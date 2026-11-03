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
    hit = c
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
  if (speakers) gain.connect(c.destination);
  if (record) gain.connect(record);
  src.start(c.currentTime + Math.max(0, at));
}

/** A place to send audio so it ends up in a recorded video. */
export function recordingSink(): MediaStreamAudioDestinationNode | null {
  return context()?.createMediaStreamDestination() ?? null;
}

// ---- the blast that reveals a rendered picture: four different ones, taking turns. The burst of light is 1.94 seconds in (see BlowApart), so each starts to land there.

const BLAST_FILES = ['blast-distant', 'blast-big', 'blast-charge', 'blast-crack'];
const BURST = 1.94;

export const blastFiles = (): string[] => BLAST_FILES;

/** Which blast plays next: it goes round, starting somewhere different for each picture. */
export function nextBlast(seed: number): number {
  let n = 0;
  try {
    n = Number(localStorage.getItem('wastelandmaps:blast') ?? '0') || 0;
    localStorage.setItem('wastelandmaps:blast', String(n + 1));
  } catch { /* storage unavailable: no rotation */ }
  return (n + (seed % 4)) % 4;
}

export function playBlast(variant: number, options: Pick<PlayOptions, 'record' | 'speakers'> = {}): void {
  switch (variant % 4) {
    case 0: // a deep, muffled boom that rolls on
      void playSfx('blast-distant', { at: BURST - 0.05, volume: 1, ...options });
      break;
    case 1: // a hard blast with a rolling echo behind it
      void playSfx('blast-big', { at: BURST - 0.04, volume: 0.95, ...options });
      void playSfx('blast-distant', { at: BURST + 0.7, volume: 0.35, rate: 0.9, ...options });
      break;
    case 2: // a charge counting down (its own beeps) and then the blast: the sound's boom is 1.86 seconds in
      void playSfx('blast-charge', { at: BURST - 1.86, volume: 0.95, ...options });
      break;
    default: // a sharp crack with thunder after it
      void playSfx('blast-crack', { at: BURST - 0.02, volume: 1, ...options });
      void playSfx('blast-distant', { at: BURST + 0.25, volume: 0.6, ...options });
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
