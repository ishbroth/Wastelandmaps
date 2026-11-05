// Everything that differs between the website and the app (Capacitor: iOS and Android): opening links, saving and sharing pictures, coming back from a
// browser or from the background, the status bar and the splash screen. Each function does the web thing in a browser and the native thing in the app.

import { App } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar, Style } from '@capacitor/status-bar';

export const isNative = (): boolean => Capacitor.isNativePlatform();
export const platform = (): 'ios' | 'android' | 'web' => Capacitor.getPlatform() as 'ios' | 'android' | 'web';

/**
 * Can credits be bought here? On the website, yes (Stripe). Apple and Google require their own in-app purchase for digital goods like these credits, so
 * until that is added the apps do not offer the purchase (credits bought on the website still work in the app after signing in).
 */
export const purchasesAvailable = (): boolean => !isNative() || platform() === 'ios';

/** The address the app's own pages are served from in the app (the website's address on the web). */
export const appOrigin = (): string => window.location.origin;

/** The custom address Supabase's sign-in email link opens the app with. Add it to the project's allowed redirect URLs. */
export const APP_SCHEME = 'com.wastelandmaps.app';
export const NATIVE_AUTH_REDIRECT = `${APP_SCHEME}://auth`;

/** Opens a link in the browser (a sheet over the app, on a phone). False if the browser blocked it. */
export async function openExternal(url: string): Promise<boolean> {
  if (isNative()) {
    try {
      await Browser.open({ url });
      return true;
    } catch {
      return false;
    }
  }
  return !!window.open(url, '_blank', 'noopener');
}

/** Sends the whole window to a link (a checkout, for instance): a browser sheet in the app, since leaving would lose the app. */
export async function goTo(url: string): Promise<void> {
  if (isNative()) await Browser.open({ url });
  else window.location.href = url;
}

const toBase64 = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });

/**
 * Gets a picture or video to the person: a download in a browser; in the app, the system share sheet (where Save Image / Save to Files / Messages are).
 * `share` only changes the wording; both open the sheet in the app.
 */
export async function saveBlob(blob: Blob, filename: string, title: string): Promise<void> {
  if (isNative()) {
    const written = await Filesystem.writeFile({ path: filename, data: await toBase64(blob), directory: Directory.Cache });
    await Share.share({ title, files: [written.uri], dialogTitle: title });
    return;
  }
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(link.href), 10_000);
}

/** Calls back when the app returns to the front (from the browser after a purchase, or from the home screen). Returns the way to stop listening. */
export function onResume(callback: () => void): () => void {
  if (isNative()) {
    const handle = App.addListener('appStateChange', (state) => { if (state.isActive) callback(); });
    return () => { void handle.then((h) => h.remove()); };
  }
  const visible = () => { if (!document.hidden) callback(); };
  document.addEventListener('visibilitychange', visible);
  return () => document.removeEventListener('visibilitychange', visible);
}

/** A link that opened the app (the sign-in email, or a shared place). Returns the way to stop listening. */
export function onAppUrl(callback: (url: string) => void): () => void {
  if (!isNative()) return () => {};
  const handle = App.addListener('appUrlOpen', (event) => callback(event.url));
  return () => { void handle.then((h) => h.remove()); };
}

/** How long the stand-by splash screen stays up at the least. */
const SPLASH_MS = 2000;

/** The app's first moments: a dark status bar that matches the map, and the splash screen goes away once the page is up. */
export async function startNative(): Promise<void> {
  if (!isNative()) return;
  try {
    await StatusBar.setStyle({ style: Style.Dark });
    if (platform() === 'android') await StatusBar.setBackgroundColor({ color: '#000a04' });
  } catch { /* a status bar this device cannot change */ }
  // the stand-by screen plays for two seconds from the moment the app starts, however fast the page was
  const shown = typeof performance !== 'undefined' ? performance.now() : 0;
  if (shown < SPLASH_MS) await new Promise((r) => window.setTimeout(r, SPLASH_MS - shown));
  try { await SplashScreen.hide({ fadeOutDuration: 250 }); } catch { /* already hidden */ }
}
