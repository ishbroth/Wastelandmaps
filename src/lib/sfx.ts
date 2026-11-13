// Recorded sound effects (public/sfx, all CC0 from OpenGameArt: see public/sfx/CREDITS.txt): the blasts that tear the photograph apart, and the creatures of the
// shooting gallery. Played through the Web Audio API so they can be started on a timeline, pitched down for the bosses, and also fed into a recording of the blast.

let ctx: AudioContext | null = null;
const buffers = new Map<string, Promise<AudioBuffer | null>>();

function context(): AudioContext | null {
  if (typeof AudioContext === 'undefined') return null;
  ctx ??= new AudioContext();
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

function load(name: string): Promise<AudioBuffer | null> {
  let hit = buffers.get(name);
  if (!hit) {
    const c = context();
    hit = name.startsWith('blast-synth-')
      ? renderBlastSynth(Number(name.slice(12)))
      : c
      ? fetch(`${import.meta.env.BASE_URL}sfx/${name}.mp3`).then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status))))).then((data) => c.decodeAudioData(data)).catch(() => null)
      : Promise.resolve(null);
    buffers.set(name, hit);
  }
  return hit;
}

/** Fetches and decodes sounds ahead of time, so they start the instant they are asked for. */
export function preloadSfx(names: string[]): void {
  for (const n of names) void load(n);
}

let speakersMuted = false;
const outputs = new Set<GainNode>();
/** Silences (or brings back) everything going to the speakers, including what is already playing. A video being recorded keeps its sound. */
export function setSfxMuted(muted: boolean): void {
  speakersMuted = muted;
  outputs.forEach((g) => { g.gain.value = muted ? 0 : 1; });
}

interface PlayOptions {
  /** Seconds from now. */
  at?: number;
  /** 1 = as recorded; below 1 is slower and lower. */
  rate?: number;
  volume?: number;
  /** Also feed this node (a recording), whether or not the speakers are on. */
  record?: AudioNode;
  /** Play through the speakers (false when sound is off but a video is being recorded). */
  speakers?: boolean;
}

export async function playSfx(name: string, { at = 0, rate = 1, volume = 1, record, speakers = true }: PlayOptions = {}): Promise<void> {
  const c = context();
  if (!c) return;
  const buffer = await load(name);
  if (!buffer) return;
  const src = c.createBufferSource();
  src.buffer = buffer;
  src.playbackRate.value = rate;
  const gain = c.createGain();
  gain.gain.value = volume;
  src.connect(gain);
  if (speakers) {
    const out = c.createGain();
    out.gain.value = speakersMuted ? 0 : 1;
    gain.connect(out);
    out.connect(c.destination);
    outputs.add(out);
    src.onended = () => outputs.delete(out);
  }
  if (record) gain.connect(record);
  src.start(c.currentTime + Math.max(0, at));
}

/** A place to send audio so it ends up in a recorded video. */
export function recordingSink(): MediaStreamAudioDestinationNode | null {
  return context()?.createMediaStreamDestination() ?? null;
}

// ---- the blast that reveals a rendered picture: a crack, then a thunderous explosion, then debris coming down (wind, dust and rocks), in four different versions that take turns. The burst
// of light is 1.94 seconds in (see BlowApart). The cracks and the explosions are recordings; the deep boom under them, the rumble, and the rain of falling pieces are
// made here (the pieces by the dozen, at random but always the same random for a version).

const BLAST_FILES = ['blast-crack', 'blast-big', 'blast-distant', 'blast-charge', 'blast-synth-0', 'blast-synth-1', 'blast-synth-2', 'blast-synth-3'];

/** What differs between the four: the seed of the falling pieces, the pitch the boom starts from and falls to, how many pieces fall and how many of them are heavy or ring. */
const SYNTH = [
  { seed: 1945, boom: [110, 26], pieces: 110, heavy: 0.2, clink: 0.1 },
  { seed: 1952, boom: [84, 20], pieces: 90, heavy: 0.34, clink: 0.06 },
  { seed: 1961, boom: [100, 24], pieces: 130, heavy: 0.16, clink: 0.14 },
  { seed: 1954, boom: [124, 30], pieces: 100, heavy: 0.24, clink: 0.2 },
];
const BURST = 1.94;
const SYNTH_RATE = 44100;
const SYNTH_SECONDS = 6.2;

export const blastFiles = (): string[] => BLAST_FILES;

const mulberry = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

/** The made parts of the blast, in one sound that starts with the crack: a sharp transient, the deep boom and its rumble, and the debris falling after it. */
export async function renderBlastSynth(version = 0): Promise<AudioBuffer | null> {
  const v = SYNTH[((version % 4) + 4) % 4];
  const Offline = typeof OfflineAudioContext !== 'undefined' ? OfflineAudioContext : (globalThis as unknown as { webkitOfflineAudioContext?: typeof OfflineAudioContext }).webkitOfflineAudioContext;
  if (!Offline) return null;
  try {
    const c = new Offline(1, Math.ceil(SYNTH_RATE * SYNTH_SECONDS), SYNTH_RATE);
    const rand = mulberry(v.seed);
    const white = c.createBuffer(1, c.length, SYNTH_RATE);
    const brown = c.createBuffer(1, c.length, SYNTH_RATE);
    const w = white.getChannelData(0), br = brown.getChannelData(0);
    let last = 0;
    for (let i = 0; i < c.length; i++) { const x = rand() * 2 - 1; w[i] = x; last = (last + 0.02 * x) / 1.02; br[i] = last * 3.5; }

    // everything is mixed, pushed a little into a soft clip for weight, and kept from clipping
    const sum = c.createGain();
    sum.gain.value = 0.8;
    const clip = c.createWaveShaper();
    const curve = new Float32Array(1024);
    for (let i = 0; i < curve.length; i++) { const x = (i / (curve.length - 1)) * 2 - 1; curve[i] = Math.tanh(x * 1.6); }
    clip.curve = curve;
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 6; comp.attack.value = 0.002; comp.release.value = 0.25;
    sum.connect(clip); clip.connect(comp); comp.connect(c.destination);

    const shape = (g: GainNode, at: number, peak: number, attack: number, decay: number) => {
      g.gain.setValueAtTime(0.0001, at);
      g.gain.linearRampToValueAtTime(peak, at + attack);
      g.gain.exponentialRampToValueAtTime(0.0001, at + attack + decay);
    };
    const noise = (buf: AudioBuffer, at: number, dur: number, filter: BiquadFilterType, freq: number, q: number, peak: number, attack: number, decay: number): BiquadFilterNode => {
      const src = c.createBufferSource();
      src.buffer = buf;
      const f = c.createBiquadFilter();
      f.type = filter; f.frequency.value = freq; f.Q.value = q;
      const g = c.createGain();
      shape(g, at, peak, attack, decay);
      src.connect(f); f.connect(g); g.connect(sum);
      src.start(at, rand() * 0.5, Math.min(dur, SYNTH_SECONDS - at - 0.01));
      return f;
    };
    const tone = (type: OscillatorType, at: number, from: number, to: number, over: number, peak: number, attack: number, decay: number) => {
      const o = c.createOscillator();
      o.type = type;
      o.frequency.setValueAtTime(from, at);
      o.frequency.exponentialRampToValueAtTime(to, at + over);
      const g = c.createGain();
      shape(g, at, peak, attack, decay);
      o.connect(g); g.connect(sum);
      o.start(at); o.stop(Math.min(SYNTH_SECONDS, at + attack + decay + 0.05));
    };

    // the crack: a hard, bright snap
    noise(white, 0, 0.3, 'highpass', 1800, 0.7, 1, 0.0008, 0.14);
    noise(white, 0, 0.5, 'bandpass', 800, 0.7, 0.7, 0.001, 0.3);
    // the explosion: a deep boom that falls away, a rumble that rolls on, and the roar between
    tone('sine', 0.08, v.boom[0], v.boom[1], 1.5, 1.25, 0.012, 3.0);
    tone('triangle', 0.08, v.boom[0] * 0.56, v.boom[1] * 1.15, 1.2, 0.5, 0.02, 2.2);
    const rumble = noise(brown, 0.08, 5.2, 'lowpass', 520, 0.7, 1.7, 0.05, 4.4);
    rumble.frequency.setValueAtTime(520, 0.08);
    rumble.frequency.exponentialRampToValueAtTime(80, 4.6);
    const roar = noise(white, 0.06, 2.2, 'bandpass', 1500, 0.6, 0.6, 0.02, 1.6);
    roar.frequency.setValueAtTime(1500, 0.06);
    roar.frequency.exponentialRampToValueAtTime(240, 1.6);
    // the debris coming down, as wind and dust and rocks (nothing pitched or narrow: that sounds like birds): gusts of wind that swell and die away, a long soft hiss of dust
    // drifting down, then stones and gravel pattering and a few heavy rocks landing, thinning out
    for (let g = 0; g < 4; g++) {
      const at = 0.7 + g * 1.25 + rand() * 0.4;
      const gust = noise(white, at, 3.2, 'bandpass', 380 + rand() * 200, 0.35, 0.34 * (1 - g * 0.17), 0.9, 1.9);
      gust.frequency.setValueAtTime(380 + rand() * 200, at);
      gust.frequency.exponentialRampToValueAtTime(240 + rand() * 120, at + 2.8);
    }
    noise(white, 1.0, 4.8, 'highpass', 2600, 0.4, 0.07, 0.6, 3.8);
    noise(brown, 1.1, 4.6, 'lowpass', 1100, 0.5, 0.4, 0.5, 3.6);
    for (let i = 0; i < v.pieces; i++) {
      const at = 0.9 + 4.4 * Math.pow(rand(), 1.5);
      const fade = 1 - (at - 0.9) / 5.2;
      const kind = rand();
      if (kind < 1 - v.heavy - v.clink) {
        // a small stone or a clod of dirt: a short, soft, wide tick
        noise(white, at, 0.09, 'bandpass', 700 + rand() * 1800, 0.5 + rand() * 0.7, (0.1 + rand() * 0.28) * fade, 0.001, 0.02 + rand() * 0.05);
      } else if (kind < 1 - v.clink) {
        // a heavy rock landing: a dull thud
        tone('sine', at, 150 + rand() * 60, 50, 0.09, (0.4 + rand() * 0.35) * fade, 0.002, 0.1);
        noise(brown, at, 0.1, 'lowpass', 400, 0.7, 0.65 * fade, 0.002, 0.08);
      } else {
        // gravel sliding and settling: a longer, gritty scrape
        noise(white, at, 0.24, 'bandpass', 900 + rand() * 900, 0.6, 0.14 * fade, 0.012, 0.16);
      }
    }
    return await c.startRendering();
  } catch {
    return null;
  }
}

/** Which blast plays next: it goes round, starting somewhere different for each picture. */
export function nextBlast(seed: number): number {
  let n = 0;
  try {
    n = Number(localStorage.getItem('wastelandmaps:blast') ?? '0') || 0;
    localStorage.setItem('wastelandmaps:blast', String(n + 1));
  } catch { /* storage unavailable: no rotation */ }
  return (n + (seed % 4)) % 4;
}

/** Every version is a crack, then the thunderous explosion, then debris coming down (the made sound has the pieces falling from just after the boom). */
export function playBlast(variant: number, options: Pick<PlayOptions, 'record' | 'speakers'> & { /** Seconds until the burst (the picture reveal waits 1.94 s for its light; a blast in a fight goes off at once). */ lead?: number; volume?: number } = {}): void {
  const { lead: leadOpt, volume: volOpt, ...rest } = options;
  const lead = leadOpt ?? BURST, vol = volOpt ?? 1;
  const at = lead - 0.02;
  const synth = `blast-synth-${variant % 4}`;
  switch (variant % 4) {
    case 0: // a sharp crack, the big blast right behind it, thunder rolling off, the pieces coming down
      void playSfx('blast-crack', { at, volume: 1 * vol, ...rest });
      void playSfx(synth, { at, volume: 0.9 * vol, ...rest });
      void playSfx('blast-big', { at: at + 0.12, volume: 1 * vol, ...rest });
      void playSfx('blast-distant', { at: at + 0.9, volume: 0.5 * vol, rate: 0.9, ...rest });
      break;
    case 1: // a higher, harder crack and a much deeper explosion: the thunder first, the blast on top
      void playSfx('blast-crack', { at, volume: 0.85 * vol, rate: 1.15, ...rest });
      void playSfx(synth, { at, volume: 0.95 * vol, ...rest });
      void playSfx('blast-distant', { at: at + 0.1, volume: 1 * vol, rate: 0.8, ...rest });
      void playSfx('blast-big', { at: at + 0.2, volume: 0.8 * vol, rate: 0.9, ...rest });
      break;
    case 2: // a charge counting down (its own beeps) that goes off with a crack, then the blast and the debris
      void playSfx('blast-charge', { at: lead - 1.86, volume: 0.9 * vol, ...rest });
      void playSfx('blast-crack', { at: at + 0.02, volume: 0.9 * vol, ...rest });
      void playSfx(synth, { at, volume: 0.9 * vol, ...rest });
      void playSfx('blast-big', { at: at + 0.16, volume: 1 * vol, ...rest });
      break;
    default: // the crack, a beat of silence, then the explosion with thunder behind it and the debris
      void playSfx('blast-crack', { at, volume: 1 * vol, rate: 0.95, ...rest });
      void playSfx(synth, { at, volume: 0.9 * vol, ...rest });
      void playSfx('blast-big', { at: at + 0.3, volume: 1 * vol, rate: 0.85, ...rest });
      void playSfx('blast-distant', { at: at + 0.8, volume: 0.55 * vol, ...rest });
  }
}

// ---- the creatures: what each makes when it strikes and when it dies. The bigger ones are the low growls; the small ones the high squeals. Bosses use their smaller
// relative's sounds, slower and lower.

interface Voice { strike: string; die: string }
const VOICES: Record<string, Voice> = {
  deathclaw: { strike: 'big-6', die: 'big-8' },
  supermutant: { strike: 'big-1', die: 'big-10' },
  ghoul: { strike: 'big-4', die: 'big-7' },
  mirelurk: { strike: 'big-3', die: 'big-9' },
  radscorpion: { strike: 'small-6', die: 'small-7' },
  radroach: { strike: 'small-8', die: 'small-10' },
  molerat: { strike: 'small-4', die: 'small-3' },
  bloatfly: { strike: 'small-18', die: 'small-16' },
};
const BOSS_OF: Record<string, { like: string; rate: number }> = {
  gangrenousghoul: { like: 'ghoul', rate: 0.75 },
  glowingbloatfly: { like: 'bloatfly', rate: 0.7 },
  mirelurkqueen: { like: 'mirelurk', rate: 0.7 },
  behemoth: { like: 'supermutant', rate: 0.65 },
};

export const enemyFiles = (): string[] => [...new Set(Object.values(VOICES).flatMap((v) => [v.strike, v.die]))];

/** Does this kind of enemy have a recorded voice? (The raiders and robots do not: they keep the shot and the crackle.) */
export const hasVoice = (type: string): boolean => type in VOICES || type in BOSS_OF;

export function playEnemy(type: string, event: 'strike' | 'die', on: boolean): boolean {
  const boss = BOSS_OF[type];
  const voice = VOICES[boss ? boss.like : type];
  if (!voice) return false;
  if (on) void playSfx(event === 'strike' ? voice.strike : voice.die, { rate: boss ? boss.rate : 0.95 + Math.random() * 0.1, volume: boss ? 1 : 0.85 });
  return true;
}
