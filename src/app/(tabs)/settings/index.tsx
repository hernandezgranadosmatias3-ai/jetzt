import Constants from 'expo-constants';
import { router } from 'expo-router';
import { TextInput, View, Platform } from 'react-native';

import * as A from '@/data/actions';
import { useStore } from '@/data/store';
import { nextAlarm } from '@/domain/alarms';
import { fmtRelativeDay, fmtTime, todayKey } from '@/domain/time';
import { getAlarmStatus } from '@/services/alarm';
import { getLocationStatus } from '@/services/location';
import { notificationPermission } from '@/services/notifications';
import { syncAll } from '@/services/sync';
import { ask } from '@/ui/ask';
import { useAsyncStatus, useNow } from '@/ui/hooks';
import { Row, Screen, Section, Segmented, SwitchRow, Txt } from '@/ui/kit';
import { space, useColors } from '@/ui/theme';

export default function SettingsScreen() {
  const c = useColors();
  const routine = useStore((s) => s.routine);
  const [alarm] = useAsyncStatus(getAlarmStatus, routine.alarm);
  const [loc] = useAsyncStatus(getLocationStatus, routine);
  const [notif] = useAsyncStatus(notificationPermission);
  const now = useNow(30000);
  const next = nextAlarm(routine.alarm, routine.tasks, now);
  const today = todayKey(now);

  const alarmValue = !routine.alarm.enabled ? 'Aus' : next ? `${fmtRelativeDay(next.date, today)} ${fmtTime(next.minutes)}` : '–';
  const web = Platform.OS === 'web';
  const alarmSub = web
    ? 'Zeiten für die Uhr-App'
    : alarm?.engine === 'alarmkit' ? 'Echter Wecker (AlarmKit)' : alarm?.engine === 'android' ? 'Echter Wecker (Android)' : alarm?.engine === 'notification' ? 'Ersatz über Mitteilungen' : alarm ? 'Nicht aktiv' : ' ';
  const activePlaces = routine.places.filter((p) => p.enabled).length;
  const locSub = web
    ? 'Ankunft per Tipp auf „Ich bin zu Hause“'
    : !routine.settings.location.enabled
    ? 'Aus – manuelle Bestätigung'
    : loc?.background !== 'granted'
      ? 'Berechtigung „Immer“ fehlt'
      : loc.error
        ? 'Nicht verfügbar – Ankunft per Tipp'
        : loc.monitoring
        ? `${activePlaces} ${activePlaces === 1 ? 'Ort' : 'Orte'} aktiv`
        : 'Kein Ort eingerichtet';

  return (
    <Screen>
      <Section title="Profil">
        <Row
          title="Name"
          right={
            <TextInput
              value={routine.profile.name}
              onChangeText={(name) => A.updateRoutine((r) => ({ ...r, profile: { ...r.profile, name } }))}
              placeholder="Optional"
              placeholderTextColor={c.text3}
              style={{ color: c.text2, fontSize: 17, minWidth: 140, textAlign: 'right' }}
              returnKeyType="done"
            />
          }
        />
      </Section>

      <Section title="Automatik">
        <Row title="Wecker" subtitle={alarmSub} value={alarmValue} icon="alarm" iconBg="#D9963A" onPress={() => router.push('/settings/alarm')} />
        <Row title="Standorte" subtitle={locSub} icon="location" iconBg="#3A7DBF" onPress={() => router.push('/settings/places')} />
        <Row
          title="Mitteilungen"
          subtitle={
            web
              ? routine.settings.notifications.enabled ? 'Erinnerungen, solange Jetzt offen ist' : 'Erinnerungen aus'
              : notif === 'granted' ? (routine.settings.notifications.enabled ? 'Erinnerungen an' : 'Erinnerungen aus') : notif === 'denied' ? 'Nicht erlaubt' : 'Noch nicht erlaubt'
          }
          icon="bell"
          iconBg="#CF5668"
          onPress={() => router.push('/settings/notifications')}
        />
        <SwitchRow
          title="Plan automatisch anpassen"
          subtitle="Bei Verspätung oder Verlängerung rutschen die nächsten Aufgaben nach. Feste Termine nur nach Rückfrage."
          value={routine.settings.autoAdjust}
          onChange={(autoAdjust) => A.updateSettings((s) => ({ ...s, autoAdjust }))}
          icon="sparkles"
          iconBg="#1F7A57"
        />
      </Section>

      <Section title="Routine">
        <Row title="Aufgaben verwalten" subtitle={`${routine.tasks.filter((t) => !t.deletedAt && !t.date).length} wiederkehrende Aufgaben`} icon="list" iconBg="#8160C8" onPress={() => router.push('/settings/routine')} />
      </Section>

      <Section title="Darstellung">
        <View style={{ padding: space.md }}>
          <Segmented
            value={routine.settings.theme}
            onChange={(theme) => A.updateSettings((s) => ({ ...s, theme }))}
            options={[
              { value: 'system', label: 'System' },
              { value: 'light', label: 'Hell' },
              { value: 'dark', label: 'Dunkel' },
            ]}
          />
        </View>
      </Section>

      <Section
        title="Datenschutz"
        footer={
          web
            ? 'Deine Routine und Statistiken werden nur in diesem Browser auf deinem Gerät gespeichert. Es gibt kein Konto, keine Werbung und keine Weitergabe an Dritte. Wenn du die Website-Daten in Safari löschst, sind sie weg.'
            : 'Deine Routine, Orte und Statistiken werden nur auf diesem Gerät in einer lokalen Datenbank gespeichert. Es gibt kein Konto, keine Werbung und keine Weitergabe an Dritte. Standorte werden über Geofencing des Betriebssystems erkannt, nicht durch dauerhafte GPS-Ortung.'
        }>
        <Row title="Alles auf diesem Gerät" icon="shield" iconBg="#6C6C70" />
      </Section>

      <Section title="Daten">
        <Row title="Wecker, Mitteilungen und Orte neu planen" onPress={() => syncAll('manual', { force: true })} chevron={false} />
        <Row
          title="Alles zurücksetzen"
          destructive
          chevron={false}
          onPress={() =>
            ask('Alles zurücksetzen?', 'Routine, Orte, Wecker und Statistiken werden gelöscht. Das lässt sich nicht rückgängig machen.', [
              { text: 'Abbrechen', style: 'cancel' },
              {
                text: 'Zurücksetzen',
                style: 'destructive',
                onPress: () => {
                  useStore.getState().resetAll();
                  syncAll('reset', { force: true });
                },
              },
            ])
          }
        />
      </Section>

      <Txt v="footnote" c="text3" center>
        Jetzt {Constants.expoConfig?.version ?? ''}
      </Txt>
    </Screen>
  );
}
