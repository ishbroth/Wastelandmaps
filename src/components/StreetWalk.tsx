// Our own street view: walk down a street that has been rendered as it is after the bombs. It is not Google's. The ground is laid out from the real streets of the map (road,
// sidewalk and broken earth, from pieces made ahead of time in the game's style), debris, dead trees and wrecks are set on the empty lots from a stock of rendered pieces, and
// each mapped place is a building built from the picture people unlocked (on its front) and generic ruined walls (on its sides), so it can be seen from different angles.
// The street goes on only while another mapped place is within 200 feet.

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import CogSpinner from './CogSpinner';
import { loadNeighborhood, type NeighborItem, type StreetRoad } from '../lib/account';

const FEET_200 = 61; // metres
const CAM_H = 1.7;
const NEAR = 0.9;
const FAR = 95;
const MAP_PX_PER_M = 2;
const MAP_SIZE = 1024; // 512 m a side
const ROAD_W: Record<string, number> = { motorway: 14, trunk: 12, primary: 11, secondary: 10, tertiary: 9, residential: 7.5, unclassified: 7.5, living_street: 6, service: 5, motorway_link: 7, trunk_link: 7, primary_link: 7, secondary_link: 7, tertiary_link: 7 };

interface Place { id: string; lat: number; lng: number; name: string }
type V = { x: number; y: number };
interface Road { id: number; hw: string; w: number; pts: V[] }
interface Building extends NeighborItem { x: number; y: number; n: V; img: HTMLCanvasElement | null; ratio: number; width: number; depth: number; side: number; /** the building as re-rendered: its own front and side, and its size in metres */ vf?: HTMLCanvasElement; vs?: HTMLCanvasElement; fw?: number; fh?: number; sd?: number }
interface Tex { data: Uint8ClampedArray; mean: [number, number, number] }
interface Assets { tex: Record<string, Tex>; sprites: Record<string, HTMLImageElement> }

const mPerDegLat = 111_320;
const toMeters = (o: { lat: number; lng: number }, p: { lat: number; lng: number }): V => ({ x: (p.lng - o.lng) * mPerDegLat * Math.cos((o.lat * Math.PI) / 180), y: (p.lat - o.lat) * mPerDegLat });
const hash = (n: number): number => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const BASE = import.meta.env.BASE_URL;
const SPRITE_NAMES = ['rubble1', 'rubble2', 'rubble3', 'rubble4', 'tree1', 'tree2', 'tree3', 'car1', 'car2', 'pole1', 'lamp1', 'houseside1', 'houseside2', 'houseside3', 'shopside1', 'flat1', 'flat2', 'flat3', 'scatter2', 'scatter3', 'tree4'];
const TEX_NAMES = ['asphalt', 'asphalt2', 'dirt', 'dirt2', 'dirt3', 'sidewalk'];
/** How tall each stock piece stands, in metres (its width follows its picture). */
const SPRITE_H: Record<string, number> = { rubble1: 2.2, rubble2: 2.2, rubble3: 1.1, rubble4: 2.4, tree1: 6.5, tree2: 4.5, tree3: 1.4, tree4: 5, flat1: 0.55, flat2: 0.5, flat3: 0.5, scatter2: 0.4, scatter3: 0.7, car1: 1.6, car2: 1.9, pole1: 8, lamp1: 6.5 };

const loadImg = (src: string): Promise<HTMLImageElement | null> => new Promise((res) => { const i = new Image(); i.crossOrigin = 'anonymous'; i.onload = () => res(i); i.onerror = () => res(null); i.src = src; });

async function loadAssets(): Promise<Assets> {
  const tex: Record<string, Tex> = {};
  await Promise.all(TEX_NAMES.map(async (n) => {
    const img = await loadImg(`${BASE}street/tex-${n}.webp`);
    if (!img) return;
    const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
    const x = c.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D; x.drawImage(img, 0, 0);
    const data = x.getImageData(0, 0, c.width, c.height).data;
    let r = 0, g = 0, b = 0, count = 0;
    for (let i = 0; i < data.length; i += 4 * 17) { r += data[i]; g += data[i + 1]; b += data[i + 2]; count++; }
    tex[n] = { data, mean: [r / count, g / count, b / count] };
  }));
  const sprites: Record<string, HTMLImageElement> = {};
  await Promise.all(SPRITE_NAMES.map(async (n) => { const i = await loadImg(`${BASE}street/${n}.webp`); if (i) sprites[n] = i; }));
  return { tex, sprites };
}

/** The whole picture, as it was rendered: it is the facade, so from the road it looks like the render (fence, curb and sidewalk included). It melts into the sky at the top and
 *  softly at the sides (where the neighbours would be); its foot stays solid so it stands on the ground. */
function cutOut(img: HTMLImageElement): { canvas: HTMLCanvasElement; ratio: number } {
  const w = img.naturalWidth, h = img.naturalHeight;
  const c = document.createElement('canvas');
  c.width = 640; c.height = Math.max(64, Math.round(640 * (h / w)));
  const x = c.getContext('2d') as CanvasRenderingContext2D;
  x.drawImage(img, 0, 0, w, h, 0, 0, c.width, c.height);
  // the sky is taken out (so ours shows): from the top edge, the smooth bright areas, stopping at anything dark or sharp (the building and its debris)
  const sw = 160, sh = Math.max(20, Math.round(160 * (h / w)));
  const sm = document.createElement('canvas'); sm.width = sw; sm.height = sh;
  const sx = sm.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D;
  sx.drawImage(c, 0, 0, sw, sh);
  const px = sx.getImageData(0, 0, sw, sh).data, seen = new Uint8Array(sw * sh), stack: number[] = [];
  const lum = (i: number) => px[i * 4] * 0.3 + px[i * 4 + 1] * 0.59 + px[i * 4 + 2] * 0.11;
  for (let i = 0; i < sw; i++) { seen[i] = 1; stack.push(i); }
  while (stack.length) {
    const p = stack.pop() as number, py = Math.floor(p / sw), pxx = p % sw;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = pxx + dx, ny = py + dy;
      if (nx < 0 || ny < 0 || nx >= sw || ny >= sh * 0.62) continue;
      const q = ny * sw + nx;
      if (seen[q]) continue;
      const d = Math.abs(px[q * 4] - px[p * 4]) + Math.abs(px[q * 4 + 1] - px[p * 4 + 1]) + Math.abs(px[q * 4 + 2] - px[p * 4 + 2]);
      if (d < 30 && lum(q) > 75) { seen[q] = 1; stack.push(q); }
    }
  }
  const mask = document.createElement('canvas'); mask.width = sw; mask.height = sh;
  const mx = mask.getContext('2d') as CanvasRenderingContext2D, md = mx.createImageData(sw, sh);
  for (let i = 0; i < sw * sh; i++) { md.data[i * 4 + 3] = seen[i] ? 0 : 255; }
  mx.putImageData(md, 0, 0);
  x.globalCompositeOperation = 'destination-in';
  x.filter = 'blur(3px)'; x.drawImage(mask, 0, 0, c.width, c.height); x.filter = 'none';
  x.globalCompositeOperation = 'destination-in';
  const gh = x.createLinearGradient(0, 0, c.width, 0);
  gh.addColorStop(0, 'rgba(0,0,0,0)'); gh.addColorStop(0.1, 'rgba(0,0,0,1)'); gh.addColorStop(0.9, 'rgba(0,0,0,1)'); gh.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = gh; x.fillRect(0, 0, c.width, c.height);
  const gv = x.createLinearGradient(0, 0, 0, c.height);
  gv.addColorStop(0, 'rgba(0,0,0,0)'); gv.addColorStop(0.22, 'rgba(0,0,0,1)'); gv.addColorStop(1, 'rgba(0,0,0,1)');
  x.fillStyle = gv; x.fillRect(0, 0, c.width, c.height);
  return { canvas: c, ratio: c.height / c.width };
}

/** A re-rendered building view (on flat magenta): the magenta cut out and the margin trimmed, so the canvas is the building alone. */
function keyView(img: HTMLImageElement): { canvas: HTMLCanvasElement; aspect: number } | null {
  const w = img.naturalWidth, h = img.naturalHeight;
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D;
  x.drawImage(img, 0, 0);
  const d = x.getImageData(0, 0, w, h), p = d.data;
  let x0 = w, y0 = h, x1 = 0, y1 = 0;
  for (let y = 0; y < h; y++) for (let xx = 0; xx < w; xx++) {
    const i = (y * w + xx) * 4, r = p[i], g = p[i + 1], b = p[i + 2], m = Math.min(r, b) - g;
    if (m > 70) p[i + 3] = 0;
    else if (m > 35) { const k = 1 - (m - 35) / 35; p[i + 3] = Math.round(255 * k); p[i] = Math.round(r * k + g * (1 - k)); p[i + 2] = Math.round(b * k + g * (1 - k)); }
    if (p[i + 3] > 40) { if (xx < x0) x0 = xx; if (xx > x1) x1 = xx; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  if (x1 - x0 < 40 || y1 - y0 < 40) return null;
  x.putImageData(d, 0, 0);
  const bw = x1 - x0 + 1, bh = y1 - y0 + 1, scale = Math.min(1, 640 / Math.max(bw, bh));
  const out = document.createElement('canvas'); out.width = Math.round(bw * scale); out.height = Math.round(bh * scale);
  (out.getContext('2d') as CanvasRenderingContext2D).drawImage(c, x0, y0, bw, bh, 0, 0, out.width, out.height);
  return { canvas: out, aspect: bw / bh };
}
/** How tall a building of this kind stands, in metres (the width follows from its picture). */
const HEIGHT_OF: Record<string, number> = { house: 6.5, home: 6.5, address: 6.5, medical: 9, office: 10, church: 12, gov: 12, park: 5, place: 14 };
/** The re-rendered pieces of a building loaded and sized: its front and its side, and how big it is. */
async function loadViews(it: NeighborItem): Promise<{ vf: HTMLCanvasElement; vs: HTMLCanvasElement; fw: number; fh: number; sd: number } | null> {
  if (!it.front || !it.side) return null;
  const [fi, si] = await Promise.all([loadImg(it.front), loadImg(it.side)]);
  const fr = fi ? keyView(fi) : null, sd = si ? keyView(si) : null;
  if (!fr || !sd) return null;
  const fh = HEIGHT_OF[it.kind] ?? 8;
  const fw = Math.max(7, Math.min(42, fh * fr.aspect));
  const depth = Math.max(6, Math.min(28, fh * sd.aspect));
  return { vf: fr.canvas, vs: sd.canvas, fw, fh, sd: depth };
}

/** The lie of the land: heights (metres) on a grid round a point, from the free open elevation service (coarse, but it has the real hills). Null if it cannot be had. */
interface Elev { cx: number; cy: number; step: number; n: number; h: Float32Array }
async function fetchElev(origin: { lat: number; lng: number }, at: V): Promise<Elev | null> {
  const n = 9, step = 40, lats: number[] = [], lngs: number[] = [];
  const mLng = mPerDegLat * Math.cos((origin.lat * Math.PI) / 180);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { lats.push(origin.lat + (at.y + (j - 4) * step) / mPerDegLat); lngs.push(origin.lng + (at.x + (i - 4) * step) / mLng); }
  try {
    const res = await fetch(`https://api.open-meteo.com/v1/elevation?latitude=${lats.map((v) => v.toFixed(5)).join(',')}&longitude=${lngs.map((v) => v.toFixed(5)).join(',')}`);
    if (!res.ok) return null;
    const body = (await res.json()) as { elevation?: number[] };
    if (!body.elevation || body.elevation.length !== n * n) return null;
    return { cx: at.x, cy: at.y, step, n, h: Float32Array.from(body.elevation) };
  } catch { return null; }
}
const elevAt = (e: Elev | null, p: V): number => {
  if (!e) return 0;
  const fx = (p.x - e.cx) / e.step + (e.n - 1) / 2, fy = (p.y - e.cy) / e.step + (e.n - 1) / 2;
  const cx = Math.max(0, Math.min(e.n - 1.001, fx)), cy = Math.max(0, Math.min(e.n - 1.001, fy));
  const x0 = Math.floor(cx), y0 = Math.floor(cy), tx = cx - x0, ty = cy - y0;
  const g = (i: number, j: number) => e.h[j * e.n + i];
  return (g(x0, y0) * (1 - tx) + g(x0 + 1, y0) * tx) * (1 - ty) + (g(x0, y0 + 1) * (1 - tx) + g(x0 + 1, y0 + 1) * tx) * ty;
};

/** The nearest point on any street to a point: where, how far, and which way the street runs there. */
function nearestRoad(roads: Road[], p: V): { at: V; d: number; tan: V; road: Road } | null {
  let best: { at: V; d: number; tan: V; road: Road } | null = null;
  for (const r of roads) {
    for (let i = 0; i + 1 < r.pts.length; i++) {
      const a = r.pts[i], b = r.pts[i + 1];
      const vx = b.x - a.x, vy = b.y - a.y, l2 = vx * vx + vy * vy;
      const t = l2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * vx + (p.y - a.y) * vy) / l2));
      const q = { x: a.x + vx * t, y: a.y + vy * t };
      const d = Math.hypot(p.x - q.x, p.y - q.y);
      if (!best || d < best.d) { const l = Math.sqrt(l2) || 1; best = { at: q, d, tan: { x: vx / l, y: vy / l }, road: r }; }
    }
  }
  return best;
}

export default function StreetWalk({ center, places, onClose }: { center: { lat: number; lng: number }; places: Place[]; onClose: () => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'none' | 'error'>('loading');
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState('');
  const world = useRef<{ viewsPending: boolean; origin: { lat: number; lng: number }; b: Building[]; roads: Map<number, Road>; loading: Set<string>; assets: Assets | null; elev: Elev | null; elevBusy: boolean; surface: { x: number; y: number; data: Uint8ClampedArray } | null; roadsVersion: number; builtVersion: number }>({ viewsPending: false, origin: center, b: [], roads: new Map(), loading: new Set(), assets: null, elev: null, elevBusy: false, surface: null, roadsVersion: 0, builtVersion: -1 });
  const cam = useRef({ x: 0, y: 0, psi: 0, vel: 0, bob: 0, look: 0, g: 0 });
  const keys = useRef({ fwd: false, back: false });
  const dragLook = useRef<{ x: number; look: number } | null>(null);
  const say = useCallback((t: string) => { setFlash(t); window.setTimeout(() => setFlash((f) => (f === t ? '' : f)), 2600); }, []);

  // what is around a point: asked for (the streets, and the pictures of the places), the pictures loaded and cut, and everything kept for the walk
  const gather = useCallback(async (at: { lat: number; lng: number }, first: boolean): Promise<boolean> => {
    setBusy(true);
    const got = await loadNeighborhood(at.lat, at.lng, places);
    if (!got) { if (first) setState('error'); setBusy(false); return false; }
    const w = world.current;
    if (first) w.origin = at;
    for (const r of got.roads ?? ([] as StreetRoad[])) {
      if (w.roads.has(r.id)) continue;
      w.roads.set(r.id, { id: r.id, hw: r.hw, w: ROAD_W[r.hw] ?? 7, pts: r.pts.map(([la, lo]) => toMeters(w.origin, { lat: la, lng: lo })) });
      w.roadsVersion++;
    }
    // no streets from the map (it could not be reached): one straight street the way Google says this one runs
    if (first && w.roads.size === 0 && got.street) {
      const a = (got.street.bearing * Math.PI) / 180, P = toMeters(at, got.street);
      w.roads.set(-1, { id: -1, hw: 'residential', w: 7.5, pts: [{ x: P.x - Math.sin(a) * 200, y: P.y - Math.cos(a) * 200 }, { x: P.x + Math.sin(a) * 200, y: P.y + Math.cos(a) * 200 }] });
      w.roadsVersion++;
    }
    // the land: where the walk is, the heights round it (the first time, and again when the walk has gone out of the last grid)
    const here = toMeters(w.origin, at);
    if (!w.elevBusy && (!w.elev || Math.hypot(here.x - w.elev.cx, here.y - w.elev.cy) > 90)) { w.elevBusy = true; void fetchElev(w.origin, here).then((e) => { if (e) w.elev = e; w.elevBusy = false; }); }
    const roads = [...w.roads.values()];
    for (const it of got.items) {
      const have = w.b.find((b) => b.id === it.id);
      if (have) { // the building has since been re-rendered into its own pieces: it is rebuilt in the street with them
        if (!have.vf && it.front && it.side && !w.loading.has(it.id + '#v')) {
          w.loading.add(it.id + '#v');
          const v = await loadViews(it);
          if (v) { have.vf = v.vf; have.vs = v.vs; have.fw = v.fw; have.fh = v.fh; have.sd = v.sd; have.width = v.fw; have.depth = v.sd; }
          w.loading.delete(it.id + '#v');
        }
        continue;
      }
      if (w.loading.has(it.id)) continue;
      w.loading.add(it.id);
      const m = toMeters(w.origin, it);
      const img = await loadImg(it.url);
      const cut = img ? cutOut(img) : null;
      // which way it faces: toward the nearest street
      const nr = nearestRoad(roads, m);
      let n: V = { x: 0, y: -1 };
      if (nr) { const dx = nr.at.x - m.x, dy = nr.at.y - m.y, l = Math.hypot(dx, dy) || 1; n = { x: dx / l, y: dy / l }; }
      const homey = it.kind === 'house' || it.kind === 'home' || it.kind === 'address';
      let width = homey ? 21 : 28; // the facade (the whole picture); the body of the building is the middle of it
      let depth = homey ? 9 : 13;
      // the front stands back from the sidewalk: if the place is closer to the street than that, it is set back
      if (nr) { const need = nr.road.w / 2 + 4.5 + depth / 2; if (nr.d < need) { m.x -= n.x * (need - nr.d); m.y -= n.y * (need - nr.d); } }
      const v = await loadViews(it);
      if (v) { width = v.fw; depth = v.sd; }
      w.b.push({ ...it, ...(v ? { vf: v.vf, vs: v.vs, fw: v.fw, fh: v.fh, sd: v.sd } : {}), x: m.x, y: m.y, n, img: cut?.canvas ?? null, ratio: Math.min(1.1, Math.max(0.5, cut?.ratio ?? 0.75)), width, depth, side: Math.floor(hash(m.x * 3 + m.y) * 3) });
    }
    w.viewsPending = !!got.viewsPending;
    setBusy(false);
    return !!got.pending;
  }, [places]);

  useEffect(() => {
    let cancelled = false, timer = 0;
    void (async () => {
      const [assets, waiting] = await Promise.all([loadAssets(), gather(center, true)]);
      // the streets are still being fetched from the map: ask again for a little while, since each try saves what has come
      let more = waiting;
      for (let i = 0; i < 8 && more && !cancelled; i++) { await new Promise((r) => setTimeout(r, 6000)); more = await gather(center, false); }
      if (cancelled) return;
      const w = world.current;
      // buildings are being re-rendered into their own pieces in the background: look again now and then, and rebuild the street with them when they come
      let tries = 0;
      timer = window.setInterval(() => { if (w.viewsPending && tries++ < 16) { const k = cam.current, o = w.origin; void gather({ lat: o.lat + k.y / mPerDegLat, lng: o.lng + k.x / (mPerDegLat * Math.cos((o.lat * Math.PI) / 180)) }, false); } }, 20000);
      w.assets = assets;
      if (!w.b.length) { setState('none'); return; }
      const c = toMeters(w.origin, center);
      const nr = nearestRoad([...w.roads.values()], c);
      const start = nr ? nr.at : c;
      // looking along the street, the way with more places ahead
      const ahead = (dir: number) => w.b.filter((b) => { const dx = b.x - start.x, dy = b.y - start.y; return nr ? dx * nr.tan.x * dir + dy * nr.tan.y * dir > 0 : true; }).length;
      const dir = nr && ahead(-1) > ahead(1) ? -1 : 1;
      cam.current.x = start.x - (nr ? nr.tan.x * dir * 8 : 0); cam.current.y = start.y - (nr ? nr.tan.y * dir * 8 : 0);
      cam.current.psi = nr ? Math.atan2(nr.tan.x * dir, nr.tan.y * dir) : 0;
      if (import.meta.env.DEV) { (window as unknown as { __sw?: unknown }).__sw = w; (window as unknown as { __swcam?: unknown }).__swcam = cam.current; }
      setState('ready');
    })();
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [center, gather]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (state !== 'ready') return;
    const c = canvas.current as HTMLCanvasElement;
    const ctx = c.getContext('2d') as CanvasRenderingContext2D;
    const w0 = world.current, assets = w0.assets as Assets;
    let raf = 0, last = performance.now(), blocked = 0, lastFetch = { x: cam.current.x, y: cam.current.y };
    // the ground is worked out per pixel at a lower size, then stretched
    const low = document.createElement('canvas');
    const lowCtx = low.getContext('2d') as CanvasRenderingContext2D;
    const surf = document.createElement('canvas'); surf.width = MAP_SIZE; surf.height = MAP_SIZE;
    const sctx = surf.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D;

    /** The map of what the ground is made of (road, sidewalk, earth, and which earth), drawn from the real streets round a point. */
    const buildSurface = (anchor: V) => {
      sctx.fillStyle = 'rgb(0,128,0)'; sctx.fillRect(0, 0, MAP_SIZE, MAP_SIZE);
      for (let i = 0; i < 260; i++) { // patches of different earth
        const px = hash(i * 1.3 + Math.floor(anchor.x / 64)) * MAP_SIZE, py = hash(i * 2.7 + Math.floor(anchor.y / 64)) * MAP_SIZE, rr = (8 + hash(i * 5.1) * 34) * MAP_PX_PER_M;
        sctx.fillStyle = `rgb(0,${Math.floor(hash(i * 9.3) * 255)},0)`; sctx.beginPath(); sctx.arc(px, py, rr, 0, Math.PI * 2); sctx.fill();
      }
      const roads = [...w0.roads.values()];
      const toPx = (p: V): [number, number] => [(p.x - anchor.x) * MAP_PX_PER_M + MAP_SIZE / 2, (anchor.y - p.y) * MAP_PX_PER_M + MAP_SIZE / 2];
      const stroke = (r: Road, widthM: number, color: string, dash?: number[]) => {
        sctx.strokeStyle = color; sctx.lineWidth = widthM * MAP_PX_PER_M; sctx.lineCap = 'butt'; sctx.lineJoin = 'round'; sctx.setLineDash(dash ?? []);
        sctx.beginPath(); r.pts.forEach((p, i) => { const [x, y] = toPx(p); if (i === 0) sctx.moveTo(x, y); else sctx.lineTo(x, y); }); sctx.stroke();
      };
      for (const r of roads) stroke(r, r.w + 6, 'rgb(100,0,0)');
      for (const r of roads) stroke(r, r.w, `rgb(200,${Math.floor(hash(r.id) * 255)},0)`);
      for (const r of roads) if (r.w >= 7) stroke(r, 0.35, 'rgb(200,0,255)', [6, 8]);
      sctx.setLineDash([]);
      w0.surface = { x: anchor.x, y: anchor.y, data: sctx.getImageData(0, 0, MAP_SIZE, MAP_SIZE).data };
      w0.builtVersion = w0.roadsVersion;
    };

    const draw = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      const dpr = window.devicePixelRatio || 1;
      const W = c.clientWidth, H = c.clientHeight;
      if (c.width !== Math.round(W * dpr) || c.height !== Math.round(H * dpr)) { c.width = Math.round(W * dpr); c.height = Math.round(H * dpr); }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const k = cam.current;

      // walking: forward or back along the street, kept on it, and as far as there are mapped places
      const roads = [...w0.roads.values()];
      const want = (keys.current.fwd ? 1 : 0) - (keys.current.back ? 1 : 0);
      k.vel += (want * 7 - k.vel) * Math.min(1, dt * 6);
      if (Math.abs(k.vel) > 0.05) {
        let nx = k.x + Math.sin(k.psi) * k.vel * dt, ny = k.y + Math.cos(k.psi) * k.vel * dt;
        const nr = nearestRoad(roads, { x: nx, y: ny });
        if (nr) {
          // steer along the street (it bends), and keep to its middle part
          const sgn = nr.tan.x * Math.sin(k.psi) + nr.tan.y * Math.cos(k.psi) < 0 ? -1 : 1;
          const target = Math.atan2(nr.tan.x * sgn, nr.tan.y * sgn);
          let dpsi = target - k.psi; dpsi = Math.atan2(Math.sin(dpsi), Math.cos(dpsi));
          k.psi += dpsi * Math.min(1, dt * 3.5);
          const lim = nr.road.w * 0.35;
          if (nr.d > lim) { const pull = (nr.d - lim) / nr.d; nx += (nr.at.x - nx) * pull; ny += (nr.at.y - ny) * pull; }
        }
        if (!w0.b.some((b) => Math.hypot(b.x - nx, b.y - ny) <= FEET_200)) { if (now - blocked > 2500) { blocked = now; say('YOU CANNOT GO THAT WAY: NO DATA YET'); } k.vel = 0; }
        else { k.x = nx; k.y = ny; k.bob += dt * 9; }
      }
      // the next stretch: when the walk has gone a way from where the pictures were last asked for, ask for what is round here
      if (Math.hypot(k.x - lastFetch.x, k.y - lastFetch.y) > 20) {
        lastFetch = { x: k.x, y: k.y };
        const o = w0.origin;
        void gather({ lat: o.lat + k.y / mPerDegLat, lng: o.lng + k.x / (mPerDegLat * Math.cos((o.lat * Math.PI) / 180)) }, false);
      }
      // the ground map is redrawn when the streets change, or the walk has gone a way from its middle
      if (!w0.surface || w0.builtVersion !== w0.roadsVersion || Math.hypot(k.x - w0.surface.x, k.y - w0.surface.y) > 110) buildSurface({ x: k.x, y: k.y });

      const f = Math.min(W * 0.85, H * 0.62), cx = W / 2 + k.look;
      // hills: the lie of the land along the way the walker looks tilts the horizon (up a rise the street climbs the screen, down a slope it falls away)
      const fw0 = { x: Math.sin(k.psi), y: Math.cos(k.psi) };
      const gNow = Math.max(-0.22, Math.min(0.22, (elevAt(w0.elev, { x: k.x + fw0.x * 26, y: k.y + fw0.y * 26 }) - elevAt(w0.elev, { x: k.x, y: k.y })) / 26));
      k.g += (gNow - k.g) * Math.min(1, dt * 2);
      const hy = H * 0.46 + Math.sin(k.bob) * 1.2 - k.g * f * 0.9;
      const fwd = { x: Math.sin(k.psi), y: Math.cos(k.psi) }, right = { x: fwd.y, y: -fwd.x };
      const cam3 = (p: V): [number, number] => { const dx = p.x - k.x, dy = p.y - k.y; return [dx * right.x + dy * right.y, dx * fwd.x + dy * fwd.y]; }; // [sideways, ahead]

      // the sky
      const sky = ctx.createLinearGradient(0, 0, 0, hy);
      sky.addColorStop(0, '#4a463c'); sky.addColorStop(0.55, '#8e7f5e'); sky.addColorStop(1, '#c9a46a');
      ctx.fillStyle = sky; ctx.fillRect(0, 0, W, hy + 2);
      for (let i = 0; i < 6; i++) { const cxx = ((hash(i * 7.1) * 1.4 - 0.2 + k.psi * 0.15) % 1.4) * W; ctx.fillStyle = 'rgba(60,54,44,0.22)'; ctx.beginPath(); ctx.ellipse(cxx, hy * (0.2 + hash(i) * 0.5), W * 0.28, hy * 0.07, 0, 0, Math.PI * 2); ctx.fill(); }

      // the ground: for each pixel below the horizon, where on the map it is and which piece it is
      const RS = 0.5;
      const lw = Math.max(40, Math.floor(W * RS)), lh = Math.max(20, Math.floor((H - hy) * RS));
      if (low.width !== lw || low.height !== lh) { low.width = lw; low.height = lh; }
      const img = lowCtx.createImageData(lw, lh), out = img.data;
      const S = w0.surface, T = assets.tex;
      const fog = [201, 164, 106];
      if (S) {
        const rowH = (H - hy) / lh, colW = W / lw;
        for (let j = 0; j < lh; j++) {
          const sy = hy + (j + 0.5) * rowH;
          const z = (CAM_H * f) / (sy - hy);
          const fogK = Math.min(1, Math.max(0, (z - 12) / (FAR - 12)));
          for (let i = 0; i < lw; i++) {
            const sx = (i + 0.5) * colW;
            const lat = ((sx - cx) / f) * z;
            const wx = k.x + fwd.x * z + right.x * lat, wy = k.y + fwd.y * z + right.y * lat;
            const mx = Math.floor((wx - S.x) * MAP_PX_PER_M + MAP_SIZE / 2), my = Math.floor((S.y - wy) * MAP_PX_PER_M + MAP_SIZE / 2);
            let name = 'dirt', scale = 6, mark = false;
            if (mx >= 0 && my >= 0 && mx < MAP_SIZE && my < MAP_SIZE) {
              const mi = (my * MAP_SIZE + mx) * 4, R = S.data[mi], G = S.data[mi + 1], B = S.data[mi + 2];
              if (R > 150) { name = G > 150 ? 'asphalt2' : 'asphalt'; scale = 5; mark = B > 140; }
              else if (R > 50) { name = 'sidewalk'; scale = 3; }
              else name = G < 85 ? 'dirt2' : G < 170 ? 'dirt' : 'dirt3';
            }
            const tx = T[name]; const o = (j * lw + i) * 4;
            if (!tx) { out[o] = 90; out[o + 1] = 80; out[o + 2] = 60; out[o + 3] = 255; continue; }
            const u = (((wx / scale) % 1) + 1) % 1, v = (((wy / scale) % 1) + 1) % 1;
            const ti = ((Math.floor(v * 512) * 512) + Math.floor(u * 512)) * 4;
            // far away the texture's fine detail would shimmer: it fades to its average
            const mixK = Math.min(1, Math.max(0, (z - 9) / 22));
            let r = tx.data[ti] * (1 - mixK) + tx.mean[0] * mixK, g = tx.data[ti + 1] * (1 - mixK) + tx.mean[1] * mixK, bb = tx.data[ti + 2] * (1 - mixK) + tx.mean[2] * mixK;
            if (mark) { r = r * 0.35 + 215 * 0.65; g = g * 0.35 + 190 * 0.65; bb = bb * 0.35 + 90 * 0.65; }
            out[o] = r * (1 - fogK) + fog[0] * fogK; out[o + 1] = g * (1 - fogK) + fog[1] * fogK; out[o + 2] = bb * (1 - fogK) + fog[2] * fogK; out[o + 3] = 255;
          }
        }
        lowCtx.putImageData(img, 0, 0);
        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(low, 0, hy, W, H - hy);
      }

      // standing things, far to near: the stock pieces on the empty lots, and the buildings
      type Thing = { z: number; draw: () => void };
      const things: Thing[] = [];
      const fogAlpha = (z: number) => Math.max(0.28, Math.min(1, 1.35 - z / FAR));

      // the buildings, as boxes: the picture on the front, generic ruined walls on the sides (each wall in strips, so it has perspective)
      const strips = (src: CanvasImageSource, sw: number, sh: number, A: V, B: V, hM: number, sink = 0, flip = false) => {
        const N = 36;
        for (let i = 0; i < N; i++) {
          const t0 = i / N, t1 = (i + 1) / N;
          const P0 = { x: A.x + (B.x - A.x) * t0, y: A.y + (B.y - A.y) * t0 }, P1 = { x: A.x + (B.x - A.x) * t1, y: A.y + (B.y - A.y) * t1 };
          const [x0, d0] = cam3(P0), [x1, d1] = cam3(P1);
          if (d0 < NEAR && d1 < NEAR) continue;
          const z0c = Math.max(NEAR, d0), z1c = Math.max(NEAR, d1);
          const xa = cx + (x0 / z0c) * f, xb = cx + (x1 / z1c) * f;
          if (xb - xa < 0.2 || xb < 0 || xa > W) continue;
          const zm = (z0c + z1c) / 2, hp = (hM * f) / zm, base = hy + ((CAM_H + sink) * f) / zm;
          ctx.globalAlpha = fogAlpha(zm);
          ctx.drawImage(src, ((flip ? N - 1 - i : i) * sw) / N, 0, sw / N + 0.6, sh, xa, base - hp, xb - xa + 0.7, hp);
        }
        ctx.globalAlpha = 1;
      };
      for (const b of w0.b) {
        const t: V = { x: -b.n.y, y: b.n.x };
        const own = !!(b.vf && b.vs); // re-rendered into its own front and side: a real box of its own size
        const body = own ? (b.fw as number) : b.width * 0.55, hw = body / 2, hd = b.depth / 2, fw = own ? hw : b.width / 2;
        const FL = { x: b.x + b.n.x * hd - t.x * hw, y: b.y + b.n.y * hd - t.y * hw }, FR = { x: b.x + b.n.x * hd + t.x * hw, y: b.y + b.n.y * hd + t.y * hw };
        const BL = { x: b.x - b.n.x * hd - t.x * hw, y: b.y - b.n.y * hd - t.y * hw }, BR = { x: b.x - b.n.x * hd + t.x * hw, y: b.y - b.n.y * hd + t.y * hw };
        // the front: its own front view, or (until it is re-rendered) the whole picture across the front of the lot
        const PL = { x: b.x + b.n.x * hd - t.x * fw, y: b.y + b.n.y * hd - t.y * fw }, PR = { x: b.x + b.n.x * hd + t.x * fw, y: b.y + b.n.y * hd + t.y * fw };
        const [bx, bz] = cam3({ x: b.x, y: b.y });
        if (bz < -b.width || bz > FAR + b.width || Math.abs(bx) > bz + b.width * 2 + 20) continue;
        const hM = own ? (b.fh as number) : b.width * b.ratio, sideH = own ? hM : Math.min(hM * 0.5, b.kind === 'house' || b.kind === 'home' || b.kind === 'address' ? 6.5 : 7.5);
        const sink = own ? 0.12 : hM * 0.05;
        const generic = assets.sprites[b.kind === 'house' || b.kind === 'home' || b.kind === 'address' ? `houseside${b.side + 1}` : 'shopside1'] ?? null;
        const sideImg: CanvasImageSource | null = own ? (b.vs as HTMLCanvasElement) : generic;
        const sideW = own ? (b.vs as HTMLCanvasElement).width : generic?.naturalWidth ?? 1, sideHpx = own ? (b.vs as HTMLCanvasElement).height : generic?.naturalHeight ?? 1;
        const frontImg: CanvasImageSource | null = own ? (b.vf as HTMLCanvasElement) : b.img;
        things.push({ z: Math.max(bz, 0.1) + hd, draw: () => {
          const faces: { A: V; B: V; out: V; img: CanvasImageSource | null; sw: number; sh: number; front: boolean; flip: boolean }[] = [
            { A: BL, B: FL, out: { x: -t.x, y: -t.y }, img: sideImg, sw: sideW, sh: sideHpx, front: false, flip: false },
            { A: FR, B: BR, out: t, img: sideImg, sw: sideW, sh: sideHpx, front: false, flip: own },
            { A: PL, B: PR, out: b.n, img: frontImg, sw: own ? (b.vf as HTMLCanvasElement).width : b.img?.width ?? 1, sh: own ? (b.vf as HTMLCanvasElement).height : b.img?.height ?? 1, front: true, flip: false },
          ];
          for (const fc of faces) {
            const mid = { x: (fc.A.x + fc.B.x) / 2, y: (fc.A.y + fc.B.y) / 2 };
            if ((k.x - mid.x) * fc.out.x + (k.y - mid.y) * fc.out.y <= 0) continue; // turned away from the walker
            if (fc.img) strips(fc.img, fc.sw, fc.sh, fc.A, fc.B, fc.front ? hM : sideH, fc.front ? sink : own ? sink : 0.15, fc.flip);
            else { const [xa, da] = cam3(fc.A), [xb, db] = cam3(fc.B); if (da > NEAR && db > NEAR) { const x0 = cx + (xa / da) * f, x1 = cx + (xb / db) * f, zz = (da + db) / 2, hp = (sideH * f) / zz; ctx.fillStyle = '#4a4338'; ctx.fillRect(Math.min(x0, x1), hy + (CAM_H * f) / zz - hp, Math.abs(x1 - x0), hp); } }
          }
        } });
      }

      // empty lots: patches of debris, bare ground and dead trees, scattered at random (clumps that run up against each other, then bare stretches), never on the road or in a building.
      // Where things go comes from smooth noise (so the density and the kind of thing change slowly over the ground) and from random positions inside small cells (so nothing is in rows).
      const vnoise = (x: number, y: number, sc: number, seed: number): number => {
        const gx = Math.floor(x / sc), gy = Math.floor(y / sc), fx = x / sc - gx, fy = y / sc - gy;
        const sm = (t: number) => t * t * (3 - 2 * t), h = (i: number, j: number) => hash(i * 57.3 + j * 113.9 + seed);
        const u = sm(fx), v = sm(fy);
        return (h(gx, gy) * (1 - u) + h(gx + 1, gy) * u) * (1 - v) + (h(gx, gy + 1) * (1 - u) + h(gx + 1, gy + 1) * u) * v;
      };
      const cell = 4.5;
      const gx0 = Math.floor((k.x - FAR) / cell), gx1 = Math.floor((k.x + FAR) / cell), gy0 = Math.floor((k.y - FAR) / cell), gy1 = Math.floor((k.y + FAR) / cell);
      const surfaceAt = (p: V): number => { if (!S) return 0; const mx = Math.floor((p.x - S.x) * MAP_PX_PER_M + MAP_SIZE / 2), my = Math.floor((S.y - p.y) * MAP_PX_PER_M + MAP_SIZE / 2); return mx < 0 || my < 0 || mx >= MAP_SIZE || my >= MAP_SIZE ? 0 : S.data[(my * MAP_SIZE + mx) * 4]; };
      const BIG = ['rubble1', 'rubble2', 'rubble3', 'rubble4'], FLAT = ['flat1', 'flat2', 'flat3'], STREW = ['scatter2', 'scatter3', 'scatter2', 'flat3'], TREES = ['tree1', 'tree2', 'tree3', 'tree4', 'tree1'];
      for (let gy = gy0; gy <= gy1; gy++) for (let gx = gx0; gx <= gx1; gx++) {
        const cxm = (gx + 0.5) * cell, cym = (gy + 0.5) * cell;
        const dens = vnoise(cxm, cym, 38, 1) * 0.65 + vnoise(cxm, cym, 11, 2) * 0.35; // clumps, with bare gaps between
        if (dens < 0.36) continue;
        const count = dens < 0.5 ? 1 : dens < 0.62 ? 2 : dens < 0.74 ? 3 : 5;
        const zone = vnoise(cxm, cym, 90, 3); // what kind of ground: rubbly, treed, or strewn
        for (let q = 0; q < count; q++) {
          const seed = gx * 73.1 + gy * 191.7 + q * 17.3;
          const p: V = { x: (gx + hash(seed + 1)) * cell, y: (gy + hash(seed + 2)) * cell };
          const [px, pz] = cam3(p);
          if (pz < NEAR + 0.5 || pz > FAR || Math.abs(px) > pz * 1.5 + 6) continue;
          if (w0.b.some((b) => Math.hypot(b.x - p.x, b.y - p.y) < Math.max(b.width, b.depth) * 0.6 + 2)) continue;
          const R = surfaceAt(p), r = hash(seed + 3);
          let name: string;
          if (R > 150) { if (r > 0.07) continue; name = r > 0.035 ? 'car1' : 'car2'; }
          else if (R > 50) { if (r > 0.12) continue; name = r > 0.06 ? 'lamp1' : 'pole1'; }
          else if (zone < 0.33) name = r < 0.12 ? TREES[Math.floor(hash(seed + 4) * TREES.length)] : r < 0.5 ? STREW[Math.floor(hash(seed + 5) * STREW.length)] : r < 0.82 ? FLAT[Math.floor(hash(seed + 6) * FLAT.length)] : BIG[Math.floor(hash(seed + 7) * BIG.length)];
          else if (zone < 0.66) name = r < 0.5 ? BIG[Math.floor(hash(seed + 4) * BIG.length)] : r < 0.8 ? FLAT[Math.floor(hash(seed + 5) * FLAT.length)] : r < 0.92 ? STREW[Math.floor(hash(seed + 6) * STREW.length)] : TREES[Math.floor(hash(seed + 7) * TREES.length)];
          else name = r < 0.45 ? TREES[Math.floor(hash(seed + 4) * TREES.length)] : r < 0.7 ? STREW[Math.floor(hash(seed + 5) * STREW.length)] : r < 0.88 ? FLAT[Math.floor(hash(seed + 6) * FLAT.length)] : BIG[Math.floor(hash(seed + 7) * BIG.length)];
          const sp = assets.sprites[name];
          if (!sp) continue;
          const hM = (SPRITE_H[name] ?? 2) * (0.55 + hash(seed + 8) * 0.95), flip = hash(seed + 9) > 0.5;
          const hp = (hM * f) / pz;
          if (hp < 1.2) continue;
          things.push({ z: pz, draw: () => {
            const wp = hp * (sp.naturalWidth / sp.naturalHeight);
            const sx = cx + (px / pz) * f, base = hy + (CAM_H * f) / pz;
            ctx.globalAlpha = fogAlpha(pz);
            if (flip) { ctx.save(); ctx.translate(sx, 0); ctx.scale(-1, 1); ctx.drawImage(sp, -wp / 2, base - hp, wp, hp); ctx.restore(); } else ctx.drawImage(sp, sx - wp / 2, base - hp, wp, hp);
            ctx.globalAlpha = 1;
          } });
        }
      }
      things.sort((a, b) => b.z - a.z).forEach((t) => t.draw());
      // the haze at the far end of the street
      const hz = ctx.createLinearGradient(0, hy - H * 0.07, 0, hy + H * 0.08);
      hz.addColorStop(0, 'rgba(201,164,106,0)'); hz.addColorStop(0.5, 'rgba(201,164,106,0.5)'); hz.addColorStop(1, 'rgba(201,164,106,0)');
      ctx.fillStyle = hz; ctx.fillRect(0, hy - H * 0.07, W, H * 0.15);
      ctx.fillStyle = 'rgba(0,0,0,0.1)'; for (let y = 0; y < H; y += 4) ctx.fillRect(0, y, W, 1.5);
      const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
      vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.5)'); ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);

      // the name of the nearest place
      let nearest: Building | null = null, nd = 1e9;
      for (const b of w0.b) { const dd = Math.hypot(b.x - k.x, b.y - k.y); if (dd < nd && dd < 35) { nd = dd; nearest = b; } }
      if (nearest) { ctx.font = "22px 'VT323', monospace"; ctx.textAlign = 'center'; ctx.fillStyle = '#e8d58a'; ctx.shadowColor = '#000'; ctx.shadowBlur = 4; ctx.fillText(nearest.name.toUpperCase(), W / 2, H - 92); ctx.shadowBlur = 0; }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [state, gather, say]);

  useEffect(() => {
    const dn = (e: KeyboardEvent) => { if (e.key === 'ArrowUp' || e.key === 'w') keys.current.fwd = true; if (e.key === 'ArrowDown' || e.key === 's') keys.current.back = true; if (e.key === 'Escape') onClose(); };
    const up = (e: KeyboardEvent) => { if (e.key === 'ArrowUp' || e.key === 'w') keys.current.fwd = false; if (e.key === 'ArrowDown' || e.key === 's') keys.current.back = false; };
    window.addEventListener('keydown', dn); window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', dn); window.removeEventListener('keyup', up); };
  }, [onClose]);

  const hold = (dir: 'fwd' | 'back') => ({
    onPointerDown: (e: React.PointerEvent) => { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); keys.current[dir] = true; },
    onPointerUp: () => { keys.current[dir] = false; },
    onPointerCancel: () => { keys.current[dir] = false; },
  });

  return createPortal(
    <div className="rm-sw" role="dialog" aria-label="Street view">
      <canvas ref={canvas} className="rm-sw-canvas"
        onPointerDown={(e) => { dragLook.current = { x: e.clientX, look: cam.current.look }; (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); }}
        onPointerMove={(e) => { const d = dragLook.current; if (d) cam.current.look = Math.max(-420, Math.min(420, d.look + (e.clientX - d.x) * 1.4)); }}
        onPointerUp={() => { dragLook.current = null; }} onPointerCancel={() => { dragLook.current = null; }} />
      <div className="rm-sw-top"><b>STREET VIEW</b><button type="button" className="rm-btn rm-btn-ghost" onClick={onClose}>LEAVE</button></div>
      {state === 'loading' && <div className="rm-sw-center"><CogSpinner big /><p>LOADING</p></div>}
      {state === 'ready' && busy && <div className="rm-sw-busy" aria-live="polite"><CogSpinner /> LOADING</div>}
      {state === 'none' && <div className="rm-sw-center"><p>NO RENDERED PLACE NEAR ENOUGH TO WALK TO FROM HERE.</p><button type="button" className="rm-btn" onClick={onClose}>BACK</button></div>}
      {state === 'error' && <div className="rm-sw-center"><p>THE STREET COULD NOT BE MAPPED RIGHT NOW. TRY AGAIN IN A MOMENT.</p><button type="button" className="rm-btn" onClick={onClose}>BACK</button></div>}
      {flash && <p className="rm-sw-flash" role="status">{flash}</p>}
      {state === 'ready' && (
        <div className="rm-sw-pad">
          <button type="button" className="rm-btn" onClick={() => { cam.current.psi += Math.PI; }} aria-label="Turn around">TURN</button>
          <button type="button" className="rm-btn rm-sw-go" {...hold('back')} aria-label="Walk back">▼</button>
          <button type="button" className="rm-btn rm-sw-go" {...hold('fwd')} aria-label="Walk forward">▲</button>
        </div>
      )}
    </div>,
    document.body,
  );
}
