import type { Store } from '../data/store.js';
import { dateKey } from '../domain/dates.js';
import type { Exercise, Food, Workout } from '../domain/types.js';
import { latestEntry } from '../domain/weight.js';

/** Shared app context. `store` is assigned once at boot (see main.ts). */
export const app = {
  store: null as unknown as Store,
  storageKind: '',
  persistent: false as boolean | null,
  today(): string {
    return dateKey();
  },
};

export const S = () => app.store;

export function exerciseMap(): Map<string, Exercise> {
  return new Map(S().all('exercises').map((e) => [e.id, e]));
}

export function foodMap(): Map<string, Food> {
  return new Map(S().all('foods').map((f) => [f.id, f]));
}

/** Latest logged weight, else the approximate profile weight (flagged as such by callers). */
export function currentBodyweight(): { kg: number; logged: boolean } {
  const e = latestEntry(S().all('bodyWeight'));
  return e ? { kg: e.weightKg, logged: true } : { kg: S().profile.startWeightKg, logged: false };
}

export function workoutsSorted(): Workout[] {
  return S()
    .all('workouts')
    .sort((a, b) => (b.date === a.date ? (b.startedAt ?? b.updatedAt) - (a.startedAt ?? a.updatedAt) : b.date.localeCompare(a.date)));
}

export function todaysWorkout(): Workout | undefined {
  const today = app.today();
  const list = workoutsSorted().filter((w) => w.date === today);
  return list.find((w) => w.status === 'active') ?? list.find((w) => w.status === 'planned') ?? list[0];
}
