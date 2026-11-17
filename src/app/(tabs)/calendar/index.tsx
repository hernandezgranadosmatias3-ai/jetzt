import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Switch, View } from 'react-native';

import * as A from '@/data/actions';
import { useStore } from '@/data/store';
import { resolveAlarm } from '@/domain/alarms';
import { CATEGORIES, category } from '@/domain/categories';
import { buildDayPlan, type PlanItem } from '@/domain/plan';
import { WEEKDAY_LONG, WEEKDAY_SHORT, addDays, fmtShortDate, fmtTime, parseDateKey, startOfWeek, todayKey, weekdayOfKey } from '@/domain/time';
import type { CategoryId, DateKey } from '@/domain/types';
import { useNow } from '@/ui/hooks';
import { Button, Chip, Icon, IconButton, Row, Screen, Section, Segmented, tap, TimeField, Txt } from '@/ui/kit';
import { radius, space, useColors } from '@/ui/theme';
import { Timeline } from '@/ui/timeline';

const DAY_START = 6 * 60;
const DAY_END = 23 * 60;

export default function CalendarScreen() {
  const c = useColors();
  const now = useNow(60000);
  const today = todayKey(now);
  const [view, setView] = useState<'week' | 'day'>('day');
  const [selected, setSelected] = useState<DateKey>(today);
  const [filter, setFilter] = useState<CategoryId | null>(null);
  const weekStart = startOfWeek(selected);
  const tasks = useStore((s) => s.routine.tasks);
  const days = useStore((s) => s.days);
  const alarm = useStore((s) => s.routine.alarm);

  const week = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)).map((d) => buildDayPlan(d, tasks, days[d], now)),
    [weekStart, tasks, days, now],
  );
  const dayPlan = week.find((p) => p.date === selected) ?? week[0];
  const filtered = (items: PlanItem[]) => (filter ? items.filter((i) => i.task.category === filter) : items);
  const usedCategories = CATEGORIES.filter((cat) => week.some((p) => p.items.some((i) => i.task.category === cat.id)));
  const weekday = weekdayOfKey(selected);
  const isWeekend = weekday >= 6;
  const wake = resolveAlarm(selected, alarm, tasks);
  const monthLabel = (() => {
    const d = parseDateKey(weekStart);
    return `${fmtShortDate(weekStart)} – ${fmtShortDate(addDays(weekStart, 6))} ${d.getFullYear()}`;
  })();

  return (
    <Screen>
      <Segmented
        value={view}
        onChange={setView}
        options={[
          { value: 'day', label: 'Tag' },
          { value: 'week', label: 'Woche' },
        ]}
      />

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <IconButton name="chevronLeft" label="Vorherige Woche" onPress={() => setSelected(addDays(selected, -7))} size={32} color={c.accent} />
        <Pressable onPress={() => { tap(); setSelected(today); }} accessibilityRole="button" accessibilityLabel="Zu heute springen">
          <Txt v="headline" center>
            {monthLabel}
          </Txt>
          {selected !== today && (
            <Txt v="footnote" c="accent" center>
              Zu heute
            </Txt>
          )}
        </Pressable>
        <IconButton name="chevron" label="Nächste Woche" onPress={() => setSelected(addDays(selected, 7))} size={32} color={c.accent} />
      </View>

      <View style={{ flexDirection: 'row', gap: 6 }}>
        {week.map((p) => {
          const active = p.date === selected;
          const isToday = p.date === today;
          const pct = p.stats.total ? p.stats.done / Math.max(1, p.stats.total - p.stats.skipped) : 0;
          return (
            <Pressable
              key={p.date}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`${WEEKDAY_LONG[weekdayOfKey(p.date)]}, ${fmtShortDate(p.date)}`}
              onPress={() => {
                tap();
                setSelected(p.date);
              }}
              style={{
                flex: 1,
                alignItems: 'center',
                paddingVertical: 10,
                borderRadius: radius.md,
                backgroundColor: active ? c.accent : c.card,
                gap: 4,
              }}>
              <Txt v="caption" color={active ? c.onAccent : c.text2} weight="600">
                {WEEKDAY_SHORT[weekdayOfKey(p.date)]}
              </Txt>
              <Txt v="headline" tabular color={active ? c.onAccent : isToday ? c.accent : c.text}>
                {parseDateKey(p.date).getDate()}
              </Txt>
              <View style={{ width: 18, height: 3, borderRadius: 2, backgroundColor: active ? 'rgba(255,255,255,0.35)' : c.ring, overflow: 'hidden' }}>
                <View style={{ width: `${pct * 100}%`, height: 3, backgroundColor: active ? c.onAccent : c.accent }} />
              </View>
            </Pressable>
          );
        })}
      </View>

      {usedCategories.length > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }} style={{ marginHorizontal: -space.lg }} contentInset={{ left: space.lg, right: space.lg }} contentOffset={{ x: -space.lg, y: 0 }}>
          <Chip small label="Alle" selected={!filter} onPress={() => setFilter(null)} />
          {usedCategories.map((cat) => (
            <Chip key={cat.id} small label={cat.label} color={cat.color} selected={filter === cat.id} onPress={() => setFilter(filter === cat.id ? null : cat.id)} />
          ))}
        </ScrollView>
      )}

      {view === 'day' ? (
        <>
          <View style={{ gap: 2 }}>
            <Txt v="title2">{WEEKDAY_LONG[weekday]}</Txt>
            <Txt v="subhead" c="text2">
              {isWeekend ? 'Wochenend-Routine' : 'Schultag'} · {dayPlan.items.length} Aufgaben
            </Txt>
          </View>

          <Section>
            <Row
              title="Wecker"
              icon="alarm"
              iconBg="#D9963A"
              subtitle={
                wake.source === 'exception' ? 'Nur an diesem Tag geändert' : wake.source === 'off' ? 'An diesem Tag aus' : wake.source === 'routine' ? 'Aus deinem Tagesplan' : 'Eigene Zeit'
              }
              right={
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                  {wake.enabled && wake.minutes != null && (
                    <TimeField value={wake.minutes} onChange={(m) => A.setAlarmException(selected, { time: m })} accessibilityLabel="Weckzeit an diesem Tag" />
                  )}
                  <Switch
                    value={wake.enabled}
                    trackColor={{ true: c.accent }}
                    onValueChange={(on) => {
                      tap();
                      if (!on) A.setAlarmException(selected, { off: true });
                      else A.setAlarmException(selected, null);
                    }}
                  />
                </View>
              }
            />
          </Section>

          <Timeline items={filtered(dayPlan.items)} date={selected} highlightId={selected === today ? dayPlan.focus?.task.id : undefined} />
          <Button label="Aufgabe hinzufügen" icon="plus" variant="tinted" onPress={() => router.push({ pathname: '/task/[id]', params: { id: 'new', date: selected } })} />
        </>
      ) : (
        <WeekGrid plans={week} today={today} filter={filter} onPick={(d) => { setSelected(d); setView('day'); }} />
      )}
    </Screen>
  );
}

function WeekGrid({ plans, today, filter, onPick }: { plans: ReturnType<typeof buildDayPlan>[]; today: DateKey; filter: CategoryId | null; onPick: (d: DateKey) => void }) {
  const c = useColors();
  const span = DAY_END - DAY_START;
  const hours = [6, 9, 12, 15, 18, 21];
  return (
    <View style={{ backgroundColor: c.card, borderRadius: radius.lg, padding: space.lg, gap: space.md }}>
      <View style={{ flexDirection: 'row', paddingLeft: 44, paddingRight: 48 }}>
        <View style={{ flex: 1, height: 16 }}>
          {hours.map((h) => (
            <Txt
              key={h}
              v="caption"
              c="text3"
              tabular
              style={{ position: 'absolute', left: `${((h * 60 - DAY_START) / span) * 100}%`, transform: [{ translateX: -6 }] }}>
              {h}
            </Txt>
          ))}
        </View>
      </View>
      {plans.map((p) => {
        const items = filter ? p.items.filter((i) => i.task.category === filter) : p.items;
        const isToday = p.date === today;
        return (
          <Pressable key={p.date} onPress={() => { tap(); onPick(p.date); }} accessibilityRole="button" accessibilityLabel={`${WEEKDAY_LONG[weekdayOfKey(p.date)]} öffnen`} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={{ width: 36 }}>
              <Txt v="footnote" weight="600" color={isToday ? c.accent : c.text}>
                {WEEKDAY_SHORT[weekdayOfKey(p.date)]}
              </Txt>
              <Txt v="caption" c="text3" tabular>
                {parseDateKey(p.date).getDate()}.
              </Txt>
            </View>
            <View style={{ flex: 1, height: 28, borderRadius: 6, backgroundColor: c.bg, overflow: 'hidden' }}>
              {items.map((i) => {
                const left = Math.max(0, (i.start - DAY_START) / span);
                const width = i.duration > 0 ? Math.max(0.006, Math.min(i.duration, DAY_END - i.start) / span) : 0.006;
                if (i.start >= DAY_END || i.end <= DAY_START) return null;
                const done = i.status === 'done';
                return (
                  <View
                    key={i.task.id}
                    style={{
                      position: 'absolute',
                      left: `${left * 100}%`,
                      width: `${width * 100}%`,
                      top: 3,
                      bottom: 3,
                      borderRadius: 3,
                      backgroundColor: category(i.task.category).color,
                      opacity: i.status === 'skipped' ? 0.25 : done ? 1 : 0.55,
                      borderRightWidth: 1,
                      borderRightColor: c.card,
                    }}
                  />
                );
              })}
            </View>
            <View style={{ width: 40, alignItems: 'flex-end' }}>
              <Txt v="caption" c="text2" tabular>
                {p.items[0] ? fmtTime(p.items[0].start) : '–'}
              </Txt>
            </View>
          </Pressable>
        );
      })}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
        <Icon name="info" size={13} color={c.text3} />
        <Txt v="caption" c="text3" style={{ flex: 1 }}>
          Kräftige Farbe = erledigt. Rechts die erste Aufgabe des Tages. Tippe auf einen Tag zum Bearbeiten.
        </Txt>
      </View>
    </View>
  );
}
