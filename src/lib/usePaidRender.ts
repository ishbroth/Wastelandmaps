// The paid game-style render of one place: unlocking it (one credit), waiting while it is made, and showing it again later for free.

import { useCallback, useEffect, useRef, useState } from 'react';
import { isNative, saveBlob } from './native';
import { unlockRender, type Account, type Unlocked } from './account';

export type PaidState =
  | { kind: 'idle' }
  | { kind: 'working' }
  | { kind: 'ready'; render: Unlocked }
  | { kind: 'error'; message: string };

const MESSAGES: Record<string, string> = {
  no_credits: 'You do not have enough credits.',
  no_streetview: 'There is no Street View picture of this address to make a snapshot from. Nothing was charged.',
  unknown_place: 'That place could not be found. Nothing was charged.',
  no_photo: 'There is no free photo of this place to render from. Nothing was charged.',
  busy: 'Rendering is paused for today. Nothing was charged; try again tomorrow.',
  failed: 'The render did not come out. Your credit was returned. Try again.',
  sign_in: 'Sign in to unlock renders.',
  server: 'Something went wrong. If a credit was taken it was returned. Try again in a moment.',
};
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function usePaidRender(spotId: string, name: string, account: Account, enabled: boolean, extra?: { kind?: string; metroId?: string | null; home?: boolean }, alsoOwned = false) {
  const [state, setState] = useState<PaidState>({ kind: 'idle' });
  const alive = useRef(true);
  const running = useRef(false);
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);

  // a different place: start over
  useEffect(() => {
    setState({ kind: 'idle' });
    running.current = false;
  }, [spotId]);

  const run = useCallback(async () => {
    if (running.current) return;
    running.current = true;
    setState({ kind: 'working' });
    for (let attempt = 0; attempt < 30 && alive.current; attempt++) {
      const result = await unlockRender(spotId, name, extra);
      if (!alive.current) break;
      if (result.kind === 'ready') {
        setState({ kind: 'ready', render: result.render });
        running.current = false;
        void account.refresh();
        return;
      }
      if (result.kind === 'error') {
        setState({ kind: 'error', message: MESSAGES[result.reason] ?? MESSAGES.server });
        running.current = false;
        void account.refresh();
        return;
      }
      await sleep(4000); // still being made: asking again is free
    }
    if (alive.current) setState({ kind: 'error', message: 'This one is taking a long time. Open it again in a minute; you will not be charged twice.' });
    running.current = false;
  }, [spotId, name, account, extra?.kind, extra?.metroId, extra?.home]);

  // already unlocked: show it without being asked (and without charge)
  const owned = account.unlocked.has(spotId) || alsoOwned;
  useEffect(() => {
    if (enabled && account.session && owned && state.kind === 'idle') void run();
  }, [enabled, account.session, owned, state.kind, run]);

  return { state, run };
}

/** Saves an image to the device (a download on the web; the share sheet in the app, where it can be saved or sent). */
export async function downloadImage(url: string, filename: string): Promise<void> {
  const blob = await (await fetch(url)).blob();
  await saveBlob(blob, filename, filename.replace(/\.[a-z0-9]+$/i, ''));
}

/** The phone's share sheet with the picture itself, where the browser can; otherwise it just saves the picture. */
export async function shareImage(url: string, filename: string, title: string): Promise<void> {
  try {
    const blob = await (await fetch(url)).blob();
    if (isNative()) {
      await saveBlob(blob, filename, title);
      return;
    }
    const file = new File([blob], filename, { type: blob.type || 'image/png' });
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title, text: `${title}, after the bombs. wastelandmaps.com` });
      return;
    }
  } catch { /* cancelled or not possible: fall back to saving */ }
  await downloadImage(url, filename);
}
