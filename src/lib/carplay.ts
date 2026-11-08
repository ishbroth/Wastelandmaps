// The car's screen. On an iPhone with a CarPlay car connected, the app can show the navigation on the car's display too: the same map as the phone's, the route, the
// places that were plotted along it, and a banner when something is discovered. All of it is dormant until a car is actually connected (CarPlay also needs Apple's
// entitlement in the app, see CARPLAY.md; Android Auto needs nothing extra); on the web and in a phone with no car, none of these calls do anything.

import { registerPlugin } from '@capacitor/core';
import { platform } from './native';

export interface CarPlace { id: string; name: string; category: string; icon: string; lat: number; lng: number }
export interface CarStep { text: string; meters: number; path: number[] }

/** Everything the car's map page needs: where the car is, the route, the places around, and the next turn. */
export interface CarPayload {
  active: boolean;
  destination: string;
  destLat: number;
  destLng: number;
  hereLat: number;
  hereLng: number;
  /** The whole route and its steps, as flat lists of latitude, longitude, latitude, longitude... */
  path: number[];
  steps: CarStep[];
  step: number;
  instruction: string;
  distanceToTurn: number;
  remainingMeters: number;
  remainingSeconds: number;
  markers: CarPlace[];
}

interface CarPlayPlugin {
  update(payload: CarPayload): Promise<void>;
  end(): Promise<void>;
  alert(options: { title: string; subtitle: string }): Promise<void>;
  status(): Promise<{ connected: boolean }>;
  addListener(event: 'connection' | 'endRequested', callback: (data: { connected?: boolean }) => void): Promise<{ remove: () => void }>;
}

// the plugin exists only in the phone apps (iPhone and Android); on the web there is nothing to call
const plugin: CarPlayPlugin | null = platform() !== 'web' ? registerPlugin<CarPlayPlugin>('CarPlay') : null;

/** Shows the navigation on the car's screen (and keeps it current). */
export function carUpdate(payload: CarPayload): void {
  void plugin?.update(payload).catch(() => undefined);
}

/** The trip is over. */
export function carEnd(): void {
  void plugin?.end().catch(() => undefined);
}

/** A banner on the car's screen. */
export function carAlert(title: string, subtitle: string): void {
  void plugin?.alert({ title, subtitle }).catch(() => undefined);
}

/** Is a car connected right now? (Always false off the iPhone.) */
export async function carConnected(): Promise<boolean> {
  try { return (await plugin?.status())?.connected === true; } catch { return false; }
}

/** The person ended the trip on the car's own screen. */
export function onCarEndRequested(callback: () => void): () => void {
  let handle: { remove: () => void } | null = null;
  let gone = false;
  void plugin?.addListener('endRequested', callback).then((h) => { if (gone) h.remove(); else handle = h; }).catch(() => undefined);
  return () => { gone = true; handle?.remove(); };
}
