/**
 * Statistics. Days without any record count as "no data", never as 0 %, so a day
 * the app was not opened does not look like a failure.
 */
import { CATEGORIES } from './categories';
import { buildDayPlan } from './plan';
import { addDays, todayKey } from './time';
import type { CategoryId, DateKey, DayRecord, TaskTemplate } from './types';

export interface DaySummary {
  date: DateKey;
  hasData: boolean;
  total: number;
  done: number;
  skipped: number;
  open: number;
  shifted: number;
  percent: number;
  trackedMinutes: number;
}

export function summarizeDay(date: DateKey, tasks: TaskTemplate[], record: DayRecord | undefined, now: number): DaySummary {
  const plan = buildDayPlan(date, tasks, record, now);
  const shifted = plan.items.filter((i) => (i.state.shiftedBy ?? 0) > 0).length;
  const trackedMinutes = plan.items.reduce((sum, i) => sum + (i.state.actualMinutes ?? 0), 0);
  const touched = !!record && Object.keys(record.instances).length > 0;
  return {
    date,
    hasData: touched || date === todayKey(now),
    total: plan.stats.total,
    done: plan.stats.done,
    skipped: plan.stats.skipped,
    open: plan.stats.open,
    shifted,
    percent: plan.stats.percent,
    trackedMinutes,
  };
}

export function summarizeRange(
  from: DateKey,
  days: number,
  tasks: TaskTemplate[],
  getRecord: (d: DateKey) => DayRecord | undefined,
  now: number,
): DaySummary[] {
  return Array.from({ length: days }, (_, i) => {
    const d = addDays(from, i);
    return summarizeDay(d, tasks, getRecord(d), now);
  });
}

export interface Consistency {
  /** Days with data in the range (excluding the future). */
  activeDays: number;
  /** Days that reached at least `threshold` %. */
  goodDays: number;
  /** Average completion of active days. */
  average: number;
}

export function consistency(summaries: DaySummary[], today: DateKey, threshold = 60): Consistency {
  const past = summaries.filter((s) => s.date <= today && s.hasData && s.total > 0);
  const goodDays = past.filter((s) => s.percent >= threshold).length;
  const average = past.length ? Math.round(past.reduce((a, s) => a + s.percent, 0) / past.length) : 0;
  return { activeDays: past.length, goodDays, average };
}

export interface ShiftedTask {
  task: TaskTemplate;
  count: number;
  minutes: number;
}

export function mostShifted(records: DayRecord[], tasks: TaskTemplate[], limit = 3): ShiftedTask[] {
  const map = new Map<string, ShiftedTask>();
  for (const r of records) {
    for (const [id, st] of Object.entries(r.instances)) {
      const by = st.shiftedBy ?? 0;
      if (by <= 0) continue;
      const task = tasks.find((t) => t.id === id);
      if (!task) continue;
      const entry = map.get(id) ?? { task, count: 0, minutes: 0 };
      entry.count += 1;
      entry.minutes += by;
      map.set(id, entry);
    }
  }
  return [...map.values()].sort((a, b) => b.count - a.count || b.minutes - a.minutes).slice(0, limit);
}

export interface TaskDuration {
  task: TaskTemplate;
  averageMinutes: number;
  plannedMinutes: number;
  samples: number;
}

export function averageDurations(records: DayRecord[], tasks: TaskTemplate[], limit = 5): TaskDuration[] {
  const map = new Map<string, { sum: number; n: number }>();
  for (const r of records) {
    for (const [id, st] of Object.entries(r.instances)) {
      if (!st.actualMinutes || st.actualMinutes <= 0) continue;
      const e = map.get(id) ?? { sum: 0, n: 0 };
      e.sum += st.actualMinutes;
      e.n += 1;
      map.set(id, e);
    }
  }
  const out: TaskDuration[] = [];
  for (const [id, e] of map) {
    const task = tasks.find((t) => t.id === id);
    if (!task) continue;
    out.push({ task, averageMinutes: Math.round(e.sum / e.n), plannedMinutes: task.duration, samples: e.n });
  }
  return out.sort((a, b) => b.samples - a.samples).slice(0, limit);
}

export interface CategoryShare {
  category: CategoryId;
  done: number;
}

export function doneByCategory(records: DayRecord[], tasks: TaskTemplate[]): CategoryShare[] {
  const counts = new Map<CategoryId, number>();
  for (const r of records) {
    for (const [id, st] of Object.entries(r.instances)) {
      if (st.status !== 'done') continue;
      const task = tasks.find((t) => t.id === id);
      if (!task) continue;
      counts.set(task.category, (counts.get(task.category) ?? 0) + 1);
    }
  }
  return CATEGORIES.map((c) => ({ category: c.id, done: counts.get(c.id) ?? 0 }))
    .filter((c) => c.done > 0)
    .sort((a, b) => b.done - a.done);
}

/** Average completion per week for the last `weeks` weeks (oldest first). */
export function weeklyTrend(
  weekStarts: DateKey[],
  tasks: TaskTemplate[],
  getRecord: (d: DateKey) => DayRecord | undefined,
  now: number,
): { weekStart: DateKey; average: number | null }[] {
  const today = todayKey(now);
  return weekStarts.map((ws) => {
    const c = consistency(summarizeRange(ws, 7, tasks, getRecord, now), today);
    return { weekStart: ws, average: c.activeDays ? c.average : null };
  });
}
