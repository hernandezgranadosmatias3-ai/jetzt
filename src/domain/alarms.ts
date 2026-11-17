/**
 * Wake-up alarm planning.
 *
 * The plan is expressed as a small set of specs the native alarm engines understand:
 * - `weekly`: repeats every week on one weekday. Used whenever a weekday has no
 *   exception in the planning horizon. Native engines keep these alive without the
 *   app (AlarmKit stores them in the system, Android reschedules after reboot).
 * - `once`: a single date. Used for the weekdays that have an exception (changed
 *   time or day off) inside the horizon, because a weekly repeat cannot skip one
 *   occurrence. The app rebuilds the plan on every launch and in background
 *   refreshes, which turns those weekdays back into `weekly` once the exception is over.
 */
import { addDays, atMinutes, todayKey, weekdayOfKey } from './time';
import type { AlarmSettings, DateKey, TaskTemplate, Weekday } from './types';

export const ALARM_HORIZON_DAYS = 28;

export type AlarmSpec =
  | { id: string; kind: 'weekly'; weekday: Weekday; minutes: number }
  | { id: string; kind: 'once'; date: DateKey; minutes: number; at: number };

/** Wake-up time from the routine for a weekday (wake-up task, else earliest morning task). */
export function routineWakeTime(weekday: Weekday, tasks: TaskTemplate[]): number | null {
  const recurring = tasks.filter((t) => !t.date && !t.deletedAt && t.days.includes(weekday));
  const wake = recurring.filter((t) => t.isWakeUp).sort((a, b) => a.start - b.start)[0];
  if (wake) return wake.start;
  const morning = recurring.filter((t) => t.category === 'morning').sort((a, b) => a.start - b.start)[0];
  return morning ? morning.start : null;
}

export function weeklyTime(weekday: Weekday, alarm: AlarmSettings, tasks: TaskTemplate[]): number | null {
  const day = alarm.days[weekday];
  if (!day?.enabled) return null;
  return day.mode === 'routine' ? routineWakeTime(weekday, tasks) : day.time;
}

export interface ResolvedAlarm {
  date: DateKey;
  enabled: boolean;
  minutes: number | null;
  source: 'routine' | 'custom' | 'exception' | 'off';
}

export function resolveAlarm(date: DateKey, alarm: AlarmSettings, tasks: TaskTemplate[]): ResolvedAlarm {
  const ex = alarm.exceptions[date];
  if (ex) {
    if (ex.off) return { date, enabled: false, minutes: null, source: 'off' };
    return { date, enabled: alarm.enabled, minutes: ex.time, source: 'exception' };
  }
  const weekday = weekdayOfKey(date);
  const minutes = weeklyTime(weekday, alarm, tasks);
  const day = alarm.days[weekday];
  return {
    date,
    enabled: alarm.enabled && minutes != null,
    minutes,
    source: !day?.enabled ? 'off' : day.mode === 'routine' ? 'routine' : 'custom',
  };
}

export function planAlarms(alarm: AlarmSettings, tasks: TaskTemplate[], now: number, horizon = ALARM_HORIZON_DAYS): AlarmSpec[] {
  if (!alarm.enabled) return [];
  const today = todayKey(now);
  const end = addDays(today, horizon);
  const affected = new Set<Weekday>(
    Object.keys(alarm.exceptions)
      .filter((d) => d >= today && d < end)
      .map(weekdayOfKey),
  );
  const specs: AlarmSpec[] = [];
  for (const w of [1, 2, 3, 4, 5, 6, 7] as Weekday[]) {
    if (affected.has(w)) continue;
    const minutes = weeklyTime(w, alarm, tasks);
    if (minutes != null) specs.push({ id: `weekly-${w}`, kind: 'weekly', weekday: w, minutes });
  }
  for (let i = 0; i < horizon; i++) {
    const date = addDays(today, i);
    if (!affected.has(weekdayOfKey(date))) continue;
    const r = resolveAlarm(date, alarm, tasks);
    if (!r.enabled || r.minutes == null) continue;
    const at = atMinutes(date, r.minutes);
    if (at > now) specs.push({ id: `once-${date}`, kind: 'once', date, minutes: r.minutes, at });
  }
  return specs;
}

export interface NextAlarm {
  date: DateKey;
  minutes: number;
  at: number;
  source: ResolvedAlarm['source'];
}

export function nextAlarm(alarm: AlarmSettings, tasks: TaskTemplate[], now: number, searchDays = 14): NextAlarm | null {
  if (!alarm.enabled) return null;
  const today = todayKey(now);
  for (let i = 0; i < searchDays; i++) {
    const date = addDays(today, i);
    const r = resolveAlarm(date, alarm, tasks);
    if (!r.enabled || r.minutes == null) continue;
    const at = atMinutes(date, r.minutes);
    if (at > now) return { date, minutes: r.minutes, at, source: r.source };
  }
  return null;
}

/** Drop exceptions in the past so the settings do not grow forever. */
export function pruneExceptions(alarm: AlarmSettings, now: number): AlarmSettings {
  const today = todayKey(now);
  const exceptions = Object.fromEntries(Object.entries(alarm.exceptions).filter(([d]) => d >= today));
  return { ...alarm, exceptions };
}

/** Next concrete occurrence of a weekly spec after `now`, for fallbacks and tests. */
export function nextOccurrence(spec: AlarmSpec, now: number): number {
  if (spec.kind === 'once') return spec.at;
  const today = todayKey(now);
  for (let i = 0; i <= 7; i++) {
    const date = addDays(today, i);
    if (weekdayOfKey(date) !== spec.weekday) continue;
    const at = atMinutes(date, spec.minutes);
    if (at > now) return at;
  }
  return atMinutes(addDays(today, 7), spec.minutes);
}
