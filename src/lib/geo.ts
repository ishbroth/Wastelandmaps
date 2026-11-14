// The device's position, the same way in a browser and in the app: Capacitor's location plugin in the app (so the system asks for permission properly),
// the browser's own in a browser.

import { registerPlugin } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';
import { isNative } from './native';

// the community plugin that keeps delivering positions while the phone is locked or the app is in the background (a foreground service with a visible
// notification on Android; the "location" background mode on iOS)
interface BackgroundPlugin {
  addWatcher(
    options: { backgroundTitle?: string; backgroundMessage?: string; requestPermissions?: boolean; stale?: boolean; distanceFilter?: number; /** (our patch of the plugin) a position to within a block or so, from Wi-Fi and cell towers, instead of the GPS chip running flat out */ lowPower?: boolean },
    callback: (location?: { latitude: number; longitude: number; accuracy: number }, error?: { code?: string; message?: string }) => void,
  ): Promise<string>;
  removeWatcher(options: { id: string }): Promise<void>;
  openSettings(): Promise<void>;
}
const BackgroundGeolocation = registerPlugin<BackgroundPlugin>('BackgroundGeolocation');

/** Takes the person to the phone's settings for this app (where location can be turned back on). */
export async function openLocationSettings(): Promise<void> {
  if (isNative()) await BackgroundGeolocation.openSettings().catch(() => {});
}

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

export interface GeoOptions { /** Save the battery: positions to within a block or so, less often (enough to discover places while the phone is in a pocket; not for turn-by-turn). */ lowPower?: boolean; timeout?: number; maximumAge?: number; highAccuracy?: boolean; /** Keep watching with the phone locked or the app in the background (app only). */ background?: { title: string; message: string } }

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
  if (isNative() && options.background) {
    const id = await BackgroundGeolocation.addWatcher(
      { backgroundTitle: options.background.title, backgroundMessage: options.background.message, requestPermissions: true, stale: false, distanceFilter: options.lowPower ? 40 : 3, lowPower: options.lowPower === true },
      (location, error) => {
        if (location) onFix({ lat: location.latitude, lng: location.longitude, accuracy: location.accuracy });
        else if (error) onError(error.code === 'NOT_AUTHORIZED' ? 1 : 2);
      },
    );
    return () => { void BackgroundGeolocation.removeWatcher({ id }); };
  }
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

/**
 * Asks the phone for location now, and says how it was answered. In the app this brings up the system's own "Allow" question whenever the phone is willing to ask
 * (it asks again after "Allow Once" has run out, and the first time); once it has been answered with "While Using" or "Don't Allow" the phone does not ask again, and
 * the only way to change it is in Settings (see openLocationSettings). In a browser the question comes with the first position, so this just reports the state.
 */
export async function askForLocation(): Promise<'granted' | 'denied' | 'prompt' | 'unsupported'> {
  if (isNative()) {
    try {
      const p = await Geolocation.requestPermissions({ permissions: ['location'] });
      return p.location === 'granted' || p.coarseLocation === 'granted' ? 'granted' : p.location === 'denied' ? 'denied' : 'prompt';
    } catch {
      return locationState();
    }
  }
  return locationState();
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
