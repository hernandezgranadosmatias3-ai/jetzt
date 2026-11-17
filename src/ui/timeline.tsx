import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, LinearTransition } from 'react-native-reanimated';

import * as A from '@/data/actions';
import { category } from '@/domain/categories';
import type { PlanItem } from '@/domain/plan';
import { fmtDuration, fmtTime } from '@/domain/time';
import type { DateKey } from '@/domain/types';

import { Icon, success, tap, Txt } from './kit';
import { radius, space, useColors } from './theme';

export function StatusCircle({ item, date, size = 24 }: { item: PlanItem; date: DateKey; size?: number }) {
  const c = useColors();
  const s = item.status;
  const onPress = () => {
    if (s === 'done' || s === 'skipped') {
      tap();
      A.reopenTask(item.task.id, date);
    } else {
      success();
      A.completeTask(item.task.id, date);
    }
  };
  let content;
  if (s === 'done') {
    content = (
      <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name="check" size={size * 0.5} color={c.onAccent} weight="bold" />
      </View>
    );
  } else if (s === 'skipped') {
    content = <Icon name="skipped" size={size} color={c.text3} />;
  } else {
    const color = s === 'active' || s === 'current' ? c.accent : c.text3;
    content = (
      <View style={{ width: size, height: size, borderRadius: size / 2, borderWidth: 1.75, borderColor: color, alignItems: 'center', justifyContent: 'center' }}>
        {s === 'active' && <View style={{ width: size * 0.42, height: size * 0.42, borderRadius: size, backgroundColor: c.accent }} />}
      </View>
    );
  }
  const label = s === 'done' ? `${item.task.title} wieder öffnen` : `${item.task.title} als erledigt markieren`;
  return (
    <Pressable onPress={onPress} hitSlop={10} accessibilityRole="checkbox" accessibilityState={{ checked: s === 'done' }} accessibilityLabel={label}>
      {content}
    </Pressable>
  );
}

function meta(item: PlanItem): string {
  const parts = [category(item.task.category).label];
  if (item.duration > 0) parts.push(fmtDuration(item.duration));
  if (item.status === 'skipped') parts.push('übersprungen');
  else if (item.status === 'missed') parts.push('offen');
  else if (item.status === 'active') parts.push('läuft');
  if ((item.state.shiftedBy ?? 0) > 0 && item.start !== item.plannedStart) parts.push(`statt ${fmtTime(item.plannedStart)}`);
  return parts.join(' · ');
}

export function TaskRow({ item, date, highlight, first }: { item: PlanItem; date: DateKey; highlight?: boolean; first?: boolean }) {
  const c = useColors();
  const cat = category(item.task.category);
  const muted = item.status === 'done' || item.status === 'skipped';
  return (
    <Animated.View layout={LinearTransition.duration(220)} entering={FadeIn.duration(180)}>
      {!first && <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: c.separator, marginLeft: 76 }} />}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${fmtTime(item.start)} ${item.task.title}`}
        onPress={() => router.push({ pathname: '/task/[id]', params: { id: item.task.id, date } })}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          gap: space.md,
          paddingVertical: 12,
          paddingHorizontal: space.lg,
          backgroundColor: pressed ? c.cardPressed : highlight ? c.accentSoft : 'transparent',
        })}>
        <View style={{ width: 46 }}>
          <Txt v="subhead" tabular weight={highlight ? '700' : '500'} color={highlight ? c.accent : muted ? c.text3 : c.text2}>
            {fmtTime(item.start)}
          </Txt>
        </View>
        <StatusCircle item={item} date={date} />
        <View style={{ flex: 1, gap: 1 }}>
          <Txt v="body" weight={highlight ? '600' : '400'} color={muted ? c.text3 : c.text} numberOfLines={1} style={item.status === 'skipped' && { textDecorationLine: 'line-through' }}>
            {item.task.title}
          </Txt>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: cat.color, opacity: muted ? 0.5 : 1 }} />
            <Txt v="footnote" c="text2" numberOfLines={1} style={{ flexShrink: 1 }}>
              {meta(item)}
            </Txt>
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {item.task.fixed && <Icon name="lock" size={12} color={c.text3} />}
          {item.task.trigger && <Icon name="location" size={12} color={c.text3} />}
          {item.task.timer && <Icon name="timer" size={13} color={c.text3} />}
        </View>
      </Pressable>
    </Animated.View>
  );
}

export function Timeline({ items, date, highlightId }: { items: PlanItem[]; date: DateKey; highlightId?: string }) {
  const c = useColors();
  if (!items.length) {
    return (
      <View style={{ backgroundColor: c.card, borderRadius: radius.lg, padding: space.xl, alignItems: 'center', gap: 6 }}>
        <Icon name="sparkles" size={22} color={c.text3} />
        <Txt v="subhead" c="text2" center>
          Für diesen Tag ist nichts geplant.
        </Txt>
      </View>
    );
  }
  return (
    <View style={{ backgroundColor: c.card, borderRadius: radius.lg, overflow: 'hidden', borderCurve: 'continuous' }}>
      {items.map((item, i) => (
        <TaskRow key={item.task.id} item={item} date={date} highlight={item.task.id === highlightId} first={i === 0} />
      ))}
    </View>
  );
}
