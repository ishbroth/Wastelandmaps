// Touch feedback, so the game answers back the way a console does: a tap for choosing, a rising rumble when you set out, a thump when you arrive, a
// pulse for XP, and in the shooting gallery a kick for every gun, a jolt when you are hit. In the app it is the phone's haptic engine; in a browser it
// is the vibration motor where there is one (Android browsers; iPhones in a browser have none). It can be switched off (Share tab).

import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { isNative } from './native';

export type Buzz =
  | 'tick' | 'select' | 'error' | 'travel' | 'arrive' | 'discover' | 'xp' | 'levelup'
  | 'pistol' | 'automatic' | 'sniper' | 'explosive' | 'flame' | 'boom' | 'hit' | 'kill' | 'hurt' | 'wave' | 'victory' | 'defeat';

const KEY = 'wastelandmaps:haptics';
let on = true;
try { on = localStorage.getItem(KEY) !== '0'; } catch { /* storage unavailable: on */ }

export const hapticsAvailable = (): boolean => isNative() || (typeof navigator !== 'undefined' && 'vibrate' in navigator);
export const hapticsEnabled = (): boolean => on;
export function setHaptics(enabled: boolean): void {
  on = enabled;
  try { localStorage.setItem(KEY, enabled ? '1' : '0'); } catch { /* not remembered */ }
  if (enabled) buzz('select');
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const impact = (style: ImpactStyle) => { void Haptics.impact({ style }).catch(() => {}); };
const notify = (type: NotificationType) => { void Haptics.notification({ type }).catch(() => {}); };

/** A short run of impacts, each after a pause: [style, wait before the next]. */
async function sequence(steps: [ImpactStyle, number][]) {
  for (const [style, gap] of steps) {
    impact(style);
    if (gap) await wait(gap);
  }
}

// automatic weapons fire many times a second: do not queue a buzz for every one
let lastRapid = 0;
const rapid = (minGap: number): boolean => {
  const now = performance.now();
  if (now - lastRapid < minGap) return false;
  lastRapid = now;
  return true;
};

/** Web patterns (milliseconds on, off, on...). */
const WEB: Record<Buzz, number | number[]> = {
  tick: 8, select: 14, error: [40, 40, 40], travel: [20, 30, 30, 30, 50], arrive: [30, 40, 70], discover: [18, 30, 24], xp: [10, 20, 10, 20, 14], levelup: [30, 40, 30, 40, 90],
  pistol: 22, automatic: 12, sniper: 55, explosive: 70, flame: 8, boom: 90, hit: 10, kill: 24, hurt: [70, 30, 40], wave: 25, victory: [40, 50, 40, 50, 120], defeat: [150, 60, 150],
};

export function buzz(kind: Buzz): void {
  if (!on) return;
  if (!isNative()) {
    try { navigator.vibrate?.(WEB[kind]); } catch { /* not allowed */ }
    return;
  }
  switch (kind) {
    case 'tick': return impact(ImpactStyle.Light);
    case 'select': return impact(ImpactStyle.Medium);
    case 'error': return notify(NotificationType.Error);
    case 'travel': return void sequence([[ImpactStyle.Light, 70], [ImpactStyle.Medium, 70], [ImpactStyle.Heavy, 0]]); // a rising rumble
    case 'arrive': return void sequence([[ImpactStyle.Heavy, 120], [ImpactStyle.Light, 0]]);
    case 'discover': return notify(NotificationType.Success);
    case 'xp': return void sequence([[ImpactStyle.Light, 60], [ImpactStyle.Light, 60], [ImpactStyle.Medium, 0]]);
    case 'levelup': return void sequence([[ImpactStyle.Medium, 90], [ImpactStyle.Medium, 90], [ImpactStyle.Heavy, 140], [ImpactStyle.Heavy, 0]]);
    case 'pistol': return impact(ImpactStyle.Medium);
    case 'automatic': if (rapid(80)) impact(ImpactStyle.Light); return;
    case 'sniper': return impact(ImpactStyle.Heavy);
    case 'explosive': return void sequence([[ImpactStyle.Heavy, 90], [ImpactStyle.Medium, 0]]);
    case 'flame': if (rapid(110)) impact(ImpactStyle.Light); return;
    case 'boom': return impact(ImpactStyle.Heavy);
    case 'hit': return impact(ImpactStyle.Light);
    case 'kill': return impact(ImpactStyle.Medium);
    case 'hurt': return void sequence([[ImpactStyle.Heavy, 60], [ImpactStyle.Medium, 0]]);
    case 'wave': return impact(ImpactStyle.Medium);
    case 'victory': return notify(NotificationType.Success);
    case 'defeat': return notify(NotificationType.Warning);
  }
}
