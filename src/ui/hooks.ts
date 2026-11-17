import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { useStore } from '@/data/store';
import { buildDayPlan, type DayPlan } from '@/domain/plan';
import { todayKey } from '@/domain/time';
import type { DateKey } from '@/domain/types';

/** Current time, refreshed every `interval` ms and when the app returns to the foreground. */
export function useNow(interval = 15000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), interval);
    const sub = AppState.addEventListener('change', (s) => s === 'active' && setNow(Date.now()));
    return () => {
      clearInterval(id);
      sub.remove();
    };
  }, [interval]);
  return now;
}

export function useToday(): DateKey {
  return todayKey(useNow(30000));
}

export function usePlan(date: DateKey, now: number): DayPlan {
  const tasks = useStore((s) => s.routine.tasks);
  const record = useStore((s) => s.days[date]);
  return useMemo(() => buildDayPlan(date, tasks, record, now), [date, tasks, record, now]);
}

export function useDay(date: DateKey) {
  return useStore((s) => s.days[date]);
}

/**
 * Load async status (permissions, scheduled alarms…) and refresh it whenever the
 * screen gains focus or the app returns to the foreground.
 */
export function useAsyncStatus<T>(load: () => Promise<T>, key?: unknown): [T | null, () => void] {
  const [value, setValue] = useState<T | null>(null);
  const [tick, setTick] = useState(0);
  const refresh = useCallback(() => setTick((t) => t + 1), []);
  const loadRef = useRef(load);
  useEffect(() => {
    loadRef.current = load;
  });
  useFocusEffect(
    useCallback(() => {
      let alive = true;
      const run = () => loadRef.current().then((v) => alive && setValue(v)).catch(() => {});
      run();
      const sub = AppState.addEventListener('change', (s) => s === 'active' && run());
      return () => {
        alive = false;
        sub.remove();
      };
    // `tick` and `key` are reload triggers, not values used inside.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tick, key]),
  );
  return [value, refresh];
}
