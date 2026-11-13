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
interface Building extends NeighborItem { x: number; y: number; n: V; img: HTMLCanvasElement | null; ratio: number; width: number; depth: number; sideIdx: number; /** the building as re-rendered: its own front and side, and its size in metres */ vf?: HTMLCanvasElement; vs?: HTMLCanvasElement; fw?: number; fh?: number; sd?: number; /** the colour of the ground at the foot of its picture (street, sidewalk, yard), which the ground in front of it is eased toward */ gc?: [number, number, number]; /** the views of it from different angles (0 front, 35, 65, 90 side; seen from the left), for drawing it as it is seen from where the walker is */ imp?: { ang: number; c: HTMLCanvasElement; asp: number }[] }
interface Tex { data: Uint8ClampedArray; mean: [number, number, number] }
interface Assets { tex: Record<string, Tex>; sprites: Record<string, HTMLImageElement>; /** small copies, for far-off drawing (much cheaper than shrinking the big ones every frame), and the same turned the other way */ small: Record<string, HTMLCanvasElement>; smallFlip: Record<string, HTMLCanvasElement>; sky: HTMLImageElement | null }

const mPerDegLat = 111_320;
const toMeters = (o: { lat: number; lng: number }, p: { lat: number; lng: number }): V => ({ x: (p.lng - o.lng) * mPerDegLat * Math.cos((o.lat * Math.PI) / 180), y: (p.lat - o.lat) * mPerDegLat });
const hash = (n: number): number => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const BASE = import.meta.env.BASE_URL;
const SPRITE_NAMES = ['rubble1', 'rubble2', 'rubble3', 'rubble4', 'tree1', 'tree2', 'tree3', 'car1', 'car2', 'pole1', 'lamp1', 'houseside1', 'houseside2', 'houseside3', 'shopside1', 'flat1', 'flat2', 'flat3', 'scatter2', 'scatter3', 'tree4', 'tree5', 'tree6', 'tree7', 'tree8', 'tree9', 'tree10',
  'swingset1', 'bench1', 'mailbox1', 'carparts1', 'junk1', 'shopcart1', 'hydrant1', 'stopsign1', 'fence1', 'fence2', 'tires1', 'bigpile1', 'bigpile2', 'bigpile3', 'shrub1', 'shrub2', 'shrub3', 'grass1', 'grass2s', 'grass3', 'car3', 'car4', 'car5', 'car7', 'car8', 'car9', 'car10', 'car11', 'car12', 'tree11', 'tree12', 'tree13'];
const TEX_NAMES = ['asphalt', 'asphalt2', 'dirt', 'dirt2', 'dirt3', 'dirt4', 'grass', 'grass2', 'debris1', 'debris2', 'debris3', 'sidewalk'];
/** How tall each stock piece stands, in metres (its width follows its picture). */
const SPRITE_H: Record<string, number> = { rubble1: 2.2, rubble2: 2.2, rubble3: 1.1, rubble4: 2.4, tree1: 6.5, tree2: 4.5, tree3: 1.4, car3: 1.7, car4: 2.4, car5: 3.3, car6: 1.7, car7: 1.7, car8: 1.5, car9: 2.6, car10: 1.8, car11: 1.7, car12: 1.8, tree11: 8, tree12: 6, tree13: 7, tree4: 5, tree5: 9, tree6: 7, tree7: 8, tree8: 4.5, tree9: 6.5, tree10: 3, swingset1: 3, bench1: 1, mailbox1: 1.3, trashcan1: 1.1, carparts1: 1.2, junk1: 1.4, shopcart1: 1, hydrant1: 0.9, stopsign1: 2.8, fence1: 1.8, fence2: 1.2, tires1: 0.8, bigpile1: 1.8, bigpile2: 1.8, bigpile3: 1.8, shrub1: 1.1, shrub2: 1.3, shrub3: 0.9, grass1: 0.9, grass2s: 0.7, grass3: 0.8, flat1: 0.55, flat2: 0.5, flat3: 0.5, scatter2: 0.4, scatter3: 0.7, car1: 1.6, car2: 1.9, pole1: 8, lamp1: 6.5 };

const loadImg = (src: string): Promise<HTMLImageElement | null> => new Promise((res) => { const i = new Image(); i.crossOrigin = 'anonymous'; i.onload = () => res(i); i.onerror = () => res(null); i.src = src; });

async function loadAssets(skyName: string): Promise<Assets> {
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
  const small: Record<string, HTMLCanvasElement> = {}, smallFlip: Record<string, HTMLCanvasElement> = {};
  for (const [n, im] of Object.entries(sprites)) {
    const sc = Math.min(1, 96 / Math.max(im.naturalWidth, im.naturalHeight)), c = document.createElement('canvas');
    c.width = Math.max(2, Math.round(im.naturalWidth * sc)); c.height = Math.max(2, Math.round(im.naturalHeight * sc));
    const x = c.getContext('2d') as CanvasRenderingContext2D; x.imageSmoothingQuality = 'high'; x.drawImage(im, 0, 0, c.width, c.height);
    small[n] = c;
    const cf = document.createElement('canvas'); cf.width = c.width; cf.height = c.height;
    const xf = cf.getContext('2d') as CanvasRenderingContext2D; xf.translate(c.width, 0); xf.scale(-1, 1); xf.drawImage(c, 0, 0);
    smallFlip[n] = cf;
  }
  const sky = await loadImg(`${BASE}street/${skyName}.webp`);
  return { tex, sprites, small, smallFlip, sky };
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
/** How wide a building of this kind is, in metres (its height follows from its picture). */
const WIDTH_OF: Record<string, number> = { house: 11, home: 11, address: 11, medical: 16, office: 16, church: 18, gov: 22, park: 10, place: 24 };
/** The re-rendered pieces of a building loaded and sized: its front and its side, and how big it is. */
async function loadViews(it: NeighborItem): Promise<{ vf: HTMLCanvasElement; vs: HTMLCanvasElement; fw: number; fh: number; sd: number; imp?: { ang: number; c: HTMLCanvasElement; asp: number }[] } | null> {
  if (!it.front || !it.side) return null;
  const [fi, si, q1, q2] = await Promise.all([loadImg(it.front), loadImg(it.side), it.q35 ? loadImg(it.q35) : null, it.q65 ? loadImg(it.q65) : null]);
  const fr = fi ? keyView(fi) : null, sd = si ? keyView(si) : null;
  if (!fr || !sd) return null;
  // its size: how wide a building of its kind is, and the height that follows from its picture
  const fw = WIDTH_OF[it.kind] ?? 12;
  const fh = Math.max(3, Math.min(16, fw / fr.aspect));
  const depth = Math.max(6, Math.min(28, fh * sd.aspect));
  const a1 = q1 ? keyView(q1) : null, a2 = q2 ? keyView(q2) : null;
  const imp = a1 && a2 ? [{ ang: 0, c: fr.canvas, asp: fr.aspect }, { ang: 35, c: a1.canvas, asp: a1.aspect }, { ang: 65, c: a2.canvas, asp: a2.aspect }, { ang: 90, c: sd.canvas, asp: sd.aspect }] : undefined;
  return { vf: fr.canvas, vs: sd.canvas, fw, fh, sd: depth, imp };
}

/** The average colour of the ground at the foot of a building picture (its street, sidewalk and yard), so the real ground can be eased toward it. */
function footColour(c: HTMLCanvasElement): [number, number, number] {
  const x = c.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D;
  const y0 = Math.floor(c.height * 0.86), h = c.height - y0, x0 = Math.floor(c.width * 0.15), w = Math.floor(c.width * 0.7);
  const d = x.getImageData(x0, y0, w, h).data;
  let r = 0, g = 0, b = 0, n = 0;
  for (let i = 0; i < d.length; i += 4 * 5) if (d[i + 3] > 128) { r += d[i]; g += d[i + 1]; b += d[i + 2]; n++; }
  return n > 20 ? [r / n, g / n, b / n] : [120, 110, 90];
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
  return ((g(x0, y0) * (1 - tx) + g(x0 + 1, y0) * tx) * (1 - ty) + (g(x0, y0 + 1) * (1 - tx) + g(x0 + 1, y0 + 1) * tx) * ty) * ELEV_SCALE; // the real hills, eased down (they were too steep at street level)
};
const ELEV_SCALE = 0.4;

/** Smooth value noise at a scale in metres (the same everywhere in the world, so the land is the same on every walk). */
function vnoise(x: number, y: number, sc: number, seed: number): number {
  const gx = Math.floor(x / sc), gy = Math.floor(y / sc), fx = x / sc - gx, fy = y / sc - gy;
  const sm = (t: number) => t * t * (3 - 2 * t), h = (i: number, j: number) => hash(i * 57.3 + j * 113.9 + seed);
  const u = sm(fx), v = sm(fy);
  return (h(gx, gy) * (1 - u) + h(gx + 1, gy) * u) * (1 - v) + (h(gx, gy + 1) * (1 - u) + h(gx + 1, gy + 1) * u) * v;
}
const HM_CELL = 2, HM_N = 256; // the land is kept every 2 metres over 512 metres
interface Land { x: number; y: number; h: Float32Array; pile: Uint8Array; zone: Uint8Array; /** how much of the way to a building's own ground colour (weight, and the colour) */ ap: Uint8Array; ac: Uint8Array }

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

export default function StreetWalk({ center, places, radiated = false, onClose }: { center: { lat: number; lng: number }; places: Place[]; /** the place is under a radiation cloud: the sky is the sickly green one */ radiated?: boolean; onClose: () => void }) {
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
        if ((!have.vf || (!have.imp && it.q35 && it.q65)) && it.front && it.side && !w.loading.has(it.id + '#v')) {
          w.loading.add(it.id + '#v');
          const v = await loadViews(it);
          if (v) { have.vf = v.vf; have.vs = v.vs; have.fw = v.fw; have.fh = v.fh; have.sd = v.sd; have.imp = v.imp; have.width = v.fw; have.depth = v.sd; }
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
      const gc = cut ? footColour(cut.canvas) : undefined;
      w.b.push({ ...it, gc, ...(v ? { vf: v.vf, vs: v.vs, fw: v.fw, fh: v.fh, sd: v.sd, imp: v.imp } : {}), x: m.x, y: m.y, n, img: cut?.canvas ?? null, ratio: Math.min(1.1, Math.max(0.5, cut?.ratio ?? 0.75)), width, depth, sideIdx: Math.floor(hash(m.x * 3 + m.y) * 3) });
    }
    w.viewsPending = !!got.viewsPending;
    setBusy(false);
    return !!got.pending;
  }, [places]);

  useEffect(() => {
    let cancelled = false, timer = 0;
    void (async () => {
      const [assets, waiting] = await Promise.all([loadAssets(`sky-${radiated ? 'fallout' : ['overcast', 'sunset', 'blue', 'blue', 'sunset'][Math.floor(hash(center.lat * 91 + center.lng * 37) * 5)]}${1 + Math.floor(hash(center.lng * 53 + center.lat * 17) * 3)}`), gather(center, true)]);
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
    let builtBuildings = -1;
    let raf = 0, last = performance.now(), blocked = 0, lastFetch = { x: cam.current.x, y: cam.current.y };
    // the ground is worked out per column at a lower size (a heightfield: hills hide what is behind them), then stretched
    const low = document.createElement('canvas');
    const lowCtx = low.getContext('2d') as CanvasRenderingContext2D;
    let lowImg: ImageData | null = null;
    const surf = document.createElement('canvas'); surf.width = MAP_SIZE; surf.height = MAP_SIZE;
    const sctx = surf.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D;
    let land: Land | null = null;
    let hCamS = 0;
    const BINS = 48;
    let occ = new Float32Array(0);

    /** The map of what the ground is made of (road, sidewalk, broken road, earth), drawn from the real streets round a point. R: 0 earth, 100 sidewalk or foundation, 200 road (G which one, B lane mark), 215 crack, 230 missing chunk. */
    const buildSurface = (anchor: V) => {
      sctx.fillStyle = 'rgb(0,0,0)'; sctx.fillRect(0, 0, MAP_SIZE, MAP_SIZE);
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
      // the road is broken here and there: big missing chunks and long cracks, at places that come from the street itself (so they are always in the same spot)
      for (const r of roads) {
        for (let i = 0; i + 1 < r.pts.length; i++) {
          const a = r.pts[i], b = r.pts[i + 1], len = Math.hypot(b.x - a.x, b.y - a.y);
          if (len < 0.5) continue;
          const tx = (b.x - a.x) / len, ty = (b.y - a.y) / len, nx = -ty, ny = tx;
          for (let d = 0; d < len; d += 5) {
            const sd = r.id * 13.7 + i * 7.1 + Math.floor(d / 5) * 3.3, q = hash(sd);
            const lat = (hash(sd + 1) - 0.5) * r.w * 0.9, cxm = a.x + tx * d + nx * lat, cym = a.y + ty * d + ny * lat;
            if (q < 0.07) { // a missing chunk: ragged, bigger near the edge
              const rad = 0.9 + hash(sd + 2) * 2.0, nv = 8;
              sctx.fillStyle = 'rgb(230,0,0)'; sctx.beginPath();
              for (let v = 0; v < nv; v++) { const an = (v / nv) * Math.PI * 2, rr = rad * (0.55 + hash(sd + v * 3.1) * 0.7); const [px, py] = toPx({ x: cxm + Math.cos(an) * rr * 1.3, y: cym + Math.sin(an) * rr }); if (v === 0) sctx.moveTo(px, py); else sctx.lineTo(px, py); }
              sctx.closePath(); sctx.fill();
            } else if (q < 0.2) { // a crack, jagged, long
              sctx.strokeStyle = 'rgb(215,0,0)'; sctx.lineWidth = 1.4; sctx.beginPath();
              let px = cxm, py = cym, an = hash(sd + 3) * Math.PI * 2;
              const [sx0, sy0] = toPx({ x: px, y: py }); sctx.moveTo(sx0, sy0);
              for (let v = 0; v < 8; v++) { an += (hash(sd + v * 5.3) - 0.5) * 1.6; px += Math.cos(an) * 1.3; py += Math.sin(an) * 1.3; const [qx, qy] = toPx({ x: px, y: py }); sctx.lineTo(qx, qy); }
              sctx.stroke();
            }
          }
        }
      }
      // under each building a concrete foundation, so it stands on something
      sctx.fillStyle = 'rgb(100,0,0)';
      for (const b of w0.b) {
        const t: V = { x: -b.n.y, y: b.n.x }, hw = (b.fw ?? b.width * 0.55) / 2 + 1, hd = b.depth / 2 + 1;
        sctx.beginPath();
        for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { const [px, py] = toPx({ x: b.x + t.x * hw * sx + b.n.x * hd * sy, y: b.y + t.y * hw * sx + b.n.y * hd * sy }); if (sx === -1 && sy === -1) sctx.moveTo(px, py); else sctx.lineTo(px, py); }
        sctx.closePath(); sctx.fill();
      }
      w0.surface = { x: anchor.x, y: anchor.y, data: sctx.getImageData(0, 0, MAP_SIZE, MAP_SIZE).data };
      w0.builtVersion = w0.roadsVersion;
      buildLand(anchor);
    };
    const surfaceR = (p: V): number => { const S = w0.surface; if (!S) return 0; const mx = Math.floor((p.x - S.x) * MAP_PX_PER_M + MAP_SIZE / 2), my = Math.floor((S.y - p.y) * MAP_PX_PER_M + MAP_SIZE / 2); return mx < 0 || my < 0 || mx >= MAP_SIZE || my >= MAP_SIZE ? 0 : S.data[(my * MAP_SIZE + mx) * 4]; };

    /** The lie of the land round a point: the real heights of the place (coarse), plus rolling ground and big mounds of debris, all flattened along the streets and under the buildings. */
    const buildLand = (anchor: V) => {
      const N = HM_N, h = new Float32Array(N * N), pile = new Uint8Array(N * N), zone = new Uint8Array(N * N), flat = new Float32Array(N * N), ap = new Uint8Array(N * N), ac = new Uint8Array(N * N * 3);
      const e0h = elevAt(w0.elev, anchor);
      const pos = (i: number, j: number): V => ({ x: anchor.x + (i - N / 2 + 0.5) * HM_CELL, y: anchor.y + (j - N / 2 + 0.5) * HM_CELL });
      for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { if (surfaceR(pos(i, j)) > 50) flat[j * N + i] = 1; }
      for (const b of w0.b) { // flat under and round each building
        const rad = Math.max(b.width, b.depth) * 0.75 + 3;
        const i0 = Math.max(0, Math.floor((b.x - rad - anchor.x) / HM_CELL + N / 2)), i1 = Math.min(N - 1, Math.ceil((b.x + rad - anchor.x) / HM_CELL + N / 2));
        const j0 = Math.max(0, Math.floor((b.y - rad - anchor.y) / HM_CELL + N / 2)), j1 = Math.min(N - 1, Math.ceil((b.y + rad - anchor.y) / HM_CELL + N / 2));
        for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { const p = pos(i, j); if (Math.hypot(p.x - b.x, p.y - b.y) < rad) flat[j * N + i] = 1; }
      }
      // soften the flat areas outward (a box blur, twice) so the ground eases from the street into the rolling land
      const tmp = new Float32Array(N * N), R = 3;
      for (let pass = 0; pass < 2; pass++) {
        for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { let a = 0; for (let d = -R; d <= R; d++) a += flat[j * N + Math.min(N - 1, Math.max(0, i + d))]; tmp[j * N + i] = a / (2 * R + 1); }
        for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { let a = 0; for (let d = -R; d <= R; d++) a += tmp[Math.min(N - 1, Math.max(0, j + d)) * N + i]; flat[j * N + i] = a / (2 * R + 1); }
      }
      for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
        const p = pos(i, j), idx = j * N + i;
        const fl = Math.min(1, flat[idx] * 1.6);
        const roll = (vnoise(p.x, p.y, 70, 21) - 0.5) * 3.4 + (vnoise(p.x, p.y, 26, 22) - 0.5) * 1.4 + (vnoise(p.x, p.y, 9, 23) - 0.5) * 0.45;
        const pv = vnoise(p.x, p.y, 55, 11) * 0.7 + vnoise(p.x, p.y, 17, 12) * 0.3;
        let P = Math.max(0, Math.min(1, (pv - 0.5) / 0.2)); P = P * P * (3 - 2 * P);
        const mound = P * (0.35 + vnoise(p.x, p.y, 8, 13) * 1.15);
        h[idx] = elevAt(w0.elev, p) - e0h + (1 - fl) * (roll + mound);
        pile[idx] = Math.round(P * (1 - fl) * 255);
        zone[idx] = Math.round(vnoise(p.x, p.y, 80, 14) * 255);
      }
      // in front of and round each building the ground takes the colour of the foot of its picture (the sidewalk and yard of the render), fading out into the ground of the street
      for (const b of w0.b) {
        if (!b.gc) continue;
        const t: V = { x: -b.n.y, y: b.n.x }, hw = (b.fw ?? b.width * 0.55) / 2 + 3, hd = b.depth / 2;
        const rad = Math.hypot(hw, hd + 3) + 2;
        const i0 = Math.max(0, Math.floor((b.x - rad - anchor.x) / HM_CELL + N / 2)), i1 = Math.min(N - 1, Math.ceil((b.x + rad - anchor.x) / HM_CELL + N / 2));
        const j0 = Math.max(0, Math.floor((b.y - rad - anchor.y) / HM_CELL + N / 2)), j1 = Math.min(N - 1, Math.ceil((b.y + rad - anchor.y) / HM_CELL + N / 2));
        for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
          const p = pos(i, j), dx = p.x - b.x, dy = p.y - b.y, u = Math.abs(dx * t.x + dy * t.y), v = dx * b.n.x + dy * b.n.y; // across the front, and toward the street
          const wu = Math.max(0, Math.min(1, (hw - u) / 4)), wv = v < -hd ? Math.max(0, 1 + (v + hd) / 3) : Math.max(0, Math.min(1, (hd + 2.5 - v) / 3));
          const wgt = Math.round(255 * wu * wv * 0.6);
          if (wgt > ap[j * N + i]) { ap[j * N + i] = wgt; ac[(j * N + i) * 3] = b.gc[0]; ac[(j * N + i) * 3 + 1] = b.gc[1]; ac[(j * N + i) * 3 + 2] = b.gc[2]; }
        }
      }
      land = { x: anchor.x, y: anchor.y, h, pile, zone, ap, ac };
    };
    const heightAt = (p: V): number => {
      const L = land;
      if (!L) return 0;
      const gx = (p.x - L.x) / HM_CELL + HM_N / 2 - 0.5, gy = (p.y - L.y) / HM_CELL + HM_N / 2 - 0.5;
      if (gx < 0 || gy < 0 || gx >= HM_N - 1 || gy >= HM_N - 1) return elevAt(w0.elev, p) - elevAt(w0.elev, { x: L.x, y: L.y });
      const x0 = Math.floor(gx), y0 = Math.floor(gy), tx = gx - x0, ty = gy - y0, i = y0 * HM_N + x0;
      return (L.h[i] * (1 - tx) + L.h[i + 1] * tx) * (1 - ty) + (L.h[i + HM_N] * (1 - tx) + L.h[i + HM_N + 1] * tx) * ty;
    };
    const GROUND = ['dirt2', 'dirt', 'dirt4', 'dirt3', 'grass', 'grass2'];
    const DEBRIS = ['debris2', 'debris1', 'debris3'];

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
      if (!w0.surface || !land || w0.builtVersion !== w0.roadsVersion || w0.b.length !== builtBuildings || Math.hypot(k.x - w0.surface.x, k.y - w0.surface.y) > 110) { buildSurface({ x: k.x, y: k.y }); builtBuildings = w0.b.length; }
      const hCam = heightAt({ x: k.x, y: k.y });
      hCamS += (hCam - hCamS) * Math.min(1, dt * 8);
      const camZ = hCamS + CAM_H;

      const f = Math.min(W * 0.85, H * 0.62), cx = W / 2 + k.look;
      const hy = H * 0.46 + Math.sin(k.bob) * 1.2;
      const fwd = { x: Math.sin(k.psi), y: Math.cos(k.psi) }, right = { x: fwd.y, y: -fwd.x };
      const cam3 = (p: V): [number, number] => { const dx = p.x - k.x, dy = p.y - k.y; return [dx * right.x + dy * right.y, dx * fwd.x + dy * fwd.y]; }; // [sideways, ahead]

      // the sky: a rendered one that stays put as the walker turns (it is wrapped round the walker, half a turn to the picture), then the haze of the horizon over its foot
      const sky = ctx.createLinearGradient(0, 0, 0, hy);
      sky.addColorStop(0, '#4a463c'); sky.addColorStop(0.55, '#8e7f5e'); sky.addColorStop(1, '#c9a46a');
      ctx.fillStyle = sky; ctx.fillRect(0, 0, W, hy + 2);
      if (assets.sky) {
        const sw = Math.PI * f, sh = Math.max(hy + 30, sw * (assets.sky.naturalHeight / assets.sky.naturalWidth));
        let x0 = cx - ((k.psi * f) % sw); x0 -= Math.ceil((x0 + sw) / sw) * sw; // start left of the screen
        for (let x = x0; x < W + sw; x += sw) ctx.drawImage(assets.sky, x, hy + 6 - sh, sw + 1, sh);
      }

      // the ground: a heightfield, worked out column by column from the walker outward (what is nearer hides what is behind it: hills do hide things)
      const RS = W > 900 ? 0.4 : 0.5;
      const lw = Math.max(40, Math.floor(W * RS)), lh = Math.max(40, Math.floor(H * RS));
      if (low.width !== lw || low.height !== lh) { low.width = lw; low.height = lh; lowImg = null; }
      if (!lowImg) lowImg = lowCtx.createImageData(lw, lh);
      const out = lowImg.data; out.fill(0);
      if (occ.length < lw * BINS) occ = new Float32Array(lw * BINS);
      const S = w0.surface, T = assets.tex, L = land;
      const fog = [201, 164, 106];
      const colW = W / lw, rowH = H / lh;
      const SC0 = new Float64Array(3), SC1 = new Float64Array(3), SC2 = new Float64Array(3);
      const sample = (tx: Tex | undefined, wx: number, wy: number, scale: number, z: number, o: Float64Array): void => {
        if (!tx) { o[0] = 100; o[1] = 90; o[2] = 70; return; }
        const u = (((wx / scale) % 1) + 1) % 1, v = (((wy / scale) % 1) + 1) % 1;
        const ti = ((Math.floor(v * 512) * 512) + Math.floor(u * 512)) * 4;
        const mixK = Math.min(1, Math.max(0, (z - 9) / 22)); // far away the texture's fine detail would shimmer: it fades to its average
        o[0] = tx.data[ti] * (1 - mixK) + tx.mean[0] * mixK; o[1] = tx.data[ti + 1] * (1 - mixK) + tx.mean[1] * mixK; o[2] = tx.data[ti + 2] * (1 - mixK) + tx.mean[2] * mixK;
      };
      if (S && L) {
        for (let ci = 0; ci < lw; ci++) {
          const u = ((ci + 0.5) * colW - cx) / f, dxr = fwd.x + right.x * u, dyr = fwd.y + right.y * u;
          let ytop = lh, z = 0.4, binDone = 0;
          while (z < FAR) {
            const bi = Math.min(BINS - 1, Math.floor(z / 2));
            while (binDone <= bi) { occ[ci * BINS + binDone] = ytop * rowH; binDone++; }
            const wx = k.x + dxr * z, wy = k.y + dyr * z;
            const gx = (wx - L.x) / HM_CELL + HM_N / 2 - 0.5, gy = (wy - L.y) / HM_CELL + HM_N / 2 - 0.5;
            let hh: number, pileV = 0, zoneV = 0.4, apV = 0, apI = 0;
            if (gx < 0 || gy < 0 || gx >= HM_N - 1 || gy >= HM_N - 1) hh = elevAt(w0.elev, { x: wx, y: wy }) - elevAt(w0.elev, { x: L.x, y: L.y });
            else {
              const x0 = Math.floor(gx), y0 = Math.floor(gy), tx = gx - x0, ty = gy - y0, ii = y0 * HM_N + x0;
              hh = (L.h[ii] * (1 - tx) + L.h[ii + 1] * tx) * (1 - ty) + (L.h[ii + HM_N] * (1 - tx) + L.h[ii + HM_N + 1] * tx) * ty;
              pileV = L.pile[ii] / 255; zoneV = L.zone[ii] / 255; apV = L.ap[ii] / 255; apI = ii * 3;
            }
            const sy = hy + ((camZ - hh) * f) / z;
            const j = Math.floor(sy / rowH);
            if (j < ytop) {
              // which piece of ground it is
              const mx = Math.floor((wx - S.x) * MAP_PX_PER_M + MAP_SIZE / 2), my = Math.floor((S.y - wy) * MAP_PX_PER_M + MAP_SIZE / 2);
              let r = 100, g = 90, b = 70;
              let R = 0, B = 0, G = 0;
              if (mx >= 0 && my >= 0 && mx < MAP_SIZE && my < MAP_SIZE) { const mi = (my * MAP_SIZE + mx) * 4; R = S.data[mi]; G = S.data[mi + 1]; B = S.data[mi + 2]; }
              if (R >= 225) { sample(T.dirt2 ?? T.dirt, wx, wy, 4, z, SC0); r = SC0[0] * 0.7; g = SC0[1] * 0.68; b = SC0[2] * 0.66; }
              else if (R >= 210) { sample(T.asphalt, wx, wy, 5, z, SC0); r = SC0[0] * 0.4; g = SC0[1] * 0.4; b = SC0[2] * 0.4; }
              else if (R > 150) { sample(G > 150 ? T.asphalt2 : T.asphalt, wx, wy, 5, z, SC0); r = SC0[0]; g = SC0[1]; b = SC0[2]; if (B > 140) { r = r * 0.35 + 215 * 0.65; g = g * 0.35 + 190 * 0.65; b = b * 0.35 + 90 * 0.65; } }
              else if (R > 50) { sample(T.sidewalk, wx, wy, 3, z, SC0); r = SC0[0]; g = SC0[1]; b = SC0[2]; }
              else {
                // earth: the kind changes over the land (dust, red clay, scorched, grass, overgrowth), blended where they meet
                const pos = zoneV * (GROUND.length - 1), i0 = Math.min(GROUND.length - 2, Math.floor(pos)), ft = pos - i0, sm = ft * ft * (3 - 2 * ft);
                sample(T[GROUND[i0]] ?? T.dirt, wx, wy, GROUND[i0].startsWith('grass') ? 4 : 6, z, SC0); sample(T[GROUND[i0 + 1]] ?? T.dirt, wx, wy, GROUND[i0 + 1].startsWith('grass') ? 4 : 6, z, SC1); const c0 = SC0, c1 = SC1;
                r = c0[0] * (1 - sm) + c1[0] * sm; g = c0[1] * (1 - sm) + c1[1] * sm; b = c0[2] * (1 - sm) + c1[2] * sm;
                if (pileV > 0.08) { // a mound of debris
                  const dk = DEBRIS[Math.min(2, Math.floor(((zoneV * 7.3) % 1) * 3))]; sample(T[dk] ?? T.dirt2, wx, wy, 3.2, z, SC2); const cd = SC2, pk = Math.min(1, pileV * 1.6);
                  r = r * (1 - pk) + cd[0] * pk; g = g * (1 - pk) + cd[1] * pk; b = b * (1 - pk) + cd[2] * pk;
                }
              }
              if (R <= 150 && apV > 0.02) { // eased toward the colour of the ground in the building's own picture (it keeps some of its own detail)
                const lum = (r + g + b) / 3, keep = 0.55 + 0.45 * Math.min(1.6, lum / 110);
                r = r * (1 - apV) + L.ac[apI] * keep * apV; g = g * (1 - apV) + L.ac[apI + 1] * keep * apV; b = b * (1 - apV) + L.ac[apI + 2] * keep * apV;
              }
              const fogK = Math.min(1, Math.max(0, (z - 12) / (FAR - 12)));
              r = r * (1 - fogK) + fog[0] * fogK; g = g * (1 - fogK) + fog[1] * fogK; b = b * (1 - fogK) + fog[2] * fogK;
              const jj = Math.max(0, j);
              for (let rr = jj; rr < ytop; rr++) { const o = (rr * lw + ci) * 4; out[o] = r; out[o + 1] = g; out[o + 2] = b; out[o + 3] = 255; }
              ytop = jj;
              if (ytop === 0) break;
            }
            z += z < 8 ? Math.max(0.015, z * 0.012) : z * 0.017;
          }
          while (binDone < BINS) { occ[ci * BINS + binDone] = ytop * rowH; binDone++; }
        }
        lowCtx.putImageData(lowImg, 0, 0);
        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(low, 0, 0, W, H);
      }
      /** The screen row below which the ground in front hides things at this distance and sideways position (so a hill hides what is behind it). */
      const occAt = (px: number, pz: number): number => { const ci = Math.max(0, Math.min(lw - 1, Math.floor((cx + (px / pz) * f) / colW))); return occ[ci * BINS + Math.min(BINS - 1, Math.floor(pz / 2))] ?? H; };

      // the haze at the far end of the street (behind the standing things, so what is near stays clear)
      const hz = ctx.createLinearGradient(0, hy - H * 0.07, 0, hy + H * 0.08);
      hz.addColorStop(0, 'rgba(201,164,106,0)'); hz.addColorStop(0.5, 'rgba(201,164,106,0.5)'); hz.addColorStop(1, 'rgba(201,164,106,0)');
      ctx.fillStyle = hz; ctx.fillRect(0, hy - H * 0.07, W, H * 0.15);

      // standing things, far to near: the stock pieces on the empty lots, and the buildings
      type Thing = { z: number; draw: () => void };
      const things: Thing[] = [];
      const fogAlpha = (z: number) => Math.max(0.28, Math.min(1, 1.35 - z / FAR));

      // the buildings, as boxes: the picture on the front, generic ruined walls on the sides (each wall in strips, so it has perspective)
      const strips = (src: CanvasImageSource, sw: number, sh: number, A: V, B: V, hM: number, sink = 0, flip = false, drop = CAM_H) => {
        const N = 64;
        for (let i = 0; i < N; i++) {
          const t0 = i / N, t1 = (i + 1) / N;
          const P0 = { x: A.x + (B.x - A.x) * t0, y: A.y + (B.y - A.y) * t0 }, P1 = { x: A.x + (B.x - A.x) * t1, y: A.y + (B.y - A.y) * t1 };
          const [x0, d0] = cam3(P0), [x1, d1] = cam3(P1);
          if (d0 < NEAR && d1 < NEAR) continue;
          const z0c = Math.max(NEAR, d0), z1c = Math.max(NEAR, d1);
          const xa = cx + (x0 / z0c) * f, xb = cx + (x1 / z1c) * f;
          if (xb - xa < 0.2 || xb < 0 || xa > W) continue;
          // each strip is a narrow slanted piece of the picture: its top and foot follow the perspective along the wall (no steps)
          const hp0 = (hM * f) / z0c, hp1 = (hM * f) / z1c, b0 = hy + ((drop + sink) * f) / z0c, b1 = hy + ((drop + sink) * f) / z1c;
          const topL = b0 - hp0, topR = b1 - hp1, dx = xb - xa + 0.7, srcX = ((flip ? N - 1 - i : i) * sw) / N, srcW = sw / N + 0.6;
          ctx.globalAlpha = fogAlpha((z0c + z1c) / 2);
          ctx.save();
          ctx.transform(dx / srcW, (topR - topL) / srcW, 0, (hp0 + hp1) / 2 / sh, xa, topL);
          ctx.drawImage(src, srcX, 0, srcW, sh, 0, 0, srcW, sh);
          ctx.restore();
        }
        ctx.globalAlpha = 1;
      };

      for (const b of w0.b) {
        if (b.imp) { // the picture of the building from the angle it is seen at (two views blended, mirrored for the right-hand side): a real look at it from here, not a flat picture skewed
          const t: V = { x: -b.n.y, y: b.n.x };
          const dxc = k.x - b.x, dyc = k.y - b.y, dl = Math.hypot(dxc, dyc) || 1;
          const cosN = (dxc * b.n.x + dyc * b.n.y) / dl, sideS = (dxc * t.x + dyc * t.y) / dl; // facing it, and which side of it the walker is on (negative: the left)
          const th = Math.min(90, (Math.atan2(Math.abs(sideS), cosN) * 180) / Math.PI), mirror = sideS > 0;
          const imp = b.imp;
          let vi = 0; while (vi < imp.length - 2 && th >= imp[vi + 1].ang) vi++;
          const VA = imp[vi], VB = imp[vi + 1], tt = (th - VA.ang) / (VB.ang - VA.ang), mix = Math.max(0, Math.min(1, (tt - 0.35) / 0.3));
          const Q: V = { x: b.x + b.n.x * b.depth * 0.3 * Math.max(0, cosN), y: b.y + b.n.y * b.depth * 0.3 * Math.max(0, cosN) };
          const [qx, qz] = cam3(Q);
          if (qz < NEAR + 0.5 || qz > FAR + 20 || Math.abs(qx) > qz * 1.5 + (b.fw ?? 12)) continue;
          const hM = b.fh as number, drop = camZ - heightAt(Q);
          const hp = (hM * f) / qz, base = hy + ((drop + 0.22) * f) / qz, sx = cx + (qx / qz) * f, oy = occAt(qx, qz);
          if (base - hp > oy + 2) continue; // behind a hill
          things.push({ z: qz, draw: () => {
            ctx.save();
            if (base > oy) { ctx.beginPath(); ctx.rect(0, 0, W, oy); ctx.clip(); }
            // it sits on the ground: a soft shadow under it
            const sh = ctx.createRadialGradient(sx, base - hp * 0.01, 1, sx, base - hp * 0.01, Math.max(4, hp * VA.asp * 0.62));
            sh.addColorStop(0, 'rgba(18,12,6,0.5)'); sh.addColorStop(1, 'rgba(18,12,6,0)');
            ctx.save(); ctx.translate(0, base - hp * 0.01); ctx.scale(1, 0.14); ctx.translate(0, -(base - hp * 0.01)); ctx.fillStyle = sh; ctx.fillRect(sx - hp * VA.asp, base - hp * 0.01 - hp * VA.asp, hp * VA.asp * 2, hp * VA.asp * 2); ctx.restore();
            const put = (v: { c: HTMLCanvasElement; asp: number }, alpha: number) => {
              const wp = hp * v.asp;
              ctx.globalAlpha = fogAlpha(qz) * alpha;
              if (mirror) { ctx.save(); ctx.translate(sx, 0); ctx.scale(-1, 1); ctx.drawImage(v.c, -wp / 2, base - hp, wp, hp); ctx.restore(); } else ctx.drawImage(v.c, sx - wp / 2, base - hp, wp, hp);
            };
            put(VA, 1);
            if (mix > 0.02) put(VB, mix);
            ctx.restore();
          } });
          continue;
        }
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
        const drop = camZ - heightAt({ x: b.x + b.n.x * hd, y: b.y + b.n.y * hd });
        const generic = assets.sprites[b.kind === 'house' || b.kind === 'home' || b.kind === 'address' ? `houseside${b.sideIdx + 1}` : 'shopside1'] ?? null;
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
            if (fc.img) strips(fc.img, fc.sw, fc.sh, fc.A, fc.B, fc.front ? hM : sideH, fc.front ? sink : own ? sink : 0.15, fc.flip, drop);
            else { const [xa, da] = cam3(fc.A), [xb, db] = cam3(fc.B); if (da > NEAR && db > NEAR) { const x0 = cx + (xa / da) * f, x1 = cx + (xb / db) * f, zz = (da + db) / 2, hp = (sideH * f) / zz; ctx.fillStyle = '#4a4338'; ctx.fillRect(Math.min(x0, x1), hy + (drop * f) / zz - hp, Math.abs(x1 - x0), hp); } }
          }
        } });
      }

      // empty lots: scattered at random, in clumps that run up against each other with bare stretches between, never on the road or in a building. Where things go comes from smooth
      // noise over the whole world (so the density and the kind of ground change slowly, and the same walk always sees the same land) and random positions inside small cells (so nothing is in rows).
      const cell = 4.5;
      const gx0 = Math.floor((k.x - FAR) / cell), gx1 = Math.floor((k.x + FAR) / cell), gy0 = Math.floor((k.y - FAR) / cell), gy1 = Math.floor((k.y + FAR) / cell);
      const have = (names: string[]) => names.filter((n) => assets.sprites[n]);
      const CARS = have(['car1', 'car2', 'car3', 'car4', 'car5', 'car7', 'car8', 'car9', 'car10', 'car11', 'car12']);
      const TREES = have(['tree1', 'tree2', 'tree3', 'tree4', 'tree5', 'tree6', 'tree7', 'tree8', 'tree9', 'tree10', 'tree11', 'tree12', 'tree13']), SHRUBS = have(['shrub1', 'shrub2', 'shrub3']), GRASS = have(['grass2s', 'grass3', 'grass2s']);
      const BIG = have(['rubble1', 'rubble2', 'rubble3', 'rubble4']), PILES = have(['bigpile1', 'bigpile2', 'bigpile3']), FLAT = have(['flat1', 'flat2', 'flat3']), STREW = have(['scatter2', 'scatter3', 'scatter2', 'flat3']);
      const JUNK = have(['swingset1', 'bench1', 'mailbox1', 'trashcan1', 'carparts1', 'junk1', 'shopcart1', 'tires1', 'fence1', 'fence2', 'junk1', 'carparts1']);
      const pick = (a: string[], q: number): string => (a.length ? a[Math.floor(q * a.length) % a.length] : '');
      for (let gy = gy0; gy <= gy1; gy++) for (let gx = gx0; gx <= gx1; gx++) {
        const cxm = (gx + 0.5) * cell, cym = (gy + 0.5) * cell;
        const pv = vnoise(cxm, cym, 55, 11) * 0.7 + vnoise(cxm, cym, 17, 12) * 0.3; // the same noise as the mounds of the land
        const dens = vnoise(cxm, cym, 38, 1) * 0.65 + vnoise(cxm, cym, 11, 2) * 0.35 + (pv > 0.5 ? 0.25 : 0);
        if (dens < 0.34) continue;
        const count = dens < 0.5 ? 1 : dens < 0.62 ? 2 : dens < 0.74 ? 3 : 5;
        const zone = vnoise(cxm, cym, 90, 3);
        for (let q = 0; q < count; q++) {
          const seed = gx * 73.1 + gy * 191.7 + q * 17.3;
          const p: V = { x: (gx + hash(seed + 1)) * cell, y: (gy + hash(seed + 2)) * cell };
          const [px, pz] = cam3(p);
          if (pz < NEAR + 0.5 || pz > FAR || Math.abs(px) > pz * 1.5 + 6) continue;
          if (w0.b.some((b) => Math.hypot(b.x - p.x, b.y - p.y) < Math.max(b.width, b.depth) * 0.6 + 2)) continue;
          const R = surfaceR(p), r = hash(seed + 3), q2 = hash(seed + 4);
          let name = '';
          if (R > 150) { if (r > 0.08) continue; name = r > 0.03 ? pick(CARS, q2) : pick(['tires1', 'carparts1'], q2); }
          else if (R > 50) { if (r > 0.14) continue; name = r > 0.1 ? pick(['lamp1', 'pole1'], q2) : pick(['hydrant1', 'mailbox1', 'bench1', 'trashcan1', 'stopsign1'], q2); }
          else if (pv > 0.5 && r < 0.4) name = pick(r < 0.15 ? PILES : r < 0.3 ? BIG : JUNK, q2); // on a mound: heaps and junk
          else if (zone < 0.33) name = r < 0.1 ? pick(TREES, q2) : r < 0.3 ? pick(SHRUBS, q2) : r < 0.5 ? pick(GRASS, q2) : r < 0.72 ? pick(STREW, q2) : r < 0.9 ? pick(FLAT, q2) : pick(BIG, q2);
          else if (zone < 0.66) name = r < 0.28 ? pick(BIG, q2) : r < 0.42 ? pick(PILES, q2) : r < 0.58 ? pick(JUNK, q2) : r < 0.74 ? pick(FLAT, q2) : r < 0.86 ? pick(STREW, q2) : r < 0.93 ? pick(GRASS, q2) : pick(TREES, q2);
          else name = r < 0.32 ? pick(TREES, q2) : r < 0.55 ? pick(SHRUBS, q2) : r < 0.78 ? pick(GRASS, q2) : r < 0.88 ? pick(STREW, q2) : r < 0.95 ? pick(FLAT, q2) : pick(JUNK, q2);
          const sp = name ? assets.sprites[name] : null;
          if (!sp) continue;
          const hM = (SPRITE_H[name] ?? 2) * (0.55 + hash(seed + 8) * 0.95), flip = hash(seed + 9) > 0.5;
          const hp = (hM * f) / pz;
          if (hp < 2.5) continue;
          const gH = heightAt(p), base = hy + ((camZ - gH) * f) / pz, oy = occAt(px, pz);
          if (base - hp > oy + 2) continue; // behind a hill
          things.push({ z: pz, draw: () => {
            const wp = hp * (sp.naturalWidth / sp.naturalHeight);
            const sx = cx + (px / pz) * f;
            const far = hp * dpr < 110, img = far ? (flip ? assets.smallFlip[name] : assets.small[name]) ?? sp : sp; // a far copy faces the same way as the near one (it is turned too)
            const clipped = base > oy;
            if (clipped || (flip && !far)) ctx.save();
            if (clipped) { ctx.beginPath(); ctx.rect(0, 0, W, oy); ctx.clip(); }
            ctx.globalAlpha = fogAlpha(pz);
            if (flip && !far) { ctx.translate(sx, 0); ctx.scale(-1, 1); ctx.drawImage(img, -wp / 2, base - hp, wp, hp); } else ctx.drawImage(img, sx - wp / 2, base - hp, wp, hp);
            if (clipped || (flip && !far)) ctx.restore(); else ctx.globalAlpha = 1;
          } });
        }
      }
      things.sort((a, b) => b.z - a.z).forEach((t) => t.draw());
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
