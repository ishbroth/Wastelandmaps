// Tiny terminal beeps made with the browser's audio. Off until the player turns it on (browsers block sound before a click anyway).

let ctx: AudioContext | null = null;

export function beep(kind: 'tick' | 'select' | 'error' = 'tick'): void {
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(kind === 'error' ? 140 : kind === 'select' ? 880 : 620, now);
    if (kind === 'select') osc.frequency.exponentialRampToValueAtTime(1320, now + 0.06);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.05, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + (kind === 'error' ? 0.22 : 0.08));
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.25);
  } catch {
    // no audio available: stay silent
  }
}
