/**
 * Place detection with geofencing (region monitoring), not continuous GPS tracking.
 *
 * The operating system watches the regions and wakes the app on entering or leaving,
 * also when the phone is locked or the app is closed. Detection is not exact to the
 * second: iOS and Android typically report a crossing within a few minutes and need
 * a radius of at least 100–150 m to be reliable. Coordinates never leave the device.
 */
import * as Location from 'expo-location';

import { getMeta, setMeta } from '@/data/db';
import type { Place, Routine } from '@/domain/types';

export const GEOFENCE_TASK = 'jetzt-geofence';
export const MIN_RADIUS = 100;

export interface LocationStatus {
  foreground: 'granted' | 'denied' | 'undetermined';
  background: 'granted' | 'denied' | 'undetermined';
  servicesEnabled: boolean;
  monitoring: boolean;
  /** Why region monitoring could not be started (e.g. not supported on this device). */
  error: string | null;
}

function perm(p: Location.LocationPermissionResponse): LocationStatus['foreground'] {
  if (p.granted) return 'granted';
  return p.canAskAgain ? 'undetermined' : 'denied';
}

export async function getLocationStatus(): Promise<LocationStatus> {
  const [fg, bg, services, monitoring] = await Promise.all([
    Location.getForegroundPermissionsAsync(),
    Location.getBackgroundPermissionsAsync(),
    Location.hasServicesEnabledAsync(),
    Location.hasStartedGeofencingAsync(GEOFENCE_TASK).catch(() => false),
  ]);
  return { foreground: perm(fg), background: perm(bg), servicesEnabled: services, monitoring, error: getMeta('geofenceError') || null };
}

/** Ask for "while using" first, then for "always", as both platforms require. */
export async function requestLocationPermissions(): Promise<{ foreground: boolean; background: boolean }> {
  const fg = await Location.requestForegroundPermissionsAsync();
  if (!fg.granted) return { foreground: false, background: false };
  const bg = await Location.requestBackgroundPermissionsAsync();
  return { foreground: true, background: bg.granted };
}

export async function currentCoordinates(): Promise<{ latitude: number; longitude: number; address?: string }> {
  const fg = await Location.requestForegroundPermissionsAsync();
  if (!fg.granted) throw new Error('Standortzugriff wurde nicht erlaubt.');
  const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
  const { latitude, longitude } = pos.coords;
  let address: string | undefined;
  try {
    const [a] = await Location.reverseGeocodeAsync({ latitude, longitude });
    if (a) address = [a.street && `${a.street} ${a.streetNumber ?? ''}`.trim(), a.city].filter(Boolean).join(', ');
  } catch {
    // Reverse geocoding is optional.
  }
  return { latitude, longitude, address };
}

/** Address search with the platform geocoder (Apple / Google system service). */
export async function geocode(address: string): Promise<{ latitude: number; longitude: number } | null> {
  const results = await Location.geocodeAsync(address);
  return results[0] ? { latitude: results[0].latitude, longitude: results[0].longitude } : null;
}

export function activePlaces(routine: Routine): Place[] {
  return routine.settings.location.enabled ? routine.places.filter((p) => p.enabled && (p.notifyOnEnter || p.notifyOnExit)) : [];
}

/**
 * Start, update or stop region monitoring. Regions are only re-registered when they
 * changed, because re-registering can make the system report the current state again.
 */
export async function syncGeofences(routine: Routine, force = false): Promise<boolean> {
  const places = activePlaces(routine);
  const started = await Location.hasStartedGeofencingAsync(GEOFENCE_TASK).catch(() => false);
  if (!places.length) {
    if (started) await Location.stopGeofencingAsync(GEOFENCE_TASK);
    setMeta('geofenceHash', '');
    return false;
  }
  const bg = await Location.getBackgroundPermissionsAsync();
  if (!bg.granted) {
    if (started) await Location.stopGeofencingAsync(GEOFENCE_TASK);
    setMeta('geofenceHash', '');
    return false;
  }
  const regions: Location.LocationRegion[] = places.map((p) => ({
    identifier: p.id,
    latitude: p.latitude,
    longitude: p.longitude,
    radius: Math.max(MIN_RADIUS, p.radius),
    notifyOnEnter: p.notifyOnEnter,
    notifyOnExit: p.notifyOnExit,
  }));
  const hash = JSON.stringify(regions);
  if (!force && started && getMeta('geofenceHash') === hash) return true;
  try {
    await Location.startGeofencingAsync(GEOFENCE_TASK, regions);
  } catch (e) {
    const message = String(e instanceof Error ? e.message : e);
    setMeta('geofenceError', /not available/i.test(message) ? 'Geofencing wird auf diesem Gerät nicht unterstützt.' : message);
    setMeta('geofenceHash', '');
    return false;
  }
  setMeta('geofenceError', '');
  setMeta('geofenceHash', hash);
  return true;
}

export async function isLocationActive(routine: Routine): Promise<boolean> {
  if (!activePlaces(routine).length) return false;
  const bg = await Location.getBackgroundPermissionsAsync().catch(() => null);
  return !!bg?.granted;
}
