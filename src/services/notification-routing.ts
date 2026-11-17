import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect } from 'react';

import { useStore } from '@/data/store';

import { handleNotificationResponse } from './responses';

/** Handle taps on notifications and their buttons, also when they launched the app. */
export function useNotificationRouting(ready: boolean) {
  const lastResponse = Notifications.useLastNotificationResponse();
  useEffect(() => {
    if (!ready || !lastResponse) return;
    handleNotificationResponse(lastResponse).then((route) => {
      if (route && useStore.getState().routine.onboarded) router.navigate(route);
    });
  }, [ready, lastResponse]);
}
