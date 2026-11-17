/**
 * Run with TZ=Europe/Berlin (see package.json) so the daylight-saving cases are real.
 */
import { describe, expect, it } from '@jest/globals';

import { nextAlarm, planAlarms } from '../alarms';
import { defaultAlarm, defaultRoutine, defaultTasks } from '../defaults';
import { buildDayPlan, findConflicts, timerRemainingMs } from '../plan';
import { inQuietHours, planReminders } from '../reminders';
import {
  applyChanges,
  applyPlaceEvent,
  cascadeAfter,
  completeTask,
  emptyRecord,
  extendTask,
  pauseTimer,
  resumeTimer,
  startTask,
  undo,
} from '../schedule';
import { summarizeDay } from '../stats';
import { atMinutes, fmtCountdown, fmtTime, minutesOfDay, weekdayOfKey } from '../time';
import type { DayRecord } from '../types';

const TUE = '2026-11-17'; // a school day
const at = (h: number, m: number, date = TUE) => atMinutes(date, h * 60 + m);
const tasks = defaultTasks(0);

describe('time', () => {
  it('uses ISO weekdays', () => {
    expect(weekdayOfKey(TUE)).toBe(2);
    expect(weekdayOfKey('2026-11-22')).toBe(7);
  });

  it('keeps wall-clock times across daylight-saving changes', () => {
    // Europe/Berlin: clocks go back on 25 Oct 2026 and forward on 28 Mar 2027.
    const autumn = new Date(atMinutes('2026-10-25', 6 * 60 + 20));
    expect([autumn.getHours(), autumn.getMinutes()]).toEqual([6, 20]);
    const spring = new Date(atMinutes('2027-03-28', 6 * 60 + 20));
    expect([spring.getHours(), spring.getMinutes()]).toEqual([6, 20]);
    // The day before the autumn change is 25 hours long.
    expect(atMinutes('2026-10-26', 0) - atMinutes('2026-10-25', 0)).toBe(25 * 3600 * 1000);
  });

  it('formats', () => {
    expect(fmtTime(16 * 60 + 30)).toBe('16:30');
    expect(fmtCountdown(59 * 60 * 1000 + 59 * 1000)).toBe('59:59');
  });
});

describe('day plan', () => {
  it('answers "what now" during homework time', () => {
    const plan = buildDayPlan(TUE, tasks, undefined, at(16, 45));
    expect(plan.focus?.task.title).toBe('Hausaufgaben');
    expect(plan.next?.task.title).toBe('Spaziergang und Meditation');
    expect(plan.items.find((i) => i.task.id === 'breakfast-school')?.status).toBe('missed');
  });

  it('shows the school-day routine in order', () => {
    const plan = buildDayPlan(TUE, tasks, undefined, at(5, 0));
    expect(plan.items.map((i) => fmtTime(i.start))).toEqual([
      '06:20', '06:40', '07:00', '07:30', '16:00', '16:30', '17:30', '18:30', '19:00', '20:30', '21:00', '21:30', '22:00',
    ]);
  });

  it('computes progress without counting skipped tasks', () => {
    let r: DayRecord = emptyRecord(TUE);
    r = completeTask(r, 'wake-school', at(6, 30));
    r = completeTask(r, 'breakfast-school', at(7, 0));
    r = { ...r, instances: { ...r.instances, getready: { status: 'skipped' } } };
    const plan = buildDayPlan(TUE, tasks, r, at(8, 0));
    expect(plan.stats).toMatchObject({ total: 13, done: 2, skipped: 1, percent: Math.round((2 / 12) * 100) });
  });
});

describe('timer', () => {
  it('keeps counting from timestamps across pauses', () => {
    const plan = buildDayPlan(TUE, tasks, undefined, at(16, 30));
    let r = startTask(emptyRecord(TUE), plan.focus!, at(16, 30));
    expect(timerRemainingMs(r.timer!, at(16, 40))).toBe(50 * 60000);
    r = pauseTimer(r, at(16, 40));
    expect(timerRemainingMs(r.timer!, at(17, 0))).toBe(50 * 60000);
    r = resumeTimer(r, at(17, 0));
    expect(timerRemainingMs(r.timer!, at(17, 10))).toBe(40 * 60000);
    r = completeTask(r, 'homework', at(17, 10));
    expect(r.instances.homework).toMatchObject({ status: 'done', actualMinutes: 20 });
    expect(r.timer).toBeNull();
  });
});

describe('extending a task', () => {
  it('extends homework by 15 minutes and proposes to move the following tasks', () => {
    const now = at(17, 0);
    let r = startTask(emptyRecord(TUE), buildDayPlan(TUE, tasks, undefined, at(16, 30)).focus!, at(16, 30));
    const plan = buildDayPlan(TUE, tasks, r, now);
    const result = extendTask(r, plan, 'homework', 15, now);
    expect(result.item.end).toBe(17 * 60 + 45);
    expect(result.proposal.changes[0]).toEqual({ taskId: 'walk', from: 17 * 60 + 30, to: 17 * 60 + 45 });
    // Bedtime is fixed: the cascade stops there instead of moving it.
    expect(result.proposal.blockedBy.map((i) => i.task.id)).toEqual(['sleep']);
    expect(result.proposal.changes.map((c) => c.taskId)).not.toContain('sleep');

    r = applyChanges(result.record, result.proposal.changes, 'test', now);
    const after = buildDayPlan(TUE, tasks, r, now);
    expect(after.items.find((i) => i.task.id === 'walk')?.start).toBe(17 * 60 + 45);
    expect(after.items.find((i) => i.task.id === 'walk')?.state.shiftedBy).toBe(15);
    // The remaining overlap with the fixed bedtime is reported as a conflict.
    expect(findConflicts(after, minutesOfDay(now)).map((c) => c.key)).toEqual(['evening|sleep']);
  });

  it('absorbs free gaps instead of moving everything', () => {
    const custom = tasks.map((t) => (t.id === 'walk' ? { ...t, start: 18 * 60 } : t)); // 30 min gap before walk
    const plan = buildDayPlan(TUE, custom, undefined, at(16, 30));
    const p = cascadeAfter(plan.items, 'homework', 17 * 60 + 45, { moveFixed: false });
    expect(p.changes).toEqual([]);
  });

  it('undo restores the previous plan', () => {
    const now = at(17, 0);
    const plan = buildDayPlan(TUE, tasks, undefined, now);
    const res = extendTask(emptyRecord(TUE), plan, 'homework', 10, now);
    const r = undo(applyChanges(res.record, res.proposal.changes, 'x', now, { continueUndo: true }));
    expect(buildDayPlan(TUE, tasks, r, now).items.find((i) => i.task.id === 'homework')?.duration).toBe(60);
  });
});

describe('arriving home', () => {
  it('starts the break at the real arrival and shifts the afternoon', () => {
    const res = applyPlaceEvent(emptyRecord(TUE), tasks, 'home', 'enter', at(16, 20), 'geofence');
    expect(res.item?.task.id).toBe('home');
    expect(res.delay).toBe(20);
    expect(res.record.instances.home).toMatchObject({ status: 'active', start: 16 * 60 + 20 });
    expect(res.proposal?.changes[0]).toEqual({ taskId: 'homework', from: 16 * 60 + 30, to: 16 * 60 + 50 });
  });

  it('does not shift anything when arriving on time', () => {
    const res = applyPlaceEvent(emptyRecord(TUE), tasks, 'home', 'enter', at(16, 2), 'geofence');
    expect(res.item?.task.id).toBe('home');
    expect(res.proposal).toBeNull();
  });

  it('ignores events far away from any triggered task', () => {
    const res = applyPlaceEvent(emptyRecord(TUE), tasks, 'home', 'enter', at(10, 0), 'geofence');
    expect(res.item).toBeNull();
    expect(res.record.events).toHaveLength(1);
  });

  it('marks school as started when leaving home without moving it', () => {
    const res = applyPlaceEvent(emptyRecord(TUE), tasks, 'home', 'exit', at(7, 38), 'geofence');
    expect(res.item?.task.id).toBe('school');
    expect(res.record.instances.school).toMatchObject({ status: 'active' });
    expect(res.record.instances.school.start).toBeUndefined();
    expect(res.proposal).toBeNull();
  });
});

describe('alarms', () => {
  const alarm = defaultAlarm();

  it('plans weekly alarms from the routine', () => {
    const specs = planAlarms(alarm, tasks, at(21, 0));
    expect(specs).toHaveLength(7);
    expect(specs.find((s) => s.kind === 'weekly' && s.weekday === 1)?.minutes).toBe(6 * 60 + 20);
    expect(specs.find((s) => s.kind === 'weekly' && s.weekday === 6)?.minutes).toBe(8 * 60 + 30);
  });

  it('follows the routine when the wake-up task changes', () => {
    const moved = tasks.map((t) => (t.id === 'wake-school' ? { ...t, start: 6 * 60 } : t));
    expect(planAlarms(alarm, moved, at(21, 0)).find((s) => s.kind === 'weekly' && s.weekday === 3)?.minutes).toBe(6 * 60);
  });

  it('turns one day off without losing the other weeks', () => {
    const a = { ...alarm, exceptions: { '2026-11-18': { off: true as const } } };
    const specs = planAlarms(a, tasks, at(21, 0));
    expect(specs.some((s) => s.kind === 'weekly' && s.weekday === 3)).toBe(false);
    const wednesdays = specs.filter((s) => s.kind === 'once').map((s) => (s.kind === 'once' ? s.date : ''));
    expect(wednesdays).toEqual(['2026-11-25', '2026-12-02', '2026-12-09']);
    expect(nextAlarm(a, tasks, at(21, 0))?.date).toBe('2026-11-19');
  });

  it('supports a one-off wake-up time', () => {
    const a = { ...alarm, exceptions: { '2026-11-18': { time: 7 * 60 } } };
    const n = nextAlarm(a, tasks, at(21, 0));
    expect(n).toMatchObject({ date: '2026-11-18', minutes: 7 * 60, source: 'exception' });
  });

  it('uses custom weekend times', () => {
    const a = { ...alarm, days: { ...alarm.days, 6: { enabled: true, mode: 'custom' as const, time: 9 * 60 + 15 } } };
    expect(planAlarms(a, tasks, at(21, 0)).find((s) => s.kind === 'weekly' && s.weekday === 6)?.minutes).toBe(9 * 60 + 15);
  });
});

describe('reminders', () => {
  it('respects quiet hours across midnight', () => {
    const q = { enabled: true, start: 22 * 60 + 15, end: 6 * 60 };
    expect(inQuietHours(23 * 60, q)).toBe(true);
    expect(inQuietHours(5 * 60, q)).toBe(true);
    expect(inQuietHours(6 * 60, q)).toBe(false);
  });

  it('plans the rest of today plus the next days without the wake-up task', () => {
    const routine = defaultRoutine();
    const list = planReminders(routine, () => undefined, at(16, 10));
    expect(list[0]).toMatchObject({ id: `r:${TUE}:homework`, title: 'Hausaufgaben', body: 'Zeit für deine Hausaufgaben.' });
    expect(list.some((r) => r.taskId === 'wake-school')).toBe(false);
    expect(list.length).toBeLessThanOrEqual(40);
    expect(list.every((r, i) => i === 0 || list[i - 1].at <= r.at)).toBe(true);
  });

  it('skips done tasks and the start reminder of geofenced tasks when location is active', () => {
    const routine = defaultRoutine();
    const rec = completeTask(emptyRecord(TUE), 'homework', at(15, 0));
    const list = planReminders(routine, (d) => (d === TUE ? rec : undefined), at(15, 0), { locationActive: true });
    expect(list.some((r) => r.id === `r:${TUE}:homework`)).toBe(false);
    expect(list.some((r) => r.id === `r:${TUE}:home`)).toBe(false);
  });
});

describe('stats', () => {
  it('summarizes a day', () => {
    let r = completeTask(emptyRecord(TUE), 'homework', at(17, 30));
    r = { ...r, instances: { ...r.instances, walk: { status: 'pending', shiftedBy: 15 } } };
    const s = summarizeDay(TUE, tasks, r, at(23, 0));
    expect(s).toMatchObject({ hasData: true, done: 1, shifted: 1, total: 13 });
  });
});
