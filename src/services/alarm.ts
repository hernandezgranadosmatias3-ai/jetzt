/**
 * Real alarms through the native module `JetztAlarm` (modules/jetzt-alarm):
 * - iOS 26+: AlarmKit. Alarms ring like the Clock app (also in silent mode and Focus),
 *   are stored by the system and survive app termination and reboots.
 * - Android: AlarmManager.setAlarmClock + full-screen alarm screen. Rescheduled after
 *   reboot, time change and app update by a BootReceiver.
 *
 * When the native engine is missing (Expo Go, iOS < 26) or not permitted, the app
 * falls back to repeating local notifications and tells the user so.
 */
import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';

import { getMeta, setMeta } from '@/data/db';
import { planAlarms, type AlarmSpec } from '@/domain/alarms';
import { todayKey } from '@/domain/time';
import type { Routine } from '@/domain/types';

import { clearAlarmFallback, notificationPermission, syncAlarmFallback } from './notifications';

type Authorization = 'authorized' | 'denied' | 'notDetermined' | 'unavailable';

interface NativeAlarm {
  id: string;
  /** ISO weekday 1–7 for weekly alarms, 0 for a single date. */
  weekday: number;
  hour: number;
  minute: number;
  /** Epoch ms for single-date alarms, 0 otherwise. */
  timestamp: number;
}

interface NativeAlarmOptions {
  title: string;
  sound: string;
  snoozeMinutes: number;
  tintColor: string;
  stopLabel: string;
  snoozeLabel: string;
}

interface JetztAlarmModule {
  getStatus(): Promise<{ engine: 'alarmkit' | 'android'; authorization: Authorization; detail?: string }>;
  requestAuthorization(): Promise<Authorization>;
  setAlarms(alarms: NativeAlarm[], options: NativeAlarmOptions): Promise<number>;
  cancelAll(): Promise<void>;
  openSettings(): Promise<void>;
}

const Native = requireOptionalNativeModule<JetztAlarmModule>('JetztAlarm');

export type AlarmEngine = 'alarmkit' | 'android' | 'notification' | 'none';

export interface AlarmStatus {
  engine: AlarmEngine;
  authorization: Authorization;
  /** Explanation shown in the settings when real alarms are not active. */
  note?: string;
}

export async function getAlarmStatus(): Promise<AlarmStatus> {
  if (Native) {
    try {
      const s = await Native.getStatus();
      if (s.authorization === 'authorized') return { engine: s.engine, authorization: s.authorization };
      const fallback = (await notificationPermission()) === 'granted' ? 'notification' : 'none';
      const note =
        s.authorization === 'unavailable'
          ? Platform.OS === 'ios'
            ? 'Echte Wecker (AlarmKit) gibt es ab iOS 26. Auf diesem Gerät weckt dich die App mit wiederholten Benachrichtigungen.'
            : 'Exakte Wecker sind auf diesem Gerät nicht verfügbar. Die App nutzt wiederholte Benachrichtigungen.'
          : s.authorization === 'denied'
            ? Platform.OS === 'ios'
              ? 'Du hast „Wecker“ für diese App nicht erlaubt. Erlaube es in den Einstellungen, damit der Wecker auch im Stumm-Modus klingelt.'
              : 'Die Berechtigung „Wecker und Erinnerungen“ fehlt. Ohne sie können Wecker verspätet klingeln.'
            : 'Erlaube echte Wecker, damit sie wie in der Uhr-App klingeln – auch im Stumm-Modus.';
      return { engine: fallback, authorization: s.authorization, note: s.detail ? `${note} (${s.detail})` : note };
    } catch (e) {
      return { engine: 'notification', authorization: 'unavailable', note: `Wecker-Modul nicht erreichbar: ${String(e)}` };
    }
  }
  const granted = (await notificationPermission()) === 'granted';
  return {
    engine: granted ? 'notification' : 'none',
    authorization: 'unavailable',
    note: 'Diese Version enthält das native Wecker-Modul nicht (z. B. Expo Go). Bitte einen Development Build nutzen. Bis dahin weckt dich die App mit Benachrichtigungen.',
  };
}

export async function requestAlarmPermission(): Promise<Authorization> {
  if (!Native) return 'unavailable';
  return Native.requestAuthorization();
}

export async function openAlarmSettings(): Promise<void> {
  if (Native) await Native.openSettings();
}

function toNative(spec: AlarmSpec): NativeAlarm {
  const hour = Math.floor(spec.minutes / 60);
  const minute = spec.minutes % 60;
  return spec.kind === 'weekly'
    ? { id: spec.id, weekday: spec.weekday, hour, minute, timestamp: 0 }
    : { id: spec.id, weekday: 0, hour, minute, timestamp: spec.at };
}

/** Ring once in about a minute, to try sound and permissions on the device. */
export async function scheduleTestAlarm(routine: Routine): Promise<number> {
  const at = Math.ceil((Date.now() + 60000) / 60000) * 60000;
  setMeta('alarmTestAt', String(at));
  await syncAlarms(routine, Date.now(), true);
  return at;
}

/**
 * Schedule the wake-up alarms with the best available engine. Skips the native call
 * when nothing changed, because AlarmKit replaces alarms by cancelling and re-adding.
 */
export async function syncAlarms(routine: Routine, now: number, force = false): Promise<AlarmStatus & { count: number }> {
  const specs = planAlarms(routine.alarm, routine.tasks, now);
  // A test alarm from the settings stays scheduled until it has rung.
  const testAt = Number(getMeta('alarmTestAt') ?? 0);
  if (testAt > now) {
    const d = new Date(testAt);
    specs.push({ id: 'test', kind: 'once', date: todayKey(testAt), minutes: d.getHours() * 60 + d.getMinutes(), at: testAt });
  }
  const status = await getAlarmStatus();
  const a = routine.alarm;
  const options: NativeAlarmOptions = {
    title: a.label || 'Guten Morgen',
    sound: a.sound,
    snoozeMinutes: a.snoozeMinutes,
    tintColor: '#1F7A57',
    stopLabel: 'Stopp',
    snoozeLabel: 'Schlummern',
  };
  const native = Native && status.authorization === 'authorized';
  const hash = JSON.stringify({ engine: status.engine, specs: specs.map(toNative), options, day: new Date(now).toDateString() });
  if (!force && getMeta('alarmHash') === hash) return { ...status, count: specs.length };

  if (native && Native) {
    await Native.setAlarms(specs.map(toNative), options);
    await clearAlarmFallback();
  } else {
    if (Native) await Native.cancelAll().catch(() => {});
    if (status.engine === 'notification') await syncAlarmFallback(specs, a, now);
  }
  setMeta('alarmHash', hash);
  return { ...status, count: specs.length };
}
