/**
 * Background task definitions. This module is imported from the app entry (index.ts)
 * before anything else, because the OS can start the JavaScript bundle without UI
 * (geofence crossing, notification action on Android, periodic refresh) and the
 * tasks must be defined at module scope at that point.
 */
import * as BackgroundTask from 'expo-background-task';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';

import { handlePlaceEvent } from '@/data/actions';
import { useStore } from '@/data/store';
import { pruneExceptions } from '@/domain/alarms';
import { todayKey } from '@/domain/time';

import { GEOFENCE_TASK } from './location';
import { CATEGORY, notifyNow } from './notifications';
import { handleNotificationResponse } from './responses';
import { syncAll } from './sync';

export const NOTIFICATION_TASK = 'jetzt-notification-response';
export const REFRESH_TASK = 'jetzt-refresh';

type GeofenceData = { eventType: Location.GeofencingEventType; region: Location.LocationRegion };

TaskManager.defineTask<GeofenceData>(GEOFENCE_TASK, async ({ data, error }) => {
  if (error || !data?.region?.identifier) return;
  const store = useStore.getState();
  store.reload();
  const { routine } = useStore.getState();
  if (!routine.settings.location.enabled) return;
  const place = routine.places.find((p) => p.id === data.region.identifier && p.enabled);
  if (!place) return;
  const event = data.eventType === Location.GeofencingEventType.Enter ? 'enter' : 'exit';
  if ((event === 'enter' && !place.notifyOnEnter) || (event === 'exit' && !place.notifyOnExit)) return;

  const outcome = handlePlaceEvent(place.id, event, 'geofence');
  if (outcome && routine.settings.notifications.enabled) {
    await notifyNow(
      outcome.title,
      outcome.body,
      { kind: 'place', taskId: outcome.taskId, date: todayKey() },
      outcome.needsDecision ? CATEGORY.arrival : CATEGORY.task,
    );
  }
  await syncAll('geofence');
});

TaskManager.defineTask<Notifications.NotificationTaskPayload>(NOTIFICATION_TASK, async ({ data }) => {
  if (data && 'actionIdentifier' in data) {
    await handleNotificationResponse(data);
  }
  return Notifications.BackgroundNotificationTaskResult.NoData;
});

TaskManager.defineTask(REFRESH_TASK, async () => {
  try {
    useStore.getState().reload();
    useStore.getState().setRoutine((r) => ({ ...r, alarm: pruneExceptions(r.alarm, Date.now()) }));
    await syncAll('background-refresh');
    return BackgroundTask.BackgroundTaskResult.Success;
  } catch {
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

Notifications.registerTaskAsync(NOTIFICATION_TASK).catch(() => {});

/** Called once the app has started; the OS decides when the refresh actually runs. */
export async function registerBackgroundRefresh() {
  const status = await BackgroundTask.getStatusAsync();
  if (status !== BackgroundTask.BackgroundTaskStatus.Available) return;
  const registered = await TaskManager.isTaskRegisteredAsync(REFRESH_TASK);
  if (!registered) await BackgroundTask.registerTaskAsync(REFRESH_TASK, { minimumInterval: 6 * 60 });
}
