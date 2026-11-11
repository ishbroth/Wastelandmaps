// The navigation's voice, set low and slow so it sounds like one of the wasteland's old machines (a Protectron, a sentry bot, a butler like Codsworth). It can be
// switched off, and the choice is remembered.
//
// In the app it is the phone's native speech (Capacitor text-to-speech): it plays through whatever the phone is connected to (a car's Bluetooth or CarPlay audio, headphones),
// lowers music or podcasts while it speaks, and keeps going with the screen locked (the iOS "audio" background mode is on). On the website it is the browser's own speech.

import { TextToSpeech, QueueStrategy } from '@capacitor-community/text-to-speech';
import { isNative } from './native';

const KEY = 'wastelandmaps:voice';

export const voiceAvailable = (): boolean => isNative() || (typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined');

export function voiceEnabled(): boolean {
  if (!voiceAvailable()) return false;
  try { return localStorage.getItem(KEY) !== 'off'; } catch { return true; }
}

export function setVoiceEnabled(on: boolean): void {
  try { localStorage.setItem(KEY, on ? 'on' : 'off'); } catch { /* fine */ }
  if (!on) stopSpeaking();
}

/** A deep, flat voice in the browser: a British male one if the device has it (a butler's), otherwise any English one. */
function pickVoice(): SpeechSynthesisVoice | undefined {
  const voices = window.speechSynthesis.getVoices().filter((v) => /^en/i.test(v.lang));
  const male = (v: SpeechSynthesisVoice) => /daniel|james|arthur|male|george|oliver|alex|fred|google uk english male/i.test(v.name);
  return voices.find((v) => /en-GB/i.test(v.lang) && male(v)) ?? voices.find(male) ?? voices.find((v) => /en-GB/i.test(v.lang)) ?? voices[0];
}

export function stopSpeaking(): void {
  if (isNative()) { void TextToSpeech.stop().catch(() => undefined); return; }
  if (voiceAvailable()) window.speechSynthesis.cancel();
}

interface NativeVoice { index?: number; lang: string; pitch: number; rate: number; name: string }
let nativeChoice: Promise<NativeVoice> | null = null;

/**
 * The phone's voice for the navigation, found once. A British butler robot (Codsworth) if the phone has a British male voice: the best one it has, with "Premium" and
 * "Enhanced" ones (which can be downloaded in Settings, Accessibility, Spoken Content, Voices) ahead of the plain ones, and a little lower and slower than a person so it
 * sounds built rather than born. With no British voice, the machine goes evil instead: one of the phone's robot or deep novelty voices, or failing those a low, slow
 * English one. (An app can only use the voices the phone has installed; it cannot add its own.)
 */
function chooseNativeVoice(): Promise<NativeVoice> {
  nativeChoice ??= (async (): Promise<NativeVoice> => {
    const butler = { pitch: 0.82, rate: 0.85 };
    const evil = { pitch: 0.5, rate: 0.76 };
    try {
      const { voices } = await TextToSpeech.getSupportedVoices();
      const named = voices.map((v, index) => ({ v, index, name: v.name ?? '' }));
      const quality = (n: string) => (/premium/i.test(n) ? 8 : /enhanced/i.test(n) ? 5 : 0);
      const british = named
        .filter(({ v }) => /^en[-_]GB/i.test(v.lang ?? ''))
        .map((x) => ({ ...x, score: (/\b(arthur|daniel|oliver|malcolm|gordon|thomas|james|george)\b/i.test(x.name) ? 20 : /\b(kate|serena|martha|stephanie|fiona|moira|susan)\b/i.test(x.name) ? 0 : 6) + (/arthur/i.test(x.name) ? 6 : /daniel/i.test(x.name) ? 4 : 0) + quality(x.name) }))
        .sort((p, q) => q.score - p.score)[0];
      if (british && british.score >= 6) return { index: british.index, lang: british.v.lang, name: british.name, ...butler };
      const robot = named.find(({ name }) => /zarvox|trinoids|bad news|albert|fred|ralph|junior/i.test(name));
      if (robot) return { index: robot.index, lang: robot.v.lang || 'en-US', name: robot.name, ...evil };
      if (british) return { index: british.index, lang: british.v.lang, name: british.name, ...butler };
      const deep = named.find(({ v, name }) => /^en/i.test(v.lang ?? '') && /\b(alex|aaron|reed|rocko|evan|nathan|tom)\b/i.test(name));
      if (deep) return { index: deep.index, lang: deep.v.lang, name: deep.name, ...evil };
    } catch { /* the phone would not list its voices: ask for British English by language */ }
    return { lang: 'en-GB', name: 'default', ...butler };
  })();
  return nativeChoice;
}

/** Says it, in the machine's voice, over whatever it was saying. */
export function speak(text: string): void {
  if (!voiceEnabled() || !text) return;
  if (isNative()) {
    // 'playback' so it is heard with the screen locked, over the car's speakers, with other audio lowered meanwhile
    void chooseNativeVoice().then((c) => TextToSpeech.speak({ text, lang: c.lang, ...(c.index !== undefined ? { voice: c.index } : {}), rate: c.rate, pitch: c.pitch, volume: 1, category: 'playback', queueStrategy: QueueStrategy.Flush }))
      .catch(() => {
        // that voice would not speak: any English one will do
        void TextToSpeech.speak({ text, lang: 'en-US', rate: 0.84, pitch: 0.5, volume: 1, category: 'playback', queueStrategy: QueueStrategy.Flush }).catch(() => undefined);
      });
    return;
  }
  const synth = window.speechSynthesis;
  synth.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.pitch = 0.35;
  u.rate = 0.8;
  u.volume = 1;
  const voice = pickVoice();
  if (voice) { u.voice = voice; u.lang = voice.lang; } else u.lang = 'en-GB';
  synth.speak(u);
}

/** A distance as it is said aloud: "400 feet", "1.5 miles". */
export function spokenDistance(meters: number): string {
  if (meters < 250) return `${Math.max(50, Math.round((meters * 3.281) / 50) * 50)} feet`;
  const mi = meters / 1609.34;
  if (mi < 0.2) return '1000 feet';
  const n = mi < 10 ? Math.round(mi * 10) / 10 : Math.round(mi);
  return `${n} ${n === 1 ? 'mile' : 'miles'}`;
}
