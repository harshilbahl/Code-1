import type { Food } from './types.js';

/**
 * Natural-language meal parsing.
 *
 * "4 eggs, 3 rotis, 200g chicken, banana and peanut butter"
 *   → [{qty 4, food Egg}, {qty 3, food Roti}, {200 g, food Chicken}, {1, Banana}, {1, Peanut butter}]
 *
 * The parser NEVER produces nutrition numbers by itself. It only proposes matches against
 * foods in the user's database; unmatched items are returned as `unmatched` for the user to
 * resolve (pick a food or create one). Every result is shown for confirmation before logging.
 *
 * `MealParser` is an interface so an AI-backed implementation can be added in Phase 2 and
 * must return the same shape (with its own `estimated` flags).
 */

export type ParsedUnit = 'g' | 'ml' | 'count' | 'tbsp' | 'tsp' | 'cup' | 'scoop' | 'slice' | null;

export interface ParsedItem {
  raw: string;
  quantity: number | null;
  unit: ParsedUnit;
  term: string;
  match: Food | null;
  /** Servings of `match` implied by the quantity, when it can be computed without guessing. */
  servings: number | null;
  confidence: 'high' | 'medium' | 'low' | 'none';
  issues: string[];
}

export interface MealParser {
  parse(text: string, foods: Food[]): Promise<ParsedItem[]> | ParsedItem[];
}

const NUMBER_WORDS: Record<string, number> = {
  a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  half: 0.5, couple: 2,
};

const UNIT_ALIASES: Record<string, ParsedUnit> = {
  g: 'g', gm: 'g', gms: 'g', gram: 'g', grams: 'g', gr: 'g',
  kg: 'g', // converted below
  ml: 'ml', l: 'ml',
  tbsp: 'tbsp', tablespoon: 'tbsp', tablespoons: 'tbsp', tbs: 'tbsp',
  tsp: 'tsp', teaspoon: 'tsp', teaspoons: 'tsp',
  cup: 'cup', cups: 'cup',
  scoop: 'scoop', scoops: 'scoop',
  slice: 'slice', slices: 'slice',
  x: 'count', pc: 'count', pcs: 'count', piece: 'count', pieces: 'count',
};

export function splitItems(text: string): string[] {
  return text
    .replace(/\s+(?:and|with|plus|&)\s+/gi, ',')
    .split(/[,;+\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function singular(word: string): string {
  const w = word.toLowerCase();
  if (w.endsWith('ies') && w.length > 4) return w.slice(0, -3) + 'y';
  if (w.endsWith('oes')) return w.slice(0, -2);
  if (w.endsWith('ches') || w.endsWith('shes')) return w.slice(0, -2);
  if (w.endsWith('s') && !w.endsWith('ss') && w.length > 3) return w.slice(0, -1);
  return w;
}

export function normalize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map(singular)
    .filter((w) => !['of', 'the', 'some', 'cooked', 'grilled', 'boiled', 'fresh', 'medium', 'large', 'small'].includes(w));
}

export function parseQuantity(raw: string): { quantity: number | null; unit: ParsedUnit; term: string } {
  let s = raw.trim().toLowerCase();
  let quantity: number | null = null;
  let unit: ParsedUnit = null;

  // "200g chicken", "1.5 cups rice", "2x eggs", "250 ml soy milk"
  const m = s.match(/^(\d+(?:[.,]\d+)?|\d+\/\d+)\s*([a-z]+)?\b\s*(.*)$/);
  if (m) {
    const n = m[1].includes('/') ? Number(m[1].split('/')[0]) / Number(m[1].split('/')[1]) : Number(m[1].replace(',', '.'));
    quantity = n;
    const u = m[2] ? UNIT_ALIASES[m[2]] : undefined;
    if (u) {
      unit = u;
      if (m[2] === 'kg') quantity = n * 1000;
      if (m[2] === 'l') quantity = n * 1000;
      s = m[3];
    } else {
      unit = 'count';
      s = [m[2], m[3]].filter(Boolean).join(' ');
    }
  } else {
    const w = s.match(/^([a-z]+)\s+(.*)$/);
    if (w && NUMBER_WORDS[w[1]] !== undefined) {
      quantity = NUMBER_WORDS[w[1]];
      unit = 'count';
      s = w[2];
      const u = s.match(/^([a-z]+)\s+(?:of\s+)?(.*)$/);
      if (u && UNIT_ALIASES[u[1]] && UNIT_ALIASES[u[1]] !== 'count') {
        unit = UNIT_ALIASES[u[1]];
        s = u[2];
      }
    }
  }
  return { quantity, unit, term: s.replace(/^of\s+/, '').trim() };
}

/** Token-overlap score between a search term and a food's name/aliases (0..1). */
export function matchScore(term: string, food: Food): number {
  const t = normalize(term);
  if (!t.length) return 0;
  let best = 0;
  for (const name of [food.name, ...food.aliases]) {
    const n = normalize(name);
    if (!n.length) continue;
    if (n.join(' ') === t.join(' ')) return 1;
    const hits = t.filter((w) => n.includes(w)).length;
    const score = hits / Math.max(t.length, n.length) * 0.9 + (hits === t.length ? 0.1 : 0);
    best = Math.max(best, score);
  }
  return best;
}

export function bestMatch(term: string, foods: Food[]): { food: Food; score: number } | null {
  let best: { food: Food; score: number } | null = null;
  for (const f of foods) {
    const score = matchScore(term, f) + (f.favorite ? 0.01 : 0) + Math.min(f.useCount, 50) / 10000;
    if (!best || score > best.score) best = { food: f, score };
  }
  return best && best.score >= 0.34 ? best : null;
}

/** Servings of `food` for a parsed quantity — or null if it would require guessing a weight. */
export function servingsFor(food: Food, quantity: number | null, unit: ParsedUnit): { servings: number | null; issue?: string } {
  if (quantity === null) return { servings: 1, issue: 'No quantity given — assumed 1 serving' };
  const su = food.servingUnit;
  if (unit === 'g' || unit === 'ml') {
    if (su === unit) return { servings: quantity / food.servingAmount };
    if (unit === 'g' && food.gramsPerServing) return { servings: quantity / food.gramsPerServing };
    return { servings: null, issue: `Can't convert ${quantity} ${unit} to "${food.name}" servings — set servings manually` };
  }
  if (unit === 'count') {
    if (su === 'g' || su === 'ml') return { servings: null, issue: `"${quantity}" of a ${food.servingAmount} ${su} food is ambiguous — set servings manually` };
    return { servings: quantity / food.servingAmount };
  }
  if (unit && unit === su) return { servings: quantity / food.servingAmount };
  return { servings: null, issue: `Unit "${unit}" doesn't match this food's serving (${food.servingUnit}) — set servings manually` };
}

export class RuleBasedMealParser implements MealParser {
  parse(text: string, foods: Food[]): ParsedItem[] {
    return splitItems(text).map((raw) => {
      const { quantity, unit, term } = parseQuantity(raw);
      const m = bestMatch(term, foods);
      if (!m) {
        return { raw, quantity, unit, term, match: null, servings: null, confidence: 'none', issues: ['No matching food in your database'] };
      }
      const { servings, issue } = servingsFor(m.food, quantity, unit);
      const issues = issue ? [issue] : [];
      const confidence = m.score >= 0.95 && !issue ? 'high' : m.score >= 0.6 ? 'medium' : 'low';
      if (confidence === 'low') issues.push(`Weak match for "${term}" — check it's the right food`);
      return { raw, quantity, unit, term, match: m.food, servings: servings === null ? null : Math.round(servings * 100) / 100, confidence, issues };
    });
  }
}
