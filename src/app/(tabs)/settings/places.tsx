import { Stack, router } from 'expo-router';
import { Linking, Platform, View } from 'react-native';

import * as A from '@/data/actions';
import { useStore } from '@/data/store';
import { getLocationStatus, requestLocationPermissions } from '@/services/location';
import { syncAll } from '@/services/sync';
import { useAsyncStatus } from '@/ui/hooks';
import { Banner, Button, Icon, Row, Screen, Section, SwitchRow, Txt } from '@/ui/kit';
import { space, useColors } from '@/ui/theme';

const KIND_ICON = { home: 'home', school: 'school', other: 'pin' } as const;

export default function PlacesScreen() {
  const c = useColors();
  const routine = useStore((s) => s.routine);
  const enabled = routine.settings.location.enabled;
  const web = Platform.OS === 'web';
  const [status, refresh] = useAsyncStatus(getLocationStatus, routine);

  const toggle = async (on: boolean) => {
    if (on) await requestLocationPermissions();
    A.updateSettings((s) => ({ ...s, location: { ...s.location, enabled: on } }));
    await syncAll('location-toggle', { force: true });
    refresh();
  };

  const permText =
    status?.background === 'granted' ? 'Immer erlaubt' : status?.foreground === 'granted' ? 'Nur beim Verwenden der App' : status?.foreground === 'denied' ? 'Nicht erlaubt' : 'Noch nicht gefragt';

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Standorte', headerLargeTitle: false }} />

      {web && (
        <Banner
          tone="blue"
          icon="home"
          title="Ankunft per Tipp"
          message="Im Browser kann Jetzt deinen Standort nicht im Hintergrund verfolgen. Wenn du nach Hause kommst, tippe auf der Heute-Seite auf „Ich bin zu Hause“ – dann startet der Nachmittag und der Plan passt sich an, falls du später dran bist."
        />
      )}

      {!web && (
      <Section footer="Die App erkennt, wenn du zu Hause ankommst oder losgehst, und startet dann den passenden Teil deiner Routine. Dafür braucht sie den Standortzugriff „Immer“.">
        <SwitchRow title="Standorterkennung" value={enabled} onChange={toggle} icon="location" iconBg="#3A7DBF" />
        {enabled && <Row title="Berechtigung" value={permText} />}
      </Section>
      )}

      {!web && enabled && status && status.background !== 'granted' && (
        <Banner
          tone="warn"
          icon="warn"
          title="Zugriff „Immer“ fehlt"
          message="Ohne ihn kann das System die App beim Ankommen nicht wecken. Bis dahin bestätigst du die Ankunft mit einem Tipp auf der Heute-Seite.">
          <Button label="Einstellungen öffnen" size="sm" onPress={() => Linking.openSettings()} />
        </Banner>
      )}
      {!web && enabled && status?.background === 'granted' && status.error && (
        <Banner tone="warn" icon="warn" title="Automatische Erkennung nicht möglich" message={`${status.error} Bestätige die Ankunft mit „Ich bin zu Hause“ auf der Heute-Seite.`} />
      )}
      {!web && enabled && status && !status.servicesEnabled && (
        <Banner tone="warn" icon="warn" title="Ortungsdienste sind ausgeschaltet" message="Schalte sie in den Systemeinstellungen ein, damit Orte erkannt werden." />
      )}

      <Section title="Orte">
        {routine.places.map((p) => (
          <Row
            key={p.id}
            title={p.name}
            subtitle={`${p.address ? `${p.address} · ` : ''}${p.radius} m${p.enabled ? '' : ' · pausiert'}`}
            icon={KIND_ICON[p.kind]}
            iconBg={p.kind === 'home' ? '#1F7A57' : p.kind === 'school' ? '#5767C9' : '#6C6C70'}
            onPress={() => router.push({ pathname: '/settings/place', params: { id: p.id } })}
          />
        ))}
        <Row title="Ort hinzufügen" icon="plus" iconBg={c.accent} onPress={() => router.push({ pathname: '/settings/place', params: { id: 'new' } })} />
      </Section>

      <View style={{ gap: space.sm, paddingHorizontal: space.sm }}>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Icon name="shield" size={14} color={c.text3} style={{ marginTop: 2 }} />
          <Txt v="footnote" c="text2" style={{ flex: 1 }}>
            Datenschutz: Die App nutzt Geofencing des Betriebssystems statt dauerhafter GPS-Ortung. Koordinaten und Ankunftszeiten bleiben auf deinem Gerät und werden nicht weitergegeben.
          </Txt>
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Icon name="info" size={14} color={c.text3} style={{ marginTop: 2 }} />
          <Txt v="footnote" c="text2" style={{ flex: 1 }}>
            Zuverlässigkeit: Das System meldet Ankunft und Abfahrt meist innerhalb weniger Minuten, nicht sekundengenau. Bei schwachem Empfang oder im Stromsparmodus kann es länger dauern.
          </Txt>
        </View>
      </View>
    </Screen>
  );
}
