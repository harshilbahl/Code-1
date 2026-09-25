import type { Goal } from './types.js';

/**
 * Weekly calorie-target adjustment. Produces a PROPOSAL only — the user must approve it
 * before any target changes. Rules are intentionally conservative and every output
 * says which numbers it was based on.
 */

export interface AdjustmentInput {
  goal: Goal;
  calorieTarget: number;
  /** 7-day weight averages: this week, last week, the week before (null = not enough weigh-ins). */
  weightAvgThisWeek: number | null;
  weightAvgLastWeek: number | null;
  weightAvgTwoWeeksAgo: number | null;
  avgCalories: number | null;
  nutritionLoggedDays: number;
  underRecovered: boolean;
}

export type AdjustmentKind = 'insufficient_data' | 'adherence' | 'review' | 'increase' | 'decrease' | 'hold';

export interface AdjustmentProposal {
  kind: AdjustmentKind;
  /** Proposed new daily calorie target, or null when no change is proposed. */
  proposedCalories: number | null;
  delta: number;
  range: [number, number] | null;
  confidence: 'low' | 'moderate';
  headline: string;
  reasons: string[];
}

export const ADJUSTMENT_RULES = {
  minNutritionDays: 4,
  adherenceRatio: 0.9,
  flatKgPerWeek: 0.1,
  /** Faster than this (kg/week) is flagged for review rather than acted on. */
  fastGainKgPerWeek: 0.75,
  fastLossKgPerWeek: 1.0,
  maintainBandKg: 0.2,
};

const fmtKg = (n: number) => `${n > 0 ? '+' : ''}${n.toFixed(2)} kg`;
const round10 = (n: number) => Math.round(n / 10) * 10;

export function proposeAdjustment(i: AdjustmentInput): AdjustmentProposal {
  const R = ADJUSTMENT_RULES;
  const none = (kind: AdjustmentKind, headline: string, reasons: string[]): AdjustmentProposal => ({
    kind,
    proposedCalories: null,
    delta: 0,
    range: null,
    confidence: 'low',
    headline,
    reasons,
  });
  const change = (delta: number, range: [number, number], confidence: 'low' | 'moderate', headline: string, reasons: string[]): AdjustmentProposal => ({
    kind: delta > 0 ? 'increase' : 'decrease',
    proposedCalories: round10(i.calorieTarget + delta),
    delta,
    range,
    confidence,
    headline,
    reasons,
  });

  if (i.weightAvgThisWeek === null || i.weightAvgLastWeek === null) {
    return none('insufficient_data', 'Not enough weigh-ins to judge the trend', [
      'A proposal needs at least 3 morning weigh-ins in each of the last two weeks.',
      'No change proposed.',
    ]);
  }

  const rate = Math.round((i.weightAvgThisWeek - i.weightAvgLastWeek) * 100) / 100;
  const prevRate = i.weightAvgTwoWeeksAgo !== null ? Math.round((i.weightAvgLastWeek - i.weightAvgTwoWeeksAgo) * 100) / 100 : null;
  const reasons: string[] = [`Weekly average changed ${fmtKg(rate)} (${i.weightAvgLastWeek.toFixed(2)} → ${i.weightAvgThisWeek.toFixed(2)} kg).`];

  // Rapid changes are flagged, never auto-corrected with a large jump.
  if (i.goal === 'gain' && rate > R.fastGainKgPerWeek) {
    return none('review', 'Weight rose faster than expected — review before changing anything', [
      ...reasons,
      `That is above ${R.fastGainKgPerWeek} kg/week. After a recent deficit, part of early regain is commonly water and glycogen, so a single fast week is not a reliable signal.`,
      'No automatic change proposed. Check the weigh-in conditions (same time, after waking) and review again next week.',
    ]);
  }
  if (rate < -R.fastLossKgPerWeek) {
    return none('review', 'Weight dropped faster than expected — review', [
      ...reasons,
      `That is a faster drop than ${R.fastLossKgPerWeek} kg/week. Check intake logging and illness/travel before changing targets.`,
    ]);
  }

  if (i.nutritionLoggedDays < R.minNutritionDays || i.avgCalories === null) {
    return none('insufficient_data', 'Log more days of food before changing targets', [
      ...reasons,
      `Only ${i.nutritionLoggedDays} of 7 days had food logged (needs ${R.minNutritionDays}+). Without intake data the trend can't be attributed to the target.`,
    ]);
  }
  reasons.push(`Average logged intake: ${Math.round(i.avgCalories).toLocaleString()} kcal/day over ${i.nutritionLoggedDays} days (target ${i.calorieTarget.toLocaleString()}).`);

  const adherent = i.avgCalories >= i.calorieTarget * R.adherenceRatio;
  if (i.underRecovered) reasons.push('Recovery markers were low on most logged days; adequate food and sleep matter more than extra training volume right now.');

  if (i.goal === 'gain') {
    if (rate >= R.flatKgPerWeek) {
      return { ...none('hold', 'On track — keep the current target', [...reasons, 'Weight is trending up at a moderate rate.']), confidence: 'moderate' };
    }
    if (!adherent) {
      return none('adherence', 'Hit the current target before raising it', [
        ...reasons,
        `Intake was ${Math.round(i.calorieTarget - i.avgCalories)} kcal/day below target. Raising the target would not change what was eaten; consistency with the current target is the first lever.`,
      ]);
    }
    if (rate < -R.flatKgPerWeek) {
      return change(250, [200, 300], 'moderate', 'Weight is dropping despite hitting target — consider a larger increase', [
        ...reasons,
        'Goal is gain but the weekly average fell while intake was on target.',
      ]);
    }
    const twoFlat = prevRate !== null && prevRate < R.flatKgPerWeek;
    if (twoFlat) {
      return change(200, [150, 250], 'moderate', 'Two flat weeks in a row — consider a modest increase', [
        ...reasons,
        `Previous week also changed ${fmtKg(prevRate as number)}. A 150–250 kcal/day increase is a modest step.`,
      ]);
    }
    return change(150, [150, 250], 'low', 'Flat week — a small increase is an option', [
      ...reasons,
      'Only one flat week so far; one more flat week would make this a stronger signal. Approving now is reasonable if you want faster regain.',
    ]);
  }

  if (i.goal === 'maintain') {
    if (Math.abs(rate) <= R.maintainBandKg) return { ...none('hold', 'Stable — keep the current target', reasons), confidence: 'moderate' };
    if (!adherent && rate < 0) return none('adherence', 'Hit the current target first', reasons);
    return rate > 0
      ? change(-150, [-200, -100], 'low', 'Drifting up — consider a small reduction', reasons)
      : change(150, [100, 200], 'low', 'Drifting down — consider a small increase', reasons);
  }

  // lose
  if (rate <= -R.flatKgPerWeek) return { ...none('hold', 'On track — keep the current target', reasons), confidence: 'moderate' };
  return change(-150, [-200, -100], 'low', 'Weight is not dropping — consider a small reduction', reasons);
}
