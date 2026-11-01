// The navigation's voice: the device's own speech, set low and slow so it sounds like one of the wasteland's old machines (a Protectron, a sentry bot, a
// butler like Codsworth). It can be switched off, and the choice is remembered.

const KEY = 'wastelandmaps:voice';

export const voiceAvailable = (): boolean => typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';

export function voiceEnabled(): boolean {
  if (!voiceAvailable()) return false;
  try { return localStorage.getItem(KEY) !== 'off'; } catch { return true; }
}

export function setVoiceEnabled(on: boolean): void {
  try { localStorage.setItem(KEY, on ? 'on' : 'off'); } catch { /* fine */ }
  if (!on) stopSpeaking();
}

/** A deep, flat voice: a British male one if the device has it (a butler's), otherwise any English one. */
function pickVoice(): SpeechSynthesisVoice | undefined {
  const voices = window.speechSynthesis.getVoices().filter((v) => /^en/i.test(v.lang));
  const male = (v: SpeechSynthesisVoice) => /daniel|james|arthur|male|george|oliver|alex|fred|google uk english male/i.test(v.name);
  return voices.find((v) => /en-GB/i.test(v.lang) && male(v)) ?? voices.find(male) ?? voices.find((v) => /en-GB/i.test(v.lang)) ?? voices[0];
}

export function stopSpeaking(): void {
  if (voiceAvailable()) window.speechSynthesis.cancel();
}

/** Says it, in the machine's voice, over whatever it was saying. */
export function speak(text: string): void {
  if (!voiceEnabled() || !text) return;
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
