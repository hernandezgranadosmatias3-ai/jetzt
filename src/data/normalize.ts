import { defaultRoutine, ROUTINE_VERSION } from '@/domain/defaults';
import type { Routine } from '@/domain/types';

/** Fill in fields added in later versions so old data keeps working. */
export function normalizeRoutine(raw: Partial<Routine>): Routine {
  const base = defaultRoutine();
  return {
    ...base,
    ...raw,
    version: ROUTINE_VERSION,
    profile: { ...base.profile, ...raw.profile },
    tasks: raw.tasks ?? base.tasks,
    places: raw.places ?? [],
    settings: {
      ...base.settings,
      ...raw.settings,
      notifications: {
        ...base.settings.notifications,
        ...raw.settings?.notifications,
        quiet: { ...base.settings.notifications.quiet, ...raw.settings?.notifications?.quiet },
      },
      location: { ...base.settings.location, ...raw.settings?.location },
    },
    alarm: {
      ...base.alarm,
      ...raw.alarm,
      days: { ...base.alarm.days, ...raw.alarm?.days },
      exceptions: raw.alarm?.exceptions ?? {},
    },
  };
}
