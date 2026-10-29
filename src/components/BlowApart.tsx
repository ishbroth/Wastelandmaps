import { useCallback, useEffect, useRef, useState } from 'react';
import { downloadImage, shareImage } from '../lib/usePaidRender';

/**
 * The reveal: the real photograph, slowly cracking, then blown apart to show the destroyed game-style render underneath. Drawn on a canvas, so the
 * whole thing can also be recorded and saved as a short video.
 */

const DURATION = 5600; // milliseconds
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
interface Chunk { vx: number; vy: number; size: number; start: number; hue: number; spin: number }
interface Crack { points: [number, number][] }

function plan(width: number, height: number, seed: number) {
  const rand = stream(seed);
  const rows = Math.max(6, Math.round((COLS * height) / width));
  const tw = width / COLS;
  const th = height / rows;
  const ix = width * 0.5;
  const iy = height * 0.46; // where it blows from
  const reach = Math.hypot(width, height) / 2;
  const tiles: Tile[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < COLS; c++) {
      const cx = (c + 0.5) * tw;
      const cy = (r + 0.5) * th;
      const dist = Math.hypot(cx - ix, cy - iy);
      const angle = Math.atan2(cy - iy, cx - ix) + (rand() - 0.5) * 0.6;
      const speed = 0.35 + rand() * 0.75;
      tiles.push({
        x: c * tw, y: r * th, w: tw, h: th,
        dx: Math.cos(angle) * speed * width * 0.9, dy: Math.sin(angle) * speed * height * 0.9 - height * 0.12,
        spin: (rand() - 0.5) * 7,
        start: 0.5 + (dist / reach) * 0.1 + rand() * 0.03,
      });
    }
  }
  const chunks: Chunk[] = Array.from({ length: 110 }, () => {
    const angle = rand() * Math.PI * 2;
    const speed = 0.25 + rand() * 1.1;
    return { vx: Math.cos(angle) * speed * width, vy: Math.sin(angle) * speed * height - height * 0.3, size: 3 + rand() * 14, start: 0.5 + rand() * 0.1, hue: 20 + rand() * 25, spin: (rand() - 0.5) * 12 };
  });
  const cracks: Crack[] = Array.from({ length: 11 }, () => {
    let a = rand() * Math.PI * 2;
    let x = ix;
    let y = iy;
    const points: [number, number][] = [[x, y]];
    const steps = 6 + Math.floor(rand() * 5);
    for (let i = 0; i < steps; i++) {
      a += (rand() - 0.5) * 0.9;
      const len = (width * (0.04 + rand() * 0.07));
      x += Math.cos(a) * len;
      y += Math.sin(a) * len;
      points.push([x, y]);
    }
    return { points };
  });
  return { tiles, chunks, cracks, ix, iy, reach };
}

function draw(ctx: CanvasRenderingContext2D, before: HTMLImageElement, after: HTMLImageElement, p: ReturnType<typeof plan>, t: number, width: number, height: number) {
  ctx.save();
  ctx.clearRect(0, 0, width, height);

  // the whole picture shakes: a little during the tension, hard at the blast, then it settles
  const quake = t < 0.5 ? ease(clamp((t - 0.2) / 0.3)) * 5 : Math.max(0, 1 - (t - 0.5) / 0.3) * 22;
  ctx.translate((Math.sin(t * 190) + Math.sin(t * 331)) * 0.5 * quake, (Math.cos(t * 170) + Math.sin(t * 277)) * 0.5 * quake);

  // underneath: the destroyed version, dark until the blast reveals it
  ctx.drawImage(after, 0, 0, width, height);
  const reveal = ease(clamp((t - 0.5) / 0.22));
  ctx.fillStyle = `rgba(8,4,0,${(1 - reveal) * 0.9})`;
  ctx.fillRect(-30, -30, width + 60, height + 60);

  // before the blast: the real photograph, going sick and cracking
  if (t < 0.9) {
    const sick = ease(clamp((t - 0.12) / 0.38));
    for (const tile of p.tiles) {
      const s = clamp((t - tile.start) / 0.34);
      if (s >= 1) continue;
      const move = Math.pow(s, 1.5);
      ctx.save();
      ctx.globalAlpha = 1 - Math.pow(s, 1.6);
      ctx.translate(tile.x + tile.w / 2 + tile.dx * move, tile.y + tile.h / 2 + tile.dy * move + move * move * height * 0.5);
      ctx.rotate(tile.spin * move);
      const grow = 1 + move * 0.35;
      ctx.scale(grow, grow);
      ctx.drawImage(before, (tile.x / width) * before.width, (tile.y / height) * before.height, (tile.w / width) * before.width + 1, (tile.h / height) * before.height + 1, -tile.w / 2, -tile.h / 2, tile.w + 1.5, tile.h + 1.5);
      // the tile browns and darkens as the photograph rots
      ctx.fillStyle = `rgba(60,30,5,${sick * 0.55})`;
      ctx.fillRect(-tile.w / 2, -tile.h / 2, tile.w + 1.5, tile.h + 1.5);
      ctx.restore();
    }
    // cracks spreading from the point of impact
    const spread = ease(clamp((t - 0.2) / 0.28));
    if (spread > 0 && t < 0.52) {
      ctx.strokeStyle = 'rgba(10,5,0,0.85)';
      for (const crack of p.cracks) {
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        const shown = Math.max(1, Math.floor(spread * (crack.points.length - 1)));
        ctx.moveTo(crack.points[0][0], crack.points[0][1]);
        for (let i = 1; i <= shown; i++) ctx.lineTo(crack.points[i][0], crack.points[i][1]);
        ctx.stroke();
      }
    }
    // a glow building at the impact point
    if (t > 0.3 && t < 0.56) {
      const glow = ease(clamp((t - 0.3) / 0.18));
      const g = ctx.createRadialGradient(p.ix, p.iy, 0, p.ix, p.iy, p.reach * 0.7 * glow);
      g.addColorStop(0, `rgba(255,190,90,${0.55 * glow})`);
      g.addColorStop(1, 'rgba(255,120,30,0)');
      ctx.fillStyle = g;
      ctx.fillRect(-30, -30, width + 60, height + 60);
    }
  }

  // the shock wave
  if (t > 0.5 && t < 0.8) {
    const w = (t - 0.5) / 0.3;
    ctx.strokeStyle = `rgba(255,230,190,${(1 - w) * 0.8})`;
    ctx.lineWidth = 4 + (1 - w) * 14;
    ctx.beginPath();
    ctx.arc(p.ix, p.iy, ease(w) * p.reach * 1.25, 0, Math.PI * 2);
    ctx.stroke();
  }

  // debris flying, then falling
  for (const chunk of p.chunks) {
    const age = t - chunk.start;
    if (age < 0 || age > 0.32) continue;
    const s = age / 0.32;
    ctx.save();
    ctx.globalAlpha = 1 - s * s;
    ctx.translate(p.ix + chunk.vx * s * 0.8, p.iy + chunk.vy * s * 0.8 + s * s * height * 0.75);
    ctx.rotate(chunk.spin * s);
    ctx.fillStyle = `hsl(${chunk.hue},35%,${22 + (chunk.size % 5) * 6}%)`;
    ctx.fillRect(-chunk.size / 2, -chunk.size / 3, chunk.size, (chunk.size * 2) / 3);
    ctx.restore();
  }

  // dust that rolls out of the blast and slowly clears
  if (t > 0.5) {
    const dust = t < 0.7 ? ease((t - 0.5) / 0.2) : 1 - ease(clamp((t - 0.7) / 0.28));
    const g = ctx.createRadialGradient(p.ix, p.iy + height * 0.1, 0, p.ix, p.iy + height * 0.1, p.reach * 1.1);
    g.addColorStop(0, `rgba(190,160,110,${0.55 * dust})`);
    g.addColorStop(1, `rgba(150,120,80,${0.25 * dust})`);
    ctx.fillStyle = g;
    ctx.fillRect(-30, -30, width + 60, height + 60);
  }

  // the flash
  const flash = Math.max(0, 1 - Math.abs(t - 0.52) / 0.045);
  if (flash > 0) {
    ctx.fillStyle = `rgba(255,244,214,${flash})`;
    ctx.fillRect(-30, -30, width + 60, height + 60);
  }
  ctx.restore();
}

export default function BlowApart({ beforeUrl, afterUrl, name, file, seed }: { beforeUrl: string; afterUrl: string; name: string; file: string; seed: number }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const images = useRef<{ before: HTMLImageElement; after: HTMLImageElement; plan: ReturnType<typeof plan>; width: number; height: number } | null>(null);
  const frame = useRef(0);
  const [state, setState] = useState<'loading' | 'playing' | 'done' | 'plain'>('loading');
  const [recording, setRecording] = useState(false);
  const canRecord = typeof MediaRecorder !== 'undefined' && typeof HTMLCanvasElement !== 'undefined' && 'captureStream' in HTMLCanvasElement.prototype;

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
      draw(ctx, data.before, data.after, data.plan, t, data.width, data.height);
      if (t < 1) frame.current = requestAnimationFrame(step);
      else {
        ctx.clearRect(0, 0, data.width, data.height);
        ctx.drawImage(data.after, 0, 0, data.width, data.height);
        setState('done');
        onEnd?.();
      }
    };
    frame.current = requestAnimationFrame(step);
  }, []);

  // load both pictures, then play once
  useEffect(() => {
    let cancelled = false;
    setState('loading');
    Promise.all([load(beforeUrl), load(afterUrl)])
      .then(([before, after]) => {
        if (cancelled || !canvas.current) return;
        const width = Math.min(1000, after.naturalWidth);
        const height = Math.round((width * after.naturalHeight) / after.naturalWidth);
        canvas.current.width = width;
        canvas.current.height = height;
        images.current = { before, after, plan: plan(width, height, seed), width, height };
        play();
      })
      .catch(() => {
        // the original photo would not load (or may not be drawn): just show the finished picture
        if (!cancelled) setState('plain');
      });
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame.current);
    };
  }, [beforeUrl, afterUrl, seed, play]);

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
        : <canvas ref={canvas} className="rm-modal-canvas rm-modal-render" aria-label={`${name}: the photograph is blown apart to reveal it in the wasteland`} />}
    </>
  );
}
