// Signing in with the phone's Face ID (or Touch ID, or the fingerprint or face unlock on Android). The app never sees anyone's face and cannot tell who a face
// belongs to: the phone only says "the person holding me passed". So a sign-in is saved in the phone's secure storage, locked behind that check, after a normal
// sign-in the person agreed to; next time the check unlocks it. Only accounts that were signed in on this phone with this switched on can be offered.

import { AccessControl, BiometricAuthError, BiometryType, NativeBiometric } from '@capgo/capacitor-native-biometric';
import { isNative } from './native';

const LIST = 'wastelandmaps:faceid:accounts';
const serverFor = (email: string): string => `wastelandmaps.com/${email.trim().toLowerCase()}`;

/** What to call the check on this phone ("FACE ID", "TOUCH ID"), or null when the phone has none set up (or this is a browser). */
export async function faceIdName(): Promise<string | null> {
  if (!isNative()) return null;
  try {
    const r = await NativeBiometric.isAvailable({ useFallback: false });
    if (!r.isAvailable) return null;
    return r.biometryType === BiometryType.FACE_ID ? 'FACE ID' : r.biometryType === BiometryType.TOUCH_ID ? 'TOUCH ID' : 'BIOMETRICS';
  } catch {
    return null;
  }
}

/** The emails that have a sign-in saved behind the phone's check (the list itself is not secret; the passwords are in the phone's secure storage). */
export function savedFaceIds(): string[] {
  try {
    const list = JSON.parse(localStorage.getItem(LIST) ?? '[]') as unknown;
    return Array.isArray(list) ? list.filter((e): e is string => typeof e === 'string') : [];
  } catch {
    return [];
  }
}
const remember = (emails: string[]) => { try { localStorage.setItem(LIST, JSON.stringify([...new Set(emails)])); } catch { /* not remembered */ } };

/** Saves a sign-in behind the phone's check. True if it was saved. */
export async function saveFaceId(email: string, password: string): Promise<boolean> {
  try {
    await NativeBiometric.setCredentials({ username: email.trim().toLowerCase(), password, server: serverFor(email), accessControl: AccessControl.BIOMETRY_ANY });
    remember([...savedFaceIds(), email.trim().toLowerCase()]);
    return true;
  } catch {
    return false;
  }
}

/** Asks the phone to check the person and gives back what was saved: 'cancelled' if they backed out or it did not match, null if nothing usable is saved. */
export async function readFaceId(email: string): Promise<{ email: string; password: string } | 'cancelled' | null> {
  try {
    const c = await NativeBiometric.getSecureCredentials({ server: serverFor(email), reason: 'Sign in to WastelandMaps', title: 'Sign in to WastelandMaps' });
    return { email: c.username, password: c.password };
  } catch (e) {
    const code = Number((e as { code?: string | number }).code);
    if (code === BiometricAuthError.NO_PROTECTED_CREDENTIALS_FOUND) { remember(savedFaceIds().filter((x) => x !== email.trim().toLowerCase())); return null; }
    return 'cancelled';
  }
}

/** Forgets the saved sign-in of one email, or of every email on this phone. */
export async function forgetFaceId(email?: string): Promise<void> {
  const targets = email ? [email.trim().toLowerCase()] : savedFaceIds();
  for (const e of targets) {
    try { await NativeBiometric.deleteCredentials({ server: serverFor(e) }); } catch { /* it was already gone */ }
  }
  remember(savedFaceIds().filter((x) => !targets.includes(x)));
}

// ---- offering it after a sign-in ----

const OFFER = 'wastelandmaps:faceid-offer';
/** Called after a sign-in with a password worked: if the phone can do it, the app asks whether to use it next time. */
export function offerFaceId(email: string, password: string): void {
  if (isNative()) window.dispatchEvent(new CustomEvent(OFFER, { detail: { email, password } }));
}
export function onFaceIdOffer(callback: (offer: { email: string; password: string }) => void): () => void {
  const handler = (e: Event) => callback((e as CustomEvent<{ email: string; password: string }>).detail);
  window.addEventListener(OFFER, handler);
  return () => window.removeEventListener(OFFER, handler);
}
