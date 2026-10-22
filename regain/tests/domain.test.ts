import assert from 'node:assert/strict';
import { test } from 'node:test';
import { proposeAdjustment, type AdjustmentInput } from '../src/domain/adjustment.js';
import { addDays, dateKey, startOfWeek } from '../src/domain/dates.js';
import { RuleBasedMealParser, parseQuantity, splitItems } from '../src/domain/mealParser.js';
import { dayTotals, foodMacros, quantityLabel, sumMacros } from '../src/domain/nutrition.js';
import { fitDayToTarget, dayMacros, substitute } from '../src/domain/planner.js';
import { recoveryLast7 } from '../src/domain/recovery.js';
import { buildWeeklyReport } from '../src/domain/report.js';
import { SEED_EXERCISES, SEED_FOODS, defaultMealPlan, defaultSettings } from '../src/domain/seed.js';
import type { BodyWeightEntry, Exercise, MealEntry, RecoveryEntry, Workout, WorkoutSet } from '../src/domain/types.js';
import { weightTrend, windowAverage } from '../src/domain/weight.js';
import { estimated1RM, exercisePRs, previousPerformance, sessionPRs, sessionStats, setVolume } from '../src/domain/workout.js';

const food = (id: string) => SEED_FOODS.find((f) => f.id === id)!;
const exMap = new Map<string, Exercise>(SEED_EXERCISES.map((e) => [e.id, e]));

function meal(date: string, calories: number, protein: number, carbs = 0, fat = 0): MealEntry {
  return {
    id: Math.random().toString(36), updatedAt: 0, createdAt: 0, date, mealType: 'lunch', foodId: null, name: 'x',
    servings: 1, quantityLabel: '1', estimated: false, calories, protein, carbs, fat,
  };
}

const bw = (date: string, weightKg: number): BodyWeightEntry => ({ id: date, updatedAt: 0, date, weightKg, note: '' });

// ---------------------------------------------------------------- nutrition
test('meal totals add calories and macros correctly', () => {
  const eggs = foodMacros(food('food-egg'), 4);
  assert.deepEqual(eggs, { calories: 288, protein: 25.2, carbs: 1.6, fat: 19.2 });
  const chicken = foodMacros(food('food-chicken-cooked'), 2); // 200 g
  assert.deepEqual(chicken, { calories: 330, protein: 62, carbs: 0, fat: 7.2 });
  const total = sumMacros([eggs, chicken]);
  assert.deepEqual(total, { calories: 618, protein: 87.2, carbs: 1.6, fat: 26.4 });
});

test('day totals only include that date', () => {
  const meals = [meal('2026-09-25', 500, 40, 50, 10), meal('2026-09-25', 700, 50, 80, 20), meal('2026-09-24', 999, 99)];
  assert.deepEqual(dayTotals(meals, '2026-09-25'), { calories: 1200, protein: 90, carbs: 130, fat: 30 });
});

test('quantity labels', () => {
  assert.equal(quantityLabel(food('food-chicken-cooked'), 2), '200 g');
  assert.equal(quantityLabel(food('food-egg'), 4), '4 pieces');
});

// ---------------------------------------------------------------- volume
test('volume = weight × reps; unilateral counts both sides; bodyweight adds BW', () => {
  const tbar = exMap.get('ex-tbar-row');
  assert.equal(setVolume({ weight: 80, reps: 8, done: true }, tbar, 60), 640);
  assert.equal(setVolume({ weight: 80, reps: 8, done: false }, tbar, 60), 0);
  const single = exMap.get('ex-single-arm-pulldown');
  assert.equal(setVolume({ weight: 30, reps: 10, done: true }, single, 60), 600);
  const pullup = exMap.get('ex-weighted-pullup');
  assert.equal(setVolume({ weight: 20, reps: 6, done: true }, pullup, 60), 480);
});

function workout(id: string, date: string, status: Workout['status'] = 'done'): Workout {
  return {
    id, updatedAt: 0, date, title: 'Back', split: 'Back', status, startedAt: 0, completedAt: 1, notes: '', bodyweightKg: 60,
    exercises: [{ id: id + '-we', exerciseId: 'ex-tbar-row', targetSets: 4, repMin: 6, repMax: 8, rirMin: 1, rirMax: 2, restSec: 150, optional: false, notes: '' }],
  };
}
function set(workoutId: string, i: number, weight: number, reps: number, rir = 1, done = true): WorkoutSet {
  return { id: `${workoutId}-${i}`, updatedAt: 0, workoutId, workoutExerciseId: workoutId + '-we', exerciseId: 'ex-tbar-row', setIndex: i, weight, reps, rir, done, notes: '', completedAt: 0 };
}

test('T-Bar example: totals, volume and previous-session comparison', () => {
  const w1 = workout('w1', '2026-09-18');
  const w2 = workout('w2', '2026-09-25', 'active');
  const sets = [set('w1', 0, 80, 8, 2), set('w1', 1, 80, 8, 1), set('w1', 2, 75, 10, 1), set('w1', 3, 70, 12, 0), set('w2', 0, 82.5, 8)];
  const s1 = sessionStats(w1, sets, exMap, 60);
  assert.equal(s1.totalSets, 4);
  assert.equal(s1.totalReps, 38);
  assert.equal(s1.volume, 80 * 8 + 80 * 8 + 75 * 10 + 70 * 12); // 2870
  assert.equal(s1.completion, 1);
  const prev = previousPerformance('ex-tbar-row', w2, [w1, w2], sets, exMap.get('ex-tbar-row'));
  assert.ok(prev);
  assert.equal(prev!.workout.id, 'w1');
  assert.equal(prev!.sets.length, 4);
  assert.equal(prev!.volume, 2870);
  const s2 = sessionStats(w2, sets, exMap, 60);
  assert.equal(s2.completion, 0.25);
});

test('PRs: heaviest load, e1RM (estimated) and only after a prior session exists', () => {
  const w1 = workout('w1', '2026-09-18');
  const w2 = workout('w2', '2026-09-25');
  const sets = [set('w1', 0, 80, 8), set('w2', 0, 85, 6)];
  const prs = exercisePRs('ex-tbar-row', [w1, w2], sets, exMap.get('ex-tbar-row'));
  assert.equal(prs.heaviest?.load, 85);
  assert.equal(estimated1RM(80, 8), 101.3);
  const s = sessionPRs('w2', [w1, w2], sets, exMap);
  assert.deepEqual(s, [{ exerciseId: 'ex-tbar-row', kinds: ['weight', 'e1rm'] }]); // 85×6 → e1RM 102 > 101.3
  assert.deepEqual(sessionPRs('w1', [w1], [sets[0]], exMap), []);
});

// ---------------------------------------------------------------- weight
test('7-day average needs 3 weigh-ins; trend compares week vs previous week', () => {
  const entries = [bw('2026-09-12', 59.6), bw('2026-09-14', 59.8), bw('2026-09-16', 60.0), bw('2026-09-19', 60.1), bw('2026-09-21', 60.2), bw('2026-09-23', 60.4)];
  const cur = windowAverage(entries, '2026-09-25');
  assert.equal(cur.count, 3);
  assert.equal(cur.average, 60.23);
  const t = weightTrend(entries, '2026-09-25');
  assert.equal(t.previous.average, 59.8);
  assert.equal(t.trend, 'up');
  assert.equal(weightTrend(entries.slice(-2), '2026-09-25').trend, 'unknown');
});

// ---------------------------------------------------------------- recovery
test('consistent under-recovery flag', () => {
  const r = (date: string, sleepHours: number, energy: number): RecoveryEntry => ({ id: date, updatedAt: 0, date, sleepHours, sleepQuality: 3, energy, soreness: 2, stress: 2, steps: null, waterL: null });
  const good = [r('2026-09-22', 8, 4), r('2026-09-23', 8, 4), r('2026-09-24', 7.5, 4)];
  assert.equal(recoveryLast7(good, '2026-09-25').consistentlyUnderRecovered, false);
  const bad = [r('2026-09-21', 5.5, 2), r('2026-09-22', 6, 3), r('2026-09-23', 8, 2), r('2026-09-24', 7.5, 4)];
  const s = recoveryLast7(bad, '2026-09-25');
  assert.equal(s.flaggedDays, 3);
  assert.equal(s.consistentlyUnderRecovered, true);
});

// ---------------------------------------------------------------- adjustment
const base: AdjustmentInput = {
  goal: 'gain', calorieTarget: 2400, weightAvgThisWeek: 60.05, weightAvgLastWeek: 60.0, weightAvgTwoWeeksAgo: 60.0,
  avgCalories: 2380, nutritionLoggedDays: 7, underRecovered: false,
};

test('two flat weeks with good adherence → modest increase proposal (not applied)', () => {
  const p = proposeAdjustment(base);
  assert.equal(p.kind, 'increase');
  assert.equal(p.proposedCalories, 2600);
  assert.deepEqual(p.range, [150, 250]);
});

test('one flat week → smaller, low-confidence proposal', () => {
  const p = proposeAdjustment({ ...base, weightAvgTwoWeeksAgo: 59.5 });
  assert.equal(p.kind, 'increase');
  assert.equal(p.delta, 150);
  assert.equal(p.confidence, 'low');
});

test('fast gain is flagged for review, no change proposed', () => {
  const p = proposeAdjustment({ ...base, weightAvgThisWeek: 61.0 });
  assert.equal(p.kind, 'review');
  assert.equal(p.proposedCalories, null);
});

test('low adherence → no target change', () => {
  const p = proposeAdjustment({ ...base, avgCalories: 1850 });
  assert.equal(p.kind, 'adherence');
  assert.equal(p.proposedCalories, null);
});

test('insufficient data → no proposal', () => {
  assert.equal(proposeAdjustment({ ...base, weightAvgLastWeek: null }).kind, 'insufficient_data');
  assert.equal(proposeAdjustment({ ...base, nutritionLoggedDays: 2 }).kind, 'insufficient_data');
});

test('gaining at a moderate rate → hold', () => {
  assert.equal(proposeAdjustment({ ...base, weightAvgThisWeek: 60.3 }).kind, 'hold');
});

// ---------------------------------------------------------------- weekly report
test('weekly report: averages over logged days, hit counts, observations', () => {
  const settings = defaultSettings('2026-09-01');
  const ws = '2026-09-14'; // Monday
  const meals: MealEntry[] = [];
  for (let i = 0; i < 6; i++) meals.push(meal(addDays(ws, i), i < 4 ? 2400 : 2000, i < 5 ? 135 : 100, 300, 70));
  const bodyWeight = [bw('2026-09-08', 59.8), bw('2026-09-10', 59.8), bw('2026-09-12', 59.8), bw('2026-09-15', 60.2), bw('2026-09-17', 60.3), bw('2026-09-20', 60.4)];
  const r = buildWeeklyReport({ settings, meals, bodyWeight, recovery: [], workouts: [], workoutSets: [], exercises: SEED_EXERCISES }, ws, '2026-09-25');
  assert.equal(r.complete, true);
  assert.equal(r.nutrition.loggedDays, 6);
  assert.equal(r.nutrition.avgCalories, Math.round((2400 * 4 + 2000 * 2) / 6));
  assert.equal(r.nutrition.calorieHitDays, 4); // 2000 < 95% of 2400
  assert.equal(r.nutrition.proteinHitDays, 5);
  assert.equal(r.body.startAvg, 59.8);
  assert.equal(r.body.endAvg, 60.3);
  assert.equal(r.body.trend, 'up');
  assert.match(r.observations[0], /increased from 59\.8 kg to 60\.3 kg/);
  assert.ok(r.observations.some((o) => /1 day\(s\) had no food logged/.test(o)));
});

// ---------------------------------------------------------------- parser
test('natural-language parsing matches foods and never invents nutrition', () => {
  assert.deepEqual(splitItems('4 eggs, 3 rotis, 200g chicken, banana and peanut butter'), ['4 eggs', '3 rotis', '200g chicken', 'banana', 'peanut butter']);
  assert.deepEqual(parseQuantity('200g chicken'), { quantity: 200, unit: 'g', term: 'chicken' });
  const items = new RuleBasedMealParser().parse('4 eggs, 3 rotis, 200g chicken, banana and peanut butter, 150g dragonfruit', SEED_FOODS);
  assert.equal(items.length, 6);
  assert.equal(items[0].match?.id, 'food-egg');
  assert.equal(items[0].servings, 4);
  assert.equal(items[1].match?.id, 'food-roti');
  assert.equal(items[1].servings, 3);
  assert.equal(items[2].match?.id, 'food-chicken-cooked');
  assert.equal(items[2].servings, 2);
  assert.equal(items[3].match?.id, 'food-banana');
  assert.equal(items[4].match?.id, 'food-pb');
  assert.equal(items[5].match, null);
  assert.equal(items[5].servings, null);
  assert.equal(items[5].confidence, 'none');
});

test('ambiguous units are flagged instead of guessed', () => {
  const [item] = new RuleBasedMealParser().parse('2 chicken', SEED_FOODS);
  assert.equal(item.match?.id, 'food-chicken-cooked');
  assert.equal(item.servings, null);
  assert.ok(item.issues.length > 0);
});

// ---------------------------------------------------------------- planner
test('substitution keeps protein grams for protein foods', () => {
  const chicken = food('food-chicken-cooked');
  const eggs = food('food-egg');
  const sub = substitute({ foodId: chicken.id, servings: 1.5 }, chicken, eggs);
  // 46.5 g protein / 6.3 g per egg ≈ 7.4 → rounded to quarter servings
  assert.equal(sub.foodId, 'food-egg');
  assert.equal(sub.servings, 7.5);
  const rice = food('food-rice');
  const roti = food('food-roti');
  const r = substitute({ foodId: rice.id, servings: 2.5 }, rice, roti); // 70 g carbs / 18
  assert.equal(r.servings, 4);
});

test('fit-to-target scales flexible foods toward the calorie target', () => {
  const foods = new Map(SEED_FOODS.map((f) => [f.id, f]));
  const day = defaultMealPlan().days[0];
  const before = dayMacros(day, foods);
  const fitted = fitDayToTarget(day, foods, 2800);
  const after = dayMacros(fitted, foods);
  assert.ok(Math.abs(after.calories - 2800) < Math.abs(before.calories - 2800));
  assert.ok(Math.abs(after.calories - 2800) < 120);
  assert.equal(after.protein >= before.protein - 5, true);
});

test('dates: local keys and week start', () => {
  assert.match(dateKey(), /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(startOfWeek('2026-09-25', 1), '2026-09-21');
  assert.equal(startOfWeek('2026-09-21', 1), '2026-09-21');
  assert.equal(startOfWeek('2026-09-27', 1), '2026-09-21');
});
