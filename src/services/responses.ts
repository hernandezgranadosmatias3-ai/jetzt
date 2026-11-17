/**
 * Handles taps on notification actions ("Erledigt", "+10 Minuten", "Plan anpassen" …),
 * both in the running app and from the background notification task (Android).
 */
import * as Notifications from 'expo-notifications';

import * as A from '@/data/actions';
import { getMeta, setMeta } from '@/data/db';
import { useStore } from '@/data/store';
import { makePending } from '@/domain/schedule';
import { todayKey } from '@/domain/time';

import { ACTION, cancelAlarmFollowUps, snoozeAlarm, snoozeNotification, type NotificationData } from './notifications';
import { syncAll } from './sync';

/** Remember handled responses: the same tap can arrive via listener and background task. */
function alreadyHandled(key: string): boolean {
  const list: string[] = JSON.parse(getMeta('handledResponses') ?? '[]');
  if (list.includes(key)) return true;
  setMeta('handledResponses', JSON.stringify([...list.slice(-40), key]));
  return false;
}

/** Extend from a notification: no dialog possible, so follow the auto-adjust setting. */
export function extendFromNotification(taskId: string, minutes: number) {
  const out = A.extendTask(taskId, minutes);
  if (!out.proposal.changes.length) return;
  const { routine } = useStore.getState();
  if (routine.settings.autoAdjust && !out.proposal.movesFixed.length) {
    A.applyChanges(out.proposal.changes, `${out.item?.task.title ?? 'Aufgabe'} verlängert`, { continueUndo: true });
  } else {
    const pending = makePending('extension', 'Nachfolgende Aufgaben verschieben', `Durch die Verlängerung überschneiden sich Aufgaben.`, out.proposal, Date.now());
    useStore.getState().setDay(todayKey(), (r) => ({ ...r, pending }));
  }
}

export type ResponseRoute = '/timer' | '/' | null;

export async function handleNotificationResponse(response: Notifications.NotificationResponse): Promise<ResponseRoute> {
  const request = response.notification.request;
  const action = response.actionIdentifier;
  const key = `${request.identifier}:${action}:${response.notification.date}`;
  if (alreadyHandled(key)) return null;

  const store = useStore.getState();
  store.reload();
  const data = (request.content.data ?? {}) as NotificationData;
  const date = data.date ?? todayKey();
  const { routine } = useStore.getState();
  let route: ResponseRoute = null;

  switch (action) {
    case ACTION.done:
    case ACTION.complete:
      if (data.taskId) A.completeTask(data.taskId, date);
      break;
    case ACTION.later:
      await snoozeNotification(request.content, routine.settings.notifications.snoozeMinutes);
      break;
    case ACTION.extend10:
      if (data.taskId) extendFromNotification(data.taskId, 10);
      route = '/timer';
      break;
    case ACTION.adjust:
      A.applyPending(date);
      route = '/';
      break;
    case ACTION.keep:
      A.dismissPending(date);
      break;
    case ACTION.awake: {
      await cancelAlarmFollowUps();
      const wake = A.getPlan(todayKey()).items.find((i) => i.task.isWakeUp && i.status !== 'done');
      if (wake) A.completeTask(wake.task.id);
      break;
    }
    case ACTION.snoozeAlarm:
      await snoozeAlarm(routine.alarm);
      break;
    case Notifications.DEFAULT_ACTION_IDENTIFIER:
      route = data.kind === 'timer' ? '/timer' : '/';
      break;
  }
  await syncAll('response');
  return route;
}
