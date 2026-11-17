import { router } from 'expo-router';
import { useState } from 'react';
import { Platform, View } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import * as A from '@/data/actions';
import { useStore } from '@/data/store';
import { nextAlarm } from '@/domain/alarms';
import { category } from '@/domain/categories';
import { findConflicts, timerRemainingMs, type DayPlan, type PlanItem } from '@/domain/plan';
import { describeChanges, projectedEnd } from '@/domain/schedule';
import { fmtCountdown, fmtDuration, fmtLongDate, fmtRelativeDay, fmtTime, minutesOfDay, todayKey } from '@/domain/time';
import type { DayRecord, Place, TaskTemplate } from '@/domain/types';
import { ask } from '@/ui/ask';
import { useNow, usePlan } from '@/ui/hooks';
import { Banner, Bar, Button, Card, Icon, ProgressRing, Screen, success, Txt } from '@/ui/kit';
import { radius, space, useColors } from '@/ui/theme';
import { Timeline } from '@/ui/timeline';

function greeting(now: number, name: string): string {
  const h = new Date(now).getHours();
  const base = h < 5 ? 'Gute Nacht' : h < 11 ? 'Guten Morgen' : h < 17 ? 'Guten Tag' : h < 22 ? 'Guten Abend' : 'Gute Nacht';
  return name ? `${base}, ${name}` : base;
}

export default function TodayScreen() {
  const insets = useSafeAreaInsets();
  const c = useColors();
  const now = useNow(15000);
  const today = todayKey(now);
  const plan = usePlan(today, now);
  const record = useStore((s) => s.days[today]);
  const routine = useStore((s) => s.routine);
  const alarm = nextAlarm(routine.alarm, routine.tasks, now);
  const { stats } = plan;

  return (
    <Screen contentStyle={{ paddingTop: (Platform.OS === 'ios' ? 0 : insets.top) + space.md }}>
      <View style={{ gap: 2 }}>
        <Txt v="largeTitle">{greeting(now, routine.profile.name)}</Txt>
        <Txt v="subhead" c="text2" tabular>
          {fmtLongDate(today)} · {fmtTime(Math.floor(minutesOfDay(now)))}
        </Txt>
      </View>

      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: space.lg }}>
        <ProgressRing size={62} stroke={7} progress={stats.percent / 100}>
          <Txt v="subhead" weight="700" tabular>
            {stats.percent}%
          </Txt>
        </ProgressRing>
        <View style={{ flex: 1, gap: 2 }}>
          <Txt v="headline">
            {stats.done} von {stats.total - stats.skipped} erledigt
          </Txt>
          <Txt v="footnote" c="text2">
            {stats.open > 0 ? `Noch ${stats.open} ${stats.open === 1 ? 'Aufgabe' : 'Aufgaben'} offen` : 'Alles abgehakt'}
            {alarm ? ` · Wecker ${fmtRelativeDay(alarm.date, today).toLowerCase()} ${fmtTime(alarm.minutes)}` : ''}
          </Txt>
        </View>
      </Card>

      <InstallHint />

      <Notices plan={plan} record={record} now={now} />

      <NowCard plan={plan} record={record} now={now} places={routine.places} />

      {plan.next && plan.focus && <NextCard item={plan.next} now={now} />}

      <View style={{ gap: space.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', paddingHorizontal: 4 }}>
          <Txt v="title3">Tagesübersicht</Txt>
          <Txt v="subhead" c="accent" onPress={() => router.push({ pathname: '/task/[id]', params: { id: 'new', date: today } })}>
            Hinzufügen
          </Txt>
        </View>
        <Timeline items={plan.items} date={today} highlightId={plan.focus?.task.id} />
      </View>

      {(new Date(now).getHours() >= 20 || (stats.open === 0 && stats.total > 0)) && (
        <Card onPress={() => router.push('/review')} style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
          <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: c.blue, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="review" size={18} color="#FFFFFF" />
          </View>
          <View style={{ flex: 1 }}>
            <Txt v="headline">Tagesrückblick</Txt>
            <Txt v="footnote" c="text2">
              Was hat heute geklappt? Und morgen vorbereiten.
            </Txt>
          </View>
          <Icon name="chevron" size={13} color={c.text3} />
        </Card>
      )}
    </Screen>
  );
}

// ---------------------------------------------------------------------------

function Notices({ plan, record, now }: { plan: DayPlan; record: DayRecord | undefined; now: number }) {
  const nowMin = minutesOfDay(now);
  const pending = record?.pending;
  const undo = record?.undo && now - record.undo.at < 15 * 60000 ? record.undo : null;
  const conflicts = findConflicts(plan, nowMin, (i) => projectedEnd(i, record, now), record?.ignoredConflicts);
  const conflict = !pending ? conflicts[0] : undefined;

  const resolve = () => {
    if (!conflict) return;
    const proposal = A.proposeForTask(conflict.a.task.id, false);
    if (proposal.changes.length) {
      A.applyChanges(proposal.changes, 'Überschneidung aufgelöst');
      success();
      return;
    }
    const fixed = A.proposeForTask(conflict.a.task.id, true);
    ask(
      `${conflict.b.task.title} ist ein fester Termin`,
      `Soll er trotzdem verschoben werden?\n\n${describeChanges(fixed.changes, plan.items)}`,
      [
        { text: 'Abbrechen', style: 'cancel' },
        { text: 'Verschieben', onPress: () => A.applyChanges(fixed.changes, 'Fester Termin verschoben') },
      ],
    );
  };

  return (
    <Animated.View layout={LinearTransition} style={{ gap: space.md }}>
      {pending && (
        <Animated.View entering={FadeIn} exiting={FadeOut}>
          <Banner tone="warn" icon="clock" title={pending.title} message={`${pending.message}\n${describeChanges(pending.changes, plan.items)}${pending.fixedTitles.length ? `\nFeste Termine: ${pending.fixedTitles.join(', ')}` : ''}`}>
            <Button label="Anpassen" size="sm" onPress={() => { A.applyPending(); success(); }} />
            <Button label="Beibehalten" size="sm" variant="gray" onPress={() => A.dismissPending()} />
          </Banner>
        </Animated.View>
      )}
      {conflict && (
        <Animated.View entering={FadeIn} exiting={FadeOut}>
          <Banner
            tone="warn"
            icon="warn"
            title="Überschneidung im Plan"
            message={`${conflict.a.task.title} endet um ${fmtTime(projectedEnd(conflict.a, record, now))}, ${conflict.b.task.title} beginnt um ${fmtTime(conflict.b.start)}.`}>
            <Button label="Nachfolgende verschieben" size="sm" onPress={resolve} />
            <Button label="So lassen" size="sm" variant="gray" onPress={() => A.ignoreConflict(conflict)} />
          </Banner>
        </Animated.View>
      )}
      {undo && !pending && (
        <Animated.View entering={FadeIn} exiting={FadeOut}>
          <Banner tone="blue" icon="sparkles" title={undo.label}>
            <Button label="Rückgängig" size="sm" variant="blue" icon="undo" onPress={() => A.undo()} />
            <Button label="Passt" size="sm" variant="gray" onPress={() => A.clearUndo()} />
          </Banner>
        </Animated.View>
      )}
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------

function manualTriggerLabel(task: TaskTemplate, places: Place[]): string | null {
  const t = task.trigger;
  if (!t) return null;
  const place = places.find((p) => p.id === t.placeId);
  if (place?.kind === 'home' || (!place && t.placeId === 'home')) return t.event === 'enter' ? 'Ich bin zu Hause' : 'Ich bin los';
  const name = place?.name ?? 'am Ort';
  return t.event === 'enter' ? `Bei ${name} angekommen` : `${name} verlassen`;
}

function NowCard({ plan, record, now, places }: { plan: DayPlan; record: DayRecord | undefined; now: number; places: Place[] }) {
  const c = useColors();
  const focus = plan.focus;
  const timer = record?.timer && focus && record.timer.taskId === focus.task.id ? record.timer : null;

  if (!focus) {
    const next = plan.next;
    if (!next) {
      return (
        <Card style={{ gap: space.md, alignItems: 'flex-start' }}>
          <Txt v="overline" c="accent">GESCHAFFT</Txt>
          <Txt v="title2">Für heute ist nichts mehr offen.</Txt>
          <Txt v="callout" c="text2">Gönn dir Ruhe. Der Rückblick zeigt, was heute geklappt hat.</Txt>
          <Button label="Tagesrückblick" icon="review" variant="tinted" onPress={() => router.push('/review')} />
        </Card>
      );
    }
    const inMin = Math.max(0, Math.round(next.start - minutesOfDay(now)));
    return (
      <Card style={{ gap: space.md }}>
        <Txt v="overline" c="text2">FREIE ZEIT · ALS NÄCHSTES</Txt>
        <Txt v="title1">
          {fmtTime(next.start)} – {next.task.title}
        </Txt>
        <Txt v="callout" c="text2">
          {inMin > 0 ? `Beginnt in ${fmtDuration(inMin)}.` : 'Beginnt jetzt.'} {next.task.description}
        </Txt>
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <Button label="Jetzt schon starten" icon="play" onPress={() => A.startTask(next.task.id)} flex />
        </View>
      </Card>
    );
  }

  const task = focus.task;
  const cat = category(task.category);
  const nowMin = minutesOfDay(now);
  const started = focus.status === 'active';
  const manual = !started ? manualTriggerLabel(task, places) : null;
  const windowProgress = focus.duration > 0 ? (nowMin - focus.start) / focus.duration : 0;
  const remainingMin = timer ? timerRemainingMs(timer, now) / 60000 : Math.max(0, focus.end - Math.max(nowMin, focus.start));

  return (
    <Animated.View entering={FadeIn.duration(250)} key={task.id}>
      <Card style={{ gap: space.md, padding: space.xl }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Txt v="overline" c="accent">
            {timer ? (timer.runningSince ? 'TIMER LÄUFT' : 'TIMER PAUSIERT') : started ? `LÄUFT SEIT ${fmtTime(focus.start)}` : 'JETZT AN DER REIHE'}
          </Txt>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: c.fill, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}>
            <Icon symbol={cat} size={12} color={cat.color} />
            <Txt v="caption" c="text2" weight="600">
              {cat.label}
            </Txt>
          </View>
        </View>

        <View style={{ gap: 4 }}>
          <Txt v="title1">
            {fmtTime(focus.start)} – {task.title}
          </Txt>
          {task.description ? (
            <Txt v="callout" c="text2">
              „{task.description}“
            </Txt>
          ) : null}
        </View>

        {timer ? (
          <TimerStrip timerTaskId={task.id} />
        ) : (
          <>
            <View style={{ flexDirection: 'row', backgroundColor: c.bg, borderRadius: radius.md, paddingVertical: 10 }}>
              <Fact label="Start" value={fmtTime(focus.start)} />
              <Fact label="Dauer" value={focus.duration ? fmtDuration(focus.duration) : '–'} />
              <Fact label="Verbleibend" value={focus.duration ? fmtDuration(Math.ceil(remainingMin)) : '–'} />
            </View>
            {focus.duration > 0 && <Bar value={windowProgress} />}
          </>
        )}

        {manual ? (
          <Button
            label={manual}
            icon="home"
            size="lg"
            onPress={() => {
              const t = task.trigger!;
              const out = A.handlePlaceEvent(t.placeId, t.event, 'manual');
              if (!out) A.startTask(task.id);
              success();
            }}
          />
        ) : timer ? (
          <Button label="Timer öffnen" icon="timer" size="lg" onPress={() => router.push('/timer')} />
        ) : !started ? (
          <Button
            label={task.timer ? 'Timer starten' : 'Starten'}
            icon="play"
            size="lg"
            onPress={() => {
              A.startTask(task.id);
              if (task.timer && focus.duration > 0) router.push('/timer');
            }}
          />
        ) : null}

        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <Button label="Erledigt" icon="check" variant="tinted" stacked flex onPress={() => { success(); A.completeTask(task.id); }} />
          <Button label="Verlängern" icon="extend" variant="gray" stacked flex onPress={() => router.push({ pathname: '/extend', params: { taskId: task.id } })} />
          <Button label="Überspringen" icon="skip" variant="gray" stacked flex onPress={() => A.skipTask(task.id)} />
        </View>
      </Card>
    </Animated.View>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', gap: 2 }}>
      <Txt v="caption" c="text2">
        {label}
      </Txt>
      <Txt v="headline" tabular>
        {value}
      </Txt>
    </View>
  );
}

/** Live countdown that re-renders every second without re-rendering the whole screen. */
function TimerStrip({ timerTaskId }: { timerTaskId: string }) {
  const c = useColors();
  const now = useNow(1000);
  const today = todayKey(now);
  const timer = useStore((s) => s.days[today]?.timer);
  if (!timer || timer.taskId !== timerTaskId) return null;
  const remaining = timerRemainingMs(timer, now);
  const over = remaining < 0;
  const progress = 1 - remaining / timer.plannedMs;
  return (
    <View style={{ gap: space.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <Txt v="largeTitle" tabular color={over ? c.warn : c.text} style={{ fontSize: 44, lineHeight: 50, fontWeight: '300' }}>
          {over ? `+${fmtCountdown(-remaining)}` : fmtCountdown(remaining)}
        </Txt>
        <Txt v="footnote" c="text2">
          {over ? 'überzogen' : `von ${fmtDuration(timer.plannedMs / 60000)}`}
        </Txt>
      </View>
      <Bar value={progress} color={over ? c.warn : c.accent} />
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <Button
          label={timer.runningSince ? 'Pausieren' : 'Fortsetzen'}
          icon={timer.runningSince ? 'pause' : 'play'}
          variant="blue"
          size="sm"
          onPress={() => (timer.runningSince ? A.pauseTimer() : A.resumeTimer())}
        />
      </View>
    </View>
  );
}

function NextCard({ item, now }: { item: PlanItem; now: number }) {
  const c = useColors();
  const inMin = Math.round(item.start - minutesOfDay(now));
  const cat = category(item.task.category);
  return (
    <Card onPress={() => router.push({ pathname: '/task/[id]', params: { id: item.task.id, date: todayKey(now) } })} style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
      <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: cat.color, alignItems: 'center', justifyContent: 'center' }}>
        <Icon symbol={cat} size={17} color="#FFFFFF" />
      </View>
      <View style={{ flex: 1 }}>
        <Txt v="footnote" c="text2">
          Als Nächstes{inMin > 0 ? ` · in ${fmtDuration(inMin)}` : ''}
        </Txt>
        <Txt v="headline" numberOfLines={1}>
          {fmtTime(item.start)} – {item.task.title}
        </Txt>
      </View>
      <Icon name="chevron" size={13} color={c.text3} />
    </Card>
  );
}

/** Web only: explain how to put Jetzt on the home screen, until it runs from there. */
function InstallHint() {
  const [hidden, setHidden] = useState(false);
  if (Platform.OS !== 'web' || hidden) return null;
  const standalone =
    typeof window !== 'undefined' &&
    (window.matchMedia?.('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone);
  if (standalone) return null;
  return (
    <Banner
      tone="blue"
      icon="arrowRight"
      title="Als App auf den Home-Bildschirm"
      message="In Safari unten auf Teilen tippen → „Zum Home-Bildschirm“. Dann startet Jetzt wie eine App, im Vollbild und mit eigenem Speicher.">
      <Button label="Später" size="sm" variant="gray" onPress={() => setHidden(true)} />
    </Banner>
  );
}
