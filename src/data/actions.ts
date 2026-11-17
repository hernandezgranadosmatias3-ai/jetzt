/**
 * User-level actions. They combine the pure domain rules with the store. Side effects
 * on the operating system (notifications, alarms, geofences) are not triggered here:
 * `services/sync.ts` watches the store and reschedules them after every change.
 */
import { buildDayPlan, isTaskOnDate, type Conflict, type DayPlan } from '@/domain/plan';
import * as S from '@/domain/schedule';
import { addDays, fmtTime, todayKey, uid } from '@/domain/time';
import type { AlarmException, AlarmSettings, DateKey, PlaceEvent, PlanChange, Place, Routine, Settings, TaskTemplate } from '@/domain/types';

import { useStore } from './store';

const now = () => Date.now();
const today = () => todayKey();
const st = () => useStore.getState();

export function getPlan(date: DateKey = today(), at: number = now()): DayPlan {
  const s = st();
  return buildDayPlan(date, s.routine.tasks, s.getDay(date), at);
}

function itemOf(taskId: string, date: DateKey) {
  return getPlan(date).items.find((i) => i.task.id === taskId) ?? null;
}

// ---------------------------------------------------------------------------
// Day actions
// ---------------------------------------------------------------------------

export function startTask(taskId: string, date: DateKey = today()) {
  const item = itemOf(taskId, date);
  if (!item) return;
  st().setDay(date, (r) => S.startTask(r, item, now()));
}

export const pauseTimer = () => st().setDay(today(), (r) => S.pauseTimer(r, now()));
export const resumeTimer = () => st().setDay(today(), (r) => S.resumeTimer(r, now()));
export const stopTimer = () => st().setDay(today(), (r) => S.stopTimer(r, now()));

export function completeTask(taskId: string, date: DateKey = today()) {
  st().setDay(date, (r) => S.completeTask(r, taskId, now()));
}

export function skipTask(taskId: string, date: DateKey = today()) {
  st().setDay(date, (r) => S.skipTask(r, taskId, now()));
}

export function reopenTask(taskId: string, date: DateKey = today()) {
  st().setDay(date, (r) => S.reopenTask(r, taskId));
}

export function moveTask(taskId: string, to: number, date: DateKey = today()) {
  const item = itemOf(taskId, date);
  if (!item) return;
  st().setDay(date, (r) => S.moveTask(r, item, to, now()));
}

/** Change start and duration of a task for one day only. */
export function editInstance(taskId: string, date: DateKey, patch: { start?: number; duration?: number }) {
  const item = itemOf(taskId, date);
  if (!item) return;
  st().setDay(date, (r) => {
    const prev = r.instances[taskId] ?? { status: 'pending' as const };
    const shifted = patch.start != null ? Math.max(0, patch.start - item.start) : 0;
    return {
      ...r,
      undo: { label: `${item.task.title} geändert`, at: now(), before: { [taskId]: r.instances[taskId] } },
      instances: { ...r.instances, [taskId]: { ...prev, ...patch, shiftedBy: (prev.shiftedBy ?? 0) + shifted } },
    };
  });
}

export interface ExtendOutcome {
  proposal: S.ShiftProposal;
  item: ReturnType<typeof itemOf>;
}

export function extendTask(taskId: string, minutes: number, date: DateKey = today()): ExtendOutcome {
  const plan = getPlan(date);
  let outcome: ExtendOutcome = { proposal: { changes: [], blockedBy: [], movesFixed: [], overflow: false }, item: null };
  st().setDay(date, (r) => {
    const res = S.extendTask(r, plan, taskId, minutes, now());
    outcome = { proposal: res.proposal, item: res.item };
    return res.record;
  });
  return outcome;
}

/** Proposal to resolve an overlap, starting after the earlier task. */
export function proposeForTask(taskId: string, moveFixed: boolean, date: DateKey = today()): S.ShiftProposal {
  const plan = getPlan(date);
  const item = plan.items.find((i) => i.task.id === taskId);
  if (!item) return { changes: [], blockedBy: [], movesFixed: [], overflow: false };
  const end = S.projectedEnd(item, st().getDay(date), now());
  return S.cascadeAfter(plan.items, taskId, end, { moveFixed });
}

export function applyChanges(changes: PlanChange[], label: string, opts: { continueUndo?: boolean; date?: DateKey } = {}) {
  st().setDay(opts.date ?? today(), (r) => S.applyChanges(r, changes, label, now(), { continueUndo: opts.continueUndo }));
}

export function applyPending(date: DateKey = today()) {
  const pending = st().getDay(date).pending;
  if (!pending) return;
  applyChanges(pending.changes, pending.title, { continueUndo: true, date });
}

export function dismissPending(date: DateKey = today()) {
  st().setDay(date, (r) => ({ ...r, pending: null }));
}

export function ignoreConflict(conflict: Conflict, date: DateKey = today()) {
  st().setDay(date, (r) => ({ ...r, ignoredConflicts: [...(r.ignoredConflicts ?? []), conflict.key] }));
}

export function undo(date: DateKey = today()) {
  st().setDay(date, (r) => S.undo(r));
}

export function clearUndo(date: DateKey = today()) {
  st().setDay(date, (r) => ({ ...r, undo: null }));
}

/**
 * Move an unfinished task to the next day as a one-off task. Returns false when the
 * task repeats on that day anyway.
 */
export function carryOver(taskId: string, from: DateKey): boolean {
  const task = st().routine.tasks.find((t) => t.id === taskId);
  if (!task) return false;
  const to = addDays(from, 1);
  if (isTaskOnDate(task, to)) return false;
  upsertTask({ ...task, id: uid(), date: to, trigger: undefined, isWakeUp: false, fixed: false, createdAt: now() });
  st().setDay(from, (r) => ({
    ...r,
    instances: { ...r.instances, [taskId]: { ...(r.instances[taskId] ?? { status: 'pending' }), status: 'skipped', movedTo: to, completedAt: now() } },
  }));
  return true;
}

export function markReviewed(date: DateKey = today()) {
  st().setDay(date, (r) => ({ ...r, reviewedAt: now() }));
}

// ---------------------------------------------------------------------------
// Place events
// ---------------------------------------------------------------------------

export interface PlaceOutcome {
  title: string;
  body: string;
  taskId: string;
  delay: number;
  adjusted: boolean;
  needsDecision: boolean;
}

/**
 * Handle arriving at / leaving a place, from the geofence task or the manual button.
 * Returns the text for the notification, or null when no task was waiting for it.
 */
export function handlePlaceEvent(placeId: string, event: PlaceEvent, source: 'geofence' | 'manual', at: number = now()): PlaceOutcome | null {
  const s = st();
  const routine = s.routine;
  const date = todayKey(at);
  let result: S.PlaceEventResult | null = null;
  s.setDay(date, (r) => {
    result = S.applyPlaceEvent(r, routine.tasks, placeId, event, at, source);
    return result.record;
  });
  const res = result as S.PlaceEventResult | null;
  if (!res?.item || res.duplicate) return null;

  const item = res.item;
  const late = res.delay >= 5 && !!res.proposal?.changes.length;
  let adjusted = false;
  let needsDecision = false;
  if (late && res.proposal) {
    if (routine.settings.autoAdjust) {
      applyChanges(res.proposal.changes, `Plan um ${res.delay} Min angepasst`, { continueUndo: true, date });
      adjusted = true;
    } else {
      const pending = S.makePending(
        'late-arrival',
        `Plan um ${res.delay} Min verschieben`,
        `Du bist ${res.delay} Minuten später angekommen als geplant.`,
        res.proposal,
        at,
      );
      s.setDay(date, (r) => ({ ...r, pending }));
      needsDecision = true;
    }
  }

  const place = routine.places.find((p) => p.id === placeId);
  const plan = getPlan(date, at);
  const next = plan.items.find((i) => i.start >= item.end && i.status === 'upcoming');
  const message = item.task.reminder.message?.trim();
  const homeArrival = place?.kind === 'home' && event === 'enter';
  const title = homeArrival ? 'Willkommen zu Hause!' : item.task.title;
  let body = message ? message.replace(/^Willkommen zu Hause!\s*/, '') : `${item.task.title} beginnt.`;
  if (adjusted) body += ` Dein Plan wurde um ${res.delay} Min angepasst${next ? ` – ${next.task.title} jetzt um ${fmtTime(next.start)}` : ''}.`;
  if (needsDecision) body += ` Du bist ${res.delay} Min später dran. Soll ich den Plan anpassen?`;
  return { title, body, taskId: item.task.id, delay: res.delay, adjusted, needsDecision };
}

// ---------------------------------------------------------------------------
// Routine actions
// ---------------------------------------------------------------------------

export function newTask(partial: Partial<TaskTemplate> = {}): TaskTemplate {
  return {
    id: uid(),
    title: '',
    description: '',
    category: 'leisure',
    start: 17 * 60,
    duration: 30,
    days: [1, 2, 3, 4, 5],
    reminder: { enabled: true, offset: 0 },
    timer: false,
    fixed: false,
    createdAt: now(),
    ...partial,
  };
}

export function upsertTask(task: TaskTemplate) {
  st().setRoutine((r) => {
    const exists = r.tasks.some((t) => t.id === task.id);
    return { ...r, tasks: exists ? r.tasks.map((t) => (t.id === task.id ? task : t)) : [...r.tasks, task] };
  });
}

export function deleteTask(id: string) {
  st().setRoutine((r) => ({ ...r, tasks: r.tasks.map((t) => (t.id === id ? { ...t, deletedAt: now() } : t)) }));
}

export function pauseTask(id: string, until: DateKey | null) {
  st().setRoutine((r) => ({
    ...r,
    tasks: r.tasks.map((t) => (t.id === id ? { ...t, pausedUntil: until ?? undefined } : t)),
  }));
}

export function updateSettings(fn: (s: Settings) => Settings) {
  st().setRoutine((r) => ({ ...r, settings: fn(r.settings) }));
}

export function updateAlarm(fn: (a: AlarmSettings) => AlarmSettings) {
  st().setRoutine((r) => ({ ...r, alarm: fn(r.alarm) }));
}

/**
 * Change or turn off the alarm for one date. A changed time also moves that day's
 * wake-up task, and the morning tasks after it if they would overlap.
 */
export function setAlarmException(date: DateKey, ex: AlarmException | null) {
  updateAlarm((a) => {
    const exceptions = { ...a.exceptions };
    if (ex) exceptions[date] = ex;
    else delete exceptions[date];
    return { ...a, exceptions };
  });
  const plan = getPlan(date);
  const wake = plan.items.find((i) => i.task.isWakeUp);
  if (!wake) return;
  if (ex && !ex.off) {
    st().setDay(date, (r) => {
      const prev = r.instances[wake.task.id] ?? { status: 'pending' as const };
      return { ...r, instances: { ...r.instances, [wake.task.id]: { ...prev, start: ex.time } } };
    });
    const updated = getPlan(date);
    const w = updated.items.find((i) => i.task.id === wake.task.id)!;
    const proposal = S.cascadeAfter(updated.items, w.task.id, w.end, { moveFixed: false });
    if (proposal.changes.length) applyChanges(proposal.changes, 'Morgen an Weckzeit angepasst', { date });
  } else {
    st().setDay(date, (r) => {
      const prev = r.instances[wake.task.id];
      if (!prev) return r;
      const { start: _drop, ...rest } = prev;
      return { ...r, instances: { ...r.instances, [wake.task.id]: rest } };
    });
  }
}

export function upsertPlace(place: Place) {
  st().setRoutine((r) => {
    const exists = r.places.some((p) => p.id === place.id);
    return { ...r, places: exists ? r.places.map((p) => (p.id === place.id ? place : p)) : [...r.places, place] };
  });
}

export function deletePlace(id: string) {
  st().setRoutine((r) => ({
    ...r,
    places: r.places.filter((p) => p.id !== id),
    tasks: r.tasks.map((t) => (t.trigger?.placeId === id ? { ...t, trigger: undefined } : t)),
  }));
}

export function updateRoutine(fn: (r: Routine) => Routine) {
  st().setRoutine(fn);
}

/**
 * Change the wake-up time of a recurring wake-up task. When getting up later, the
 * morning block after it (up to two hours, until the first fixed appointment) moves too.
 */
export function setWakeTime(taskId: string, newStart: number) {
  st().setRoutine((r) => {
    const wake = r.tasks.find((t) => t.id === taskId);
    if (!wake) return r;
    const delta = newStart - wake.start;
    const sameDays = (t: TaskTemplate) => !t.date && !t.deletedAt && t.days.length === wake.days.length && t.days.every((d) => wake.days.includes(d));
    const firstFixed = Math.min(
      24 * 60,
      ...r.tasks.filter((t) => t.fixed && !t.deletedAt && t.start > wake.start && t.days.some((d) => wake.days.includes(d))).map((t) => t.start),
    );
    const tasks = r.tasks.map((t) => {
      if (t.id === taskId) return { ...t, start: newStart };
      if (delta > 0 && sameDays(t) && !t.fixed && t.start > wake.start && t.start < wake.start + 120 && t.start < firstFixed) {
        return { ...t, start: Math.min(24 * 60 - 1, t.start + delta) };
      }
      return t;
    });
    return { ...r, tasks };
  });
}
