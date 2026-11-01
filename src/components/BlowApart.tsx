import ScrollRow from './ScrollRow';
import { useCallback, useEffect, useRef, useState } from 'react';
import { downloadImage, shareImage } from '../lib/usePaidRender';
import { saveBlob } from '../lib/native';

/**
 * The reveal: the real photograph, then a bomb. A flash of white, a mushroom cloud rising over the sky in the photo (when it has open sky), the
 * shock wave arriving as a rush of dust and flying debris at the screen that swallows the picture, a second whiteout, and then, as the white clears,
 * the destroyed render. Drawn on a canvas, so the whole thing can also be recorded and saved as a short video.
 * It plays the first time someone sees a place; after that they get the finished picture, with REPLAY.
 */

const DURATION = 7600; // milliseconds

const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const ease = (x: number) => x * x * (3 - 2 * x);

function load(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('image failed to load'));
    img.src = url;
  });
}

/** A small repeatable random stream, so the same reveal plays the same way each time. */
function stream(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

// After the flash and the mushroom cloud the shock wave arrives as a wall of dust rushing at the viewer from behind the picture (where the cloud stands),
// carrying specks of debris that swell as they come at the glass. The real photograph is lost in the dust and the destroyed picture is there when it thins.
interface Chunk { angle: number; speed: number; size: number; start: number; shade: number; round: boolean; r0: number; spin: number }
interface Puff { angle: number; speed: number; radius: number; start: number; shade: number; r0: number }
interface Giant { dx: number; dy: number; radius: number; start: number }
interface Sky { mask: HTMLCanvasElement | null; hasSky: boolean; cloudX: number; horizon: number }

/** Finds the open sky in the photograph (bright, bluish or grey, near the top), so the mushroom cloud can rise behind the landmark and not in front of it. */
function findSky(before: HTMLImageElement, width: number, height: number): Sky {
  const none: Sky = { mask: null, hasSky: false, cloudX: 0.7, horizon: 0.6 };
  try {
    const w = 120;
    const h = Math.max(20, Math.round((w * height) / width));
    const small = document.createElement('canvas');
    small.width = w;
    small.height = h;
    const sctx = small.getContext('2d', { willReadFrequently: true });
    if (!sctx) return none;
    sctx.drawImage(before, 0, 0, w, h);
    const data = sctx.getImageData(0, 0, w, h);
    const px = data.data;
    const maskSmall = sctx.createImageData(w, h);
    let skyTop = 0;
    let topCount = 0;
    let left = 0;
    let right = 0;
    let lowest = 0; // the lowest row that is still mostly sky: about where the horizon sits
    const rowSky = new Array<number>(h).fill(0);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        const r = px[i], g = px[i + 1], b = px[i + 2];
        const lum = 0.299 * r + 0.587 * g + 0.114 * b;
        const sat = (Math.max(r, g, b) - Math.min(r, g, b)) / (Math.max(r, g, b) || 1);
        const sky = y < h * 0.7 && ((lum > 150 && sat < 0.5) || (b > r + 14 && b >= g - 6 && lum > 105) || lum > 205);
        if (sky) {
          maskSmall.data[i] = maskSmall.data[i + 1] = maskSmall.data[i + 2] = 255;
          maskSmall.data[i + 3] = 255;
          rowSky[y]++;
          if (y < h * 0.4) { skyTop++; if (x < w / 2) left++; else right++; }
        }
        if (y < h * 0.4) topCount++;
      }
    }
    for (let y = 0; y < h * 0.7; y++) if (rowSky[y] > w * 0.45) lowest = y;
    const hasSky = skyTop / topCount > 0.38;
    if (!hasSky) return { ...none, hasSky: false };
    sctx.putImageData(maskSmall, 0, 0);
    const mask = document.createElement('canvas');
    mask.width = width;
    mask.height = height;
    const mctx = mask.getContext('2d');
    if (!mctx) return none;
    mctx.imageSmoothingEnabled = true;
    mctx.drawImage(small, 0, 0, width, height);
    return { mask, hasSky: true, cloudX: left > right ? 0.3 : 0.7, horizon: clamp((lowest + 3) / h, 0.3, 0.7) };
  } catch {
    return none; // the photo may not be read back (no permission to read its pixels): no cloud, the rest still plays
  }
}

function plan(width: number, height: number, seed: number, ox: number, oy: number) {
  const rand = stream(seed);
  const reach = Math.max(Math.hypot(ox, oy), Math.hypot(width - ox, oy), Math.hypot(ox, height - oy), Math.hypot(width - ox, height - oy));
  // specks of debris and grit
  const chunks: Chunk[] = Array.from({ length: 260 }, () => ({
    angle: rand() * Math.PI * 2, speed: 0.45 + rand() * 1.1, size: 1.4 + rand() * 4.2, start: 0.47 + rand() * 0.2, shade: rand(), round: rand() < 0.55,
    r0: rand() * reach * 0.12, spin: (rand() - 0.5) * 8,
  }));
  // the billows of dust
  const puffs: Puff[] = Array.from({ length: 90 }, () => ({
    angle: rand() * Math.PI * 2, speed: 0.3 + rand() * 0.9, radius: reach * (0.06 + rand() * 0.11), start: 0.44 + rand() * 0.12, shade: rand(), r0: rand() * reach * 0.1,
  }));
  // a few huge soft clouds that swell until they fill the screen
  const giants: Giant[] = Array.from({ length: 7 }, () => ({ dx: (rand() - 0.5) * reach * 0.5, dy: (rand() - 0.5) * reach * 0.35, radius: reach * (0.7 + rand() * 0.5), start: 0.46 + rand() * 0.1 }));
  return { chunks, puffs, giants, ox, oy, reach };
}

/** The mushroom cloud: a fireball at the base, a stem, and a billowing cap, grown from nothing and then breaking up in the dust. */
function mushroom(ctx: CanvasRenderingContext2D, t: number, x: number, base: number, w: number, h: number, seed: number) {
  const grow = ease(clamp((t - 0.265) / 0.3));
  if (grow <= 0) return;
  const fade = 1 - ease(clamp((t - 0.62) / 0.14));
  if (fade <= 0) return;
  const rand = stream(seed);
  const size = Math.min(w, h * 1.1);
  const rise = size * 0.62 * grow;
  const capR = size * 0.22 * (0.35 + 0.65 * grow);
  const stemW = size * 0.045 * (0.7 + 0.5 * grow);
  const capY = base - rise;
  ctx.save();
  ctx.globalAlpha = fade;

  // the fireball at the foot
  const fire = ctx.createRadialGradient(x, base, 0, x, base, size * (0.1 + 0.16 * grow));
  fire.addColorStop(0, 'rgba(255,240,190,0.95)');
  fire.addColorStop(0.4, 'rgba(255,150,50,0.7)');
  fire.addColorStop(1, 'rgba(160,50,10,0)');
  ctx.fillStyle = fire;
  ctx.fillRect(x - size, base - size * 0.5, size * 2, size);

  // the stem: a column of overlapping puffs, thicker and darker toward the ground
  const puffs = 22;
  for (let k = 0; k <= puffs; k++) {
    const f = k / puffs;
    const y = base - rise * f;
    const sway = Math.sin(f * 7 + seed) * stemW * 0.35;
    const r = stemW * (1.1 + (1 - f) * 0.9 + rand() * 0.4);
    const g = ctx.createRadialGradient(x + sway, y, 0, x + sway, y, r);
    g.addColorStop(0, f < 0.35 ? 'rgba(255,170,80,0.85)' : 'rgba(150,115,95,0.85)');
    g.addColorStop(1, 'rgba(70,55,48,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x + sway, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // the cap: a ring of billows, orange where it is hot inside and brown-grey at the edge
  const billows = 20;
  for (let k = 0; k < billows; k++) {
    const a = (k / billows) * Math.PI * 2;
    const rr = capR * (0.55 + rand() * 0.3);
    const bx = x + Math.cos(a) * capR * 0.95;
    const by = capY + Math.sin(a) * capR * 0.55;
    const g = ctx.createRadialGradient(bx, by, 0, bx, by, rr);
    g.addColorStop(0, 'rgba(245,170,90,0.8)');
    g.addColorStop(0.55, 'rgba(140,105,90,0.8)');
    g.addColorStop(1, 'rgba(80,62,55,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(bx, by, rr, 0, Math.PI * 2);
    ctx.fill();
  }
  const core = ctx.createRadialGradient(x, capY, 0, x, capY, capR * 1.1);
  core.addColorStop(0, 'rgba(255,210,130,0.9)');
  core.addColorStop(0.6, 'rgba(190,120,70,0.6)');
  core.addColorStop(1, 'rgba(90,70,60,0)');
  ctx.fillStyle = core;
  ctx.beginPath();
  ctx.ellipse(x, capY, capR * 1.15, capR * 0.7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function draw(
  ctx: CanvasRenderingContext2D, cloud: CanvasRenderingContext2D | null, before: HTMLImageElement, after: HTMLImageElement,
  p: ReturnType<typeof plan>, sky: Sky, t: number, width: number, height: number, seed: number,
) {
  ctx.save();
  ctx.clearRect(0, 0, width, height);

  // the picture trembles as the light grows and when the wave arrives, settling afterward
  let quake = 0;
  if (t > 0.3 && t < 0.47) quake = ease(clamp((t - 0.3) / 0.17)) * 3;
  else if (t >= 0.47) quake = Math.max(0, 1 - (t - 0.47) / 0.3) * 5;
  ctx.translate((Math.sin(t * 210) + Math.sin(t * 337)) * 0.5 * quake, (Math.cos(t * 180) + Math.sin(t * 281)) * 0.5 * quake);

  // underneath: the destroyed picture, in darkness until the dust has taken the real one
  ctx.drawImage(after, 0, 0, width, height);
  const revealed = ease(clamp((t - 0.6) / 0.2));
  ctx.fillStyle = 'rgba(25,14,4,' + (1 - revealed) * 0.92 + ')';
  ctx.fillRect(-40, -40, width + 80, height + 80);

  // the real photograph, scorched by the heat and then lost in the dust
  if (t < 0.7) {
    const scorch = ease(clamp((t - 0.27) / 0.22));
    ctx.globalAlpha = 1 - ease(clamp((t - 0.54) / 0.12));
    ctx.drawImage(before, 0, 0, width, height);
    ctx.globalAlpha = 1;
    if (t > 0.27 && t < 0.62) {
      ctx.fillStyle = 'rgba(70,35,8,' + scorch * 0.28 * (1 - ease(clamp((t - 0.5) / 0.12))) + ')';
      ctx.fillRect(0, 0, width, height);
    }
  }

  // the mushroom cloud, in the sky only: it rises behind the landmark
  if (cloud && sky.hasSky && sky.mask && t > 0.26 && t < 0.78) {
    cloud.clearRect(0, 0, width, height);
    mushroom(cloud, t, sky.cloudX * width, sky.horizon * height, width, height, seed);
    cloud.save();
    cloud.globalCompositeOperation = 'destination-in';
    cloud.drawImage(sky.mask, 0, 0);
    cloud.restore();
    ctx.drawImage(cloud.canvas, 0, 0);
  }

  // the fireball's glow washing over everything
  if (t > 0.26 && t < 0.6) {
    const glow = (1 - ease(clamp((t - 0.3) / 0.3))) * 0.4;
    const gx = (sky.hasSky ? sky.cloudX : 0.6) * width;
    const g = ctx.createRadialGradient(gx, height * (sky.hasSky ? sky.horizon : 0.6), 0, gx, height * (sky.hasSky ? sky.horizon : 0.6), Math.hypot(width, height) * 0.8);
    g.addColorStop(0, 'rgba(255,200,110,' + glow + ')');
    g.addColorStop(1, 'rgba(255,120,40,0)');
    ctx.fillStyle = g;
    ctx.fillRect(-40, -40, width + 80, height + 80);
  }

  // the wall of dust rushing at the screen
  if (t > 0.44 && t < 0.88) {
    const q = clamp((t - 0.44) / 0.44);
    const haze = Math.sin(q * Math.PI);
    const wash = ctx.createRadialGradient(p.ox, p.oy, 0, p.ox, p.oy, p.reach * (0.35 + q * 1.1));
    wash.addColorStop(0, 'rgba(214,180,138,' + haze * 0.7 + ')');
    wash.addColorStop(1, 'rgba(190,156,114,' + haze * 0.42 + ')');
    ctx.fillStyle = wash;
    ctx.fillRect(-40, -40, width + 80, height + 80);
    const blob = (x: number, y: number, r: number, a: number, tone: number) => {
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, 'rgba(' + tone + ',' + (tone - 26) + ',' + (tone - 60) + ',' + a + ')');
      g.addColorStop(1, 'rgba(' + tone + ',' + (tone - 26) + ',' + (tone - 60) + ',0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    };
    for (const gi of p.giants) {
      const age = clamp((t - gi.start) / 0.34);
      if (age <= 0) continue;
      blob(p.ox + gi.dx * age, p.oy + gi.dy * age, gi.radius * (0.25 + age * 1.1), Math.sin(Math.min(1, age) * Math.PI) * 0.5, 184);
    }
    for (const puff of p.puffs) {
      const age = clamp((t - puff.start) / 0.36);
      if (age <= 0) continue;
      const dist = puff.r0 + p.reach * puff.speed * Math.pow(age, 0.8);
      blob(p.ox + Math.cos(puff.angle) * dist, p.oy + Math.sin(puff.angle) * dist * 0.85, puff.radius * (0.6 + age * 5), Math.sin(Math.min(1, age) * Math.PI) * 0.6, 150 + Math.round(puff.shade * 70));
    }
  }

  // specks of debris and grit flying out at the viewer, growing as they come
  for (const c of p.chunks) {
    const age = t - c.start;
    if (age < 0 || age > 0.24) continue;
    const s = age / 0.24;
    const dist = c.r0 + p.reach * c.speed * Math.pow(s, 1.2);
    const size = c.size * (1 + s * 5);
    ctx.save();
    ctx.globalAlpha = Math.min(1, s * 8) * (1 - s * s) * 0.9;
    ctx.translate(p.ox + Math.cos(c.angle) * dist, p.oy + Math.sin(c.angle) * dist * 0.9);
    ctx.rotate(c.spin * s);
    ctx.fillStyle = 'hsl(' + (24 + c.shade * 16) + ',' + (14 + c.shade * 16) + '%,' + (24 + c.shade * 30) + '%)';
    if (c.round) {
      ctx.beginPath();
      ctx.arc(0, 0, size / 2, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillRect(-size / 2, -size / 3, size, (size * 2) / 3);
    }
    ctx.restore();
  }

  // the flashes of white: tremors of light before the burst, the burst itself, and the whiteout that ends it
  let white = 0;
  white = Math.max(white, 0.16 * Math.max(0, 1 - Math.abs(t - 0.14) / 0.012));
  white = Math.max(white, 0.22 * Math.max(0, 1 - Math.abs(t - 0.185) / 0.014));
  white = Math.max(white, Math.max(0, 1 - Math.abs(t - 0.255) / 0.03)); // the burst
  if (t > 0.72 && t < 0.9) white = Math.max(white, t < 0.84 ? ease(clamp((t - 0.72) / 0.12)) : 1 - 0 * t);
  else if (t >= 0.9) white = Math.max(white, 1 - ease(clamp((t - 0.9) / 0.1)));
  if (white > 0) {
    ctx.fillStyle = 'rgba(255,248,226,' + clamp(white) + ')';
    ctx.fillRect(-40, -40, width + 80, height + 80);
  }
  ctx.restore();
}

export default function BlowApart({ beforeUrl, afterUrl, name, file, seed, seenId }: { beforeUrl: string; afterUrl: string; name: string; file: string; seed: number; /** What counts as having seen it (when the picture's own address changes each visit). */ seenId?: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const images = useRef<{ before: HTMLImageElement; after: HTMLImageElement; plan: ReturnType<typeof plan>; sky: Sky; cloud: CanvasRenderingContext2D | null; width: number; height: number } | null>(null);
  const frame = useRef(0);
  const [state, setState] = useState<'loading' | 'playing' | 'done' | 'plain'>('loading');
  const [recording, setRecording] = useState(false);
  const canRecord = typeof MediaRecorder !== 'undefined' && typeof HTMLCanvasElement !== 'undefined' && 'captureStream' in HTMLCanvasElement.prototype;
  const seenKey = `wastelandmaps:seen:${seenId ?? afterUrl}`;

  const finish = useCallback(() => {
    const el = canvas.current;
    const data = images.current;
    const ctx = el?.getContext('2d');
    if (!el || !data || !ctx) return;
    ctx.clearRect(0, 0, data.width, data.height);
    ctx.drawImage(data.after, 0, 0, data.width, data.height);
    setState('done');
  }, []);

  const play = useCallback((onEnd?: () => void) => {
    const el = canvas.current;
    const data = images.current;
    if (!el || !data) return;
    const ctx = el.getContext('2d');
    if (!ctx) return;
    cancelAnimationFrame(frame.current);
    setState('playing');
    const started = performance.now();
    const step = (now: number) => {
      const t = clamp((now - started) / DURATION);
      draw(ctx, data.cloud, data.before, data.after, data.plan, data.sky, t, data.width, data.height, seed);
      if (t < 1) frame.current = requestAnimationFrame(step);
      else {
        finish();
        onEnd?.();
      }
    };
    frame.current = requestAnimationFrame(step);
  }, [finish, seed]);

  // load both pictures; the first time this place is seen, play the blast, otherwise just show the finished picture
  useEffect(() => {
    let cancelled = false;
    setState('loading');
    Promise.all([load(beforeUrl), load(afterUrl)])
      .then(([before, after]) => {
        if (cancelled || !canvas.current) return;
        const width = Math.min(1400, after.naturalWidth);
        const height = Math.round((width * after.naturalHeight) / after.naturalWidth);
        canvas.current.width = width;
        canvas.current.height = height;
        const layer = document.createElement('canvas');
        layer.width = width;
        layer.height = height;
        const sky = findSky(before, width, height);
        // the blast point is where the mushroom cloud stands (the middle of the picture when there is no open sky for it)
        const ox = (sky.hasSky ? sky.cloudX : 0.5) * width, oy = (sky.hasSky ? sky.horizon : 0.55) * height;
        images.current = { before, after, plan: plan(width, height, seed, ox, oy), sky, cloud: layer.getContext('2d'), width, height };
        let seen = false;
        try { seen = !!localStorage.getItem(seenKey); } catch { /* storage unavailable: play it */ }
        if (seen) finish();
        else play(() => { try { localStorage.setItem(seenKey, '1'); } catch { /* fine */ } });
      })
      .catch(() => {
        // the original photo would not load (or may not be drawn): just show the finished picture
        if (!cancelled) setState('plain');
      });
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame.current);
    };
  }, [beforeUrl, afterUrl, seed, play, finish, seenKey]);

  const saveAnimation = () => {
    const el = canvas.current;
    if (!el || recording) return;
    const mime = ['video/mp4', 'video/webm;codecs=vp9', 'video/webm'].find((m) => MediaRecorder.isTypeSupported(m));
    if (!mime) return;
    setRecording(true);
    const recorder = new MediaRecorder(el.captureStream(30), { mimeType: mime, videoBitsPerSecond: 6_000_000 });
    const parts: Blob[] = [];
    recorder.ondataavailable = (e) => { if (e.data.size > 0) parts.push(e.data); };
    recorder.onstop = () => {
      const blob = new Blob(parts, { type: mime.split(';')[0] });
      void saveBlob(blob, file.replace(/\.png$/i, mime.startsWith('video/mp4') ? '.mp4' : '.webm'), name).finally(() => setRecording(false));
    };
    recorder.start();
    // play it again from the start while recording, and stop a moment after the finish
    play(() => setTimeout(() => recorder.stop(), 700));
  };

  return (
    <>
      {state === 'plain'
        ? <img src={afterUrl} className="rm-modal-canvas rm-modal-render" alt={`${name} in the wasteland`} />
        : <canvas ref={canvas} className="rm-modal-canvas rm-modal-render" aria-label={`${name}: the photograph is hit by a bomb and torn apart to reveal it in the wasteland`} />}
      <div className="rm-snap-actions">
        <ScrollRow label="Snapshot options">
          {state !== 'plain' && <button type="button" className="rm-btn rm-btn-ghost" disabled={state !== 'done' || recording} onClick={() => play()}>REPLAY</button>}
          <button type="button" className="rm-btn rm-btn-ghost" onClick={() => void downloadImage(afterUrl, file)}>SAVE IMAGE</button>
          {canRecord && state !== 'plain' && (
            <button type="button" className="rm-btn rm-btn-ghost" disabled={state !== 'done' || recording} onClick={saveAnimation}>{recording ? 'RECORDING…' : 'SAVE VIDEO'}</button>
          )}
          <button type="button" className="rm-btn rm-btn-ghost" onClick={() => void shareImage(afterUrl, file, name)}>SHARE</button>
        </ScrollRow>
      </div>
    </>
  );
}
