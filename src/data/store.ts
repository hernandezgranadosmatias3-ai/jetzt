/**
 * App state (zustand), written through to SQLite on every change.
 *
 * The same store is used by the UI and by background tasks. Background tasks call
 * `hydrate()` first, so they always work on the latest data from the database;
 * the UI calls `reload()` when the app returns to the foreground.
 */
import { create } from 'zustand';

import { defaultRoutine } from '@/domain/defaults';
import { tasksForDate } from '@/domain/plan';
import { emptyRecord } from '@/domain/schedule';
import { addDays, todayKey } from '@/domain/time';
import type { DateKey, DayRecord, Routine } from '@/domain/types';

import * as db from './db';

const HISTORY_DAYS = 120;
const FUTURE_DAYS = 21;

interface AppStore {
  hydrated: boolean;
  routine: Routine;
  days: Record<DateKey, DayRecord>;
  hydrate: () => void;
  reload: () => void;
  setRoutine: (fn: (r: Routine) => Routine) => void;
  getDay: (date: DateKey) => DayRecord;
  setDay: (date: DateKey, fn: (r: DayRecord) => DayRecord) => DayRecord;
  ensureDays: (from: DateKey, to: DateKey) => void;
  resetAll: () => void;
}

function loadWindow(): Record<DateKey, DayRecord> {
  const today = todayKey();
  return db.loadDays(addDays(today, -HISTORY_DAYS), addDays(today, FUTURE_DAYS));
}

export const useStore = create<AppStore>((set, get) => ({
  hydrated: false,
  routine: defaultRoutine(),
  days: {},

  hydrate: () => {
    if (get().hydrated) return;
    set({ routine: db.loadRoutine(), days: loadWindow(), hydrated: true });
  },

  reload: () => {
    set({ routine: db.loadRoutine(), days: loadWindow(), hydrated: true });
  },

  setRoutine: (fn) => {
    const routine = fn(get().routine);
    db.saveRoutine(routine);
    set({ routine });
  },

  getDay: (date) => get().days[date] ?? emptyRecord(date),

  setDay: (date, fn) => {
    const today = todayKey();
    let record = fn(get().getDay(date));
    // Keep the list of planned tasks current until the day is over; then it is frozen.
    if (date >= today) {
      record = { ...record, plannedIds: tasksForDate(get().routine.tasks, date, undefined, today).map((t) => t.id) };
    }
    db.saveDay(record);
    set({ days: { ...get().days, [date]: record } });
    return record;
  },

  ensureDays: (from, to) => {
    const missing = db.loadDays(from, to);
    const days = get().days;
    if (Object.keys(missing).every((k) => days[k])) return;
    set({ days: { ...missing, ...days } });
  },

  resetAll: () => {
    db.resetDatabase();
    set({ routine: defaultRoutine(), days: {}, hydrated: true });
  },
}));

export const store = {
  get: () => useStore.getState(),
  routine: () => useStore.getState().routine,
  day: (date: DateKey) => useStore.getState().getDay(date),
};
