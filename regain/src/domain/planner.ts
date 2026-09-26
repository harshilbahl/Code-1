import { foodMacros, sumMacros } from './nutrition.js';
import type { Food, Macros, MealPlan, PlanDay, PlanItem, PlanMeal, SubstitutionGroup, Weekday } from './types.js';

/**
 * Substitutions keep the macro that defines the food's role constant:
 *   protein foods  ↔ matched on protein grams   (chicken ↔ fish ↔ eggs ↔ tofu)
 *   carb foods     ↔ matched on carb grams      (rice ↔ roti ↔ potatoes ↔ pasta)
 *   milk           ↔ matched on volume          (soy ↔ oat ↔ almond)
 *   fat / fruit / other ↔ matched on calories
 */
export const GROUP_BASIS: Record<SubstitutionGroup, keyof Macros | 'servings'> = {
  protein: 'protein',
  carb: 'carbs',
  milk: 'servings',
  fat: 'calories',
  fruit: 'calories',
  other: 'calories',
};

export const GROUP_LABEL: Record<SubstitutionGroup, string> = {
  protein: 'Protein',
  carb: 'Carbs',
  milk: 'Milk (dairy-free)',
  fat: 'Fats',
  fruit: 'Fruit',
  other: 'Other',
};

const roundServing = (n: number) => Math.max(0.25, Math.round(n * 4) / 4);

export function substitute(item: PlanItem, from: Food, to: Food): PlanItem {
  const basis = from.group ? GROUP_BASIS[from.group] : 'calories';
  if (basis === 'servings') {
    // volume-for-volume when both are measured in the same unit
    const fromAmt = from.servingAmount * item.servings;
    const servings = to.servingUnit === from.servingUnit ? fromAmt / to.servingAmount : item.servings;
    return { foodId: to.id, servings: roundServing(servings) };
  }
  const target = from[basis] * item.servings;
  const per = to[basis];
  const servings = per > 0 ? target / per : item.servings;
  return { foodId: to.id, servings: roundServing(servings) };
}

export function substitutesFor(food: Food, foods: Food[]): Food[] {
  if (!food.group) return [];
  return foods.filter((f) => f.id !== food.id && f.group === food.group && f.dairyFree).sort((a, b) => a.name.localeCompare(b.name));
}

export function itemMacros(item: PlanItem, foods: Map<string, Food>): Macros | null {
  const f = foods.get(item.foodId);
  return f ? foodMacros(f, item.servings) : null;
}

export function mealMacros(meal: PlanMeal, foods: Map<string, Food>): Macros {
  return sumMacros(meal.items.map((i) => itemMacros(i, foods)).filter((m): m is Macros => m !== null));
}

export function dayMacros(day: PlanDay, foods: Map<string, Food>): Macros {
  return sumMacros(day.meals.map((m) => mealMacros(m, foods)));
}

export function planDay(plan: MealPlan, weekday: Weekday): PlanDay | undefined {
  return plan.days.find((d) => d.weekday === weekday);
}

/**
 * Scale carb- and fat-group servings so the day lands near the calorie target while leaving
 * protein foods untouched. Returns a new day; the caller decides whether to save it.
 */
export function fitDayToTarget(day: PlanDay, foods: Map<string, Food>, calorieTarget: number): PlanDay {
  const total = dayMacros(day, foods).calories;
  let flexible = 0;
  for (const meal of day.meals) {
    for (const it of meal.items) {
      const f = foods.get(it.foodId);
      if (f && (f.group === 'carb' || f.group === 'fat' || f.group === 'fruit')) flexible += f.calories * it.servings;
    }
  }
  if (flexible <= 0) return day;
  const factor = Math.max(0.25, (flexible + (calorieTarget - total)) / flexible);
  return {
    ...day,
    meals: day.meals.map((meal) => ({
      ...meal,
      items: meal.items.map((it) => {
        const f = foods.get(it.foodId);
        if (!f || !(f.group === 'carb' || f.group === 'fat' || f.group === 'fruit')) return it;
        return { ...it, servings: roundServing(it.servings * factor) };
      }),
    })),
  };
}
