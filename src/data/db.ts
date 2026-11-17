/**
 * Local SQLite database (expo-sqlite, synchronous API).
 *
 * - `kv`   : the routine (tasks, places, settings, alarm) as one JSON document.
 * - `days` : one row per calendar day with what happened (status, shifts, timer, events).
 *
 * Everything stays on the device. The synchronous API is used on purpose: background
 * tasks (geofence, notification actions) read and write the same database before the
 * UI is mounted.
 */
import * as SQLite from 'expo-sqlite';

import { defaultRoutine } from '@/domain/defaults';
import type { DateKey, DayRecord, Routine } from '@/domain/types';

import { normalizeRoutine } from './normalize';

export { normalizeRoutine };

let db: SQLite.SQLiteDatabase | null = null;

function open(): SQLite.SQLiteDatabase {
  if (db) return db;
  db = SQLite.openDatabaseSync('jetzt.db');
  db.execSync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS days (date TEXT PRIMARY KEY NOT NULL, data TEXT NOT NULL, updated_at INTEGER NOT NULL);
  `);
  return db;
}

export function loadRoutine(): Routine {
  const row = open().getFirstSync<{ value: string }>('SELECT value FROM kv WHERE key = ?', 'routine');
  if (!row) return defaultRoutine();
  try {
    return normalizeRoutine(JSON.parse(row.value));
  } catch {
    return defaultRoutine();
  }
}

export function saveRoutine(routine: Routine): void {
  open().runSync('INSERT OR REPLACE INTO kv (key, value) VALUES (?, ?)', 'routine', JSON.stringify(routine));
}

export function loadDay(date: DateKey): DayRecord | undefined {
  const row = open().getFirstSync<{ data: string }>('SELECT data FROM days WHERE date = ?', date);
  return row ? (JSON.parse(row.data) as DayRecord) : undefined;
}

export function loadDays(from: DateKey, to: DateKey): Record<DateKey, DayRecord> {
  const rows = open().getAllSync<{ date: string; data: string }>(
    'SELECT date, data FROM days WHERE date >= ? AND date <= ? ORDER BY date',
    from,
    to,
  );
  const out: Record<DateKey, DayRecord> = {};
  for (const r of rows) out[r.date] = JSON.parse(r.data);
  return out;
}

export function saveDay(record: DayRecord): void {
  open().runSync(
    'INSERT OR REPLACE INTO days (date, data, updated_at) VALUES (?, ?, ?)',
    record.date,
    JSON.stringify(record),
    Date.now(),
  );
}

export function getMeta(key: string): string | null {
  return open().getFirstSync<{ value: string }>('SELECT value FROM kv WHERE key = ?', `meta:${key}`)?.value ?? null;
}

export function setMeta(key: string, value: string): void {
  open().runSync('INSERT OR REPLACE INTO kv (key, value) VALUES (?, ?)', `meta:${key}`, value);
}

export function resetDatabase(): void {
  open().execSync('DELETE FROM kv; DELETE FROM days;');
}
