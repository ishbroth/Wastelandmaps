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

/** Says it, in the machine's voice, over whatever it was saying. */
export function speak(text: string): void {
  if (!voiceEnabled() || !text) return;
  if (isNative()) {
    // 'playback' so it is heard with the screen locked, over the car's speakers, with other audio lowered meanwhile
    void TextToSpeech.speak({ text, lang: 'en-GB', rate: 0.9, pitch: 0.5, volume: 1, category: 'playback', queueStrategy: QueueStrategy.Flush }).catch(() => {
      // no British voice on this phone: any English one will do
      void TextToSpeech.speak({ text, lang: 'en-US', rate: 0.9, pitch: 0.5, volume: 1, category: 'playback', queueStrategy: QueueStrategy.Flush }).catch(() => undefined);
    });
    return;
  }
  const synth = window.speechSynthesis;
  synth.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.pitch = 0.35;
  u.rate = 0.88;
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
