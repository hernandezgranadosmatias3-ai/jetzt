import { Stack } from 'expo-router';
import { Linking, Platform, Switch, TextInput, View } from 'react-native';

import * as A from '@/data/actions';
import { useStore } from '@/data/store';
import { nextAlarm, routineWakeTime } from '@/domain/alarms';
import { WEEKDAY_LONG, addDays, fmtRelativeDay, fmtTime, todayKey } from '@/domain/time';
import type { SoundId, Weekday } from '@/domain/types';
import { getAlarmStatus, openAlarmSettings, requestAlarmPermission, scheduleTestAlarm } from '@/services/alarm';
import { requestNotificationPermission } from '@/services/notifications';
import { syncAll } from '@/services/sync';
import { tell } from '@/ui/ask';
import { useAsyncStatus, useNow } from '@/ui/hooks';
import { Banner, Button, Card, Chip, Icon, Row, Screen, Section, SwitchRow, tap, TimeField, Txt } from '@/ui/kit';
import { space, useColors } from '@/ui/theme';

const SOUNDS: { id: SoundId; label: string }[] = [
  { id: 'sanft', label: 'Sanft' },
  { id: 'glocke', label: 'Glocke' },
  { id: 'klar', label: 'Klar' },
  { id: 'default', label: 'System' },
];
const SNOOZE = [5, 9, 10, 15];

export default function AlarmSettings() {
  const c = useColors();
  const routine = useStore((s) => s.routine);
  const alarm = routine.alarm;
  const [status, refresh] = useAsyncStatus(getAlarmStatus, alarm);
  const now = useNow(30000);
  const next = nextAlarm(alarm, routine.tasks, now);
  const today = todayKey(now);
  const tomorrow = addDays(today, 1);
  const exceptions = Object.entries(alarm.exceptions)
    .filter(([d]) => d >= today)
    .sort(([a], [b]) => a.localeCompare(b));

  const setDay = (w: Weekday, patch: Partial<(typeof alarm.days)[Weekday]>) =>
    A.updateAlarm((a) => ({ ...a, days: { ...a.days, [w]: { ...a.days[w], ...patch } } }));

  const allow = async () => {
    if (status?.authorization === 'denied') {
      if (Platform.OS === 'ios') await Linking.openSettings();
      else await openAlarmSettings();
    } else {
      await requestAlarmPermission();
      await requestNotificationPermission();
    }
    await syncAll('alarm-permission', { force: true });
    refresh();
  };

  const real = status?.engine === 'alarmkit' || status?.engine === 'android';
  const web = Platform.OS === 'web';

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Wecker', headerLargeTitle: false }} />

      <Card style={{ alignItems: 'center', gap: 4, paddingVertical: space.xl }}>
        <Txt v="footnote" c="text2">
          NÄCHSTER WECKER
        </Txt>
        <Txt v="largeTitle" tabular style={{ fontSize: 56, lineHeight: 62, fontWeight: '200' }}>
          {alarm.enabled && next ? fmtTime(next.minutes) : '––:––'}
        </Txt>
        <Txt v="subhead" c="text2">
          {!alarm.enabled ? 'Wecker ist aus' : next ? `${fmtRelativeDay(next.date, today)}${next.source === 'exception' ? ' · einmalig geändert' : ''}` : 'Kein Wecker in den nächsten zwei Wochen'}
        </Txt>
      </Card>

      {web && (
        <Banner
          tone="blue"
          icon="info"
          title="Wecker in der Uhr-App stellen"
          message="Im Browser kann Jetzt dich nicht wecken, wenn das iPhone gesperrt ist. Stell die Zeiten unten einmalig in der Uhr-App ein – Jetzt nutzt sie trotzdem für deinen Tagesplan."
        />
      )}

      {status && !web && (
        <Banner
          tone={real ? 'accent' : 'warn'}
          icon={real ? 'checkCircle' : 'warn'}
          title={real ? (status.engine === 'alarmkit' ? 'Echter Wecker aktiv (AlarmKit)' : 'Echter Wecker aktiv') : status.engine === 'notification' ? 'Wecker über Mitteilungen (eingeschränkt)' : 'Wecker nicht aktiv'}
          message={
            real
              ? 'Klingelt wie die Uhr-App – auch im Stumm-Modus, bei Fokus und wenn die App geschlossen ist.'
              : `${status.note ?? ''}${status.engine === 'notification' ? ' Mitteilungen klingeln nicht im Stumm-Modus. Stell dein Telefon nachts auf laut oder erlaube echte Wecker.' : ''}`
          }>
          {!real && status.authorization !== 'unavailable' && <Button label={status.authorization === 'denied' ? 'Einstellungen öffnen' : 'Echte Wecker erlauben'} size="sm" onPress={allow} />}
          {status.engine === 'none' && <Button label="Mitteilungen erlauben" size="sm" onPress={allow} />}
        </Banner>
      )}

      <Section>
        <SwitchRow title="Wecker" subtitle="Automatisch nach deinem Tagesplan" value={alarm.enabled} onChange={(enabled) => A.updateAlarm((a) => ({ ...a, enabled }))} icon="alarm" iconBg="#D9963A" />
      </Section>

      <Section title="Wochentage" footer="„Plan“ übernimmt die Zeit deiner Aufgabe „Aufstehen“ und passt sich an, wenn du den Tagesplan änderst. Eine eigene Zeit gilt jede Woche.">
        {([1, 2, 3, 4, 5, 6, 7] as Weekday[]).map((w) => {
          const d = alarm.days[w];
          const fromRoutine = routineWakeTime(w, routine.tasks);
          const time = d.mode === 'routine' ? fromRoutine : d.time;
          return (
            <Row
              key={w}
              title={WEEKDAY_LONG[w]}
              subtitle={!d.enabled ? 'Aus' : d.mode === 'routine' ? (fromRoutine != null ? 'Aus dem Tagesplan' : 'Kein „Aufstehen“ im Plan') : 'Eigene Zeit'}
              right={
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                  {d.enabled && d.mode === 'custom' && <Chip small label="Plan" selected={false} onPress={() => setDay(w, { mode: 'routine' })} />}
                  {d.enabled && time != null && <TimeField value={time} onChange={(m) => setDay(w, { mode: 'custom', time: m })} accessibilityLabel={`Weckzeit ${WEEKDAY_LONG[w]}`} />}
                  <Switch value={d.enabled} trackColor={{ true: c.accent }} onValueChange={(enabled) => { tap(); setDay(w, { enabled }); }} />
                </View>
              }
            />
          );
        })}
      </Section>

      <Section title="Kurzfristig ändern" footer="Gilt nur für den einen Tag. Danach klingelt der Wecker wieder wie gewohnt.">
        <Row
          title="Morgen"
          subtitle={alarm.exceptions[tomorrow] ? (alarm.exceptions[tomorrow].off ? 'Ausgeschaltet' : 'Andere Zeit') : 'Wie geplant'}
          right={
            <View style={{ flexDirection: 'row', gap: space.sm }}>
              <Button label="Ausschalten" size="sm" variant="gray" onPress={() => A.setAlarmException(tomorrow, { off: true })} />
              <Button
                label="Später"
                size="sm"
                variant="gray"
                onPress={() => {
                  const base = next?.date === tomorrow ? next.minutes : routineWakeTime(1, routine.tasks) ?? 6 * 60 + 20;
                  A.setAlarmException(tomorrow, { time: base + 30 });
                }}
              />
            </View>
          }
        />
        {exceptions.map(([d, ex]) => (
          <Row
            key={d}
            title={fmtRelativeDay(d, today)}
            subtitle={ex.off ? 'Kein Wecker' : 'Einmalige Weckzeit'}
            right={
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                {!ex.off && <TimeField value={ex.time} onChange={(m) => A.setAlarmException(d, { time: m })} />}
                <Button label="Zurücksetzen" size="sm" variant="plain" onPress={() => A.setAlarmException(d, null)} />
              </View>
            }
          />
        ))}
      </Section>

      {!web && (
        <>
      <Section title="Weckton" footer={Platform.OS === 'ios' ? 'iOS spielt für Wecker nur Töne ab, die in der App enthalten sind, oder den Standardton.' : undefined}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, padding: space.md }}>
          {SOUNDS.map((s) => (
            <Chip key={s.id} label={s.label} selected={alarm.sound === s.id} onPress={() => A.updateAlarm((a) => ({ ...a, sound: s.id }))} />
          ))}
        </View>
      </Section>

      <Section title="Schlummern">
        <View style={{ flexDirection: 'row', gap: space.sm, padding: space.md }}>
          {SNOOZE.map((m) => (
            <Chip key={m} label={`${m} Min`} selected={alarm.snoozeMinutes === m} onPress={() => A.updateAlarm((a) => ({ ...a, snoozeMinutes: m }))} />
          ))}
        </View>
      </Section>

      <Section title="Text auf dem Wecker">
        <Row
          title="Titel"
          right={
            <TextInput
              value={alarm.label}
              onChangeText={(label) => A.updateAlarm((a) => ({ ...a, label }))}
              placeholder="Guten Morgen"
              placeholderTextColor={c.text3}
              style={{ color: c.text2, fontSize: 17, minWidth: 160, textAlign: 'right' }}
            />
          }
        />
      </Section>

      <Section footer="Plant einen einmaligen Wecker in etwa einer Minute – gut, um Ton, Lautstärke und Berechtigungen auf dem Gerät zu prüfen.">
        <Row
          title="Testwecker stellen"
          icon="speaker"
          iconBg="#25467A"
          chevron={false}
          onPress={async () => {
            const at = await scheduleTestAlarm(useStore.getState().routine);
            const d = new Date(at);
            tell('Testwecker gestellt', `Er klingelt um ${fmtTime(d.getHours() * 60 + d.getMinutes())}. Du kannst die App schließen und das Telefon sperren.`);
          }}
        />
      </Section>

        </>
      )}

      <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: space.sm }}>
        <Icon name="info" size={14} color={c.text3} style={{ marginTop: 2 }} />
        <Txt v="footnote" c="text3" style={{ flex: 1 }}>
          Wecker, Erinnerungen und Push-Nachrichten sind verschiedene Dinge: Der Wecker nutzt das Weck-System des Telefons, Erinnerungen sind lokale Mitteilungen. Push-Nachrichten von einem Server braucht die App nicht.
        </Txt>
      </View>
    </Screen>
  );
}
