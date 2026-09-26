import { proposeAdjustment, type AdjustmentProposal } from './adjustment.js';
import { addDays, inRange, rangeDays } from './dates.js';
import { dayTotals, mealsOn } from './nutrition.js';
import { recoveryWindow, type RecoveryStatus } from './recovery.js';
import type { BodyWeightEntry, Exercise, ISODate, MealEntry, RecoveryEntry, Settings, Workout, WorkoutSet } from './types.js';
import { windowAverage, type Trend } from './weight.js';
import { latestEntry } from './weight.js';
import { sessionStats, workoutMuscleGroups } from './workout.js';

export interface ReportData {
  settings: Settings;
  meals: MealEntry[];
  bodyWeight: BodyWeightEntry[];
  recovery: RecoveryEntry[];
  workouts: Workout[];
  workoutSets: WorkoutSet[];
  exercises: Exercise[];
}

export interface WeeklyReport {
  weekStart: ISODate;
  weekEnd: ISODate;
  complete: boolean;
  daysElapsed: number;
  body: {
    startAvg: number | null;
    endAvg: number | null;
    change: number | null;
    trend: Trend;
    weighIns: number;
  };
  nutrition: {
    loggedDays: number;
    avgCalories: number | null;
    avgProtein: number | null;
    avgCarbs: number | null;
    avgFat: number | null;
    calorieHitDays: number;
    proteinHitDays: number;
    calorieTarget: number;
    proteinTarget: number;
    daily: { date: ISODate; calories: number; protein: number; logged: boolean }[];
  };
  training: {
    trainingDays: number;
    sessions: number;
    sets: number;
    volume: number;
    muscleGroups: string[];
    restDays: number;
  };
  recovery: RecoveryStatus;
  observations: string[];
  proposal: AdjustmentProposal;
}

/** Target in force on a given day (from the approval history), falling back to the current target. */
export function targetOn(settings: Settings, date: ISODate): { calories: number; protein: number } {
  const past = settings.targetHistory.filter((h) => h.date <= date).sort((a, b) => a.date.localeCompare(b.date));
  const last = past[past.length - 1];
  return last ? { calories: last.calories, protein: last.protein } : { calories: settings.calorieTarget, protein: settings.proteinTarget };
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const r0 = (n: number | null) => (n === null ? null : Math.round(n));

export function buildWeeklyReport(data: ReportData, weekStart: ISODate, today: ISODate): WeeklyReport {
  const { settings } = data;
  const weekEnd = addDays(weekStart, 6);
  const complete = weekEnd < today;
  const lastDay = complete ? weekEnd : today;
  const days = rangeDays(weekStart, 7).filter((d) => d <= lastDay);

  // --- Body weight: this week's 7-day average vs the previous week's.
  const endW = windowAverage(data.bodyWeight, weekEnd);
  const startW = windowAverage(data.bodyWeight, addDays(weekStart, -1));
  const twoAgo = windowAverage(data.bodyWeight, addDays(weekStart, -8));
  const change = endW.average !== null && startW.average !== null ? Math.round((endW.average - startW.average) * 100) / 100 : null;
  const trend: Trend = change === null ? 'unknown' : Math.abs(change) < 0.1 ? 'flat' : change > 0 ? 'up' : 'down';

  // --- Nutrition: averages over LOGGED days only (unlogged days are not zeros).
  const daily = days.map((d) => {
    const t = dayTotals(data.meals, d);
    return { date: d, calories: t.calories, protein: t.protein, carbs: t.carbs, fat: t.fat, logged: mealsOn(data.meals, d).length > 0 };
  });
  const logged = daily.filter((d) => d.logged);
  const threshold = settings.targetHitThreshold / 100;
  const calorieHitDays = logged.filter((d) => d.calories >= targetOn(settings, d.date).calories * threshold).length;
  const proteinHitDays = logged.filter((d) => d.protein >= targetOn(settings, d.date).protein * threshold).length;
  const avgCalories = avg(logged.map((d) => d.calories));
  const avgProtein = avg(logged.map((d) => d.protein));

  // --- Training.
  const exMap = new Map(data.exercises.map((e) => [e.id, e]));
  const weekWorkouts = data.workouts.filter((w) => w.status === 'done' && inRange(w.date, weekStart, weekEnd));
  const bw = latestEntry(data.bodyWeight, weekEnd)?.weightKg ?? null;
  let sets = 0;
  let volume = 0;
  const groups = new Set<string>();
  for (const w of weekWorkouts) {
    const s = sessionStats(w, data.workoutSets, exMap, bw);
    sets += s.totalSets;
    volume += s.volume;
    workoutMuscleGroups(w, data.workoutSets, exMap).forEach((g) => groups.add(g));
  }
  const trainingDays = new Set(weekWorkouts.map((w) => w.date)).size;

  const recovery = recoveryWindow(data.recovery, weekStart, weekEnd);

  const proposal = proposeAdjustment({
    goal: settings.goal,
    calorieTarget: settings.calorieTarget,
    weightAvgThisWeek: endW.average,
    weightAvgLastWeek: startW.average,
    weightAvgTwoWeeksAgo: twoAgo.average,
    avgCalories,
    nutritionLoggedDays: logged.length,
    underRecovered: recovery.consistentlyUnderRecovered,
  });

  const report: WeeklyReport = {
    weekStart,
    weekEnd,
    complete,
    daysElapsed: days.length,
    body: { startAvg: startW.average, endAvg: endW.average, change, trend, weighIns: endW.count },
    nutrition: {
      loggedDays: logged.length,
      avgCalories: r0(avgCalories),
      avgProtein: r0(avgProtein),
      avgCarbs: r0(avg(logged.map((d) => d.carbs))),
      avgFat: r0(avg(logged.map((d) => d.fat))),
      calorieHitDays,
      proteinHitDays,
      calorieTarget: settings.calorieTarget,
      proteinTarget: settings.proteinTarget,
      daily: daily.map(({ date, calories, protein, logged: l }) => ({ date, calories, protein, logged: l })),
    },
    training: {
      trainingDays,
      sessions: weekWorkouts.length,
      sets,
      volume: Math.round(volume),
      muscleGroups: [...groups],
      restDays: days.length - trainingDays,
    },
    recovery,
    observations: [],
    proposal,
  };
  report.observations = observations(report, settings.targetHitThreshold);
  return report;
}

/** Plain, data-based statements. Every sentence cites the numbers it came from. */
export function observations(r: WeeklyReport, hitThreshold: number): string[] {
  const o: string[] = [];
  const b = r.body;
  if (b.startAvg !== null && b.endAvg !== null && b.change !== null) {
    const verb = b.trend === 'flat' ? 'was essentially unchanged' : b.change > 0 ? 'increased' : 'decreased';
    o.push(`Your 7-day average ${verb} from ${b.startAvg.toFixed(1)} kg to ${b.endAvg.toFixed(1)} kg (${b.change > 0 ? '+' : ''}${b.change.toFixed(2)} kg).`);
  } else {
    o.push(`Not enough weigh-ins to compare weekly averages (${b.weighIns} this week; 3+ per week needed).`);
  }
  const n = r.nutrition;
  if (n.loggedDays > 0 && n.avgCalories !== null) {
    o.push(`Average intake was ${n.avgCalories.toLocaleString()} kcal/day and ${n.avgProtein} g protein/day across ${n.loggedDays} logged day${n.loggedDays === 1 ? '' : 's'}.`);
    o.push(`Calorie target reached on ${n.calorieHitDays}/${n.loggedDays} logged days; protein target on ${n.proteinHitDays}/${n.loggedDays} (≥${hitThreshold}% of target).`);
    if (n.loggedDays < r.daysElapsed) o.push(`${r.daysElapsed - n.loggedDays} day(s) had no food logged and are excluded from averages, not counted as zero.`);
  } else {
    o.push('No meals logged this week.');
  }
  const t = r.training;
  o.push(`${t.sessions} session${t.sessions === 1 ? '' : 's'} completed over ${t.trainingDays} training day${t.trainingDays === 1 ? '' : 's'}: ${t.sets} working sets, ${t.volume.toLocaleString()} kg volume.`);
  const rc = r.recovery;
  if (rc.loggedDays > 0) {
    o.push(`Average sleep ${rc.avgSleep ?? '–'} h, energy ${rc.avgEnergy ?? '–'}/5, soreness ${rc.avgSoreness ?? '–'}/5 over ${rc.loggedDays} logged day${rc.loggedDays === 1 ? '' : 's'}.`);
    if (rc.consistentlyUnderRecovered) o.push(`Recovery markers were below threshold on ${rc.flaggedDays} of ${rc.loggedDays} logged days.`);
  }
  return o;
}
