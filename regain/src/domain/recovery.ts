import { addDays, inRange } from './dates.js';
import type { ISODate, RecoveryEntry } from './types.js';

/**
 * A logged day counts as "under-recovered" when ANY of:
 *   sleep < 7 h, sleep quality <= 2, energy <= 2, soreness >= 4, stress >= 4
 * The pattern is "consistent" when at least 3 of the logged days in the last 7 meet it
 * AND they make up at least half of the logged days.
 */
export const RECOVERY_RULES = {
  minSleepHours: 7,
  lowScore: 2,
  highScore: 4,
  minFlaggedDays: 3,
};

export function recoveryFlags(e: RecoveryEntry): string[] {
  const f: string[] = [];
  if (e.sleepHours !== null && e.sleepHours < RECOVERY_RULES.minSleepHours) f.push(`sleep ${e.sleepHours} h`);
  if (e.sleepQuality !== null && e.sleepQuality <= RECOVERY_RULES.lowScore) f.push(`sleep quality ${e.sleepQuality}/5`);
  if (e.energy !== null && e.energy <= RECOVERY_RULES.lowScore) f.push(`energy ${e.energy}/5`);
  if (e.soreness !== null && e.soreness >= RECOVERY_RULES.highScore) f.push(`soreness ${e.soreness}/5`);
  if (e.stress !== null && e.stress >= RECOVERY_RULES.highScore) f.push(`stress ${e.stress}/5`);
  return f;
}

export interface RecoveryStatus {
  loggedDays: number;
  flaggedDays: number;
  consistentlyUnderRecovered: boolean;
  avgSleep: number | null;
  avgEnergy: number | null;
  avgSoreness: number | null;
  avgStress: number | null;
  avgSleepQuality: number | null;
}

function avg(values: (number | null)[]): number | null {
  const v = values.filter((x): x is number => x !== null && x !== undefined);
  return v.length ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10 : null;
}

export function recoveryWindow(entries: RecoveryEntry[], start: ISODate, end: ISODate): RecoveryStatus {
  const within = entries.filter((e) => inRange(e.date, start, end));
  const flagged = within.filter((e) => recoveryFlags(e).length > 0).length;
  return {
    loggedDays: within.length,
    flaggedDays: flagged,
    consistentlyUnderRecovered: flagged >= RECOVERY_RULES.minFlaggedDays && flagged * 2 >= within.length,
    avgSleep: avg(within.map((e) => e.sleepHours)),
    avgEnergy: avg(within.map((e) => e.energy)),
    avgSoreness: avg(within.map((e) => e.soreness)),
    avgStress: avg(within.map((e) => e.stress)),
    avgSleepQuality: avg(within.map((e) => e.sleepQuality)),
  };
}

export function recoveryLast7(entries: RecoveryEntry[], today: ISODate): RecoveryStatus {
  return recoveryWindow(entries, addDays(today, -6), today);
}
