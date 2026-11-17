import { router } from 'expo-router';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import * as A from '@/data/actions';
import { useStore } from '@/data/store';
import { category } from '@/domain/categories';
import { timerElapsedMs, timerRemainingMs } from '@/domain/plan';
import { fmtCountdown, fmtDuration, fmtTime, todayKey } from '@/domain/time';
import { ask } from '@/ui/ask';
import { useNow } from '@/ui/hooks';
import { Button, Icon, IconButton, ProgressRing, success, Txt } from '@/ui/kit';
import { space, useColors } from '@/ui/theme';

export default function TimerScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const now = useNow(1000);
  const today = todayKey(now);
  const record = useStore((s) => s.days[today]);
  const tasks = useStore((s) => s.routine.tasks);
  const timer = record?.timer;
  const task = tasks.find((t) => t.id === timer?.taskId);

  if (!timer || !task) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center', gap: space.lg, padding: space.xl }}>
        <Icon name="timer" size={40} color={c.text3} />
        <Txt v="title3" center>
          Gerade läuft kein Timer.
        </Txt>
        <Button label="Schließen" variant="gray" onPress={() => router.back()} />
      </View>
    );
  }

  const cat = category(task.category);
  const remaining = timerRemainingMs(timer, now);
  const over = remaining < 0;
  const running = timer.runningSince != null;
  const progress = Math.min(1, timerElapsedMs(timer, now) / timer.plannedMs);
  const startedAt = record?.instances[task.id]?.startedAt;

  const finish = () => {
    success();
    A.completeTask(task.id);
    router.back();
  };

  const stop = () =>
    ask('Timer beenden?', 'Die Zeit wird gespeichert. Möchtest du die Aufgabe als erledigt markieren?', [
      { text: 'Abbrechen', style: 'cancel' },
      { text: 'Nur beenden', onPress: () => { A.stopTimer(); router.back(); } },
      { text: 'Erledigt', style: 'default', onPress: finish },
    ]);

  return (
    <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: insets.top + space.sm, paddingBottom: insets.bottom + space.lg, paddingHorizontal: space.xl }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <IconButton name="close" label="Schließen" onPress={() => router.back()} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Icon symbol={cat} size={14} color={cat.color} />
          <Txt v="footnote" c="text2" weight="600">
            {cat.label}
          </Txt>
        </View>
        <View style={{ width: 36 }} />
      </View>

      <View style={{ alignItems: 'center', marginTop: space.xl, gap: 6 }}>
        <Txt v="title1" center>
          {task.title}
        </Txt>
        <Txt v="subhead" c="text2" center>
          Geplant {fmtDuration(timer.plannedMs / 60000)}
          {startedAt ? ` · gestartet ${fmtTime(new Date(startedAt).getHours() * 60 + new Date(startedAt).getMinutes())}` : ''}
        </Txt>
      </View>

      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ProgressRing size={280} stroke={12} progress={over ? 1 : progress} color={over ? c.warn : running ? c.accent : c.text3}>
          <View style={{ alignItems: 'center' }}>
            <Txt v="largeTitle" tabular color={over ? c.warn : c.text} style={{ fontSize: 64, lineHeight: 72, fontWeight: '200', letterSpacing: -1 }}>
              {over ? `+${fmtCountdown(-remaining)}` : fmtCountdown(remaining)}
            </Txt>
            <Txt v="subhead" c="text2">
              {over ? 'über der geplanten Zeit' : running ? 'verbleibend' : 'pausiert'}
            </Txt>
          </View>
        </ProgressRing>
        {task.description ? (
          <Txt v="callout" c="text2" center style={{ marginTop: space.xl, maxWidth: 300 }}>
            {task.description}
          </Txt>
        ) : null}
      </View>

      <View style={{ gap: space.md }}>
        <Button
          label={running ? 'Pausieren' : 'Fortsetzen'}
          icon={running ? 'pause' : 'play'}
          size="lg"
          variant={running ? 'blue' : 'filled'}
          onPress={() => (running ? A.pauseTimer() : A.resumeTimer())}
        />
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <Button label="Verlängern" icon="plus" variant="gray" flex onPress={() => router.push({ pathname: '/extend', params: { taskId: task.id } })} />
          <Button label="Erledigt" icon="check" variant="tinted" flex onPress={finish} />
        </View>
        <Button label="Vorzeitig beenden" variant="plain" size="sm" onPress={stop} />
      </View>
    </View>
  );
}
