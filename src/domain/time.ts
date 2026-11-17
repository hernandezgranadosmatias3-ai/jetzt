import type { DateKey, Weekday } from './types';

export const MINUTES_PER_DAY = 24 * 60;

const pad = (n: number) => String(n).padStart(2, '0');

export function dateKey(d: Date): DateKey {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Local midnight of the given date key. */
export function parseDateKey(key: DateKey): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(key: DateKey, n: number): DateKey {
  const d = parseDateKey(key);
  d.setDate(d.getDate() + n);
  return dateKey(d);
}

export function todayKey(now: number = Date.now()): DateKey {
  return dateKey(new Date(now));
}

export function isoWeekday(d: Date): Weekday {
  const w = d.getDay();
  return (w === 0 ? 7 : w) as Weekday;
}

export function weekdayOfKey(key: DateKey): Weekday {
  return isoWeekday(parseDateKey(key));
}

/** Wall-clock minutes after local midnight, with seconds as a fraction. */
export function minutesOfDay(ms: number): number {
  const d = new Date(ms);
  return d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60;
}

/**
 * Absolute timestamp for a wall-clock time on a date. Built from local date
 * components, so it follows daylight-saving changes. A time that does not exist
 * (02:30 on the spring-forward night) resolves to the next valid time.
 */
export function atMinutes(key: DateKey, minutes: number): number {
  const [y, m, d] = key.split('-').map(Number);
  const whole = Math.floor(minutes);
  const seconds = Math.round((minutes - whole) * 60);
  return new Date(y, m - 1, d, Math.floor(whole / 60), whole % 60, seconds).getTime();
}

/** Monday of the week that contains `key`. */
export function startOfWeek(key: DateKey): DateKey {
  return addDays(key, 1 - weekdayOfKey(key));
}

export function clampMinutes(m: number): number {
  return Math.max(0, Math.min(MINUTES_PER_DAY - 1, Math.round(m)));
}

export function fmtTime(minutes: number): string {
  const m = ((Math.round(minutes) % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
}

export function parseTime(text: string): number | null {
  const match = /^(\d{1,2})[:.]?(\d{2})$/.exec(text.trim());
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h > 23 || m > 59) return null;
  return h * 60 + m;
}

export function fmtDuration(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  if (m < 60) return `${m} Min`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest ? `${h} Std ${rest} Min` : `${h} Std`;
}

/** Countdown text `MM:SS` or `H:MM:SS`. */
export function fmtCountdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

export const WEEKDAY_LONG = ['', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];
export const WEEKDAY_SHORT = ['', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
export const MONTHS = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
];
export const MONTHS_SHORT = ['Jan', 'Feb', 'März', 'Apr', 'Mai', 'Juni', 'Juli', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];

/** "Dienstag, 17. November" */
export function fmtLongDate(key: DateKey): string {
  const d = parseDateKey(key);
  return `${WEEKDAY_LONG[isoWeekday(d)]}, ${d.getDate()}. ${MONTHS[d.getMonth()]}`;
}

/** "17. Nov" */
export function fmtShortDate(key: DateKey): string {
  const d = parseDateKey(key);
  return `${d.getDate()}. ${MONTHS_SHORT[d.getMonth()]}`;
}

/** "Heute", "Morgen", "Übermorgen" or "Mi, 19. Nov". */
export function fmtRelativeDay(key: DateKey, today: DateKey): string {
  if (key === today) return 'Heute';
  if (key === addDays(today, 1)) return 'Morgen';
  if (key === addDays(today, 2)) return 'Übermorgen';
  if (key === addDays(today, -1)) return 'Gestern';
  return `${WEEKDAY_SHORT[weekdayOfKey(key)]}, ${fmtShortDate(key)}`;
}

export const ALL_DAYS: Weekday[] = [1, 2, 3, 4, 5, 6, 7];
export const SCHOOL_DAYS: Weekday[] = [1, 2, 3, 4, 5];
export const WEEKEND: Weekday[] = [6, 7];

export function fmtDays(days: Weekday[]): string {
  const sorted = [...days].sort((a, b) => a - b);
  const same = (a: Weekday[]) => a.length === sorted.length && a.every((d, i) => d === sorted[i]);
  if (same(ALL_DAYS)) return 'Täglich';
  if (same(SCHOOL_DAYS)) return 'Mo–Fr';
  if (same(WEEKEND)) return 'Wochenende';
  if (sorted.length === 0) return 'Nie';
  return sorted.map((d) => WEEKDAY_SHORT[d]).join(', ');
}

export function uid(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}
