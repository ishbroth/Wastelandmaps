// The shooting gallery's sounds, made on the spot (no files): shots, blasts, hits and the thump of being hurt.

let ctx: AudioContext | null = null;

function context(): AudioContext | null {
  if (typeof AudioContext === 'undefined') return null;
  ctx ??= new AudioContext();
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

/** A burst of noise with a falling volume: the body of every gun sound. */
function burst(c: AudioContext, seconds: number, volume: number, lowpass: number, pitchDrop = 0) {
  const length = Math.floor(c.sampleRate * seconds);
  const buffer = c.createBuffer(1, length, c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 2.2);
  const src = c.createBufferSource();
  src.buffer = buffer;
  const filter = c.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(lowpass, c.currentTime);
  if (pitchDrop) filter.frequency.exponentialRampToValueAtTime(Math.max(80, lowpass * pitchDrop), c.currentTime + seconds);
  const gain = c.createGain();
  gain.gain.value = volume;
  src.connect(filter).connect(gain).connect(c.destination);
  src.start();
}

export type SoundKind = 'pistol' | 'automatic' | 'sniper' | 'explosive' | 'flame' | 'boom' | 'hurt' | 'kill' | 'empty';

export function playSound(kind: SoundKind, on: boolean) {
  if (!on) return;
  const c = context();
  if (!c) return;
  switch (kind) {
    case 'pistol': return burst(c, 0.16, 0.5, 5200, 0.2);
    case 'automatic': return burst(c, 0.09, 0.4, 6500, 0.3);
    case 'sniper': return burst(c, 0.45, 0.7, 3600, 0.08);
    case 'explosive': return burst(c, 0.5, 0.6, 1800, 0.15);
    case 'flame': return burst(c, 0.12, 0.25, 2400);
    case 'boom': return burst(c, 0.9, 0.9, 900, 0.1);
    case 'hurt': return burst(c, 0.25, 0.6, 500, 0.3);
    case 'kill': return burst(c, 0.14, 0.25, 1200, 0.4);
    case 'empty': return burst(c, 0.04, 0.2, 9000);
  }
}
