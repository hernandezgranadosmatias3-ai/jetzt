/**
 * Local notifications (expo-notifications).
 *
 * Three different mechanisms are kept apart on purpose:
 * 1. Local notifications (this file): reminders, timer end, arrival messages and the
 *    alarm fallback. Planned on the device, no server, work offline.
 * 2. Real alarms (`alarm.ts` + native module): AlarmKit on iOS, AlarmManager on Android.
 *    They ring through silent mode / Focus and show a full-screen alarm.
 * 3. Push notifications (remote, via APNs/FCM) are not used. Everything the app needs is
 *    known on the device. They would only become relevant for cloud sync between devices.
 */
import * as Notifications from 'expo-notifications';
import { AndroidAudioContentType, AndroidAudioUsage, AndroidImportance, AndroidNotificationVisibility } from 'expo-notifications';
import { Platform } from 'react-native';

import { nextOccurrence, type AlarmSpec } from '@/domain/alarms';
import { planReminders } from '@/domain/reminders';
import { fmtTime } from '@/domain/time';
import type { AlarmSettings, DateKey, DayRecord, Routine, TaskTemplate, TimerState } from '@/domain/types';
import { timerRemainingMs } from '@/domain/plan';

export const CATEGORY = {
  task: 'task_reminder',
  timer: 'timer_end',
  arrival: 'arrival',
  alarm: 'wake_alarm',
} as const;

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

export const CHANNEL = {
  reminders: 'reminders',
  timer: 'timer',
  location: 'location',
  alarm: 'alarm',
} as const;

export type NotificationData = {
  kind: 'task' | 'followup' | 'timer' | 'place' | 'alarm' | 'snooze';
  taskId?: string;
  date?: DateKey;
  hash?: string;
};

/**
 * On iOS, actions open the app: JavaScript is not guaranteed to run for a background
 * action when the app was terminated. On Android the background notification task
 * handles actions without opening the app.
 */
const background = Platform.OS === 'android';

export async function setupNotifications(): Promise<void> {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL.reminders, {
      name: 'Erinnerungen',
      description: 'Erinnerungen an Aufgaben aus deinem Tagesplan',
      importance: AndroidImportance.HIGH,
    });
    await Notifications.setNotificationChannelAsync(CHANNEL.timer, {
      name: 'Timer',
      description: 'Meldung, wenn die geplante Zeit einer Aufgabe abgelaufen ist',
      importance: AndroidImportance.HIGH,
    });
    await Notifications.setNotificationChannelAsync(CHANNEL.location, {
      name: 'Ankunft und Abfahrt',
      description: 'Meldungen beim Ankommen und Verlassen deiner Orte',
      importance: AndroidImportance.DEFAULT,
    });
    await Notifications.setNotificationChannelAsync(CHANNEL.alarm, {
      name: 'Wecker (Ersatz)',
      description: 'Wird nur genutzt, wenn echte Wecker nicht erlaubt sind',
      importance: AndroidImportance.MAX,
      sound: 'sanft.wav',
      bypassDnd: true,
      lockscreenVisibility: AndroidNotificationVisibility.PUBLIC,
      audioAttributes: { usage: AndroidAudioUsage.ALARM, contentType: AndroidAudioContentType.SONIFICATION },
    });
  }

  const opts = { opensAppToForeground: !background };
  await Promise.all([
    Notifications.setNotificationCategoryAsync(CATEGORY.task, [
      { identifier: ACTION.done, buttonTitle: 'Erledigt', options: opts },
      { identifier: ACTION.later, buttonTitle: 'Später', options: opts },
    ]),
    Notifications.setNotificationCategoryAsync(CATEGORY.timer, [
      { identifier: ACTION.complete, buttonTitle: 'Abschließen', options: opts },
      { identifier: ACTION.extend10, buttonTitle: '+10 Minuten', options: opts },
    ]),
    Notifications.setNotificationCategoryAsync(CATEGORY.arrival, [
      { identifier: ACTION.adjust, buttonTitle: 'Plan anpassen', options: opts },
      { identifier: ACTION.keep, buttonTitle: 'Plan beibehalten', options: opts },
    ]),
    Notifications.setNotificationCategoryAsync(CATEGORY.alarm, [
      { identifier: ACTION.awake, buttonTitle: 'Ich bin wach', options: opts },
      { identifier: ACTION.snoozeAlarm, buttonTitle: 'Schlummern', options: opts },
    ]),
  ]);
}

export async function notificationPermission(): Promise<'granted' | 'denied' | 'undetermined'> {
  const p = await Notifications.getPermissionsAsync();
  if (p.granted) return 'granted';
  return p.canAskAgain ? 'undetermined' : 'denied';
}

export async function requestNotificationPermission(): Promise<boolean> {
  const p = await Notifications.requestPermissionsAsync({
    ios: { allowAlert: true, allowSound: true, allowBadge: false },
  });
  return p.granted;
}

function hashOf(...parts: (string | number | undefined)[]): string {
  return parts.join('|');
}

async function scheduledWithPrefix(prefixes: string[]) {
  const all = await Notifications.getAllScheduledNotificationsAsync();
  return all.filter((n) => prefixes.some((p) => n.identifier.startsWith(p)));
}

/** Reconcile the rolling window of task reminders with what the OS has scheduled. */
export async function syncReminders(
  routine: Routine,
  getRecord: (date: DateKey) => DayRecord | undefined,
  now: number,
  locationActive: boolean,
): Promise<number> {
  const planned = planReminders(routine, getRecord, now, { locationActive });
  const desired = new Map(planned.map((p) => [p.id, { ...p, hash: hashOf(p.at, p.title, p.body) }]));
  const existing = await scheduledWithPrefix(['r:', 'f:']);

  for (const n of existing) {
    const want = desired.get(n.identifier);
    const hash = (n.content.data as NotificationData | undefined)?.hash;
    if (want && want.hash === hash) desired.delete(n.identifier);
    else await Notifications.cancelScheduledNotificationAsync(n.identifier);
  }
  for (const p of desired.values()) {
    await Notifications.scheduleNotificationAsync({
      identifier: p.id,
      content: {
        title: p.title,
        body: p.body,
        sound: 'default',
        categoryIdentifier: CATEGORY.task,
        interruptionLevel: 'active',
        data: { kind: p.kind, taskId: p.taskId, date: p.date, hash: p.hash } satisfies NotificationData,
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: p.at, channelId: CHANNEL.reminders },
    });
  }
  return planned.length;
}

const TIMER_ID = 't:timer';

export function timerEndText(task: TaskTemplate): { title: string; body: string } {
  const lead = task.category === 'learning' ? 'Deine Lernzeit ist vorbei.' : `${task.title}: Die geplante Zeit ist vorbei.`;
  return {
    title: task.category === 'learning' ? 'Lernzeit vorbei' : `${task.title} – Zeit ist um`,
    body: `${lead} Möchtest du die Aufgabe abschließen oder weitere 10 Minuten hinzufügen?`,
  };
}

/** Keep exactly one notification for the end of the running timer. */
export async function syncTimerNotification(timer: TimerState | null | undefined, task: TaskTemplate | undefined, date: DateKey, now: number) {
  const existing = (await scheduledWithPrefix([TIMER_ID]))[0];
  if (!timer || timer.runningSince == null || !task) {
    if (existing) await Notifications.cancelScheduledNotificationAsync(TIMER_ID);
    return;
  }
  const at = now + timerRemainingMs(timer, now);
  if (at <= now + 1000) {
    if (existing) await Notifications.cancelScheduledNotificationAsync(TIMER_ID);
    return;
  }
  const hash = hashOf(timer.taskId, Math.round(at / 1000));
  if (existing && (existing.content.data as NotificationData | undefined)?.hash === hash) return;
  const text = timerEndText(task);
  await Notifications.scheduleNotificationAsync({
    identifier: TIMER_ID,
    content: {
      ...text,
      sound: 'default',
      categoryIdentifier: CATEGORY.timer,
      interruptionLevel: 'timeSensitive',
      data: { kind: 'timer', taskId: task.id, date, hash } satisfies NotificationData,
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at, channelId: CHANNEL.timer },
  });
}

export async function notifyNow(title: string, body: string, data: NotificationData, category: string = CATEGORY.task) {
  await Notifications.scheduleNotificationAsync({
    content: { title, body, sound: 'default', categoryIdentifier: category, interruptionLevel: 'timeSensitive', data },
    trigger: { channelId: CHANNEL.location },
  });
}

/** "Später": show the same reminder again in a few minutes. */
export async function snoozeNotification(content: Notifications.NotificationContent, minutes: number) {
  const data = (content.data ?? {}) as NotificationData;
  await Notifications.scheduleNotificationAsync({
    identifier: `s:${data.taskId ?? 'x'}:${Date.now()}`,
    content: {
      title: content.title ?? 'Erinnerung',
      body: content.body ?? '',
      sound: 'default',
      categoryIdentifier: content.categoryIdentifier ?? CATEGORY.task,
      interruptionLevel: 'timeSensitive',
      data: { ...data, kind: 'snooze' },
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: Math.max(60, minutes * 60), channelId: CHANNEL.reminders },
  });
}

// ---------------------------------------------------------------------------
// Alarm fallback
// ---------------------------------------------------------------------------

/** Follow-up nudges after the first alarm notification, in minutes. */
const FALLBACK_REPEATS = [0, 3, 6];
const FALLBACK_ONCE_DAYS = 8;

function soundFile(alarm: AlarmSettings): string {
  return alarm.sound === 'default' ? 'default' : `${alarm.sound}.wav`;
}

/**
 * Used when real alarms are not available (iOS before 26, permission denied, Android
 * without exact-alarm permission, or a build without the native module). Repeating
 * notifications with sound; on Android scheduled via setAlarmClock. They are marked
 * time-sensitive, which only takes effect with the matching entitlement (paid Apple account).
 * They do not ring through silent mode and cannot show a full-screen alarm.
 */
export async function syncAlarmFallback(specs: AlarmSpec[], alarm: AlarmSettings, now: number) {
  const existing = await scheduledWithPrefix(['a:']);
  await Promise.all(existing.map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)));
  if (!specs.length) return 0;

  let count = 0;
  const schedule = async (id: string, extra: number, trigger: Notifications.NotificationTriggerInput, minutes: number) => {
    await Notifications.scheduleNotificationAsync({
      identifier: `a:${id}:${extra}`,
      content: {
        title: extra === 0 ? alarm.label || 'Guten Morgen' : 'Bist du wach?',
        body: extra === 0 ? `Zeit aufzustehen – ${fmtTime(minutes)}` : 'Dein Wecker hat geklingelt. Tippe auf „Ich bin wach“.',
        sound: soundFile(alarm),
        categoryIdentifier: CATEGORY.alarm,
        interruptionLevel: 'timeSensitive',
        data: { kind: 'alarm' } satisfies NotificationData,
      },
      trigger,
    });
    count++;
  };
  const dateTrigger = (at: number): Notifications.NotificationTriggerInput => ({
    type: Notifications.SchedulableTriggerInputTypes.DATE,
    date: at,
    channelId: CHANNEL.alarm,
    delivery: 'alarmClock',
  });

  for (const spec of specs) {
    const next = nextOccurrence(spec, now);
    if (spec.kind === 'once' && next - now > FALLBACK_ONCE_DAYS * 86400000) continue;
    if (spec.kind === 'weekly') {
      // The main alarm repeats weekly on its own, even if the app is not opened.
      await schedule(spec.id, 0, {
        type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
        weekday: (spec.weekday % 7) + 1, // expo: 1 = Sunday, ISO: 7 = Sunday
        hour: Math.floor(spec.minutes / 60),
        minute: spec.minutes % 60,
        channelId: CHANNEL.alarm,
        delivery: 'alarmClock',
      }, spec.minutes);
    } else {
      await schedule(spec.id, 0, dateTrigger(next), spec.minutes);
    }
    // Follow-up nudges only for the next occurrence; rebuilt on every sync.
    if (next - now < 36 * 3600000) {
      for (const extra of FALLBACK_REPEATS.slice(1)) await schedule(spec.id, extra, dateTrigger(next + extra * 60000), spec.minutes);
    }
  }
  return count;
}

export async function clearAlarmFallback() {
  const existing = await scheduledWithPrefix(['a:']);
  await Promise.all(existing.map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)));
}

/** After "Ich bin wach": drop the remaining nudges of the fallback alarm. */
export async function cancelAlarmFollowUps() {
  const followUps = (await scheduledWithPrefix(['a:'])).filter((n) => !n.identifier.endsWith(':0'));
  await Promise.all(followUps.map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)));
  const presented = await Notifications.getPresentedNotificationsAsync();
  await Promise.all(
    presented
      .filter((n) => (n.request.content.data as NotificationData | undefined)?.kind === 'alarm')
      .map((n) => Notifications.dismissNotificationAsync(n.request.identifier)),
  );
}

export async function snoozeAlarm(alarm: AlarmSettings) {
  await Notifications.scheduleNotificationAsync({
    identifier: `as:${Date.now()}`,
    content: {
      title: alarm.label || 'Guten Morgen',
      body: 'Schlummerzeit vorbei – Zeit aufzustehen.',
      sound: soundFile(alarm),
      categoryIdentifier: CATEGORY.alarm,
      interruptionLevel: 'timeSensitive',
      data: { kind: 'alarm' } satisfies NotificationData,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: alarm.snoozeMinutes * 60,
      channelId: CHANNEL.alarm,
    },
  });
}

export async function scheduledCounts(): Promise<{ reminders: number; alarms: number }> {
  const all = await Notifications.getAllScheduledNotificationsAsync();
  return {
    reminders: all.filter((n) => /^[rf]:/.test(n.identifier)).length,
    alarms: all.filter((n) => n.identifier.startsWith('a:')).length,
  };
}
