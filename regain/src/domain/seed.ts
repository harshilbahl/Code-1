import { dateKey } from './dates.js';
import type {
  Exercise,
  Food,
  MealPlan,
  PlanDay,
  PlanMeal,
  Settings,
  UserProfile,
  Weekday,
  Workout,
  WorkoutTemplate,
} from './types.js';

/**
 * Starter data. Food values are TYPICAL REFERENCE VALUES (rounded from standard
 * food-composition tables) and are marked `source: 'reference'` so the UI labels them as
 * approximate. Brands vary — the user can edit any food to match their packaging.
 */

type FoodSeed = Omit<Food, 'updatedAt' | 'favorite' | 'lastUsedAt' | 'useCount' | 'source' | 'dairyFree' | 'aliases'> & {
  aliases?: string[];
  favorite?: boolean;
};

const F = (f: FoodSeed): Food => ({
  aliases: [],
  favorite: false,
  lastUsedAt: null,
  useCount: 0,
  source: 'reference',
  dairyFree: true,
  updatedAt: 0,
  ...f,
});

export const SEED_FOODS: Food[] = [
  F({ id: 'food-egg', name: 'Egg (large)', aliases: ['egg', 'eggs', 'whole egg'], servingAmount: 1, servingUnit: 'piece', gramsPerServing: 50, calories: 72, protein: 6.3, carbs: 0.4, fat: 4.8, group: 'protein', favorite: true }),
  F({ id: 'food-chicken-cooked', name: 'Chicken breast (cooked)', aliases: ['chicken', 'chicken breast', 'grilled chicken'], servingAmount: 100, servingUnit: 'g', gramsPerServing: null, calories: 165, protein: 31, carbs: 0, fat: 3.6, group: 'protein', favorite: true }),
  F({ id: 'food-chicken-raw', name: 'Chicken breast (raw weight)', aliases: ['raw chicken'], servingAmount: 100, servingUnit: 'g', gramsPerServing: null, calories: 120, protein: 22.5, carbs: 0, fat: 2.6, group: 'protein' }),
  F({ id: 'food-salmon', name: 'Salmon (cooked)', aliases: ['salmon', 'fish'], servingAmount: 100, servingUnit: 'g', gramsPerServing: null, calories: 206, protein: 22, carbs: 0, fat: 12, group: 'protein' }),
  F({ id: 'food-whitefish', name: 'White fish, cod (cooked)', aliases: ['cod', 'white fish', 'basa', 'tilapia'], servingAmount: 100, servingUnit: 'g', gramsPerServing: null, calories: 105, protein: 23, carbs: 0, fat: 0.9, group: 'protein' }),
  F({ id: 'food-tuna', name: 'Tuna, canned in water (drained)', aliases: ['tuna'], servingAmount: 100, servingUnit: 'g', gramsPerServing: null, calories: 116, protein: 26, carbs: 0, fat: 1, group: 'protein' }),
  F({ id: 'food-beef-lean', name: 'Lean beef mince 5% (cooked)', aliases: ['beef', 'mince', 'ground beef', 'keema'], servingAmount: 100, servingUnit: 'g', gramsPerServing: null, calories: 175, protein: 26, carbs: 0, fat: 7.5, group: 'protein' }),
  F({ id: 'food-tofu', name: 'Tofu, firm', aliases: ['tofu'], servingAmount: 100, servingUnit: 'g', gramsPerServing: null, calories: 144, protein: 17, carbs: 3, fat: 9, group: 'protein' }),
  F({ id: 'food-pea-protein', name: 'Pea protein powder (1 scoop)', aliases: ['protein shake', 'protein powder', 'vegan protein', 'shake'], servingAmount: 1, servingUnit: 'scoop', gramsPerServing: 30, calories: 115, protein: 24, carbs: 1.5, fat: 2, group: 'protein' }),
  F({ id: 'food-lentils', name: 'Lentils / dal (cooked)', aliases: ['lentils', 'dal', 'daal'], servingAmount: 100, servingUnit: 'g', gramsPerServing: null, calories: 116, protein: 9, carbs: 20, fat: 0.4, group: 'protein' }),
  F({ id: 'food-chickpeas', name: 'Chickpeas (cooked)', aliases: ['chickpeas', 'chana', 'chole'], servingAmount: 100, servingUnit: 'g', gramsPerServing: null, calories: 164, protein: 8.9, carbs: 27, fat: 2.6, group: 'protein' }),

  F({ id: 'food-roti', name: 'Roti / chapati (whole wheat)', aliases: ['roti', 'chapati', 'phulka'], servingAmount: 1, servingUnit: 'piece', gramsPerServing: 40, calories: 120, protein: 3.1, carbs: 18, fat: 3.7, group: 'carb', favorite: true }),
  F({ id: 'food-rice', name: 'White / basmati rice (cooked)', aliases: ['rice', 'basmati', 'white rice'], servingAmount: 100, servingUnit: 'g', gramsPerServing: null, calories: 130, protein: 2.7, carbs: 28, fat: 0.3, group: 'carb', favorite: true }),
  F({ id: 'food-potato', name: 'Potato (boiled)', aliases: ['potato', 'potatoes', 'aloo'], servingAmount: 100, servingUnit: 'g', gramsPerServing: null, calories: 87, protein: 1.9, carbs: 20, fat: 0.1, group: 'carb' }),
  F({ id: 'food-sweet-potato', name: 'Sweet potato (baked)', aliases: ['sweet potato'], servingAmount: 100, servingUnit: 'g', gramsPerServing: null, calories: 90, protein: 2, carbs: 21, fat: 0.2, group: 'carb' }),
  F({ id: 'food-pasta', name: 'Pasta (cooked)', aliases: ['pasta', 'spaghetti', 'penne'], servingAmount: 100, servingUnit: 'g', gramsPerServing: null, calories: 158, protein: 5.8, carbs: 31, fat: 0.9, group: 'carb' }),
  F({ id: 'food-oats', name: 'Rolled oats (dry)', aliases: ['oats', 'oatmeal', 'porridge'], servingAmount: 40, servingUnit: 'g', gramsPerServing: null, calories: 150, protein: 5, carbs: 27, fat: 2.5, group: 'carb', favorite: true }),
  F({ id: 'food-bread', name: 'Whole wheat bread', aliases: ['bread', 'toast', 'brown bread'], servingAmount: 1, servingUnit: 'slice', gramsPerServing: 32, calories: 80, protein: 4, carbs: 14, fat: 1, group: 'carb' }),

  F({ id: 'food-soy-milk', name: 'Soy milk, unsweetened', aliases: ['soy milk', 'soya milk', 'milk'], servingAmount: 250, servingUnit: 'ml', gramsPerServing: null, calories: 80, protein: 7, carbs: 4, fat: 4, group: 'milk', favorite: true }),
  F({ id: 'food-oat-milk', name: 'Oat milk', aliases: ['oat milk'], servingAmount: 250, servingUnit: 'ml', gramsPerServing: null, calories: 120, protein: 2, carbs: 16, fat: 5, group: 'milk' }),
  F({ id: 'food-almond-milk', name: 'Almond milk, unsweetened', aliases: ['almond milk'], servingAmount: 250, servingUnit: 'ml', gramsPerServing: null, calories: 40, protein: 1, carbs: 1, fat: 3, group: 'milk' }),

  F({ id: 'food-banana', name: 'Banana (medium)', aliases: ['banana'], servingAmount: 1, servingUnit: 'piece', gramsPerServing: 118, calories: 105, protein: 1.3, carbs: 27, fat: 0.4, group: 'fruit', favorite: true }),
  F({ id: 'food-apple', name: 'Apple (medium)', aliases: ['apple'], servingAmount: 1, servingUnit: 'piece', gramsPerServing: 182, calories: 95, protein: 0.5, carbs: 25, fat: 0.3, group: 'fruit' }),
  F({ id: 'food-dates', name: 'Dates (Medjool)', aliases: ['date', 'dates', 'khajoor'], servingAmount: 1, servingUnit: 'piece', gramsPerServing: 24, calories: 66, protein: 0.4, carbs: 18, fat: 0, group: 'fruit' }),

  F({ id: 'food-pb', name: 'Peanut butter', aliases: ['peanut butter', 'pb'], servingAmount: 1, servingUnit: 'tbsp', gramsPerServing: 16, calories: 94, protein: 3.6, carbs: 3.2, fat: 8, group: 'fat', favorite: true }),
  F({ id: 'food-almonds', name: 'Almonds', aliases: ['almonds', 'badam', 'nuts'], servingAmount: 28, servingUnit: 'g', gramsPerServing: null, calories: 164, protein: 6, carbs: 6, fat: 14, group: 'fat' }),
  F({ id: 'food-olive-oil', name: 'Olive oil', aliases: ['oil', 'olive oil'], servingAmount: 1, servingUnit: 'tbsp', gramsPerServing: 13.5, calories: 119, protein: 0, carbs: 0, fat: 13.5, group: 'fat' }),
  F({ id: 'food-avocado', name: 'Avocado (half)', aliases: ['avocado'], servingAmount: 1, servingUnit: 'piece', gramsPerServing: 100, calories: 160, protein: 2, carbs: 8.5, fat: 14.7, group: 'fat' }),
  F({ id: 'food-hummus', name: 'Hummus', aliases: ['hummus'], servingAmount: 30, servingUnit: 'g', gramsPerServing: null, calories: 50, protein: 2.4, carbs: 4.3, fat: 2.9, group: 'fat' }),
  F({ id: 'food-honey', name: 'Honey', aliases: ['honey'], servingAmount: 1, servingUnit: 'tbsp', gramsPerServing: 21, calories: 64, protein: 0, carbs: 17, fat: 0, group: 'other' }),
];

type ExSeed = Omit<Exercise, 'updatedAt' | 'alternatives' | 'unilateral' | 'bodyweight' | 'compound'> & Partial<Pick<Exercise, 'alternatives' | 'unilateral' | 'bodyweight' | 'compound'>>;
const E = (e: ExSeed): Exercise => ({ alternatives: [], unilateral: false, bodyweight: false, compound: false, updatedAt: 0, ...e });

export const SEED_EXERCISES: Exercise[] = [
  // Back
  E({ id: 'ex-weighted-pullup', name: 'Weighted Pull-up', muscleGroup: 'back', bodyweight: true, compound: true, alternatives: ['ex-lat-pulldown'] }),
  E({ id: 'ex-lat-pulldown', name: 'Heavy Lat Pulldown', muscleGroup: 'back', compound: true, alternatives: ['ex-weighted-pullup'] }),
  E({ id: 'ex-tbar-row', name: 'T-Bar Row', muscleGroup: 'back', compound: true, alternatives: ['ex-barbell-row', 'ex-db-row'] }),
  E({ id: 'ex-chest-supported-row', name: 'Chest-Supported Row', muscleGroup: 'back', compound: true, alternatives: ['ex-db-row', 'ex-seated-cable-row'] }),
  E({ id: 'ex-single-arm-pulldown', name: 'Single-Arm Lat Pulldown', muscleGroup: 'back', unilateral: true, alternatives: ['ex-lat-pulldown'] }),
  E({ id: 'ex-seated-cable-row', name: 'Seated Cable Row', muscleGroup: 'back', compound: true, alternatives: ['ex-chest-supported-row'] }),
  E({ id: 'ex-straight-arm-pulldown', name: 'Straight-Arm Pulldown', muscleGroup: 'back', alternatives: [] }),
  E({ id: 'ex-reverse-pec-deck', name: 'Reverse Pec Deck', muscleGroup: 'rear_delts', alternatives: ['ex-face-pull'] }),
  E({ id: 'ex-shrug', name: 'Shrugs', muscleGroup: 'traps', alternatives: [] }),
  E({ id: 'ex-barbell-row', name: 'Barbell Row', muscleGroup: 'back', compound: true }),
  E({ id: 'ex-db-row', name: 'Single-Arm Dumbbell Row', muscleGroup: 'back', unilateral: true, compound: true }),
  E({ id: 'ex-face-pull', name: 'Face Pull', muscleGroup: 'rear_delts' }),
  // Chest
  E({ id: 'ex-bench', name: 'Barbell Bench Press', muscleGroup: 'chest', compound: true }),
  E({ id: 'ex-incline-db', name: 'Incline Dumbbell Press', muscleGroup: 'chest', compound: true }),
  E({ id: 'ex-cable-fly', name: 'Cable Fly', muscleGroup: 'chest' }),
  E({ id: 'ex-dips', name: 'Dips', muscleGroup: 'chest', bodyweight: true, compound: true }),
  // Shoulders
  E({ id: 'ex-ohp', name: 'Overhead Press', muscleGroup: 'shoulders', compound: true }),
  E({ id: 'ex-db-shoulder-press', name: 'Seated Dumbbell Shoulder Press', muscleGroup: 'shoulders', compound: true }),
  E({ id: 'ex-lateral-raise', name: 'Dumbbell Lateral Raise', muscleGroup: 'shoulders' }),
  E({ id: 'ex-cable-lateral', name: 'Single-Arm Cable Lateral Raise', muscleGroup: 'shoulders', unilateral: true }),
  // Arms
  E({ id: 'ex-barbell-curl', name: 'Barbell Curl', muscleGroup: 'biceps' }),
  E({ id: 'ex-incline-curl', name: 'Incline Dumbbell Curl', muscleGroup: 'biceps' }),
  E({ id: 'ex-hammer-curl', name: 'Hammer Curl', muscleGroup: 'biceps' }),
  E({ id: 'ex-pushdown', name: 'Triceps Pushdown', muscleGroup: 'triceps' }),
  E({ id: 'ex-oh-triceps', name: 'Overhead Triceps Extension', muscleGroup: 'triceps' }),
  E({ id: 'ex-skullcrusher', name: 'EZ-Bar Skull Crusher', muscleGroup: 'triceps' }),
  // Legs
  E({ id: 'ex-squat', name: 'Back Squat', muscleGroup: 'quads', compound: true }),
  E({ id: 'ex-rdl', name: 'Romanian Deadlift', muscleGroup: 'hamstrings', compound: true }),
  E({ id: 'ex-leg-press', name: 'Leg Press', muscleGroup: 'quads', compound: true }),
  E({ id: 'ex-bss', name: 'Bulgarian Split Squat', muscleGroup: 'quads', unilateral: true, compound: true }),
  E({ id: 'ex-leg-curl', name: 'Seated Leg Curl', muscleGroup: 'hamstrings' }),
  E({ id: 'ex-leg-ext', name: 'Leg Extension', muscleGroup: 'quads' }),
  E({ id: 'ex-calf-raise', name: 'Standing Calf Raise', muscleGroup: 'calves' }),
];

export const BACK_TEMPLATE: WorkoutTemplate = {
  id: 'tpl-back',
  updatedAt: 0,
  name: 'BACK — Width + Thickness',
  split: 'Back',
  exercises: [
    { exerciseId: 'ex-weighted-pullup', targetSets: 4, repMin: 6, repMax: 10, rirMin: 1, rirMax: 2, restSec: 150, optional: false, notes: 'Or heavy lat pulldown — tap Swap.' },
    { exerciseId: 'ex-tbar-row', targetSets: 4, repMin: 6, repMax: 8, rirMin: 1, rirMax: 2, restSec: 150, optional: false, notes: '' },
    { exerciseId: 'ex-chest-supported-row', targetSets: 3, repMin: 8, repMax: 12, rirMin: 1, rirMax: 2, restSec: 120, optional: false, notes: '' },
    { exerciseId: 'ex-single-arm-pulldown', targetSets: 3, repMin: 10, repMax: 12, rirMin: 1, rirMax: 2, restSec: 90, optional: false, notes: 'Reps are per side.' },
    { exerciseId: 'ex-seated-cable-row', targetSets: 3, repMin: 10, repMax: 12, rirMin: 1, rirMax: 2, restSec: 120, optional: false, notes: '' },
    { exerciseId: 'ex-straight-arm-pulldown', targetSets: 3, repMin: 12, repMax: 15, rirMin: 1, rirMax: 2, restSec: 75, optional: false, notes: '' },
    { exerciseId: 'ex-reverse-pec-deck', targetSets: 3, repMin: 15, repMax: 20, rirMin: 1, rirMax: 2, restSec: 60, optional: false, notes: '' },
    { exerciseId: 'ex-shrug', targetSets: 3, repMin: 10, repMax: 15, rirMin: 1, rirMax: 2, restSec: 75, optional: true, notes: 'Optional.' },
  ],
};

export function workoutFromTemplate(tpl: WorkoutTemplate, date: string, newId: () => string, now: number): Workout {
  return {
    id: newId(),
    updatedAt: now,
    date,
    title: tpl.name,
    split: tpl.split,
    status: 'planned',
    exercises: tpl.exercises.map((e) => ({ ...e, id: newId() })),
    startedAt: null,
    completedAt: null,
    notes: '',
    bodyweightKg: null,
  };
}

export function defaultProfile(today = dateKey()): UserProfile {
  return {
    id: 'me',
    updatedAt: 0,
    name: '',
    age: 33,
    heightCm: 173,
    sex: 'unspecified',
    startWeightKg: 60,
    startDate: today,
    trainingYears: 12,
    dietaryNotes: 'No dairy / milk products (gut). Easy but tasty meals.',
  };
}

export function defaultSettings(today = dateKey()): Settings {
  return {
    id: 'settings',
    updatedAt: 0,
    goal: 'gain',
    activityLevel: 'moderate',
    calorieTarget: 2400,
    proteinTarget: 130,
    carbTarget: null,
    fatTarget: null,
    weekStartsOn: 1,
    split: { 0: '', 1: 'Shoulders', 2: '', 3: 'Back', 4: 'Arms', 5: 'Legs', 6: 'Chest' } as Record<Weekday, string>,
    targetHistory: [{ date: today, calories: 2400, protein: 130, reason: 'Starting estimate (editable) — refine from weekly trend' }],
    targetHitThreshold: 95,
  };
}

const M = (mealType: PlanMeal['mealType'], title: string, items: [string, number][]): PlanMeal => ({
  mealType,
  title,
  items: items.map(([foodId, servings]) => ({ foodId, servings })),
});

const DAY_A: PlanMeal[] = [
  M('breakfast', 'Oats, soy milk, banana & PB', [['food-oats', 2], ['food-soy-milk', 1], ['food-banana', 1], ['food-pb', 1]]),
  M('lunch', 'Chicken & rice bowl', [['food-chicken-cooked', 1.5], ['food-rice', 2.5], ['food-olive-oil', 1]]),
  M('pre_workout', 'Banana & dates', [['food-banana', 1], ['food-dates', 2]]),
  M('post_workout', 'Pea protein + soy milk', [['food-pea-protein', 1], ['food-soy-milk', 1]]),
  M('dinner', 'Salmon & potatoes', [['food-salmon', 1.5], ['food-potato', 3]]),
  M('snack', 'Almonds', [['food-almonds', 1]]),
];

const DAY_B: PlanMeal[] = [
  M('breakfast', 'Eggs, roti & banana', [['food-egg', 4], ['food-roti', 2], ['food-banana', 1]]),
  M('lunch', 'Beef mince & rice', [['food-beef-lean', 1.5], ['food-rice', 2.5]]),
  M('pre_workout', 'Toast & honey', [['food-bread', 2], ['food-honey', 1]]),
  M('post_workout', 'Pea protein + banana', [['food-pea-protein', 1], ['food-banana', 1]]),
  M('dinner', 'Chicken pasta', [['food-chicken-cooked', 1.5], ['food-pasta', 2], ['food-olive-oil', 1]]),
  M('snack', 'Almonds', [['food-almonds', 1]]),
];

const DAY_C: PlanMeal[] = [
  M('breakfast', 'Oats, soy milk, PB & dates', [['food-oats', 2], ['food-soy-milk', 1], ['food-pb', 1], ['food-dates', 2]]),
  M('lunch', 'Tuna & potatoes', [['food-tuna', 1.5], ['food-potato', 3], ['food-olive-oil', 1]]),
  M('pre_workout', 'Banana & toast with honey', [['food-banana', 1], ['food-bread', 1], ['food-honey', 1]]),
  M('post_workout', 'Pea protein + soy milk', [['food-pea-protein', 1], ['food-soy-milk', 1]]),
  M('dinner', 'Tofu & rice', [['food-tofu', 2], ['food-rice', 2.5]]),
  M('snack', 'Apple & almonds', [['food-apple', 1], ['food-almonds', 1]]),
];

export function defaultMealPlan(): MealPlan {
  const rotation: Record<Weekday, PlanMeal[]> = { 1: DAY_A, 2: DAY_B, 3: DAY_C, 4: DAY_A, 5: DAY_B, 6: DAY_C, 0: DAY_A };
  const days: PlanDay[] = ([1, 2, 3, 4, 5, 6, 0] as Weekday[]).map((weekday) => ({
    weekday,
    meals: rotation[weekday].map((m) => ({ ...m, items: m.items.map((i) => ({ ...i })) })),
  }));
  return { id: 'plan-default', updatedAt: 0, name: 'Dairy-free regain plan', days };
}
