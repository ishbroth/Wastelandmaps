// Keeps the phone's screen from going to sleep while a route is being followed (a navigation that blanks itself at a junction is no use). In a browser it does nothing.

import { KeepAwake } from '@capacitor-community/keep-awake';
import { isNative } from './native';

export async function keepScreenOn(on: boolean): Promise<void> {
  if (!isNative()) return;
  try {
    if (on) await KeepAwake.keepAwake();
    else await KeepAwake.allowSleep();
  } catch { /* the phone would not say: the screen sleeps as usual */ }
}
