import { Stack, router } from 'expo-router';
import { Switch, View } from 'react-native';

import * as A from '@/data/actions';
import { useStore } from '@/data/store';
import { resolveAlarm } from '@/domain/alarms';
import { category } from '@/domain/categories';
import { isTaskOnDate, type PlanItem } from '@/domain/plan';
import { addDays, fmtLongDate, fmtTime, todayKey } from '@/domain/time';
import { useNow, usePlan } from '@/ui/hooks';
import { Button, Card, Dot, HeaderButton, Icon, ProgressRing, Row, Screen, Section, success, tap, TimeField, Txt } from '@/ui/kit';
import { space, useColors } from '@/ui/theme';
import { Timeline } from '@/ui/timeline';

function verdict(percent: number, total: number): string {
  if (!total) return 'Heute war nichts geplant.';
  if (percent >= 85) return 'Ein starker Tag. Du warst richtig bei der Sache.';
  if (percent >= 60) return 'Ein solider Tag. Das Wichtigste ist geschafft.';
  if (percent >= 30) return 'Nicht alles hat geklappt – und das ist in Ordnung.';
  return 'Manche Tage laufen anders. Morgen ist ein neuer Anfang.';
}

export default function ReviewScreen() {
  const c = useColors();
  const now = useNow(60000);
  const today = todayKey(now);
  const tomorrow = addDays(today, 1);
  const plan = usePlan(today, now);
  const tomorrowPlan = usePlan(tomorrow, now);
  const routine = useStore((s) => s.routine);
  const wake = resolveAlarm(tomorrow, routine.alarm, routine.tasks);

  const done = plan.items.filter((i) => i.status === 'done');
  const shifted = plan.items.filter((i) => (i.state.shiftedBy ?? 0) > 0 || i.state.movedTo);
  const skipped = plan.items.filter((i) => i.status === 'skipped' && !i.state.movedTo);
  const open = plan.items.filter((i) => i.status !== 'done' && i.status !== 'skipped');

  return (
    <Screen>
      <Stack.Screen options={{ headerRight: () => <HeaderButton label="Fertig" bold onPress={() => { A.markReviewed(); router.back(); }} /> }} />

      <Card style={{ alignItems: 'center', gap: space.md, paddingVertical: space.xxl }}>
        <ProgressRing size={128} stroke={12} progress={plan.stats.percent / 100}>
          <Txt v="title1" tabular>
            {plan.stats.percent}%
          </Txt>
        </ProgressRing>
        <View style={{ alignItems: 'center', gap: 4 }}>
          <Txt v="title3" center>
            {plan.stats.done} von {plan.stats.total - plan.stats.skipped} Aufgaben erledigt
          </Txt>
          <Txt v="subhead" c="text2" center>
            {verdict(plan.stats.percent, plan.stats.total)}
          </Txt>
        </View>
      </Card>

      <ReviewList title="Erledigt" items={done} empty="Noch nichts abgehakt." />
      {shifted.length > 0 && (
        <ReviewList
          title="Verschoben"
          items={shifted}
          detail={(i) => (i.state.movedTo ? 'auf morgen' : `+${i.state.shiftedBy} Min · ${fmtTime(i.plannedStart)} → ${fmtTime(i.start)}`)}
        />
      )}
      {skipped.length > 0 && <ReviewList title="Ausgelassen" items={skipped} />}

      {open.length > 0 && (
        <Section title="Noch offen" footer="Hake ab, was du doch geschafft hast. Einmalige Aufgaben kannst du auf morgen verschieben, wiederkehrende kommen morgen ohnehin wieder.">
          {open.map((i) => (
            <Row
              key={i.task.id}
              title={i.task.title}
              subtitle={`${fmtTime(i.start)} · ${category(i.task.category).label}`}
              right={
                <View style={{ flexDirection: 'row', gap: space.sm }}>
                  <Button label="Erledigt" size="sm" variant="tinted" onPress={() => { success(); A.completeTask(i.task.id); }} />
                  {isTaskOnDate(i.task, tomorrow) ? (
                    <Button label="Auslassen" size="sm" variant="gray" onPress={() => A.skipTask(i.task.id)} />
                  ) : (
                    <Button label="Morgen" size="sm" variant="gray" onPress={() => A.carryOver(i.task.id, today)} />
                  )}
                </View>
              }
            />
          ))}
        </Section>
      )}

      <View style={{ gap: 2, marginTop: space.md }}>
        <Txt v="title2">Morgen vorbereiten</Txt>
        <Txt v="subhead" c="text2">
          {fmtLongDate(tomorrow)}
        </Txt>
      </View>

      <Section footer={wake.source === 'routine' ? 'Die Weckzeit kommt aus deinem Tagesplan. Eine Änderung hier gilt nur für morgen und verschiebt die Morgenroutine mit.' : undefined}>
        <Row
          title="Wecker"
          icon="alarm"
          iconBg="#D9963A"
          subtitle={wake.enabled ? 'Klingelt morgen früh' : 'Morgen kein Wecker'}
          right={
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
              {wake.enabled && wake.minutes != null && <TimeField value={wake.minutes} onChange={(m) => A.setAlarmException(tomorrow, { time: m })} accessibilityLabel="Weckzeit morgen" />}
              <Switch
                value={wake.enabled}
                trackColor={{ true: c.accent }}
                onValueChange={(on) => {
                  tap();
                  A.setAlarmException(tomorrow, on ? null : { off: true });
                }}
              />
            </View>
          }
        />
      </Section>

      <Timeline items={tomorrowPlan.items} date={tomorrow} />
      <Button label="Aufgabe für morgen" icon="plus" variant="tinted" onPress={() => router.push({ pathname: '/task/[id]', params: { id: 'new', date: tomorrow } })} />
    </Screen>
  );
}

function ReviewList({ title, items, empty, detail }: { title: string; items: PlanItem[]; empty?: string; detail?: (i: PlanItem) => string }) {
  const c = useColors();
  if (!items.length && !empty) return null;
  return (
    <Section title={title}>
      {items.length ? (
        items.map((i) => (
          <Row
            key={i.task.id}
            title={i.task.title}
            subtitle={detail ? detail(i) : `${fmtTime(i.start)}${i.state.actualMinutes ? ` · ${i.state.actualMinutes} Min fokussiert` : ''}`}
            left={<Dot color={category(i.task.category).color} />}
            right={title === 'Erledigt' ? <Icon name="checkCircle" size={20} color={c.accent} /> : undefined}
          />
        ))
      ) : (
        <Row title={empty!} />
      )}
    </Section>
  );
}
