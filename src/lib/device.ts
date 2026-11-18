// An id for this phone that survives deleting and reinstalling the app, so the welcome gift (500 caps) cannot be collected again by reinstalling. On an iPhone it is a random id kept in the
// keychain (which the system does not erase when an app is deleted); on Android it is the system's own id for the device. The server keeps only a hash of it. Null in a browser.

import { Capacitor } from '@capacitor/core';
import { Device } from '@capacitor/device';
import { NativeBiometric } from '@capgo/capacitor-native-biometric';

const SERVER = 'wastelandmaps.com/device-id';

export async function deviceId(): Promise<string | null> {
  if (!Capacitor.isNativePlatform()) return null;
  try {
    if (Capacitor.getPlatform() === 'ios') {
      try {
        const saved = await NativeBiometric.getCredentials({ server: SERVER });
        if (saved.password && /^[A-Za-z0-9-]{16,80}$/.test(saved.password)) return saved.password;
      } catch { /* none saved yet */ }
      const fresh = crypto.randomUUID();
      await NativeBiometric.setCredentials({ username: 'device', password: fresh, server: SERVER });
      return fresh;
    }
    const { identifier } = await Device.getId();
    return identifier ? `android-${identifier}` : null;
  } catch {
    return null;
  }
}
