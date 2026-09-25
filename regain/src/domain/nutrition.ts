import type { Food, ISODate, Macros, MealEntry, MealType, ServingUnit } from './types.js';

export const ZERO_MACROS: Macros = { calories: 0, protein: 0, carbs: 0, fat: 0 };

export function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export function addMacros(a: Macros, b: Macros): Macros {
  return {
    calories: a.calories + b.calories,
    protein: a.protein + b.protein,
    carbs: a.carbs + b.carbs,
    fat: a.fat + b.fat,
  };
}

export function scaleMacros(m: Macros, factor: number): Macros {
  return {
    calories: Math.round(m.calories * factor),
    protein: round1(m.protein * factor),
    carbs: round1(m.carbs * factor),
    fat: round1(m.fat * factor),
  };
}

export function sumMacros(items: Macros[]): Macros {
  const total = items.reduce(addMacros, ZERO_MACROS);
  return {
    calories: Math.round(total.calories),
    protein: round1(total.protein),
    carbs: round1(total.carbs),
    fat: round1(total.fat),
  };
}

export function foodMacros(food: Food, servings: number): Macros {
  return scaleMacros(food, servings);
}

export function mealsOn(meals: MealEntry[], date: ISODate): MealEntry[] {
  return meals.filter((m) => m.date === date);
}

export function dayTotals(meals: MealEntry[], date: ISODate): Macros {
  return sumMacros(mealsOn(meals, date));
}

export function totalsByMealType(meals: MealEntry[], date: ISODate): Record<MealType, Macros> {
  const out = {} as Record<MealType, Macros>;
  for (const m of mealsOn(meals, date)) {
    out[m.mealType] = sumMacros([out[m.mealType] ?? ZERO_MACROS, m]);
  }
  return out;
}

/** Calories implied by macros (4/4/9). Used to flag entries whose numbers don't add up. */
export function caloriesFromMacros(m: Omit<Macros, 'calories'>): number {
  return Math.round(m.protein * 4 + m.carbs * 4 + m.fat * 9);
}

export function unitLabel(unit: ServingUnit, amount: number): string {
  if (unit === 'g' || unit === 'ml') return `${amount} ${unit}`;
  const plural = amount === 1 ? '' : unit === 'piece' ? 's' : unit === 'serving' ? 's' : unit === 'slice' ? 's' : unit === 'scoop' ? 's' : unit === 'cup' ? 's' : '';
  return `${amount} ${unit}${plural}`;
}

export function servingLabel(food: Food): string {
  const base = unitLabel(food.servingUnit, food.servingAmount);
  if (food.gramsPerServing && food.servingUnit !== 'g') return `${base} (${food.gramsPerServing} g)`;
  return base;
}

/** "1.5 × 100 g" → "150 g"; "4 × 1 piece" → "4 pieces". */
export function quantityLabel(food: Food, servings: number): string {
  const amount = round1(food.servingAmount * servings);
  return unitLabel(food.servingUnit, amount);
}

/** Suggest the meal type from the time of day, so a quick log needs no extra tap. */
export function defaultMealType(date: Date = new Date()): MealType {
  const h = date.getHours();
  if (h < 11) return 'breakfast';
  if (h < 15) return 'lunch';
  if (h < 17) return 'snack';
  if (h < 22) return 'dinner';
  return 'snack';
}

export const MEAL_TYPE_LABEL: Record<MealType, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  pre_workout: 'Pre-workout',
  post_workout: 'Post-workout',
  dinner: 'Dinner',
  snack: 'Snack',
};
