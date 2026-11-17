/**
 * Pure state transitions for one day: starting, pausing, extending, finishing and
 * re-planning tasks. Each function takes a DayRecord and returns a new one.
 */
import { buildDayPlan, timerElapsedMs, timerRemainingMs, type DayPlan, type PlanItem } from './plan';
import { MINUTES_PER_DAY, clampMinutes, fmtTime, minutesOfDay, uid } from './time';
import type { DateKey, DayRecord, InstanceState, PendingAdjustment, PlaceEvent, PlanChange, TaskTemplate } from './types';

export function emptyRecord(date: DateKey): DayRecord {
  return { date, instances: {}, events: [], timer: null, pending: null, undo: null };
}

function patchInstance(record: DayRecord, taskId: string, patch: Partial<InstanceState>): DayRecord {
  const prev = record.instances[taskId] ?? { status: 'pending' };
  return { ...record, instances: { ...record.instances, [taskId]: { ...prev, ...patch } } };
}

function withUndo(record: DayRecord, label: string, taskIds: string[], now: number): DayRecord {
  const before: Record<string, InstanceState | undefined> = {};
  for (const id of taskIds) before[id] = record.instances[id];
  return { ...record, undo: { label, at: now, before } };
}

export function undo(record: DayRecord): DayRecord {
  if (!record.undo) return record;
  const instances = { ...record.instances };
  for (const [id, state] of Object.entries(record.undo.before)) {
    if (state) instances[id] = state;
    else delete instances[id];
  }
  return { ...record, instances, undo: null, pending: null };
}

// ---------------------------------------------------------------------------
// Re-planning
// ---------------------------------------------------------------------------

export interface ShiftProposal {
  changes: PlanChange[];
  /** Fixed appointments that stopped the cascade (overlap remains). */
  blockedBy: PlanItem[];
  /** Fixed appointments that would move (only with moveFixed). */
  movesFixed: PlanItem[];
  /** The plan would run past midnight. */
  overflow: boolean;
}

/**
 * Move the tasks after `fromTaskId` so none of them overlaps once that task ends
 * at `newEnd`. Free gaps absorb the delay, so tasks only move as far as needed.
 * Finished or already started tasks are never moved. Fixed appointments stop the
 * cascade unless `moveFixed` is true.
 */
export function cascadeAfter(items: PlanItem[], fromTaskId: string, newEnd: number, opts: { moveFixed: boolean }): ShiftProposal {
  const idx = items.findIndex((i) => i.task.id === fromTaskId);
  const changes: PlanChange[] = [];
  const blockedBy: PlanItem[] = [];
  const movesFixed: PlanItem[] = [];
  let prevEnd = newEnd;
  for (let i = idx + 1; i < items.length; i++) {
    const item = items[i];
    if (item.state.status === 'done' || item.state.status === 'skipped' || item.state.status === 'active') continue;
    if (item.start >= prevEnd) break;
    if (item.task.fixed && !opts.moveFixed) {
      blockedBy.push(item);
      break;
    }
    const to = Math.round(prevEnd);
    changes.push({ taskId: item.task.id, from: item.start, to });
    if (item.task.fixed) movesFixed.push(item);
    prevEnd = to + item.duration;
  }
  return { changes, blockedBy, movesFixed, overflow: prevEnd > MINUTES_PER_DAY };
}

/**
 * Apply re-planning changes. With `continueUndo`, the undo entry of the preceding
 * step (an extension or arrival) is kept, so one "Rückgängig" reverts both.
 */
export function applyChanges(
  record: DayRecord,
  changes: PlanChange[],
  label: string,
  now: number,
  opts: { continueUndo?: boolean } = {},
): DayRecord {
  if (!changes.length) return record;
  let next =
    opts.continueUndo && record.undo
      ? { ...record, undo: { ...record.undo, label } }
      : withUndo(record, label, changes.map((c) => c.taskId), now);
  for (const c of changes) {
    const prev = next.instances[c.taskId];
    const shifted = (prev?.shiftedBy ?? 0) + Math.max(0, c.to - c.from);
    next = patchInstance(next, c.taskId, { start: clampMinutes(c.to), shiftedBy: shifted });
  }
  return { ...next, pending: null };
}

export function describeChanges(changes: PlanChange[], items: PlanItem[]): string {
  const title = (id: string) => items.find((i) => i.task.id === id)?.task.title ?? '';
  return changes.map((c) => `${title(c.taskId)} ${fmtTime(c.from)} → ${fmtTime(c.to)}`).join('\n');
}

/** Current end of an item, including a running timer that is late. */
export function projectedEnd(item: PlanItem, record: DayRecord | undefined, now: number): number {
  const timer = record?.timer;
  if (timer && timer.taskId === item.task.id) {
    const remaining = timerRemainingMs(timer, now);
    return Math.max(item.end, minutesOfDay(now) + Math.max(0, remaining) / 60000);
  }
  return item.end;
}

export function makePending(
  reason: PendingAdjustment['reason'],
  title: string,
  message: string,
  proposal: ShiftProposal,
  now: number,
): PendingAdjustment {
  return {
    id: uid(),
    reason,
    title,
    message,
    changes: proposal.changes,
    fixedTitles: proposal.movesFixed.map((i) => i.task.title),
    createdAt: now,
  };
}

// ---------------------------------------------------------------------------
// Task lifecycle
// ---------------------------------------------------------------------------

/**
 * Start a task. Starting a timer task starts its countdown. Starting late or early
 * moves the task's start to the real start (fixed appointments keep their time).
 */
export function startTask(record: DayRecord, item: PlanItem, now: number): DayRecord {
  let next = record;
  // Only one task runs at a time: an earlier started task keeps its status but loses the timer.
  if (next.timer && next.timer.taskId !== item.task.id) next = stopTimer(next, now);
  const nowMin = Math.round(minutesOfDay(now));
  const patch: Partial<InstanceState> = { status: 'active', startedAt: now };
  if (!item.task.fixed && Math.abs(nowMin - item.start) >= 2) {
    patch.start = nowMin;
    if (nowMin > item.start) patch.shiftedBy = (item.state.shiftedBy ?? 0) + (nowMin - item.start);
  }
  next = patchInstance(next, item.task.id, patch);
  if (item.task.timer && item.duration > 0) {
    next = { ...next, timer: { taskId: item.task.id, runningSince: now, elapsedBeforeMs: 0, plannedMs: item.duration * 60000 } };
  }
  return next;
}

export function pauseTimer(record: DayRecord, now: number): DayRecord {
  const t = record.timer;
  if (!t || t.runningSince == null) return record;
  return { ...record, timer: { ...t, runningSince: null, elapsedBeforeMs: t.elapsedBeforeMs + (now - t.runningSince) } };
}

export function resumeTimer(record: DayRecord, now: number): DayRecord {
  const t = record.timer;
  if (!t || t.runningSince != null) return record;
  return { ...record, timer: { ...t, runningSince: now } };
}

/** Stop the countdown without finishing the task. */
export function stopTimer(record: DayRecord, now: number): DayRecord {
  const t = record.timer;
  if (!t) return record;
  const minutes = Math.round(timerElapsedMs(t, now) / 60000);
  const prev = record.instances[t.taskId];
  const next = patchInstance(record, t.taskId, { actualMinutes: (prev?.actualMinutes ?? 0) + minutes });
  return { ...next, timer: null };
}

export function completeTask(record: DayRecord, taskId: string, now: number): DayRecord {
  let next = record;
  if (next.timer?.taskId === taskId) next = stopTimer(next, now);
  const prev = next.instances[taskId];
  if (!prev?.actualMinutes && prev?.startedAt) {
    next = patchInstance(next, taskId, { actualMinutes: Math.max(1, Math.round((now - prev.startedAt) / 60000)) });
  }
  return patchInstance(next, taskId, { status: 'done', completedAt: now });
}

export function skipTask(record: DayRecord, taskId: string, now: number): DayRecord {
  let next = record;
  if (next.timer?.taskId === taskId) next = stopTimer(next, now);
  return patchInstance(next, taskId, { status: 'skipped', completedAt: now });
}

export function reopenTask(record: DayRecord, taskId: string): DayRecord {
  return patchInstance(record, taskId, { status: 'pending', completedAt: undefined });
}

/** Move a single task to a new start time today. */
export function moveTask(record: DayRecord, item: PlanItem, to: number, now: number): DayRecord {
  const next = withUndo(record, `${item.task.title} verschoben`, [item.task.id], now);
  const delta = to - item.start;
  return patchInstance(next, item.task.id, {
    start: clampMinutes(to),
    shiftedBy: (item.state.shiftedBy ?? 0) + Math.max(0, delta),
  });
}

/**
 * Add minutes to a task. Returns the new record and a proposal for the following
 * tasks if the longer task now overlaps them.
 */
export function extendTask(
  record: DayRecord,
  plan: DayPlan,
  taskId: string,
  minutes: number,
  now: number,
): { record: DayRecord; proposal: ShiftProposal; item: PlanItem } {
  const item = plan.items.find((i) => i.task.id === taskId);
  if (!item) throw new Error(`Task ${taskId} is not planned on ${plan.date}`);
  let next = withUndo(record, `${item.task.title} um ${minutes} Min verlängert`, plan.items.map((i) => i.task.id), now);
  next = patchInstance(next, taskId, {
    duration: item.duration + minutes,
    extendedBy: (item.state.extendedBy ?? 0) + minutes,
  });
  if (next.timer?.taskId === taskId) {
    next = { ...next, timer: { ...next.timer, plannedMs: next.timer.plannedMs + minutes * 60000 } };
  }
  const tasks = plan.items.map((i) => i.task);
  const updated = buildDayPlan(plan.date, tasks, next, now);
  const updatedItem = updated.items.find((i) => i.task.id === taskId)!;
  const end = projectedEnd(updatedItem, next, now);
  return { record: next, proposal: cascadeAfter(updated.items, taskId, end, { moveFixed: false }), item: updatedItem };
}

// ---------------------------------------------------------------------------
// Place events (geofence or manual "Ich bin zu Hause")
// ---------------------------------------------------------------------------

/** How far from the planned time a place event may be to count for a task. */
export const TRIGGER_WINDOW_MIN = 180;

export interface PlaceEventResult {
  record: DayRecord;
  item: PlanItem | null;
  /** Minutes later than planned (negative = earlier). */
  delay: number;
  proposal: ShiftProposal | null;
  duplicate: boolean;
}

export function matchTrigger(plan: DayPlan, placeId: string, event: PlaceEvent, nowMin: number): PlanItem | null {
  let best: PlanItem | null = null;
  for (const item of plan.items) {
    const trig = item.task.trigger;
    if (!trig || trig.placeId !== placeId || trig.event !== event) continue;
    if (item.state.status !== 'pending') continue;
    const distance = Math.abs(item.plannedStart - nowMin);
    if (distance > TRIGGER_WINDOW_MIN) continue;
    if (!best || distance < Math.abs(best.plannedStart - nowMin)) best = item;
  }
  return best;
}

export function applyPlaceEvent(
  record: DayRecord,
  tasks: TaskTemplate[],
  placeId: string,
  event: PlaceEvent,
  now: number,
  source: 'geofence' | 'manual',
): PlaceEventResult {
  // Geofences can fire twice in a row at the border of a region.
  const recent = record.events.find((e) => e.placeId === placeId && e.event === event && now - e.at < 20 * 60000);
  const withEvent: DayRecord = { ...record, events: [...record.events, { placeId, event, at: now, source }] };
  const plan = buildDayPlan(record.date, tasks, record, now);
  const nowMin = Math.round(minutesOfDay(now));
  const item = matchTrigger(plan, placeId, event, nowMin);
  if (!item) return { record: withEvent, item: null, delay: 0, proposal: null, duplicate: !!recent };

  const delay = nowMin - item.start;
  let next = withUndo(withEvent, `${item.task.title} um ${fmtTime(nowMin)}`, plan.items.map((i) => i.task.id), now);
  next = startTask(next, item, now);
  if (item.task.fixed || delay < 5) return { record: next, item, delay, proposal: null, duplicate: false };

  const updated = buildDayPlan(record.date, tasks, next, now);
  const updatedItem = updated.items.find((i) => i.task.id === item.task.id)!;
  const proposal = cascadeAfter(updated.items, item.task.id, updatedItem.end, { moveFixed: false });
  return { record: next, item: updatedItem, delay, proposal, duplicate: false };
}
