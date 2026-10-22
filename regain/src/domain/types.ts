// Core data model. Every persisted record has a string `id` and `updatedAt`
// so a future cloud-sync layer can do last-write-wins merging per record.

export type ISODate = string; // local calendar day, YYYY-MM-DD
export type Timestamp = number; // epoch ms

export interface BaseRecord {
  id: string;
  updatedAt: Timestamp;
}

export type Goal = 'gain' | 'maintain' | 'lose';
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'high' | 'very_high';
export type Sex = 'male' | 'female' | 'unspecified';

export interface UserProfile extends BaseRecord {
  name: string;
  age: number;
  heightCm: number;
  sex: Sex;
  /** Approximate starting weight from the intake profile — not a weigh-in. */
  startWeightKg: number;
  startDate: ISODate;
  trainingYears: number;
  dietaryNotes: string;
}

export interface TargetChange {
  date: ISODate;
  calories: number;
  protein: number;
  reason: string;
}

export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0 = Sunday

export interface Settings extends BaseRecord {
  goal: Goal;
  activityLevel: ActivityLevel;
  calorieTarget: number;
  proteinTarget: number;
  carbTarget: number | null;
  fatTarget: number | null;
  /** First day of the reporting week. */
  weekStartsOn: Weekday;
  /** Preferred split: weekday -> label (e.g. "Back"); empty string = rest. */
  split: Record<Weekday, string>;
  targetHistory: TargetChange[];
  /** Percentage of target that counts as "reached" in reports. */
  targetHitThreshold: number;
}

export type ServingUnit = 'g' | 'ml' | 'piece' | 'tbsp' | 'tsp' | 'cup' | 'scoop' | 'slice' | 'serving';

export type FoodSource = 'reference' | 'user' | 'label';

export interface Food extends BaseRecord {
  name: string;
  aliases: string[];
  servingAmount: number;
  servingUnit: ServingUnit;
  /** Grams in one serving when the unit is not already grams (enables "150g chicken" style entry). */
  gramsPerServing: number | null;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  /** reference = typical published value (approximate); user = entered by the user; label = from a packaging label. */
  source: FoodSource;
  favorite: boolean;
  /** Substitution group used by the diet planner (e.g. "protein", "carb", "milk"). */
  group: SubstitutionGroup | null;
  dairyFree: boolean;
  lastUsedAt: Timestamp | null;
  useCount: number;
}

export type SubstitutionGroup = 'protein' | 'carb' | 'milk' | 'fat' | 'fruit' | 'other';

export const MEAL_TYPES = ['breakfast', 'lunch', 'pre_workout', 'post_workout', 'dinner', 'snack'] as const;
export type MealType = (typeof MEAL_TYPES)[number];

export interface Macros {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface MealEntry extends BaseRecord, Macros {
  date: ISODate;
  mealType: MealType;
  foodId: string | null;
  name: string;
  /** Number of servings of the food (1 for custom one-off entries). */
  servings: number;
  /** Human readable quantity, e.g. "200 g" or "4 piece". */
  quantityLabel: string;
  /** True if any value is an estimate/reference value rather than user-verified. */
  estimated: boolean;
  createdAt: Timestamp;
}

export type MuscleGroup =
  | 'back'
  | 'chest'
  | 'shoulders'
  | 'arms'
  | 'biceps'
  | 'triceps'
  | 'legs'
  | 'quads'
  | 'hamstrings'
  | 'glutes'
  | 'calves'
  | 'traps'
  | 'rear_delts'
  | 'core'
  | 'other';

export interface Exercise extends BaseRecord {
  name: string;
  muscleGroup: MuscleGroup;
  /** Logged reps are per side; volume counts both sides (see volume.ts). */
  unilateral: boolean;
  /** Load = body weight + added weight (e.g. pull-ups, dips). */
  bodyweight: boolean;
  compound: boolean;
  alternatives: string[]; // exercise ids
}

export interface WorkoutExercise {
  id: string;
  exerciseId: string;
  targetSets: number;
  repMin: number;
  repMax: number;
  rirMin: number;
  rirMax: number;
  restSec: number;
  optional: boolean;
  notes: string;
}

export type WorkoutStatus = 'planned' | 'active' | 'done';

export interface Workout extends BaseRecord {
  date: ISODate;
  title: string;
  split: string;
  status: WorkoutStatus;
  exercises: WorkoutExercise[];
  startedAt: Timestamp | null;
  completedAt: Timestamp | null;
  notes: string;
  /** Body weight used for bodyweight-exercise volume, captured at completion. */
  bodyweightKg: number | null;
}

export interface WorkoutSet extends BaseRecord {
  workoutId: string;
  workoutExerciseId: string;
  exerciseId: string;
  setIndex: number;
  weight: number | null;
  reps: number | null;
  rir: number | null;
  done: boolean;
  notes: string;
  completedAt: Timestamp | null;
}

export interface WorkoutTemplate extends BaseRecord {
  name: string;
  split: string;
  exercises: Omit<WorkoutExercise, 'id'>[];
}

export interface BodyWeightEntry extends BaseRecord {
  date: ISODate;
  weightKg: number;
  note: string;
}

export interface RecoveryEntry extends BaseRecord {
  date: ISODate;
  sleepHours: number | null;
  sleepQuality: number | null; // 1-5
  energy: number | null; // 1-5
  soreness: number | null; // 1-5 (5 = very sore)
  stress: number | null; // 1-5 (5 = very stressed)
  steps: number | null;
  waterL: number | null;
}

export type ProposalStatus = 'pending' | 'approved' | 'declined' | 'none';

export interface WeeklyReportRecord extends BaseRecord {
  weekStart: ISODate;
  generatedAt: Timestamp;
  proposedCalories: number | null;
  proposedProtein: number | null;
  proposalSummary: string;
  status: ProposalStatus;
  decidedAt: Timestamp | null;
}

export interface PlanItem {
  foodId: string;
  servings: number;
}

export interface PlanMeal {
  mealType: MealType;
  title: string;
  items: PlanItem[];
}

export interface PlanDay {
  weekday: Weekday;
  meals: PlanMeal[];
}

export interface MealPlan extends BaseRecord {
  name: string;
  days: PlanDay[];
}

/** All collections. Names map 1:1 to IndexedDB object stores and to backup JSON keys. */
export interface Collections {
  userProfile: UserProfile;
  settings: Settings;
  foods: Food;
  meals: MealEntry;
  exercises: Exercise;
  workouts: Workout;
  workoutSets: WorkoutSet;
  workoutTemplates: WorkoutTemplate;
  bodyWeight: BodyWeightEntry;
  recovery: RecoveryEntry;
  weeklyReports: WeeklyReportRecord;
  mealPlans: MealPlan;
}

export type CollectionName = keyof Collections;

export const COLLECTIONS: CollectionName[] = [
  'userProfile',
  'settings',
  'foods',
  'meals',
  'exercises',
  'workouts',
  'workoutSets',
  'workoutTemplates',
  'bodyWeight',
  'recovery',
  'weeklyReports',
  'mealPlans',
];
