import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import * as A from '@/data/actions';
import { useStore } from '@/data/store';
import { HOME_PLACE_ID } from '@/domain/defaults';
import { fmtTime } from '@/domain/time';
import { requestAlarmPermission } from '@/services/alarm';
import { currentCoordinates, requestLocationPermissions } from '@/services/location';
import { requestNotificationPermission } from '@/services/notifications';
import { syncAll } from '@/services/sync';
import { Button, Icon, Row, Section, success, TimeField, Txt, type IconName } from '@/ui/kit';
import { radius, space, useColors } from '@/ui/theme';

const STEPS = 6;
const web = Platform.OS === 'web';

export default function Onboarding() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const routine = useStore((s) => s.routine);
  const wakeSchool = routine.tasks.find((t) => t.id === 'wake-school');
  const wakeWeekend = routine.tasks.find((t) => t.id === 'wake-weekend');
  const home = routine.places.find((p) => p.id === HOME_PLACE_ID);

  const next = () => {
    setNote(null);
    setStep((s) => Math.min(STEPS, s + 1));
  };
  const finish = async () => {
    success();
    A.updateRoutine((r) => ({ ...r, onboarded: true }));
    await syncAll('onboarding', { force: true });
  };
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  };

  const setHomeHere = () =>
    run(async () => {
      try {
        const pos = await currentCoordinates();
        A.upsertPlace({
          id: HOME_PLACE_ID,
          name: 'Zuhause',
          kind: 'home',
          latitude: pos.latitude,
          longitude: pos.longitude,
          address: pos.address,
          radius: 150,
          notifyOnEnter: true,
          notifyOnExit: true,
          enabled: true,
        });
        await requestLocationPermissions();
        A.updateSettings((s) => ({ ...s, location: { ...s.location, enabled: true } }));
        // iOS answers the "Always" upgrade asynchronously, so the result is checked again later.
        setNote('Zuhause ist gespeichert. Ob die automatische Erkennung aktiv ist, siehst du jederzeit unter Einstellungen → Standorte.');
      } catch (e) {
        setNote(e instanceof Error ? e.message : 'Der Standort konnte nicht bestimmt werden.');
      }
    });

  const page = (() => {
    switch (step) {
      case 0:
        return (
          <Page icon="sun" title="Was sollte ich jetzt tun?" text={web ? "Jetzt plant deinen Tag, erinnert dich an Aufgaben und passt den Plan an, wenn du später heimkommst." : "Jetzt plant deinen Tag, weckt dich, erinnert dich an Aufgaben und merkt, wann du nach Hause kommst."}>
            <Feature icon="alarm" title={web ? "Weckzeiten aus deinem Plan" : "Automatischer Wecker"} text="Nach deinem Tagesplan – an Schultagen und am Wochenende." />
            <Feature icon="home" title={web ? "Ankommen mit einem Tipp" : "Zuhause erkennen"} text="Kommst du heim, startet der nächste Teil deiner Routine." />
            <Feature icon="timer" title="Timer für Aufgaben" text="Mit Pause und Verlängern. Der Plan passt sich an." />
          </Page>
        );
      case 1:
        return (
          <Page icon="person" title="Wie heißt du?" text="Nur für die Begrüßung. Bleibt auf deinem Gerät.">
            <TextInput
              value={routine.profile.name}
              onChangeText={(name) => A.updateRoutine((r) => ({ ...r, profile: { ...r.profile, name } }))}
              placeholder="Vorname (optional)"
              placeholderTextColor={c.text3}
              autoFocus
              returnKeyType="next"
              onSubmitEditing={next}
              style={{ height: 52, borderRadius: radius.md, backgroundColor: c.card, paddingHorizontal: space.lg, fontSize: 20, color: c.text }}
            />
          </Page>
        );
      case 2:
        return (
          <Page icon="alarm" title="Wann stehst du auf?" text={web ? "Danach richtet sich dein Morgen. Die Morgenroutine rutscht mit, wenn du später aufstehst." : "Daraus stellt die App deinen Wecker. Die Morgenroutine rutscht mit, wenn du später aufstehst."}>
            <Section>
              {wakeSchool && <Row title="Schultage" subtitle="Montag bis Freitag" right={<TimeField value={wakeSchool.start} onChange={(m) => A.setWakeTime('wake-school', m)} accessibilityLabel="Aufstehen an Schultagen" />} />}
              {wakeWeekend && <Row title="Wochenende" subtitle="Samstag und Sonntag" right={<TimeField value={wakeWeekend.start} onChange={(m) => A.setWakeTime('wake-weekend', m)} accessibilityLabel="Aufstehen am Wochenende" />} />}
            </Section>
            <Txt v="footnote" c="text2">
              Deine Routine ist schon vorbereitet ({routine.tasks.filter((t) => !t.deletedAt).length} Aufgaben, z. B. Hausaufgaben um {fmtTime(routine.tasks.find((t) => t.id === 'homework')?.start ?? 990)}). Du kannst alles später ändern.
            </Txt>
          </Page>
        );
      case 3:
        return (
          <Page icon="bell" title="Erinnerungen" text={web ? "Zu jeder Aufgabe erinnert dich Jetzt mit einem kurzen Ton und einem Hinweis – solange die App geöffnet ist. In deinen Ruhezeiten bleibt es still." : "Zu jeder Aufgabe kommt eine kurze Mitteilung – mit „Erledigt“ und „Später“ direkt in der Mitteilung. In deinen Ruhezeiten bleibt es still."}>
            <Button
              label={web ? "Erinnerungen einschalten" : "Mitteilungen erlauben"}
              size="lg"
              disabled={busy}
              onPress={() => run(async () => { await requestNotificationPermission(); next(); })}
            />
          </Page>
        );
      case 4:
        if (web) {
          return (
            <Page icon="alarm" title="Dein Wecker" text="Im Browser kann Jetzt dich nicht wecken, solange das iPhone gesperrt ist. Stell deine Aufstehzeiten deshalb einmal in der Uhr-App ein – Jetzt plant den Tag trotzdem danach.">
              <Section>
                {wakeSchool && <Row title="Montag bis Freitag" value={fmtTime(wakeSchool.start)} />}
                {wakeWeekend && <Row title="Samstag und Sonntag" value={fmtTime(wakeWeekend.start)} />}
              </Section>
            </Page>
          );
        }
        return (
          <Page
            icon="alarm"
            title="Echter Wecker"
            text={
              Platform.OS === 'ios'
                ? 'Ab iOS 26 klingelt der Wecker wie die Uhr-App: auch im Stumm-Modus, bei Fokus und wenn die App geschlossen ist. Dafür fragt iOS nach der Erlaubnis für Wecker.'
                : 'Android braucht die Erlaubnis für „Wecker und Erinnerungen“, damit der Wecker pünktlich und als Vollbild klingelt.'
            }>
            <Button
              label="Wecker erlauben"
              size="lg"
              disabled={busy}
              onPress={() =>
                run(async () => {
                  const r = await requestAlarmPermission();
                  if (r === 'authorized') next();
                  else setNote(r === 'unavailable' ? 'Auf diesem Gerät gibt es keine echten Wecker. Die App weckt dich mit wiederholten Mitteilungen.' : 'Ohne Erlaubnis weckt dich die App mit Mitteilungen. Du kannst das später in den Einstellungen ändern.');
                })
              }
            />
          </Page>
        );
      case 5:
        if (web) {
          return (
            <Page icon="home" title="Nach Hause kommen" text="Wenn du von der Schule heimkommst, tippe auf der Heute-Seite auf „Ich bin zu Hause“. Dann startet dein Nachmittag – und kommst du später als geplant, rücken die nächsten Aufgaben automatisch nach." />
          );
        }
        return (
          <Page
            icon="home"
            title="Wo ist dein Zuhause?"
            text="Dann erkennt die App, wann du von der Schule heimkommst, und startet deinen Nachmittag. Sie nutzt dafür Geofencing des Systems – keine dauerhafte Ortung. Dein Standort bleibt auf dem Gerät.">
            {home ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, backgroundColor: c.accentSoft, padding: space.lg, borderRadius: radius.md }}>
                <Icon name="checkCircle" size={20} color={c.accent} />
                <Txt v="body" style={{ flex: 1 }}>
                  {home.address ?? 'Zuhause gespeichert'}
                </Txt>
              </View>
            ) : (
              <Button label="Ich bin gerade zu Hause" icon="location" size="lg" disabled={busy} onPress={setHomeHere} />
            )}
            <Txt v="footnote" c="text2">
              Für die automatische Erkennung fragt das System nach dem Zugriff „Immer“. Ohne ihn tippst du nach dem Heimkommen auf „Ich bin zu Hause“. Die Schule und weitere Orte kannst du in den Einstellungen anlegen.
            </Txt>
          </Page>
        );
      default:
        return (
          <Page icon="checkCircle" title="Alles bereit" text="Auf der Heute-Seite siehst du immer, was gerade dran ist. Viel Erfolg!">
            <View style={{ gap: space.sm }}>
              <Summary icon="alarm" text={wakeSchool ? `Wecker Mo–Fr um ${fmtTime(wakeSchool.start)}` : 'Wecker eingerichtet'} />
              <Summary icon="home" text={home ? 'Zuhause wird erkannt' : 'Ankunft per Tipp bestätigen'} />
              <Summary icon="list" text={`${routine.tasks.filter((t) => !t.deletedAt).length} Aufgaben in deiner Routine`} />
            </View>
          </Page>
        );
    }
  })();

  const skippable = step >= 3 && step <= 5;
  // Permission steps have their own main button; "Weiter" appears once something happened.
  const needsAction = (step === 3 || (!web && (step === 4 || (step === 5 && !home)))) && !note;
  const primary = step === STEPS ? 'Los geht’s' : step === 0 ? 'Einrichten' : 'Weiter';

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={{ flexDirection: 'row', gap: 6, justifyContent: 'center', paddingTop: insets.top + space.md }}>
        {Array.from({ length: STEPS + 1 }, (_, i) => (
          <View key={i} style={{ width: i === step ? 18 : 6, height: 6, borderRadius: 3, backgroundColor: i <= step ? c.accent : c.fillStrong }} />
        ))}
      </View>
      <ScrollView contentContainerStyle={{ flexGrow: 1, padding: space.xl, justifyContent: 'center' }} keyboardShouldPersistTaps="handled">
        <Animated.View key={step} entering={FadeIn.duration(260)} exiting={web ? undefined : FadeOut.duration(120)} style={{ gap: space.lg }}>
          {page}
          {note && (
            <Txt v="subhead" c="text2">
              {note}
            </Txt>
          )}
          {busy && <ActivityIndicator />}
        </Animated.View>
      </ScrollView>
      <View style={{ padding: space.xl, paddingBottom: insets.bottom + space.lg, gap: space.sm }}>
        {!needsAction && <Button label={primary} size="lg" onPress={step === STEPS ? finish : next} disabled={busy} />}
        {skippable && needsAction && <Button label="Später" variant="plain" onPress={next} />}
      </View>
    </KeyboardAvoidingView>
  );
}

function Page({ icon, title, text, children }: { icon: IconName; title: string; text: string; children?: React.ReactNode }) {
  const c = useColors();
  return (
    <View style={{ gap: space.lg }}>
      <View style={{ width: 64, height: 64, borderRadius: 18, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center', borderCurve: 'continuous' }}>
        <Icon name={icon} size={30} color={c.onAccent} weight="semibold" />
      </View>
      <View style={{ gap: space.sm }}>
        <Txt v="largeTitle">{title}</Txt>
        <Txt v="callout" c="text2">
          {text}
        </Txt>
      </View>
      {children}
    </View>
  );
}

function Feature({ icon, title, text }: { icon: IconName; title: string; text: string }) {
  const c = useColors();
  return (
    <View style={{ flexDirection: 'row', gap: space.md, alignItems: 'flex-start' }}>
      <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: c.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} size={18} color={c.accent} />
      </View>
      <View style={{ flex: 1 }}>
        <Txt v="headline">{title}</Txt>
        <Txt v="subhead" c="text2">
          {text}
        </Txt>
      </View>
    </View>
  );
}

function Summary({ icon, text }: { icon: IconName; text: string }) {
  const c = useColors();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, backgroundColor: c.card, padding: space.lg, borderRadius: radius.md }}>
      <Icon name={icon} size={18} color={c.accent} />
      <Txt v="body">{text}</Txt>
    </View>
  );
}
