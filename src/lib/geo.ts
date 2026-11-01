// The device's position, the same way in a browser and in the app: Capacitor's location plugin in the app (so the system asks for permission properly),
// the browser's own in a browser.

import { Geolocation } from '@capacitor/geolocation';
import { isNative } from './native';

export interface GeoFix { lat: number; lng: number; accuracy: number }

/** 1: refused, 2: could not work it out, 3: too slow (the browser's codes). */
export class GeoError extends Error {
  code: 1 | 2 | 3;
  constructor(code: 1 | 2 | 3, message = 'location error') {
    super(message);
    this.code = code;
  }
}

const codeOf = (e: unknown): 1 | 2 | 3 => {
  const code = (e as { code?: number | string }).code;
  const text = String((e as { message?: string }).message ?? '').toLowerCase();
  if (code === 1 || code === '1' || /denied|permission|not authori/.test(text)) return 1;
  if (code === 3 || code === '3' || /timeout|timed out/.test(text)) return 3;
  return 2;
};

export interface GeoOptions { timeout?: number; maximumAge?: number; highAccuracy?: boolean }

/** Where the device is now (throws a GeoError). */
export async function getFix(options: GeoOptions = {}): Promise<GeoFix> {
  if (isNative()) {
    try {
      const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: options.highAccuracy ?? true, timeout: options.timeout ?? 20_000, maximumAge: options.maximumAge ?? 30_000 });
      return { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy };
    } catch (e) {
      throw new GeoError(codeOf(e));
    }
  }
  if (!navigator.geolocation) throw new GeoError(2, 'this device cannot find itself');
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }),
      (err) => reject(new GeoError(err.code as 1 | 2 | 3, err.message)),
      { timeout: options.timeout ?? 20_000, maximumAge: options.maximumAge ?? 30_000, enableHighAccuracy: options.highAccuracy ?? true },
    );
  });
}

/** Every new position until the returned function is called. `onError` gets the code; only 1 (refused) means the watching has really failed. */
export async function watchFixes(onFix: (fix: GeoFix) => void, onError: (code: 1 | 2 | 3) => void, options: GeoOptions = {}): Promise<() => void> {
  if (isNative()) {
    const id = await Geolocation.watchPosition({ enableHighAccuracy: options.highAccuracy ?? true, maximumAge: options.maximumAge ?? 10_000, timeout: options.timeout ?? 30_000 }, (pos, err) => {
      if (pos) onFix({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy });
      else if (err) onError(codeOf(err));
    });
    return () => { void Geolocation.clearWatch({ id }); };
  }
  if (!navigator.geolocation) return () => {};
  const id = navigator.geolocation.watchPosition(
    (pos) => onFix({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }),
    (err) => onError(err.code as 1 | 2 | 3),
    { enableHighAccuracy: options.highAccuracy ?? true, maximumAge: options.maximumAge ?? 10_000 },
  );
  return () => navigator.geolocation.clearWatch(id);
}

/** Is location usable, refused, or not yet asked? */
export async function locationState(): Promise<'granted' | 'denied' | 'prompt' | 'unsupported'> {
  if (isNative()) {
    try {
      const p = await Geolocation.checkPermissions();
      return p.location === 'granted' || p.coarseLocation === 'granted' ? 'granted' : p.location === 'denied' ? 'denied' : 'prompt';
    } catch {
      return 'prompt';
    }
  }
  if (!navigator.geolocation) return 'unsupported';
  try {
    const state = await navigator.permissions?.query({ name: 'geolocation' as PermissionName });
    return state ? (state.state as 'granted' | 'denied' | 'prompt') : 'prompt';
  } catch {
    return 'prompt';
  }
}
