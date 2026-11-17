/**
 * Web version: browsers cannot ring an alarm while the phone sleeps. The settings
 * show the planned wake-up times so they can be set once in the iPhone's Clock app.
 */
import { planAlarms } from '@/domain/alarms';
import type { Routine } from '@/domain/types';

import type { AlarmEngine, AlarmStatus } from './alarm';

export type { AlarmEngine, AlarmStatus };

const NOTE = 'Im Browser kann Jetzt dich nicht wecken, wenn das iPhone gesperrt ist. Stell die Zeiten unten einmalig in der Uhr-App ein.';

export async function getAlarmStatus(): Promise<AlarmStatus> {
  return { engine: 'none', authorization: 'unavailable', note: NOTE };
}

export async function requestAlarmPermission(): Promise<'unavailable'> {
  return 'unavailable';
}

export async function openAlarmSettings(): Promise<void> {}

export async function syncAlarms(routine: Routine, now: number, _force = false): Promise<AlarmStatus & { count: number }> {
  return { ...(await getAlarmStatus()), count: planAlarms(routine.alarm, routine.tasks, now).length };
}

export async function scheduleTestAlarm(_routine: Routine): Promise<number> {
  return Date.now();
}
