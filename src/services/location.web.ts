/**
 * Web version: browsers cannot watch places in the background. Arrival is confirmed
 * with the "Ich bin zu Hause" button on the Heute page.
 */
import type { Place, Routine } from '@/domain/types';

import type { LocationStatus } from './location';

export type { LocationStatus };

export const GEOFENCE_TASK = 'jetzt-geofence';
export const MIN_RADIUS = 100;

export async function getLocationStatus(): Promise<LocationStatus> {
  return {
    foreground: 'denied',
    background: 'denied',
    servicesEnabled: false,
    monitoring: false,
    error: 'Im Browser gibt es keine automatische Orts-Erkennung.',
  };
}

export async function requestLocationPermissions(): Promise<{ foreground: boolean; background: boolean }> {
  return { foreground: false, background: false };
}

export function currentCoordinates(): Promise<{ latitude: number; longitude: number; address?: string }> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(new Error('Standort ist in diesem Browser nicht verfügbar.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ latitude: p.coords.latitude, longitude: p.coords.longitude }),
      () => reject(new Error('Standortzugriff wurde nicht erlaubt.')),
      { enableHighAccuracy: false, timeout: 15000 },
    );
  });
}

export async function geocode(_address: string): Promise<{ latitude: number; longitude: number } | null> {
  return null;
}

export function activePlaces(_routine: Routine): Place[] {
  return [];
}

export async function syncGeofences(_routine: Routine, _force = false): Promise<boolean> {
  return false;
}

export async function isLocationActive(_routine: Routine): Promise<boolean> {
  return false;
}
