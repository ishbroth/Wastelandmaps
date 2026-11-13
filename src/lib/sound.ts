// Tiny terminal sounds made with the browser's audio. Off on the website until the player turns it on (browsers block sound before a click anyway);
// on in the app. Besides the beeps there are short phrases for the moments of the game: setting out, arriving, finding a place, gaining XP, levelling up.

let ctx: AudioContext | null = null;

export type BeepKind = 'tick' | 'select' | 'error' | 'travel' | 'arrive' | 'discover' | 'xp' | 'levelup';

/** One note: a frequency (optionally sliding to another), when it starts, how long it lasts, and how loud. */
interface Note { f: number; to?: number; at: number; len: number; vol?: number; type?: OscillatorType }

const PHRASES: Record<BeepKind, Note[]> = {
  tick: [{ f: 620, at: 0, len: 0.08 }],
  select: [{ f: 880, to: 1320, at: 0, len: 0.08 }],
  error: [{ f: 140, at: 0, len: 0.22 }],
  // setting out: an engine-like sweep rising, then a confirming blip
  travel: [{ f: 180, to: 520, at: 0, len: 0.32, type: 'sawtooth', vol: 0.045 }, { f: 880, at: 0.34, len: 0.08 }, { f: 1175, at: 0.44, len: 0.1 }],
  // arriving: two settling tones and a bright one
  arrive: [{ f: 523, at: 0, len: 0.12 }, { f: 659, at: 0.12, len: 0.12 }, { f: 988, at: 0.24, len: 0.26, vol: 0.06 }],
  // a place found: a quick rising pair
  discover: [{ f: 740, at: 0, len: 0.07 }, { f: 1245, at: 0.08, len: 0.14, vol: 0.06 }],
  // XP gained: little pips climbing
  xp: [{ f: 660, at: 0, len: 0.05 }, { f: 880, at: 0.06, len: 0.05 }, { f: 1100, at: 0.12, len: 0.05 }, { f: 1320, at: 0.18, len: 0.1, vol: 0.06 }],
  // a level: a short fanfare
  levelup: [{ f: 523, at: 0, len: 0.12 }, { f: 659, at: 0.13, len: 0.12 }, { f: 784, at: 0.26, len: 0.12 }, { f: 1047, at: 0.39, len: 0.34, vol: 0.07 }],
};

/** Browsers and phones only let sound start after a touch: the first touch anywhere wakes the audio, so a sound made later with no touch of its own (the sign-in that Face ID finishes) is heard. */
function unlockAudio(): void {
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
  } catch { /* no audio available */ }
}
if (typeof window !== 'undefined') for (const ev of ['pointerdown', 'touchstart', 'keydown']) window.addEventListener(ev, unlockAudio, { once: true, capture: true });

export function beep(kind: BeepKind = 'tick'): void {
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    const start = ctx.currentTime;
    for (const n of PHRASES[kind]) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = n.type ?? 'square';
      const t0 = start + n.at;
      osc.frequency.setValueAtTime(n.f, t0);
      if (n.to) osc.frequency.exponentialRampToValueAtTime(n.to, t0 + n.len);
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(n.vol ?? 0.05, t0 + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + n.len);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + n.len + 0.05);
    }
  } catch {
    // no audio available: stay silent
  }
}
