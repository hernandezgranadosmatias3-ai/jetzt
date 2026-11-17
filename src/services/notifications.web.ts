/**
 * Web version of the reminders.
 *
 * Browsers cannot schedule notifications for a later time. The web app therefore keeps
 * its own timers while it is open: at the right moment it plays a short tone and shows a
 * banner inside the app. If the app is in the background and the browser allows it
 * (iPhone: only for web apps on the home screen, iOS 16.4+), a system notification is
 * shown as well. When the iPhone locks the app, nothing can be shown until it is opened
 * again.
 */
import type * as Notifications from 'expo-notifications';

import type { AlarmSpec } from '@/domain/alarms';
import { timerRemainingMs } from '@/domain/plan';
import { planReminders } from '@/domain/reminders';
import type { AlarmSettings, DateKey, DayRecord, Routine, TaskTemplate, TimerState } from '@/domain/types';

import { showInAppNotice } from './in-app';

export const CATEGORY = { task: 'task_reminder', timer: 'timer_end', arrival: 'arrival', alarm: 'wake_alarm' } as const;
export const ACTION = {
  done: 'done',
  later: 'later',
  complete: 'complete',
  extend10: 'extend10',
  adjust: 'adjust',
  keep: 'keep',
  awake: 'awake',
  snoozeAlarm: 'alarm_snooze',
} as const;
export const CHANNEL = { reminders: 'reminders', timer: 'timer', location: 'location', alarm: 'alarm' } as const;

export type NotificationData = {
  kind: 'task' | 'followup' | 'timer' | 'place' | 'alarm' | 'snooze';
  taskId?: string;
  date?: DateKey;
  hash?: string;
};

/** Timers are only set for the next hours; the plan is re-synced regularly anyway. */
const WINDOW_MS = 12 * 3600 * 1000;
const timers = new Map<string, ReturnType<typeof setTimeout>>();

let audio: AudioContext | null = null;

function unlockAudio() {
  try {
    const Ctx = (globalThis as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }).AudioContext
      ?? (globalThis as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!audio && Ctx) audio = new Ctx();
    if (audio?.state === 'suspended') audio.resume();
  } catch {
    // no audio
  }
}

/** Two soft tones, like a chime. */
function chime() {
  if (!audio) return;
  const now = audio.currentTime;
  [660, 880].forEach((freq, i) => {
    const osc = audio!.createOscillator();
    const gain = audio!.createGain();
    osc.frequency.value = freq;
    osc.type = 'sine';
    gain.gain.setValueAtTime(0, now + i * 0.22);
    gain.gain.linearRampToValueAtTime(0.25, now + i * 0.22 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.22 + 0.9);
    osc.connect(gain).connect(audio!.destination);
    osc.start(now + i * 0.22);
    osc.stop(now + i * 0.22 + 1);
  });
}

async function present(title: string, body: string) {
  chime();
  showInAppNotice(title, body);
  try {
    const hidden = typeof document !== 'undefined' && document.visibilityState === 'hidden';
    if (!hidden || typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) await reg.showNotification(title, { body, icon: '/jetzt/icons/icon-192.png' });
    else new Notification(title, { body });
  } catch {
    // The in-app banner is enough.
  }
}

function scheduleAt(id: string, at: number, title: string, body: string) {
  clear(id);
  const delay = at - Date.now();
  if (delay <= 0 || delay > WINDOW_MS) return;
  timers.set(
    id,
    setTimeout(() => {
      timers.delete(id);
      present(title, body);
    }, delay),
  );
}

function clear(id: string) {
  const t = timers.get(id);
  if (t) clearTimeout(t);
  timers.delete(id);
}

function clearPrefix(prefixes: string[]) {
  for (const id of [...timers.keys()]) if (prefixes.some((p) => id.startsWith(p))) clear(id);
}

export async function setupNotifications(): Promise<void> {
  if (typeof document === 'undefined') return;
  // Browsers only allow sound after a first tap.
  document.addEventListener('pointerdown', unlockAudio, { once: false, passive: true });
}

/** In-app reminders always work while the app is open. */
export async function notificationPermission(): Promise<'granted' | 'denied' | 'undetermined'> {
  return 'granted';
}

export async function requestNotificationPermission(): Promise<boolean> {
  unlockAudio();
  try {
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') await Notification.requestPermission();
  } catch {
    // Not supported (e.g. Safari tab instead of home screen app).
  }
  return true;
}

export async function syncReminders(
  routine: Routine,
  getRecord: (date: DateKey) => DayRecord | undefined,
  now: number,
  locationActive: boolean,
): Promise<number> {
  clearPrefix(['r:', 'f:']);
  const planned = planReminders(routine, getRecord, now, { locationActive, horizonDays: 2 });
  planned.forEach((p) => scheduleAt(p.id, p.at, p.title, p.body));
  return planned.length;
}

export function timerEndText(task: TaskTemplate): { title: string; body: string } {
  const lead = task.category === 'learning' ? 'Deine Lernzeit ist vorbei.' : `${task.title}: Die geplante Zeit ist vorbei.`;
  return {
    title: task.category === 'learning' ? 'Lernzeit vorbei' : `${task.title} – Zeit ist um`,
    body: `${lead} Möchtest du die Aufgabe abschließen oder weitere 10 Minuten hinzufügen?`,
  };
}

export async function syncTimerNotification(timer: TimerState | null | undefined, task: TaskTemplate | undefined, _date: DateKey, now: number) {
  clear('t:timer');
  if (!timer || timer.runningSince == null || !task) return;
  const text = timerEndText(task);
  scheduleAt('t:timer', now + timerRemainingMs(timer, now), text.title, text.body);
}

export async function notifyNow(title: string, body: string, _data: NotificationData, _category?: string) {
  await present(title, body);
}

export async function snoozeNotification(content: Notifications.NotificationContent, minutes: number) {
  scheduleAt(`s:${Date.now()}`, Date.now() + minutes * 60000, content.title ?? 'Erinnerung', content.body ?? '');
}

export async function syncAlarmFallback(_specs: AlarmSpec[], _alarm: AlarmSettings, _now: number) {
  return 0;
}

export async function clearAlarmFallback() {}
export async function cancelAlarmFollowUps() {}
export async function snoozeAlarm(_alarm: AlarmSettings) {}

export async function scheduledCounts(): Promise<{ reminders: number; alarms: number }> {
  return { reminders: [...timers.keys()].filter((id) => /^[rf]:/.test(id)).length, alarms: 0 };
}
