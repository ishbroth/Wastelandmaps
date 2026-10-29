import { useCallback, useEffect, useRef, useState } from 'react';
import { downloadImage, shareImage } from '../lib/usePaidRender';

/**
 * The reveal: the real photograph, then a bomb. A flash of white, a mushroom cloud rising over the sky in the photo (when it has open sky), the
 * shock wave arriving as a wall of dust that rips the picture into pieces and blows them away, a second whiteout, and then, as the white clears,
 * the destroyed render. Drawn on a canvas, so the whole thing can also be recorded and saved as a short video.
 * It plays the first time someone sees a place; after that they get the finished picture, with REPLAY.
 */

const DURATION = 7600; // milliseconds
const COLS = 18;

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

interface Tile { x: number; y: number; w: number; h: number; dx: number; dy: number; spin: number; start: number }
interface Chunk { vx: number; vy: number; size: number; start: number; hue: number; spin: number; y0: number }
interface Streak { y: number; speed: number; length: number; thick: number; offset: number; alpha: number }
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

function plan(width: number, height: number, seed: number) {
  const rand = stream(seed);
  const rows = Math.max(6, Math.round((COLS * height) / width));
  const tw = width / COLS;
  const th = height / rows;
  const wind = 0.5 + rand() * 0.25; // the blast blows to the right
  const tiles: Tile[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < COLS; c++) {
      const cx = (c + 0.5) * tw;
      tiles.push({
        x: c * tw, y: r * th, w: tw, h: th,
        dx: (wind + rand() * 0.8) * width * 0.9, dy: (rand() - 0.62) * height * 0.8,
        spin: (rand() - 0.5) * 9,
        // the shock front sweeps across from the left: tiles are ripped off in order
        start: 0.47 + (cx / width) * 0.13 + rand() * 0.025,
      });
    }
  }
  const chunks: Chunk[] = Array.from({ length: 130 }, () => ({
    vx: (0.4 + rand() * 1.3) * width * (wind + 0.3), vy: (rand() - 0.7) * height * 0.8, size: 3 + rand() * 15, start: 0.48 + rand() * 0.14,
    hue: 20 + rand() * 25, spin: (rand() - 0.5) * 14, y0: height * (0.35 + rand() * 0.55),
  }));
  const streaks: Streak[] = Array.from({ length: 70 }, () => ({
    y: rand() * height, speed: 1.2 + rand() * 1.6, length: width * (0.25 + rand() * 0.5), thick: 5 + rand() * 30, offset: rand(), alpha: 0.12 + rand() * 0.28,
  }));
  return { tiles, chunks, streaks, wind, rand: stream(seed ^ 0x5bd1e995) };
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

  // the picture shakes: a tremble as the light grows, hard when the blast arrives, settling afterward
  let quake = 0;
  if (t > 0.3 && t < 0.47) quake = ease(clamp((t - 0.3) / 0.17)) * 4;
  else if (t >= 0.47) quake = Math.max(0, 1 - (t - 0.47) / 0.3) * 26;
  ctx.translate((Math.sin(t * 210) + Math.sin(t * 337)) * 0.5 * quake, (Math.cos(t * 180) + Math.sin(t * 281)) * 0.5 * quake);

  // underneath: the destroyed picture, hidden in darkness and dust until the real one is torn away
  ctx.drawImage(after, 0, 0, width, height);
  const revealed = ease(clamp((t - 0.52) / 0.24));
  ctx.fillStyle = 'rgba(25,14,4,' + (1 - revealed) * 0.92 + ')';
  ctx.fillRect(-40, -40, width + 80, height + 80);

  // the real photograph, then the pieces of it as they are ripped off
  if (t < 0.8) {
    const scorch = ease(clamp((t - 0.27) / 0.22));
    ctx.drawImage(before, 0, 0, width, height);
    for (const tile of p.tiles) {
      const s = clamp((t - tile.start) / 0.3);
      if (s <= 0) continue;
      const move = Math.pow(s, 1.55);
      // under the tile that is leaving, the destroyed picture shows through
      ctx.save();
      ctx.beginPath();
      ctx.rect(tile.x, tile.y, tile.w + 1, tile.h + 1);
      ctx.clip();
      ctx.drawImage(after, 0, 0, width, height);
      ctx.fillStyle = 'rgba(25,14,4,' + (1 - revealed) * 0.92 + ')';
      ctx.fillRect(tile.x - 2, tile.y - 2, tile.w + 4, tile.h + 4);
      ctx.restore();
      if (s >= 1) continue;
      ctx.save();
      ctx.globalAlpha = 1 - Math.pow(s, 1.8);
      ctx.translate(tile.x + tile.w / 2 + tile.dx * move, tile.y + tile.h / 2 + tile.dy * move + move * move * height * 0.4);
      ctx.rotate(tile.spin * move);
      const grow = 1 + move * 0.3;
      ctx.scale(grow, grow);
      ctx.drawImage(before, (tile.x / width) * before.width, (tile.y / height) * before.height, (tile.w / width) * before.width + 1, (tile.h / height) * before.height + 1, -tile.w / 2, -tile.h / 2, tile.w + 1.5, tile.h + 1.5);
      ctx.fillStyle = 'rgba(70,35,8,' + scorch * 0.5 + ')';
      ctx.fillRect(-tile.w / 2, -tile.h / 2, tile.w + 1.5, tile.h + 1.5);
      ctx.restore();
    }
    // before the tiles go, the whole picture is already scorched by the heat
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

  // the dust wall of the shock wave sweeping through, and the pieces it carries
  if (t > 0.44 && t < 0.86) {
    const wave = ease(clamp((t - 0.44) / 0.42));
    const haze = Math.sin(clamp((t - 0.44) / 0.42) * Math.PI);
    ctx.fillStyle = 'rgba(200,165,120,' + haze * 0.5 + ')';
    ctx.fillRect(-40, -40, width + 80, height + 80);
    for (const s of p.streaks) {
      const x = ((t - 0.44) * 3.2 * s.speed + s.offset) % 1.5 * width - s.length * 0.4;
      const a = s.alpha * haze * 1.4;
      const g = ctx.createLinearGradient(x, 0, x + s.length, 0);
      g.addColorStop(0, 'rgba(215,180,135,0)');
      g.addColorStop(0.5, 'rgba(215,180,135,' + a + ')');
      g.addColorStop(1, 'rgba(215,180,135,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x, s.y - s.thick / 2, s.length, s.thick);
    }
    void wave;
  }
  for (const c of p.chunks) {
    const age = t - c.start;
    if (age < 0 || age > 0.3) continue;
    const s = age / 0.3;
    ctx.save();
    ctx.globalAlpha = 1 - s * s;
    ctx.translate(c.vx * s * 0.55, c.y0 + c.vy * s * 0.5 + s * s * height * 0.5);
    ctx.rotate(c.spin * s);
    ctx.fillStyle = 'hsl(' + c.hue + ',32%,' + (22 + (c.size % 5) * 6) + '%)';
    ctx.fillRect(-c.size / 2, -c.size / 3, c.size, (c.size * 2) / 3);
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

export default function BlowApart({ beforeUrl, afterUrl, name, file, seed }: { beforeUrl: string; afterUrl: string; name: string; file: string; seed: number }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const images = useRef<{ before: HTMLImageElement; after: HTMLImageElement; plan: ReturnType<typeof plan>; sky: Sky; cloud: CanvasRenderingContext2D | null; width: number; height: number } | null>(null);
  const frame = useRef(0);
  const [state, setState] = useState<'loading' | 'playing' | 'done' | 'plain'>('loading');
  const [recording, setRecording] = useState(false);
  const canRecord = typeof MediaRecorder !== 'undefined' && typeof HTMLCanvasElement !== 'undefined' && 'captureStream' in HTMLCanvasElement.prototype;
  const seenKey = `wastelandmaps:seen:${afterUrl}`;

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
        images.current = { before, after, plan: plan(width, height, seed), sky: findSky(before, width, height), cloud: layer.getContext('2d'), width, height };
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
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = file.replace(/\.png$/i, mime.startsWith('video/mp4') ? '.mp4' : '.webm');
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(link.href), 10_000);
      setRecording(false);
    };
    recorder.start();
    // play it again from the start while recording, and stop a moment after the finish
    play(() => setTimeout(() => recorder.stop(), 700));
  };

  return (
    <>
      <span className="rm-modal-style rm-modal-actions">
        {state !== 'plain' && <button type="button" className="rm-btn rm-btn-ghost" disabled={state !== 'done' || recording} onClick={() => play()}>REPLAY</button>}
        <button type="button" className="rm-btn rm-btn-ghost" onClick={() => void downloadImage(afterUrl, file)}>SAVE IMAGE</button>
        {canRecord && state !== 'plain' && (
          <button type="button" className="rm-btn rm-btn-ghost" disabled={state !== 'done' || recording} onClick={saveAnimation}>{recording ? 'RECORDING…' : 'SAVE VIDEO'}</button>
        )}
        <button type="button" className="rm-btn rm-btn-ghost" onClick={() => void shareImage(afterUrl, file, name)}>SHARE</button>
      </span>
      {state === 'plain'
        ? <img src={afterUrl} className="rm-modal-canvas rm-modal-render" alt={`${name} in the wasteland`} />
        : <canvas ref={canvas} className="rm-modal-canvas rm-modal-render" aria-label={`${name}: the photograph is hit by a bomb and torn apart to reveal it in the wasteland`} />}
    </>
  );
}
