import { Tabs } from 'expo-router';

import { Icon, type IconName } from '@/ui/kit';
import { useColors } from '@/ui/theme';

/** Web: classic bottom tab bar (the native tab bar is iOS/Android only). */
export default function TabsLayout() {
  const c = useColors();
  const icon = (name: IconName) =>
    function TabIcon({ color }: { color: unknown }) {
      return <Icon name={name} size={22} color={String(color)} />;
    };
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: c.accent,
        tabBarInactiveTintColor: c.text2,
        tabBarStyle: { backgroundColor: c.card, borderTopColor: c.separator },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        sceneStyle: { backgroundColor: c.bg },
      }}>
      <Tabs.Screen name="(today)" options={{ title: 'Heute', tabBarIcon: icon('sun') }} />
      <Tabs.Screen name="calendar" options={{ title: 'Kalender', tabBarIcon: icon('calendar') }} />
      <Tabs.Screen name="stats" options={{ title: 'Statistik', tabBarIcon: icon('chart') }} />
      <Tabs.Screen name="settings" options={{ title: 'Einstellungen', tabBarIcon: icon('gear') }} />
    </Tabs>
  );
}
