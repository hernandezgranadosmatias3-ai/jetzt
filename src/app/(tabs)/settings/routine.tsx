import { Stack, router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { useStore } from '@/data/store';
import { CATEGORIES, category } from '@/domain/categories';
import { fmtDays, fmtDuration, fmtShortDate, fmtTime } from '@/domain/time';
import type { TaskTemplate } from '@/domain/types';
import { useToday } from '@/ui/hooks';
import { Dot, HeaderButton, Icon, Row, Screen, Section, Segmented, Txt } from '@/ui/kit';
import { space, useColors } from '@/ui/theme';

export default function RoutineScreen() {
  const c = useColors();
  const [group, setGroup] = useState<'time' | 'category'>('time');
  const tasks = useStore((s) => s.routine.tasks);
  const today = useToday();
  const active = tasks.filter((t) => !t.deletedAt && (!t.date || t.date >= today)).sort((a, b) => a.start - b.start);

  const sections: { title: string; items: TaskTemplate[] }[] =
    group === 'time'
      ? [
          { title: 'Schultage (Mo–Fr)', items: active.filter((t) => !t.date && t.days.some((d) => d <= 5)) },
          { title: 'Wochenende', items: active.filter((t) => !t.date && t.days.every((d) => d >= 6)) },
          { title: 'Einmalig', items: active.filter((t) => !!t.date) },
        ]
      : CATEGORIES.map((cat) => ({ title: cat.label, items: active.filter((t) => t.category === cat.id) }));

  return (
    <Screen>
      <Stack.Screen
        options={{
          title: 'Routine',
          headerLargeTitle: false,
          headerRight: () => <HeaderButton label="Neu" bold onPress={() => router.push({ pathname: '/task/[id]', params: { id: 'new' } })} />,
        }}
      />
      <Segmented
        value={group}
        onChange={setGroup}
        options={[
          { value: 'time', label: 'Nach Tagen' },
          { value: 'category', label: 'Nach Kategorie' },
        ]}
      />
      {sections
        .filter((s) => s.items.length)
        .map((s) => (
          <Section key={s.title} title={s.title}>
            {s.items.map((t) => (
              <Row
                key={t.id}
                title={t.title}
                subtitle={`${fmtTime(t.start)}${t.duration ? ` · ${fmtDuration(t.duration)}` : ''} · ${t.date ? fmtShortDate(t.date) : fmtDays(t.days)}${t.pausedUntil && t.pausedUntil >= today ? ' · pausiert' : ''}`}
                left={<Dot color={category(t.category).color} size={10} />}
                right={
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    {!t.reminder.enabled && <Icon name="bellOff" size={13} color={c.text3} />}
                    {t.isWakeUp && <Icon name="alarm" size={13} color={c.text3} />}
                    {t.trigger && <Icon name="pin" size={13} color={c.text3} />}
                    <Icon name="chevron" size={13} color={c.text3} />
                  </View>
                }
                onPress={() => router.push({ pathname: '/task/[id]', params: { id: t.id } })}
              />
            ))}
          </Section>
        ))}
      <Txt v="footnote" c="text3" center style={{ paddingHorizontal: space.lg }}>
        Durchgestrichene Glocke = keine Erinnerung · Wecker = bestimmt die Weckzeit · Stecknadel = startet per Standort
      </Txt>
    </Screen>
  );
}
