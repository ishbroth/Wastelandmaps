// "Discovered: ..." notices. In the page they appear as a toast (App.tsx). Here is the other half: a system notification, on a phone or desktop,
// for when the page is in the background. It needs the person's permission, asked for when they switch AUTO-DISCOVER on. In the app the system's local
// notifications are used (the browser's Notification API does not exist in an iPhone's web view).

import { LocalNotifications } from '@capacitor/local-notifications';
import { isNative } from './native';

/** Asks for permission (once) and readies the service worker. True if notifications can be shown. */
export async function enableNotifications(): Promise<boolean> {
  if (isNative()) {
    try {
      const current = await LocalNotifications.checkPermissions();
      if (current.display === 'granted') return true;
      return (await LocalNotifications.requestPermissions()).display === 'granted';
    } catch {
      return false;
    }
  }
  if (typeof Notification === 'undefined') return false;
  try {
    if (Notification.permission === 'default') await Notification.requestPermission();
    if (Notification.permission !== 'granted') return false;
    if ('serviceWorker' in navigator) await navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`);
    return true;
  } catch {
    return false;
  }
}

/** A system notification, if allowed and the page is not in front (the toast covers that case). */
export async function pushNotice(title: string, body: string): Promise<void> {
  if (isNative()) {
    if (!document.hidden) return;
    try {
      if ((await LocalNotifications.checkPermissions()).display !== 'granted') return;
      await LocalNotifications.schedule({ notifications: [{ id: Math.floor(Date.now() % 2_000_000_000), title, body }] });
    } catch { /* the toast already told them */ }
    return;
  }
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted' || !document.hidden) return;
  try {
    const registration = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration() : undefined;
    if (registration) await registration.showNotification(title, { body, tag: 'discovery' });
    else new Notification(title, { body });
  } catch { /* the toast already told them */ }
}
