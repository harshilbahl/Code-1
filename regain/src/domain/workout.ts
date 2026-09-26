import type { Exercise, ISODate, Workout, WorkoutExercise, WorkoutSet } from './types.js';

/**
 * VOLUME DEFINITION
 *
 *   Standard exercise:    volume = weight × reps
 *   Unilateral exercise:  reps are logged PER SIDE, so
 *                         volume = weight × reps × 2   (both sides counted)
 *   Bodyweight exercise:  load = body weight + added weight
 *                         (e.g. weighted pull-up at 60 kg BW + 20 kg belt = 80 kg load)
 *
 * Only sets marked done with reps > 0 count. Weight defaults to 0 when blank.
 */
export function setLoad(set: Pick<WorkoutSet, 'weight'>, exercise: Pick<Exercise, 'bodyweight'> | undefined, bodyweightKg: number | null): number {
  const added = set.weight ?? 0;
  if (exercise?.bodyweight) return added + (bodyweightKg ?? 0);
  return added;
}

export function setVolume(
  set: Pick<WorkoutSet, 'weight' | 'reps' | 'done'>,
  exercise: Pick<Exercise, 'bodyweight' | 'unilateral'> | undefined,
  bodyweightKg: number | null,
): number {
  if (!set.done || !set.reps || set.reps <= 0) return 0;
  const sides = exercise?.unilateral ? 2 : 1;
  return setLoad(set, exercise, bodyweightKg) * set.reps * sides;
}

export interface SessionStats {
  totalSets: number;
  plannedSets: number;
  totalReps: number;
  volume: number;
  completion: number; // 0..1
}

export function sessionStats(
  workout: Workout,
  sets: WorkoutSet[],
  exercises: Map<string, Exercise>,
  bodyweightKg: number | null,
): SessionStats {
  const own = sets.filter((s) => s.workoutId === workout.id);
  const done = own.filter((s) => s.done);
  const required = workout.exercises.filter((e) => !e.optional);
  const requiredIds = new Set(required.map((e) => e.id));
  const plannedSets = Math.max(
    required.reduce((n, e) => n + Math.max(e.targetSets, own.filter((s) => s.workoutExerciseId === e.id).length), 0),
    1,
  );
  const doneRequired = done.filter((s) => requiredIds.has(s.workoutExerciseId)).length;
  const bw = workout.bodyweightKg ?? bodyweightKg;
  return {
    totalSets: done.length,
    plannedSets,
    totalReps: done.reduce((n, s) => n + (s.reps ?? 0) * (exercises.get(s.exerciseId)?.unilateral ? 2 : 1), 0),
    volume: Math.round(done.reduce((v, s) => v + setVolume(s, exercises.get(s.exerciseId), bw), 0)),
    completion: Math.min(1, doneRequired / plannedSets),
  };
}

export function setsFor(sets: WorkoutSet[], workoutId: string, workoutExerciseId: string): WorkoutSet[] {
  return sets
    .filter((s) => s.workoutId === workoutId && s.workoutExerciseId === workoutExerciseId)
    .sort((a, b) => a.setIndex - b.setIndex);
}

export interface PreviousPerformance {
  workout: Workout;
  sets: WorkoutSet[];
  volume: number;
}

/** Most recent completed session (other than `current`) that trained this exercise. */
export function previousPerformance(
  exerciseId: string,
  current: Workout,
  workouts: Workout[],
  sets: WorkoutSet[],
  exercise: Exercise | undefined,
): PreviousPerformance | null {
  const candidates = workouts
    .filter((w) => w.id !== current.id && w.status === 'done' && w.date <= current.date)
    .sort((a, b) => (b.date === a.date ? (b.completedAt ?? 0) - (a.completedAt ?? 0) : b.date.localeCompare(a.date)));
  for (const w of candidates) {
    const s = sets
      .filter((x) => x.workoutId === w.id && x.exerciseId === exerciseId && x.done)
      .sort((a, b) => a.setIndex - b.setIndex);
    if (s.length) {
      return { workout: w, sets: s, volume: Math.round(s.reduce((v, x) => v + setVolume(x, exercise, w.bodyweightKg), 0)) };
    }
  }
  return null;
}

/** Epley estimate. Labelled "estimated" everywhere it is shown. Only meaningful for reps <= 12. */
export function estimated1RM(load: number, reps: number): number {
  if (reps <= 0 || load <= 0) return 0;
  if (reps === 1) return load;
  return Math.round(load * (1 + reps / 30) * 10) / 10;
}

export interface ExercisePRs {
  heaviest: { load: number; reps: number; date: ISODate } | null;
  bestE1RM: { value: number; load: number; reps: number; date: ISODate } | null;
  bestSetVolume: { value: number; date: ISODate } | null;
  mostReps: { reps: number; load: number; date: ISODate } | null;
}

export function exercisePRs(
  exerciseId: string,
  workouts: Workout[],
  sets: WorkoutSet[],
  exercise: Exercise | undefined,
  opts: { excludeWorkoutId?: string } = {},
): ExercisePRs {
  const byId = new Map(workouts.map((w) => [w.id, w]));
  const out: ExercisePRs = { heaviest: null, bestE1RM: null, bestSetVolume: null, mostReps: null };
  for (const s of sets) {
    if (s.exerciseId !== exerciseId || !s.done || !s.reps) continue;
    if (opts.excludeWorkoutId && s.workoutId === opts.excludeWorkoutId) continue;
    const w = byId.get(s.workoutId);
    if (!w) continue;
    const load = setLoad(s, exercise, w.bodyweightKg);
    const date = w.date;
    if (!out.heaviest || load > out.heaviest.load || (load === out.heaviest.load && s.reps > out.heaviest.reps)) {
      out.heaviest = { load, reps: s.reps, date };
    }
    if (s.reps <= 12) {
      const e = estimated1RM(load, s.reps);
      if (!out.bestE1RM || e > out.bestE1RM.value) out.bestE1RM = { value: e, load, reps: s.reps, date };
    }
    const vol = setVolume(s, exercise, w.bodyweightKg);
    if (!out.bestSetVolume || vol > out.bestSetVolume.value) out.bestSetVolume = { value: vol, date };
    if (!out.mostReps || s.reps > out.mostReps.reps) out.mostReps = { reps: s.reps, load, date };
  }
  return out;
}

export type PRKind = 'weight' | 'e1rm' | 'volume';

/** PRs set in `workoutId`, compared against every other logged session. */
export function sessionPRs(
  workoutId: string,
  workouts: Workout[],
  sets: WorkoutSet[],
  exercises: Map<string, Exercise>,
): { exerciseId: string; kinds: PRKind[] }[] {
  const w = workouts.find((x) => x.id === workoutId);
  if (!w) return [];
  const ids = [...new Set(sets.filter((s) => s.workoutId === workoutId && s.done).map((s) => s.exerciseId))];
  const result: { exerciseId: string; kinds: PRKind[] }[] = [];
  for (const exId of ids) {
    const ex = exercises.get(exId);
    const before = exercisePRs(exId, workouts, sets, ex, { excludeWorkoutId: workoutId });
    if (!before.heaviest) continue; // first time doing it: no PR claims
    const now = exercisePRs(exId, workouts.filter((x) => x.id === workoutId), sets.filter((s) => s.workoutId === workoutId), ex);
    const kinds: PRKind[] = [];
    if (now.heaviest && now.heaviest.load > before.heaviest.load) kinds.push('weight');
    if (now.bestE1RM && before.bestE1RM && now.bestE1RM.value > before.bestE1RM.value) kinds.push('e1rm');
    if (now.bestSetVolume && before.bestSetVolume && now.bestSetVolume.value > before.bestSetVolume.value) kinds.push('volume');
    if (kinds.length) result.push({ exerciseId: exId, kinds });
  }
  return result;
}

export function formatSet(s: Pick<WorkoutSet, 'weight' | 'reps' | 'rir'>, exercise?: Pick<Exercise, 'bodyweight' | 'unilateral'>): string {
  const w = s.weight ?? 0;
  const load = exercise?.bodyweight ? (w > 0 ? `BW+${w} kg` : 'BW') : `${w} kg`;
  const reps = `${s.reps ?? 0}${exercise?.unilateral ? '/side' : ''}`;
  const rir = s.rir !== null && s.rir !== undefined ? ` · RIR ${s.rir}` : '';
  return `${load} × ${reps}${rir}`;
}

export function targetLabel(e: WorkoutExercise): string {
  const reps = e.repMin === e.repMax ? `${e.repMin}` : `${e.repMin}–${e.repMax}`;
  return `${e.targetSets} × ${reps}`;
}

export function restLabel(sec: number): string {
  if (sec < 120) return `${sec} s`;
  const m = sec / 60;
  return Number.isInteger(m) ? `${m} min` : `${m.toFixed(1)} min`;
}

export function workoutMuscleGroups(workout: Workout, sets: WorkoutSet[], exercises: Map<string, Exercise>): string[] {
  const doneIds = new Set(sets.filter((s) => s.workoutId === workout.id && s.done).map((s) => s.exerciseId));
  const groups = new Set<string>();
  for (const id of doneIds) {
    const g = exercises.get(id)?.muscleGroup;
    if (g) groups.add(g);
  }
  return [...groups];
}
