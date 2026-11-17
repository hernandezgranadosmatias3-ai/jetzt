/**
 * Local reminder planning.
 *
 * iOS keeps at most 64 pending local notifications per app, so reminders are planned
 * as a rolling window of concrete dates instead of one repeating trigger per task and
 * weekday. The window is rebuilt whenever the plan changes, on every app start and in
 * the periodic background refresh.
 */
import { resolveAlarm } from './alarms';
import { category } from './categories';
import { buildDayPlan } from './plan';
import { addDays, atMinutes, fmtTime, todayKey } from './time';
import type { DateKey, DayRecord, QuietHours, Routine } from './types';

export const REMINDER_HORIZON_DAYS = 3;
export const REMINDER_BUDGET = 40;
export const FOLLOW_UP_DELAY_MIN = 15;

export type ReminderKind = 'task' | 'followup';

export interface PlannedReminder {
  id: string;
  at: number;
  title: string;
  body: string;
  kind: ReminderKind;
  taskId: string;
  date: DateKey;
}

export function inQuietHours(minutes: number, q: QuietHours): boolean {
  if (!q.enabled || q.start === q.end) return false;
  const m = ((minutes % 1440) + 1440) % 1440;
  return q.start < q.end ? m >= q.start && m < q.end : m >= q.start || m < q.end;
}

export function reminderText(title: string, categoryId: Parameters<typeof category>[0], message?: string): string {
  return message?.trim() || category(categoryId).message(title);
}

export function planReminders(
  routine: Routine,
  getRecord: (date: DateKey) => DayRecord | undefined,
  now: number,
  opts: { horizonDays?: number; budget?: number; locationActive?: boolean } = {},
): PlannedReminder[] {
  const { settings, tasks, alarm } = routine;
  if (!settings.notifications.enabled) return [];
  const horizon = opts.horizonDays ?? REMINDER_HORIZON_DAYS;
  const quiet = settings.notifications.quiet;
  const today = todayKey(now);
  const out: PlannedReminder[] = [];

  for (let d = 0; d < horizon; d++) {
    const date = addDays(today, d);
    const plan = buildDayPlan(date, tasks, getRecord(date), now);
    const alarmSet = resolveAlarm(date, alarm, tasks).enabled;

    for (const item of plan.items) {
      if (item.state.status === 'done' || item.state.status === 'skipped') continue;
      const task = item.task;
      const started = item.state.status === 'active';
      const triggeredByPlace = !!task.trigger && opts.locationActive;

      // Start reminder. The wake-up task is covered by the alarm, place-triggered
      // tasks by the geofence (the time-based reminder is the fallback without location).
      if (!started && task.reminder.enabled && !(task.isWakeUp && alarmSet) && !triggeredByPlace) {
        const minute = item.start - task.reminder.offset;
        const at = atMinutes(date, minute);
        if (at > now && (task.category === 'sleep' || !inQuietHours(minute, quiet))) {
          const body = task.trigger && !opts.locationActive
            ? `${reminderText(task.title, task.category, task.reminder.message)} Tippe auf „Erledigt“, sobald du angekommen bist.`
            : reminderText(task.title, task.category, task.reminder.message);
          out.push({
            id: `r:${date}:${task.id}`,
            at,
            title: task.reminder.offset > 0 ? `${task.title} um ${fmtTime(item.start)}` : task.title,
            body,
            kind: 'task',
            taskId: task.id,
            date,
          });
        }
      }

      // Gentle follow-up when a task is still open after its end.
      if (settings.notifications.followUps && task.reminder.enabled && !(started && task.timer) && item.duration >= 10 && !task.fixed && task.category !== 'sleep') {
        const minute = item.end + FOLLOW_UP_DELAY_MIN;
        const at = atMinutes(date, minute);
        if (at > now && !inQuietHours(minute, quiet)) {
          out.push({
            id: `f:${date}:${task.id}`,
            at,
            title: `Noch offen: ${task.title}`,
            body: 'Schon erledigt? Hake die Aufgabe ab oder verschiebe sie auf später.',
            kind: 'followup',
            taskId: task.id,
            date,
          });
        }
      }
    }
  }

  return out.sort((a, b) => a.at - b.at).slice(0, opts.budget ?? REMINDER_BUDGET);
}
