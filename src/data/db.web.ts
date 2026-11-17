/**
 * Web version of the local database: the browser's localStorage, with the same
 * synchronous API as the SQLite version in db.ts. Data stays in this browser only.
 * On the iPhone, the web app added to the home screen keeps its own storage.
 */
import { defaultRoutine } from '@/domain/defaults';
import type { DateKey, DayRecord, Routine } from '@/domain/types';

import { normalizeRoutine } from './normalize';

export { normalizeRoutine };

const PREFIX = 'jetzt:';
const ROUTINE = `${PREFIX}routine`;
const DAY = `${PREFIX}day:`;
const META = `${PREFIX}meta:`;

function get(key: string): string | null {
  try {
    return globalThis.localStorage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function set(key: string, value: string): void {
  try {
    globalThis.localStorage?.setItem(key, value);
  } catch (e) {
    console.warn('[db] Speichern nicht möglich', e);
  }
}

export function loadRoutine(): Routine {
  const raw = get(ROUTINE);
  if (!raw) return defaultRoutine();
  try {
    return normalizeRoutine(JSON.parse(raw));
  } catch {
    return defaultRoutine();
  }
}

export function saveRoutine(routine: Routine): void {
  set(ROUTINE, JSON.stringify(routine));
}

export function loadDay(date: DateKey): DayRecord | undefined {
  const raw = get(DAY + date);
  return raw ? (JSON.parse(raw) as DayRecord) : undefined;
}

export function loadDays(from: DateKey, to: DateKey): Record<DateKey, DayRecord> {
  const out: Record<DateKey, DayRecord> = {};
  try {
    const ls = globalThis.localStorage;
    for (let i = 0; ls && i < ls.length; i++) {
      const key = ls.key(i);
      if (!key?.startsWith(DAY)) continue;
      const date = key.slice(DAY.length);
      if (date < from || date > to) continue;
      const raw = ls.getItem(key);
      if (raw) out[date] = JSON.parse(raw);
    }
  } catch {
    // Storage not available (private mode): start empty.
  }
  return out;
}

export function saveDay(record: DayRecord): void {
  set(DAY + record.date, JSON.stringify(record));
}

export function getMeta(key: string): string | null {
  return get(META + key);
}

export function setMeta(key: string, value: string): void {
  set(META + key, value);
}

export function resetDatabase(): void {
  try {
    const ls = globalThis.localStorage;
    const keys: string[] = [];
    for (let i = 0; ls && i < ls.length; i++) {
      const k = ls.key(i);
      if (k?.startsWith(PREFIX)) keys.push(k);
    }
    keys.forEach((k) => ls?.removeItem(k));
  } catch {
    // ignore
  }
}
