import { MINUTES_PER_DAY, minutesOfDay, todayKey, weekdayOfKey } from './time';
import type { DateKey, DayRecord, InstanceState, TaskTemplate, TimerState } from './types';

/**
 * done / skipped: finished by the user
 * active:   started by the user (timer or arrival), not finished yet
 * current:  not started, but its time window contains "now"
 * missed:   its time is over and it was neither done nor skipped
 * upcoming: still ahead
 */
export type ItemStatus = 'done' | 'skipped' | 'active' | 'current' | 'missed' | 'upcoming';

export interface PlanItem {
  task: TaskTemplate;
  /** Effective start today (minutes after midnight). */
  start: number;
  duration: number;
  end: number;
  /** Start time from the routine template. */
  plannedStart: number;
  state: InstanceState;
  status: ItemStatus;
}

export interface DayPlan {
  date: DateKey;
  items: PlanItem[];
  /** The task that answers "Was sollte ich jetzt tun?" (null in a free gap). */
  focus: PlanItem | null;
  /** The next task after the focus. */
  next: PlanItem | null;
  stats: { total: number; done: number; skipped: number; open: number; percent: number };
}

const PENDING: InstanceState = { status: 'pending' };

export function isTaskOnDate(task: TaskTemplate, key: DateKey): boolean {
  if (task.deletedAt) return false;
  if (task.pausedUntil && key <= task.pausedUntil) return false;
  if (task.date) return task.date === key;
  return task.days.includes(weekdayOfKey(key));
}

/**
 * Tasks of a day. Past days with a frozen list keep the tasks that were planned
 * back then, so later routine edits do not rewrite history.
 */
export function tasksForDate(tasks: TaskTemplate[], key: DateKey, record: DayRecord | undefined, today: DateKey): TaskTemplate[] {
  if (key < today && record?.plannedIds) {
    const ids = new Set(record.plannedIds);
    return tasks.filter((t) => ids.has(t.id));
  }
  return tasks.filter((t) => isTaskOnDate(t, key));
}

function compareItems(a: PlanItem, b: PlanItem): number {
  return a.start - b.start || a.task.start - b.task.start || a.task.title.localeCompare(b.task.title);
}

/** Planned end of the timer if it keeps running from `now` (minutes after midnight). */
export function timerRemainingMs(timer: TimerState, now: number): number {
  const elapsed = timer.elapsedBeforeMs + (timer.runningSince != null ? now - timer.runningSince : 0);
  return timer.plannedMs - elapsed;
}

export function timerElapsedMs(timer: TimerState, now: number): number {
  return timer.elapsedBeforeMs + (timer.runningSince != null ? now - timer.runningSince : 0);
}

export function buildDayPlan(
  key: DateKey,
  tasks: TaskTemplate[],
  record: DayRecord | undefined,
  now: number,
): DayPlan {
  const today = todayKey(now);
  const nowMin = key === today ? minutesOfDay(now) : key < today ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY;

  const items: PlanItem[] = tasksForDate(tasks, key, record, today)
    .map((task) => {
      const state = record?.instances[task.id] ?? PENDING;
      const start = state.start ?? task.start;
      const duration = state.duration ?? task.duration;
      return { task, start, duration, end: start + duration, plannedStart: task.start, state, status: 'upcoming' as ItemStatus };
    })
    .sort(compareItems);

  const timerTaskId = key === today ? record?.timer?.taskId : undefined;
  const focus = findFocus(items, nowMin, timerTaskId);

  for (const item of items) {
    const s = item.state.status;
    if (s === 'done' || s === 'skipped' || s === 'active') item.status = s;
    else if (item === focus) item.status = 'current';
    else if (windowEnd(items, item) <= nowMin) item.status = 'missed';
    else item.status = 'upcoming';
  }

  const next = items.find((i) => i !== focus && i.status === 'upcoming' && (!focus || i.start >= focus.start)) ?? null;

  const done = items.filter((i) => i.status === 'done').length;
  const skipped = items.filter((i) => i.status === 'skipped').length;
  const total = items.length;
  const open = total - done - skipped;
  const denominator = total - skipped;
  const percent = denominator > 0 ? Math.round((done / denominator) * 100) : 0;

  return { date: key, items, focus, next, stats: { total, done, skipped, open, percent } };
}

/** End of the window in which an item counts as "now". Point-in-time tasks last until the next task. */
function windowEnd(items: PlanItem[], item: PlanItem): number {
  if (item.duration > 0) return item.end;
  const later = items.find((i) => i.start > item.start);
  return later ? later.start : MINUTES_PER_DAY;
}

function findFocus(items: PlanItem[], nowMin: number, timerTaskId: string | undefined): PlanItem | null {
  if (timerTaskId) {
    const t = items.find((i) => i.task.id === timerTaskId && i.state.status !== 'done' && i.state.status !== 'skipped');
    if (t) return t;
  }
  const started = items.filter((i) => i.state.status === 'active');
  if (started.length) return started[started.length - 1];

  let found: PlanItem | null = null;
  for (const item of items) {
    if (item.state.status !== 'pending') continue;
    if (item.start <= nowMin && nowMin < windowEnd(items, item)) found = item; // latest start wins
  }
  return found;
}

export interface Conflict {
  a: PlanItem;
  b: PlanItem;
  /** Minutes of overlap. */
  overlap: number;
  key: string;
}

/**
 * Overlaps between consecutive open tasks that still matter (end after now).
 * `projectedEndOf` lets the caller account for a running timer.
 */
export function findConflicts(plan: DayPlan, nowMin: number, projectedEndOf?: (item: PlanItem) => number, ignored: string[] = []): Conflict[] {
  const open = plan.items.filter((i) => i.status !== 'done' && i.status !== 'skipped');
  const result: Conflict[] = [];
  for (let i = 0; i < open.length - 1; i++) {
    const a = open[i];
    const b = open[i + 1];
    if (b.duration === 0 && !b.task.fixed) continue;
    const aEnd = projectedEndOf ? projectedEndOf(a) : a.end;
    if (aEnd <= nowMin) continue;
    const overlap = Math.round(aEnd - b.start);
    const key = `${a.task.id}|${b.task.id}`;
    if (overlap > 0 && a.duration > 0 && !ignored.includes(key)) result.push({ a, b, overlap, key });
  }
  return result;
}
