import { addDays, inRange, startOfWeek } from './dates.js';
import type { BodyWeightEntry, ISODate, Weekday } from './types.js';

export type Trend = 'up' | 'flat' | 'down' | 'unknown';

/** Minimum weigh-ins inside a 7-day window before an average is shown. */
export const MIN_ENTRIES_FOR_AVERAGE = 3;
/** Change in 7-day average (kg) below which the trend is reported as flat. */
export const FLAT_THRESHOLD_KG = 0.1;

const round2 = (n: number) => Math.round(n * 100) / 100;

export function sortedByDate(entries: BodyWeightEntry[]): BodyWeightEntry[] {
  return [...entries].sort((a, b) => a.date.localeCompare(b.date));
}

export function latestEntry(entries: BodyWeightEntry[], onOrBefore?: ISODate): BodyWeightEntry | null {
  const s = sortedByDate(entries).filter((e) => !onOrBefore || e.date <= onOrBefore);
  return s.length ? s[s.length - 1] : null;
}

export interface WindowAverage {
  average: number | null;
  count: number;
  start: ISODate;
  end: ISODate;
}

/** Mean of weigh-ins in [end-6, end]. Returns null average when fewer than `minEntries` exist. */
export function windowAverage(entries: BodyWeightEntry[], end: ISODate, days = 7, minEntries = MIN_ENTRIES_FOR_AVERAGE): WindowAverage {
  const start = addDays(end, -(days - 1));
  const within = entries.filter((e) => inRange(e.date, start, end));
  const average = within.length >= minEntries ? round2(within.reduce((s, e) => s + e.weightKg, 0) / within.length) : null;
  return { average, count: within.length, start, end };
}

export interface TrendResult {
  trend: Trend;
  current: WindowAverage;
  previous: WindowAverage;
  change: number | null;
}

/** Compares the 7-day average ending `today` with the 7 days before it. Never uses a single day. */
export function weightTrend(entries: BodyWeightEntry[], today: ISODate): TrendResult {
  const current = windowAverage(entries, today);
  const previous = windowAverage(entries, addDays(today, -7));
  if (current.average === null || previous.average === null) return { trend: 'unknown', current, previous, change: null };
  const change = round2(current.average - previous.average);
  const trend: Trend = Math.abs(change) < FLAT_THRESHOLD_KG ? 'flat' : change > 0 ? 'up' : 'down';
  return { trend, current, previous, change };
}

export interface WeekAverage {
  weekStart: ISODate;
  average: number | null;
  count: number;
}

export function weeklyAverages(entries: BodyWeightEntry[], lastWeekStart: ISODate, weeks: number): WeekAverage[] {
  const out: WeekAverage[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const ws = addDays(lastWeekStart, -7 * i);
    const we = addDays(ws, 6);
    const within = entries.filter((e) => inRange(e.date, ws, we));
    out.push({
      weekStart: ws,
      count: within.length,
      average: within.length >= MIN_ENTRIES_FOR_AVERAGE ? round2(within.reduce((s, e) => s + e.weightKg, 0) / within.length) : null,
    });
  }
  return out;
}

/** Weekly average for the calendar week containing `date`. */
export function weekAverageFor(entries: BodyWeightEntry[], date: ISODate, weekStartsOn: Weekday): WeekAverage {
  const ws = startOfWeek(date, weekStartsOn);
  return weeklyAverages(entries, ws, 1)[0];
}

/** Rolling 7-day average series for charts: one point per day that has enough data. */
export function rollingSeries(entries: BodyWeightEntry[], start: ISODate, end: ISODate): { date: ISODate; value: number }[] {
  const out: { date: ISODate; value: number }[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) {
    const w = windowAverage(entries, d, 7, 2);
    if (w.average !== null) out.push({ date: d, value: w.average });
  }
  return out;
}

export const TREND_ARROW: Record<Trend, string> = { up: '↗', flat: '→', down: '↘', unknown: '·' };
