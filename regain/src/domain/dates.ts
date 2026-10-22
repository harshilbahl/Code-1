import type { ISODate, Weekday } from './types.js';

const pad = (n: number) => String(n).padStart(2, '0');

/** Local calendar date key (never UTC — a 7am weigh-in in Dubai must land on the local day). */
export function dateKey(d: Date = new Date()): ISODate {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function parseDate(key: ISODate): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d, 12); // noon avoids DST edge cases
}

export function addDays(key: ISODate, days: number): ISODate {
  const d = parseDate(key);
  d.setDate(d.getDate() + days);
  return dateKey(d);
}

export function daysBetween(a: ISODate, b: ISODate): number {
  return Math.round((parseDate(b).getTime() - parseDate(a).getTime()) / 86400000);
}

export function weekday(key: ISODate): Weekday {
  return parseDate(key).getDay() as Weekday;
}

export function startOfWeek(key: ISODate, weekStartsOn: Weekday): ISODate {
  const diff = (weekday(key) - weekStartsOn + 7) % 7;
  return addDays(key, -diff);
}

export function rangeDays(start: ISODate, count: number): ISODate[] {
  return Array.from({ length: count }, (_, i) => addDays(start, i));
}

export function inRange(key: ISODate, start: ISODate, endInclusive: ISODate): boolean {
  return key >= start && key <= endInclusive;
}

const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WEEKDAY_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const weekdayShort = (w: number) => WEEKDAY_SHORT[w];
export const weekdayLong = (w: number) => WEEKDAY_LONG[w];

export function formatDay(key: ISODate, today: ISODate = dateKey()): string {
  const diff = daysBetween(key, today);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  if (diff === -1) return 'Tomorrow';
  const d = parseDate(key);
  return `${WEEKDAY_SHORT[d.getDay()]} ${d.getDate()} ${MONTH_SHORT[d.getMonth()]}`;
}

export function formatShort(key: ISODate): string {
  const d = parseDate(key);
  return `${d.getDate()} ${MONTH_SHORT[d.getMonth()]}`;
}

export function formatRange(start: ISODate, endInclusive: ISODate): string {
  return `${formatShort(start)} – ${formatShort(endInclusive)}`;
}
