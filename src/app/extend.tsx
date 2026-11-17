import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import * as A from '@/data/actions';
import type { PlanItem } from '@/domain/plan';
import type { ShiftProposal } from '@/domain/schedule';
import { fmtDuration, fmtTime } from '@/domain/time';
import { Button, Icon, success, tap, Txt } from '@/ui/kit';
import { radius, space, useColors } from '@/ui/theme';

const OPTIONS = [5, 10, 15, 30];

export default function ExtendSheet() {
  const c = useColors();
  const { taskId } = useLocalSearchParams<{ taskId: string }>();
  const plan = A.getPlan();
  const item = plan.items.find((i) => i.task.id === taskId);
  const [custom, setCustom] = useState('');
  const [result, setResult] = useState<{ minutes: number; proposal: ShiftProposal; item: PlanItem } | null>(null);

  if (!item) {
    return (
      <View style={{ padding: space.xl }}>
        <Txt v="headline">Diese Aufgabe ist heute nicht geplant.</Txt>
      </View>
    );
  }

  const extend = (minutes: number) => {
    if (!minutes || minutes <= 0) return;
    const out = A.extendTask(item.task.id, minutes);
    if (!out.proposal.changes.length && !out.proposal.blockedBy.length) {
      success();
      router.back();
      return;
    }
    setResult({ minutes, proposal: out.proposal, item: out.item! });
  };

  if (result) {
    const { proposal } = result;
    const titleOf = (id: string) => plan.items.find((i) => i.task.id === id)?.task.title ?? '';
    const blocked = proposal.blockedBy[0];
    return (
      <Animated.View entering={FadeIn} style={{ padding: space.xl, paddingTop: space.xxl, gap: space.lg }}>
        <View style={{ gap: 6 }}>
          <Txt v="title2">Nachfolgende Aufgaben verschieben?</Txt>
          <Txt v="callout" c="text2">
            {item.task.title} endet jetzt um {fmtTime(result.item.end)}. Dadurch gibt es Überschneidungen.
          </Txt>
        </View>
        {proposal.changes.length > 0 && (
          <View style={{ backgroundColor: c.card, borderRadius: radius.md, paddingVertical: 4 }}>
            {proposal.changes.map((ch) => (
              <View key={ch.taskId} style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.lg, paddingVertical: 10, gap: space.md }}>
                <Txt v="body" style={{ flex: 1 }} numberOfLines={1}>
                  {titleOf(ch.taskId)}
                </Txt>
                <Txt v="subhead" c="text3" tabular style={{ textDecorationLine: 'line-through' }}>
                  {fmtTime(ch.from)}
                </Txt>
                <Icon name="arrowRight" size={12} color={c.text3} />
                <Txt v="subhead" c="accent" tabular weight="600">
                  {fmtTime(ch.to)}
                </Txt>
              </View>
            ))}
          </View>
        )}
        {blocked && (
          <Txt v="footnote" c="text2">
            {blocked.task.title} um {fmtTime(blocked.start)} ist ein fester Termin und bleibt, wo er ist.
          </Txt>
        )}
        {proposal.overflow && (
          <Txt v="footnote" color={c.warn}>
            Der Plan reicht dadurch über Mitternacht hinaus.
          </Txt>
        )}
        <View style={{ gap: space.sm }}>
          {proposal.changes.length > 0 && (
            <Button
              label="Nachfolgende verschieben"
              size="lg"
              onPress={() => {
                A.applyChanges(proposal.changes, `${item.task.title} um ${result.minutes} Min verlängert`, { continueUndo: true });
                success();
                router.back();
              }}
            />
          )}
          {blocked && (
            <Button
              label={`Auch ${blocked.task.title} verschieben`}
              variant="tinted"
              onPress={() => {
                const all = A.proposeForTask(item.task.id, true);
                A.applyChanges(all.changes, `${item.task.title} um ${result.minutes} Min verlängert`, { continueUndo: true });
                success();
                router.back();
              }}
            />
          )}
          <Button label="Nur verlängern" variant="gray" onPress={() => router.back()} />
        </View>
      </Animated.View>
    );
  }

  return (
    <View style={{ padding: space.xl, paddingTop: space.xxl, gap: space.lg }}>
      <View style={{ gap: 4 }}>
        <Txt v="title2">Mehr Zeit für {item.task.title}</Txt>
        <Txt v="callout" c="text2">
          Geplant bis {fmtTime(item.end)} ({fmtDuration(item.duration)}).
        </Txt>
      </View>
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        {OPTIONS.map((m) => (
          <Pressable
            key={m}
            accessibilityRole="button"
            accessibilityLabel={`${m} Minuten verlängern`}
            onPress={() => {
              tap();
              extend(m);
            }}
            style={({ pressed }) => ({
              flex: 1,
              height: 64,
              borderRadius: radius.md,
              backgroundColor: pressed ? c.accent : c.card,
              alignItems: 'center',
              justifyContent: 'center',
            })}>
            {({ pressed }) => (
              <>
                <Txt v="title3" tabular color={pressed ? c.onAccent : c.text}>
                  +{m}
                </Txt>
                <Txt v="caption" color={pressed ? c.onAccent : c.text2}>
                  Min
                </Txt>
              </>
            )}
          </Pressable>
        ))}
      </View>
      <View style={{ flexDirection: 'row', gap: space.sm, alignItems: 'center' }}>
        <TextInput
          value={custom}
          onChangeText={(t) => setCustom(t.replace(/[^0-9]/g, '').slice(0, 3))}
          placeholder="Eigene Zeit in Minuten"
          placeholderTextColor={c.text3}
          keyboardType="number-pad"
          returnKeyType="done"
          onSubmitEditing={() => extend(Number(custom))}
          style={{ flex: 1, height: 48, borderRadius: radius.md, backgroundColor: c.card, paddingHorizontal: space.lg, color: c.text, fontSize: 17 }}
        />
        <Button label="Hinzufügen" disabled={!Number(custom)} onPress={() => extend(Number(custom))} />
      </View>
    </View>
  );
}
