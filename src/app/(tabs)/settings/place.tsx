import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, TextInput, View } from 'react-native';

import * as A from '@/data/actions';
import { useStore } from '@/data/store';
import { HOME_PLACE_ID, SCHOOL_PLACE_ID } from '@/domain/defaults';
import { uid } from '@/domain/time';
import type { Place } from '@/domain/types';
import { currentCoordinates, geocode } from '@/services/location';
import { syncAll } from '@/services/sync';
import { ask, tell } from '@/ui/ask';
import { Button, Chip, HeaderButton, Row, Screen, Section, Segmented, success, SwitchRow } from '@/ui/kit';
import { radius, space, useColors } from '@/ui/theme';

const RADII = [100, 150, 250, 400];

export default function PlaceEditor() {
  const c = useColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const routine = useStore((s) => s.routine);
  const existing = routine.places.find((p) => p.id === id);
  const hasHome = routine.places.some((p) => p.kind === 'home');
  const [draft, setDraft] = useState<Place>(
    () =>
      existing ?? {
        id: hasHome ? uid() : HOME_PLACE_ID,
        name: hasHome ? '' : 'Zuhause',
        kind: hasHome ? 'other' : 'home',
        latitude: 0,
        longitude: 0,
        radius: 150,
        notifyOnEnter: true,
        notifyOnExit: true,
        enabled: true,
      },
  );
  const [query, setQuery] = useState(existing?.address ?? '');
  const [busy, setBusy] = useState(false);
  const set = (patch: Partial<Place>) => setDraft((d) => ({ ...d, ...patch }));
  const located = draft.latitude !== 0 || draft.longitude !== 0;
  const linked = routine.tasks.filter((t) => !t.deletedAt && t.trigger?.placeId === draft.id);

  const useHere = async () => {
    setBusy(true);
    try {
      const pos = await currentCoordinates();
      set({ latitude: pos.latitude, longitude: pos.longitude, address: pos.address });
      if (pos.address) setQuery(pos.address);
    } catch (e) {
      tell('Standort nicht verfügbar', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const search = async () => {
    if (!query.trim()) return;
    setBusy(true);
    try {
      const r = await geocode(query.trim());
      if (r) set({ ...r, address: query.trim() });
      else tell('Adresse nicht gefunden', 'Versuche es mit Straße, Hausnummer und Ort.');
    } catch {
      tell('Suche nicht möglich', 'Die Adresssuche braucht eine Internetverbindung. Alternativ den aktuellen Standort verwenden.');
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    const place = { ...draft, name: draft.name.trim() || (draft.kind === 'home' ? 'Zuhause' : draft.kind === 'school' ? 'Schule' : 'Ort') };
    // Keep the well-known ids so the default routine's triggers (home arrival) match.
    if (!existing && place.kind === 'home' && !routine.places.some((p) => p.id === HOME_PLACE_ID)) place.id = HOME_PLACE_ID;
    if (!existing && place.kind === 'school' && !routine.places.some((p) => p.id === SCHOOL_PLACE_ID)) place.id = SCHOOL_PLACE_ID;
    A.upsertPlace(place);
    await syncAll('place-saved', { force: true });
    success();
    router.back();
  };

  return (
    <Screen keyboardShouldPersistTaps="handled">
      <Stack.Screen
        options={{
          title: existing ? draft.name || 'Ort' : 'Neuer Ort',
          headerLargeTitle: false,
          headerRight: () => <HeaderButton label="Sichern" bold disabled={!located} onPress={save} />,
        }}
      />

      <Section>
        <Row
          title="Name"
          right={
            <TextInput value={draft.name} onChangeText={(name) => set({ name })} placeholder="z. B. Sportverein" placeholderTextColor={c.text3} style={{ color: c.text, fontSize: 17, minWidth: 160, textAlign: 'right' }} />
          }
        />
        <View style={{ padding: space.md }}>
          <Segmented
            value={draft.kind}
            onChange={(kind) => set({ kind })}
            options={[
              { value: 'home', label: 'Zuhause' },
              { value: 'school', label: 'Schule' },
              { value: 'other', label: 'Anderer Ort' },
            ]}
          />
        </View>
      </Section>

      <Section title="Position" footer={located ? `Gespeichert: ${draft.latitude.toFixed(4)}, ${draft.longitude.toFixed(4)}` : 'Am einfachsten: Stell dich an den Ort und tippe auf „Aktuellen Standort verwenden“.'}>
        <View style={{ padding: space.md, gap: space.md }}>
          <Button label="Aktuellen Standort verwenden" icon="location" variant="tinted" onPress={useHere} disabled={busy} />
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Adresse suchen"
              placeholderTextColor={c.text3}
              returnKeyType="search"
              onSubmitEditing={search}
              style={{ flex: 1, height: 44, borderRadius: radius.sm, backgroundColor: c.bg, paddingHorizontal: space.md, color: c.text, fontSize: 16 }}
            />
            <Button label="Suchen" variant="gray" onPress={search} disabled={busy || !query.trim()} />
          </View>
          {busy && <ActivityIndicator />}
        </View>
      </Section>

      <Section title="Radius" footer="Ab 150 m arbeitet die Erkennung auf beiden Systemen zuverlässig. Kleinere Radien lösen später oder gar nicht aus.">
        <View style={{ flexDirection: 'row', gap: space.sm, padding: space.md }}>
          {RADII.map((r) => (
            <Chip key={r} label={`${r} m`} selected={draft.radius === r} onPress={() => set({ radius: r })} />
          ))}
        </View>
      </Section>

      <Section title="Erkennen" footer={linked.length ? `Startet: ${linked.map((t) => `${t.title} (${t.trigger?.event === 'enter' ? 'Ankunft' : 'Verlassen'})`).join(', ')}` : 'Verknüpfe im Aufgaben-Editor eine Aufgabe mit diesem Ort.'}>
        <SwitchRow title="Ankunft" value={draft.notifyOnEnter} onChange={(notifyOnEnter) => set({ notifyOnEnter })} />
        <SwitchRow title="Verlassen" value={draft.notifyOnExit} onChange={(notifyOnExit) => set({ notifyOnExit })} />
        <SwitchRow title="Aktiv" subtitle="Vorübergehend ausschalten, ohne den Ort zu löschen" value={draft.enabled} onChange={(enabled) => set({ enabled })} />
      </Section>

      {existing && (
        <Section>
          <Row
            title="Ort löschen"
            destructive
            chevron={false}
            onPress={() =>
              ask('Ort löschen?', 'Verknüpfte Aufgaben bleiben erhalten, starten aber nicht mehr automatisch.', [
                { text: 'Abbrechen', style: 'cancel' },
                { text: 'Löschen', style: 'destructive', onPress: () => { A.deletePlace(existing.id); syncAll('place-deleted', { force: true }); router.back(); } },
              ])
            }
          />
        </Section>
      )}
    </Screen>
  );
}
