// "Enjoying WastelandMaps? Rate it": only in the store apps (iOS and Android), never on the website. It is asked once after a few minutes of use following the first
// download, then again a week later, and every week after that, until the person taps a star. This phone remembers (not the account): the ask is about the app
// they have installed.

import { InAppReview } from '@capacitor-community/in-app-review';
import { isNative } from './native';

const KEY = 'wastelandmaps:rate:v1';
const WEEK = 7 * 24 * 3600 * 1000;
/** Seconds of use in one go before the ask. */
export const USE_BEFORE_ASK = 180;

interface RateState { lastAsk: number | null; done: boolean }

function read(): RateState {
  try { const v = JSON.parse(localStorage.getItem(KEY) ?? 'null') as RateState | null; if (v && typeof v.done === 'boolean') return v; } catch { /* nothing kept */ }
  return { lastAsk: null, done: false };
}
const write = (s: RateState) => { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* storage full or blocked */ } };

/** Is it time to ask: in the app, not rated yet, and never asked or asked a week ago. */
export function dueToRate(now = Date.now()): boolean {
  if (!isNative()) return false;
  const s = read();
  return !s.done && (s.lastAsk === null || now - s.lastAsk >= WEEK);
}

/** The popup was shown: the week starts now. */
export const markAsked = (now = Date.now()) => write({ ...read(), lastAsk: now });

/** A star was tapped: never ask again, and open the store's own review (the star count is not sent anywhere). */
export async function rated(): Promise<void> {
  write({ ...read(), done: true });
  try { await InAppReview.requestReview(); } catch { /* the store sheet is not available: nothing more to do */ }
}
