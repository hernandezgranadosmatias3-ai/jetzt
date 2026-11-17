import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, TextInput, View } from 'react-native';

import * as A from '@/data/actions';
import { useStore } from '@/data/store';
import { CATEGORIES, category } from '@/domain/categories';
import { buildDayPlan } from '@/domain/plan';
import { ALL_DAYS, SCHOOL_DAYS, WEEKDAY_SHORT, WEEKEND, addDays, fmtDuration, fmtRelativeDay, fmtShortDate, fmtTime, todayKey, weekdayOfKey } from '@/domain/time';
import type { DateKey, TaskTemplate, Weekday } from '@/domain/types';
import { ask } from '@/ui/ask';
import { useNow } from '@/ui/hooks';
import { Button, Chip, HeaderButton, Row, Section, Segmented, success, SwitchRow, TimeField, Txt } from '@/ui/kit';
import { radius, space, useColors } from '@/ui/theme';

const DURATIONS = [0, 15, 20, 30, 45, 60, 90, 120];
const OFFSETS = [0, 5, 10, 15, 30];

export default function TaskEditor() {
  const c = useColors();
  const params = useLocalSearchParams<{ id: string; date?: string }>();
  const date = (params.date as DateKey | undefined) ?? undefined;
  const isNew = params.id === 'new';
  const routine = useStore((s) => s.routine);
  const existing = routine.tasks.find((t) => t.id === params.id);
  const now = useNow(30000);
  const today = todayKey(now);

  const [draft, setDraft] = useState<TaskTemplate>(() =>
    existing ?? A.newTask(date ? { date, days: [weekdayOfKey(date)], start: nextQuarter(date === today) } : {}),
  );
  const set = (patch: Partial<TaskTemplate>) => setDraft((d) => ({ ...d, ...patch }));
  const record = useStore((s) => (date ? s.days[date] : undefined));
  const instance = useMemo(() => {
    if (!date || !existing) return null;
    return buildDayPlan(date, routine.tasks, record, now).items.find((i) => i.task.id === existing.id) ?? null;
  }, [date, existing, routine.tasks, record, now]);

  const valid = draft.title.trim().length > 0 && (draft.date || draft.days.length > 0);
  const save = () => {
    if (!valid) return;
    A.upsertTask({ ...draft, title: draft.title.trim(), description: draft.description.trim() });
    success();
    router.back();
  };

  const remove = () =>
    ask('Aufgabe löschen?', `„${draft.title}“ wird aus deiner Routine entfernt. Vergangene Tage behalten ihre Statistik.`, [
      { text: 'Abbrechen', style: 'cancel' },
      { text: 'Löschen', style: 'destructive', onPress: () => { A.deleteTask(draft.id); router.back(); } },
    ]);

  const repeat: 'once' | 'days' = draft.date ? 'once' : 'days';
  const toggleDay = (d: Weekday) => set({ days: draft.days.includes(d) ? draft.days.filter((x) => x !== d) : [...draft.days, d].sort() as Weekday[] });
  const sameDays = (a: Weekday[]) => a.length === draft.days.length && a.every((d) => draft.days.includes(d));

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen
        options={{
          title: isNew ? 'Neue Aufgabe' : 'Aufgabe',
          headerLeft: () => <HeaderButton label="Abbrechen" onPress={() => router.back()} />,
          headerRight: () => <HeaderButton label="Sichern" bold disabled={!valid} onPress={save} />,
        }}
      />
      <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.xl, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
        {instance && date && (
          <Section title={`${fmtRelativeDay(date, today)} · ${fmtShortDate(date)}`} footer="Änderungen hier gelten nur für diesen Tag.">
            <Row
              title="Status"
              value={{ done: 'Erledigt', skipped: 'Übersprungen', active: 'Läuft', current: 'Jetzt', missed: 'Offen', upcoming: 'Geplant' }[instance.status]}
            />
            <Row title="Beginn" right={<TimeField value={instance.start} onChange={(m) => A.editInstance(instance.task.id, date, { start: m })} accessibilityLabel="Beginn an diesem Tag" />} />
            <Row title="Dauer" value={fmtDuration(instance.duration)} />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, padding: space.md }}>
              {instance.status === 'done' || instance.status === 'skipped' ? (
                <Button label="Wieder öffnen" size="sm" variant="gray" onPress={() => A.reopenTask(instance.task.id, date)} />
              ) : (
                <>
                  {date === today && instance.status !== 'active' && (
                    <Button label="Starten" icon="play" size="sm" onPress={() => { A.startTask(instance.task.id, date); router.back(); }} />
                  )}
                  <Button label="Erledigt" icon="check" size="sm" variant="tinted" onPress={() => { success(); A.completeTask(instance.task.id, date); router.back(); }} />
                  {date === today && <Button label="Verlängern" size="sm" variant="gray" onPress={() => router.push({ pathname: '/extend', params: { taskId: instance.task.id } })} />}
                  <Button label="Überspringen" size="sm" variant="gray" onPress={() => { A.skipTask(instance.task.id, date); router.back(); }} />
                </>
              )}
            </View>
          </Section>
        )}

        <View style={{ backgroundColor: c.card, borderRadius: radius.md, overflow: 'hidden' }}>
          <TextInput
            value={draft.title}
            onChangeText={(title) => set({ title })}
            placeholder="Name der Aufgabe"
            placeholderTextColor={c.text3}
            autoFocus={isNew}
            style={{ fontSize: 20, fontWeight: '600', color: c.text, paddingHorizontal: space.lg, paddingVertical: 14 }}
          />
          <View style={{ height: 0.5, backgroundColor: c.separator, marginLeft: space.lg }} />
          <TextInput
            value={draft.description}
            onChangeText={(description) => set({ description })}
            placeholder="Beschreibung (optional)"
            placeholderTextColor={c.text3}
            multiline
            style={{ fontSize: 16, color: c.text, paddingHorizontal: space.lg, paddingVertical: 12, minHeight: 64 }}
          />
        </View>

        <View style={{ gap: space.sm }}>
          <Txt v="footnote" c="text2" style={{ marginLeft: space.lg }}>
            KATEGORIE
          </Txt>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
            {CATEGORIES.map((cat) => (
              <Chip key={cat.id} label={cat.label} small selected={draft.category === cat.id} color={cat.color} onPress={() => set({ category: cat.id })} />
            ))}
          </View>
        </View>

        <Section title="Zeit" footer={draft.duration > 0 ? `Endet um ${fmtTime(draft.start + draft.duration)}.` : 'Ein Zeitpunkt ohne Dauer, z. B. Schlafenszeit.'}>
          <Row title="Beginn" right={<TimeField value={draft.start} onChange={(start) => set({ start })} accessibilityLabel="Beginn" />} />
          <View style={{ padding: space.md, gap: space.sm }}>
            <Txt v="subhead" c="text2">
              Dauer
            </Txt>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
              {DURATIONS.map((d) => (
                <Chip key={d} small label={d === 0 ? 'Keine' : fmtDuration(d)} selected={draft.duration === d} onPress={() => set({ duration: d })} />
              ))}
            </View>
            {!DURATIONS.includes(draft.duration) && <Txt v="footnote" c="text2">Aktuell: {fmtDuration(draft.duration)}</Txt>}
          </View>
        </Section>

        <Section title="Wiederholung">
          <View style={{ padding: space.md, gap: space.md }}>
            <Segmented
              value={repeat}
              onChange={(v) => set(v === 'once' ? { date: date ?? today } : { date: undefined })}
              options={[
                { value: 'days', label: 'Wiederkehrend' },
                { value: 'once', label: 'Einmalig' },
              ]}
            />
            {repeat === 'days' ? (
              <>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  {ALL_DAYS.map((d) => (
                    <Chip key={d} small label={WEEKDAY_SHORT[d]} selected={draft.days.includes(d)} onPress={() => toggleDay(d)} />
                  ))}
                </View>
                <View style={{ flexDirection: 'row', gap: space.sm }}>
                  <Chip small label="Täglich" selected={sameDays(ALL_DAYS)} onPress={() => set({ days: ALL_DAYS })} />
                  <Chip small label="Schultage" selected={sameDays(SCHOOL_DAYS)} onPress={() => set({ days: SCHOOL_DAYS })} />
                  <Chip small label="Wochenende" selected={sameDays(WEEKEND)} onPress={() => set({ days: WEEKEND })} />
                </View>
              </>
            ) : (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
                {Array.from({ length: 7 }, (_, i) => addDays(today, i)).map((d) => (
                  <Chip key={d} small label={fmtRelativeDay(d, today)} selected={draft.date === d} onPress={() => set({ date: d })} />
                ))}
              </View>
            )}
          </View>
        </Section>

        <Section title="Erinnerung" footer="Erinnerungen kommen als Mitteilung mit „Erledigt“ und „Später“. In deinen Ruhezeiten bleibt es still.">
          <SwitchRow title="Erinnern" value={draft.reminder.enabled} onChange={(enabled) => set({ reminder: { ...draft.reminder, enabled } })} icon="bell" iconBg="#D7743A" />
          {draft.reminder.enabled && (
            <View style={{ padding: space.md, gap: space.sm }}>
              <Txt v="subhead" c="text2">
                Vorlauf
              </Txt>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
                {OFFSETS.map((o) => (
                  <Chip key={o} small label={o === 0 ? 'Pünktlich' : `${o} Min vorher`} selected={draft.reminder.offset === o} onPress={() => set({ reminder: { ...draft.reminder, offset: o } })} />
                ))}
              </View>
              <TextInput
                value={draft.reminder.message ?? ''}
                onChangeText={(message) => set({ reminder: { ...draft.reminder, message } })}
                placeholder={category(draft.category).message(draft.title || 'Aufgabe')}
                placeholderTextColor={c.text3}
                style={{ fontSize: 16, color: c.text, backgroundColor: c.bg, borderRadius: radius.sm, paddingHorizontal: space.md, paddingVertical: 10 }}
              />
            </View>
          )}
        </Section>

        <Section footer="Feste Termine verschiebt die App nie ohne deine Bestätigung. Die Aufsteh-Aufgabe bestimmt die Weckzeit ihrer Tage.">
          <SwitchRow title="Timer" subtitle="Countdown mit Pause und Verlängern" value={draft.timer} onChange={(timer) => set({ timer })} icon="timer" iconBg="#3A7DBF" />
          <SwitchRow title="Fester Termin" value={draft.fixed} onChange={(fixed) => set({ fixed })} icon="lock" iconBg="#6C6C70" />
          <SwitchRow title="Aufstehen (Wecker)" value={!!draft.isWakeUp} onChange={(isWakeUp) => set({ isWakeUp })} icon="alarm" iconBg="#D9963A" />
        </Section>

        <Section title="Standort" footer={routine.places.length ? 'Die Aufgabe beginnt automatisch, wenn du ankommst oder losgehst.' : 'Lege zuerst einen Ort in den Einstellungen an.'}>
          <View style={{ padding: space.md, gap: space.md }}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
              <Chip small label="Kein Auslöser" selected={!draft.trigger} onPress={() => set({ trigger: undefined })} />
              {routine.places.map((p) => (
                <Chip key={p.id} small label={p.name} selected={draft.trigger?.placeId === p.id} onPress={() => set({ trigger: { placeId: p.id, event: draft.trigger?.event ?? 'enter' } })} />
              ))}
            </View>
            {draft.trigger && (
              <Segmented
                value={draft.trigger.event}
                onChange={(event) => set({ trigger: { ...draft.trigger!, event } })}
                options={[
                  { value: 'enter', label: 'Beim Ankommen' },
                  { value: 'exit', label: 'Beim Verlassen' },
                ]}
              />
            )}
          </View>
        </Section>

        {!isNew && (
          <Section footer={draft.pausedUntil ? `Pausiert bis einschließlich ${fmtShortDate(draft.pausedUntil)}.` : 'Pausierte Aufgaben erscheinen vorübergehend nicht im Plan.'}>
            {draft.pausedUntil ? (
              <Row title="Pause beenden" onPress={() => { A.pauseTask(draft.id, null); set({ pausedUntil: undefined }); }} chevron={false} />
            ) : (
              <Row title="Eine Woche pausieren" onPress={() => { const until = addDays(today, 6); A.pauseTask(draft.id, until); set({ pausedUntil: until }); }} chevron={false} />
            )}
            <Row title="Aufgabe löschen" destructive onPress={remove} chevron={false} />
          </Section>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function nextQuarter(isToday: boolean): number {
  if (!isToday) return 17 * 60;
  const d = new Date();
  const m = d.getHours() * 60 + d.getMinutes();
  return Math.min(23 * 60 + 45, Math.ceil((m + 5) / 15) * 15);
}
