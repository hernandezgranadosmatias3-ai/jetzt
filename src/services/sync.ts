/**
 * Keeps the operating system in line with the plan: reminders, timer notification,
 * alarms and geofences. Runs after every change (debounced), on app start, when the
 * app comes back to the foreground and in the periodic background refresh.
 */
import { useStore } from '@/data/store';
import { todayKey } from '@/domain/time';

import { syncAlarms } from './alarm';
import { isLocationActive, syncGeofences } from './location';
import { notificationPermission, syncReminders, syncTimerNotification } from './notifications';

let timeout: ReturnType<typeof setTimeout> | null = null;
let running: Promise<void> | null = null;
let again = false;

export async function syncAll(reason: string, opts: { force?: boolean } = {}): Promise<void> {
  if (running) {
    again = true;
    return running;
  }
  running = (async () => {
    try {
      const s = useStore.getState();
      const routine = s.routine;
      const now = Date.now();
      const today = todayKey(now);
      const notificationsAllowed = (await notificationPermission()) === 'granted';
      const locationActive = await isLocationActive(routine).catch(() => false);

      if (notificationsAllowed) {
        await syncReminders(routine, (d) => useStore.getState().days[d], now, locationActive);
        const record = s.getDay(today);
        const task = routine.tasks.find((t) => t.id === record.timer?.taskId);
        await syncTimerNotification(record.timer, task, today, now);
      }
      await syncAlarms(routine, now, opts.force);
      await syncGeofences(routine, opts.force).catch((e) => console.warn('[sync] geofences', e));
    } catch (e) {
      console.warn(`[sync:${reason}]`, e);
    }
  })();
  await running;
  running = null;
  if (again) {
    again = false;
    await syncAll('queued');
  }
}

export function scheduleSync(reason = 'change', delay = 400) {
  if (timeout) clearTimeout(timeout);
  timeout = setTimeout(() => {
    timeout = null;
    syncAll(reason);
  }, delay);
}

let unsubscribe: (() => void) | null = null;

/** Re-sync whenever the routine or a day record changes. */
export function startSyncWatcher() {
  if (unsubscribe) return;
  unsubscribe = useStore.subscribe((state, prev) => {
    if (state.routine !== prev.routine || state.days !== prev.days) scheduleSync();
  });
}
