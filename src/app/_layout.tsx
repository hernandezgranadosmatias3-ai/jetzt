import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo } from 'react';
import { Appearance, AppState } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { useStore } from '@/data/store';
import { registerBackgroundRefresh } from '@/services/background';
import { setupNotifications } from '@/services/notifications';
import { useNotificationRouting } from '@/services/notification-routing';
import { startSyncWatcher, syncAll } from '@/services/sync';
import { NoticeBanner } from '@/ui/notice-banner';
import { palettes, useScheme } from '@/ui/theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const hydrated = useStore((s) => s.hydrated);
  const onboarded = useStore((s) => s.routine.onboarded);
  const themePref = useStore((s) => s.routine.settings.theme);
  const scheme = useScheme();
  const c = palettes[scheme];

  useEffect(() => {
    useStore.getState().hydrate();
  }, []);

  // Native controls (date pickers, tab bar, sheets) follow the in-app theme choice.
  useEffect(() => {
    // Not available in every browser.
    if (typeof Appearance.setColorScheme === 'function') Appearance.setColorScheme(themePref === 'system' ? 'unspecified' : themePref);
  }, [themePref]);

  useEffect(() => {
    if (!hydrated) return;
    SplashScreen.hideAsync().catch(() => {});
    startSyncWatcher();
    setupNotifications()
      .catch((e) => console.warn('[notifications] setup', e))
      .finally(() => syncAll('launch', { force: true }));
    registerBackgroundRefresh().catch(() => {});
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      useStore.getState().reload();
      syncAll('foreground');
    });
    return () => sub.remove();
  }, [hydrated]);

  // Taps on notifications and their action buttons, also when they launched the app.
  useNotificationRouting(hydrated);

  const navTheme = useMemo(() => {
    const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: { ...base.colors, primary: c.accent, background: c.bg, card: c.card, text: c.text, border: c.separator },
    };
  }, [scheme, c]);

  if (!hydrated) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider value={navTheme}>
        <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
        <Stack screenOptions={{ headerTintColor: c.accent, headerTitleStyle: { color: c.text }, contentStyle: { backgroundColor: c.bg } }}>
          <Stack.Protected guard={onboarded}>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="timer" options={{ presentation: 'fullScreenModal', headerShown: false, animation: 'slide_from_bottom' }} />
            <Stack.Screen
              name="extend"
              options={{
                presentation: 'formSheet',
                headerShown: false,
                sheetAllowedDetents: 'fitToContents',
                sheetGrabberVisible: true,
                sheetCornerRadius: 24,
                contentStyle: { backgroundColor: c.bg },
              }}
            />
            <Stack.Screen name="task/[id]" options={{ presentation: 'modal', title: 'Aufgabe' }} />
            <Stack.Screen name="review" options={{ presentation: 'modal', title: 'Tagesrückblick' }} />
          </Stack.Protected>
          <Stack.Protected guard={!onboarded}>
            <Stack.Screen name="onboarding" options={{ headerShown: false, gestureEnabled: false }} />
          </Stack.Protected>
        </Stack>
        <NoticeBanner />
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
