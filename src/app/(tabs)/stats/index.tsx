import { useEffect, useMemo } from 'react';
import { View } from 'react-native';

import { useStore } from '@/data/store';
import { category } from '@/domain/categories';
import { averageDurations, consistency, doneByCategory, mostShifted, summarizeRange, weeklyTrend } from '@/domain/stats';
import { WEEKDAY_SHORT, addDays, fmtDuration, fmtShortDate, startOfWeek, todayKey, weekdayOfKey } from '@/domain/time';
import type { DayRecord } from '@/domain/types';
import { useNow } from '@/ui/hooks';
import { Bar, Card, Dot, ProgressRing, Screen, Txt } from '@/ui/kit';
import { radius, space, useColors } from '@/ui/theme';

export default function StatsScreen() {
  const c = useColors();
  const now = useNow(60000);
  const today = todayKey(now);
  const weekStart = startOfWeek(today);
  const tasks = useStore((s) => s.routine.tasks);
  const days = useStore((s) => s.days);
  const ensureDays = useStore((s) => s.ensureDays);
  useEffect(() => ensureDays(addDays(weekStart, -42), today), [ensureDays, weekStart, today]);

  const data = useMemo(() => {
    const get = (d: string) => days[d];
    const week = summarizeRange(weekStart, 7, tasks, get, now);
    const lastWeek = summarizeRange(addDays(weekStart, -7), 7, tasks, get, now);
    const records: DayRecord[] = Object.values(days).filter((r) => r.date >= addDays(today, -28) && r.date <= today);
    return {
      todaySummary: week.find((s) => s.date === today),
      week,
      cons: consistency(week, today),
      prev: consistency(lastWeek, today),
      trend: weeklyTrend(Array.from({ length: 6 }, (_, i) => addDays(weekStart, (i - 5) * 7)), tasks, get, now),
      shifted: mostShifted(records, tasks),
      durations: averageDurations(records, tasks),
      byCategory: doneByCategory(records, tasks),
    };
  }, [days, tasks, weekStart, today, now]);

  const t = data.todaySummary;
  const delta = data.cons.activeDays && data.prev.activeDays ? data.cons.average - data.prev.average : null;
  const maxCat = Math.max(1, ...data.byCategory.map((x) => x.done));

  return (
    <Screen>
      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: space.lg }}>
        <ProgressRing size={76} stroke={8} progress={(t?.percent ?? 0) / 100}>
          <Txt v="headline" tabular>
            {t?.percent ?? 0}%
          </Txt>
        </ProgressRing>
        <View style={{ flex: 1, gap: 2 }}>
          <Txt v="footnote" c="text2">
            HEUTE
          </Txt>
          <Txt v="title3">
            {t?.done ?? 0} von {(t?.total ?? 0) - (t?.skipped ?? 0)} erledigt
          </Txt>
          <Txt v="footnote" c="text2">
            {t && t.trackedMinutes > 0 ? `${fmtDuration(t.trackedMinutes)} mit Timer fokussiert` : 'Jeder abgehakte Punkt zählt.'}
          </Txt>
        </View>
      </Card>

      <Card style={{ gap: space.lg }}>
        <View style={{ gap: 2 }}>
          <Txt v="footnote" c="text2">
            DIESE WOCHE
          </Txt>
          <Txt v="title3">
            {data.cons.activeDays ? `An ${data.cons.goodDays} von ${data.cons.activeDays} Tagen über 60 %` : 'Die Woche beginnt gerade.'}
          </Txt>
          {delta != null && (
            <Txt v="footnote" c="text2">
              {delta > 2 ? `Im Schnitt ${delta} Prozentpunkte mehr als letzte Woche.` : delta < -2 ? 'Etwas weniger als letzte Woche – das ist völlig okay.' : 'Ähnlich beständig wie letzte Woche.'}
            </Txt>
          )}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 120, gap: 10 }}>
          {data.week.map((d) => {
            const future = d.date > today;
            const h = d.hasData && !future ? Math.max(4, (d.percent / 100) * 100) : 4;
            return (
              <View key={d.date} style={{ flex: 1, alignItems: 'center', gap: 6 }}>
                <Txt v="caption" c="text3" tabular>
                  {d.hasData && !future ? `${d.percent}` : ''}
                </Txt>
                <View
                  style={{
                    width: '100%',
                    height: h,
                    borderRadius: 6,
                    backgroundColor: future || !d.hasData ? c.ring : d.date === today ? c.accent : c.accent,
                    opacity: d.date === today || future || !d.hasData ? 1 : 0.65,
                  }}
                />
                <Txt v="caption" weight={d.date === today ? '700' : '500'} color={d.date === today ? c.accent : c.text2}>
                  {WEEKDAY_SHORT[weekdayOfKey(d.date)]}
                </Txt>
              </View>
            );
          })}
        </View>
      </Card>

      <Card style={{ gap: space.md }}>
        <Txt v="footnote" c="text2">
          ENTWICKLUNG · LETZTE 6 WOCHEN
        </Txt>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 72, gap: 8 }}>
          {data.trend.map((w) => (
            <View key={w.weekStart} style={{ flex: 1, alignItems: 'center', gap: 4 }}>
              <View style={{ width: '100%', height: w.average != null ? Math.max(4, (w.average / 100) * 56) : 4, borderRadius: 4, backgroundColor: w.average != null ? c.blue : c.ring, opacity: w.weekStart === startOfWeek(today) ? 1 : 0.6 }} />
              <Txt v="caption" c="text3" tabular>
                {fmtShortDate(w.weekStart).replace(/\s.*/, '')}
              </Txt>
            </View>
          ))}
        </View>
        <Txt v="footnote" c="text2">
          Durchschnittlich erledigter Anteil pro Woche. Tage ohne Nutzung zählen nicht.
        </Txt>
      </Card>

      {data.shifted.length > 0 && (
        <Card style={{ gap: space.md }}>
          <Txt v="footnote" c="text2">
            HÄUFIG VERSCHOBEN · 4 WOCHEN
          </Txt>
          {data.shifted.map((s) => (
            <View key={s.task.id} style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
              <Dot color={category(s.task.category).color} />
              <Txt v="body" style={{ flex: 1 }} numberOfLines={1}>
                {s.task.title}
              </Txt>
              <Txt v="subhead" c="text2" tabular>
                {s.count}× · Ø {Math.round(s.minutes / s.count)} Min
              </Txt>
            </View>
          ))}
          <Txt v="footnote" c="text2">
            Wird etwas oft verschoben, passt vielleicht eine andere Uhrzeit besser.
          </Txt>
        </Card>
      )}

      {data.durations.length > 0 && (
        <Card style={{ gap: space.md }}>
          <Txt v="footnote" c="text2">
            DURCHSCHNITTLICHE AUFGABENZEIT
          </Txt>
          {data.durations.map((d) => (
            <View key={d.task.id} style={{ gap: 6 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Txt v="subhead" numberOfLines={1} style={{ flex: 1 }}>
                  {d.task.title}
                </Txt>
                <Txt v="subhead" c="text2" tabular>
                  Ø {fmtDuration(d.averageMinutes)} / geplant {fmtDuration(d.plannedMinutes)}
                </Txt>
              </View>
              <Bar value={d.plannedMinutes ? d.averageMinutes / Math.max(d.plannedMinutes, d.averageMinutes) : 0} color={category(d.task.category).color} />
            </View>
          ))}
        </Card>
      )}

      {data.byCategory.length > 0 && (
        <Card style={{ gap: space.md }}>
          <Txt v="footnote" c="text2">
            ERLEDIGT NACH KATEGORIE · 4 WOCHEN
          </Txt>
          {data.byCategory.map((x) => {
            const cat = category(x.category);
            return (
              <View key={x.category} style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
                <Txt v="subhead" style={{ width: 128 }} numberOfLines={1}>
                  {cat.label}
                </Txt>
                <View style={{ flex: 1 }}>
                  <Bar value={x.done / maxCat} color={cat.color} height={8} />
                </View>
                <Txt v="subhead" c="text2" tabular style={{ width: 28, textAlign: 'right' }}>
                  {x.done}
                </Txt>
              </View>
            );
          })}
        </Card>
      )}

      <View style={{ backgroundColor: c.accentSoft, borderRadius: radius.lg, padding: space.lg }}>
        <Txt v="subhead" c="text2">
          Statistiken sind ein Spiegel, kein Zeugnis. Ein ruhiger Tag mit wenigen Häkchen ist genauso Teil deiner Routine.
        </Txt>
      </View>
    </Screen>
  );
}
