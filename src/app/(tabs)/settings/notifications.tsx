import { Stack, router } from 'expo-router';
import { Linking, Platform, View } from 'react-native';

import * as A from '@/data/actions';
import { useStore } from '@/data/store';
import { notificationPermission, requestNotificationPermission, scheduledCounts } from '@/services/notifications';
import { syncAll } from '@/services/sync';
import { useAsyncStatus } from '@/ui/hooks';
import { Banner, Button, Chip, Row, Screen, Section, SwitchRow, TimeField } from '@/ui/kit';
import { space } from '@/ui/theme';

const SNOOZE = [5, 10, 15, 30];

export default function NotificationSettings() {
  const settings = useStore((s) => s.routine.settings.notifications);
  const [perm, refresh] = useAsyncStatus(notificationPermission);
  const [counts] = useAsyncStatus(scheduledCounts, settings);
  const web = Platform.OS === 'web';
  const set = (patch: Partial<typeof settings>) => A.updateSettings((s) => ({ ...s, notifications: { ...s.notifications, ...patch } }));
  const q = settings.quiet;

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Mitteilungen', headerLargeTitle: false }} />

      {perm && perm !== 'granted' && (
        <Banner tone="warn" icon="bell" title="Mitteilungen sind nicht erlaubt" message="Ohne Mitteilungen kann dich die App nicht an Aufgaben oder das Ende eines Timers erinnern.">
          <Button
            label={perm === 'denied' ? 'Einstellungen öffnen' : 'Erlauben'}
            size="sm"
            onPress={async () => {
              if (perm === 'denied') await Linking.openSettings();
              else await requestNotificationPermission();
              await syncAll('notification-permission', { force: true });
              refresh();
            }}
          />
        </Banner>
      )}

      <Section footer={web ? 'Im Browser kommen Erinnerungen als Ton und Hinweis, solange Jetzt geöffnet ist. Lass die App beim Lernen einfach offen.' : perm === 'granted' && counts ? `Geplant: ${counts.reminders} Erinnerungen für die nächsten Tage${counts.alarms ? `, ${counts.alarms} Wecker-Mitteilungen` : ''}. Die Liste wird automatisch erneuert.` : undefined}>
        <SwitchRow title="Erinnerungen" subtitle="Zu Beginn jeder Aufgabe" value={settings.enabled} onChange={(enabled) => set({ enabled })} icon="bell" iconBg="#CF5668" />
        <SwitchRow title="Bei offenen Aufgaben nachfragen" subtitle="15 Minuten nach dem geplanten Ende" value={settings.followUps} onChange={(followUps) => set({ followUps })} icon="clock" iconBg="#D7743A" />
      </Section>

      <Section title="Ruhezeiten" footer="In den Ruhezeiten kommen keine Erinnerungen. Der Wecker klingelt trotzdem.">
        <SwitchRow title="Ruhezeiten" value={q.enabled} onChange={(enabled) => set({ quiet: { ...q, enabled } })} icon="moon" iconBg="#4A5677" />
        {q.enabled && <Row title="Von" right={<TimeField value={q.start} onChange={(start) => set({ quiet: { ...q, start } })} accessibilityLabel="Ruhezeit Beginn" />} />}
        {q.enabled && <Row title="Bis" right={<TimeField value={q.end} onChange={(end) => set({ quiet: { ...q, end } })} accessibilityLabel="Ruhezeit Ende" />} />}
      </Section>

      <Section title="„Später“ erinnert nach">
        <View style={{ flexDirection: 'row', gap: space.sm, padding: space.md }}>
          {SNOOZE.map((m) => (
            <Chip key={m} label={`${m} Min`} selected={settings.snoozeMinutes === m} onPress={() => set({ snoozeMinutes: m })} />
          ))}
        </View>
      </Section>

      <Section footer="Für einzelne Aufgaben kannst du die Erinnerung im Aufgaben-Editor ausschalten oder einen eigenen Text festlegen.">
        <Row title="Erinnerungen pro Aufgabe" onPress={() => router.push('/settings/routine')} />
      </Section>
    </Screen>
  );
}
