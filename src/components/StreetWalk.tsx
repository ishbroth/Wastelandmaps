// Our own street view: walk down a street that has been rendered as it is after the bombs. It is not Google's: the finished pictures that people unlocked (and, for a person who
// bought the atlas, the addresses others rendered in that metro) are cut to the building, set along a cracked road where their addresses really lie, seen in perspective
// from the street, and the lots that nobody has mapped are empty wasteland and rubble. The street can go on only while another mapped place is within 200 feet of the last.

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { loadNeighborhood, type NeighborItem } from '../lib/account';

const FEET_200 = 61; // metres
const CAM_H = 1.7;
const ROAD_HALF = 5.2;
const NEAR = 1.6;
const FAR = 75;

interface Place { id: string; lat: number; lng: number; name: string }
interface Building extends NeighborItem { s: number; t: number; img: HTMLCanvasElement | null; ratio: number; width: number }

const mPerDegLat = 111_320;
const toMeters = (o: { lat: number; lng: number }, p: { lat: number; lng: number }): { x: number; y: number } => ({ x: (p.lng - o.lng) * mPerDegLat * Math.cos((o.lat * Math.PI) / 180), y: (p.lat - o.lat) * mPerDegLat });
const toLatLng = (o: { lat: number; lng: number }, x: number, y: number): { lat: number; lng: number } => ({ lat: o.lat + y / mPerDegLat, lng: o.lng + x / (mPerDegLat * Math.cos((o.lat * Math.PI) / 180)) });
const hash = (n: number): number => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

/** A picture cut to its middle (where the building is), with its sides and its foot faded out so it can sit beside the next one and on the ground. */
function cutOut(img: HTMLImageElement): { canvas: HTMLCanvasElement; ratio: number } {
  const w = img.naturalWidth, h = img.naturalHeight;
  const sx = w * 0.16, sw = w * 0.68;
  const c = document.createElement('canvas');
  c.width = 512; c.height = Math.max(64, Math.round(512 * (h / sw)));
  const x = c.getContext('2d') as CanvasRenderingContext2D;
  x.drawImage(img, sx, 0, sw, h, 0, 0, c.width, c.height);
  x.globalCompositeOperation = 'destination-in';
  const gh = x.createLinearGradient(0, 0, c.width, 0);
  gh.addColorStop(0, 'rgba(0,0,0,0)'); gh.addColorStop(0.1, 'rgba(0,0,0,1)'); gh.addColorStop(0.9, 'rgba(0,0,0,1)'); gh.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = gh; x.fillRect(0, 0, c.width, c.height);
  const gv = x.createLinearGradient(0, 0, 0, c.height);
  gv.addColorStop(0, 'rgba(0,0,0,1)'); gv.addColorStop(0.9, 'rgba(0,0,0,1)'); gv.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = gv; x.fillRect(0, 0, c.width, c.height);
  return { canvas: c, ratio: c.height / c.width };
}

const loadImg = (src: string): Promise<HTMLImageElement | null> => new Promise((res) => { const i = new Image(); i.crossOrigin = 'anonymous'; i.onload = () => res(i); i.onerror = () => res(null); i.src = src; });

export default function StreetWalk({ center, places, onClose }: { center: { lat: number; lng: number }; places: Place[]; onClose: () => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'none' | 'error'>('loading');
  const [flash, setFlash] = useState('');
  const world = useRef<{ origin: { lat: number; lng: number }; u: { x: number; y: number }; n: { x: number; y: number }; P: { x: number; y: number }; b: Building[]; fetchedAt: { lat: number; lng: number }[]; loading: Set<string> }>({ origin: center, u: { x: 0, y: 1 }, n: { x: 1, y: 0 }, P: { x: 0, y: 0 }, b: [], fetchedAt: [], loading: new Set() });
  const cam = useRef({ s: 0, dir: 1, vel: 0, bob: 0, look: 0 });
  const dragLook = useRef<{ x: number; look: number } | null>(null);
  const keys = useRef({ fwd: false, back: false });
  const names = useRef('');
  const say = useCallback((t: string) => { setFlash(t); window.setTimeout(() => setFlash((f) => (f === t ? '' : f)), 2600); }, []);

  // what is around a point: asked for, the pictures loaded and cut, and set on the street
  const gather = useCallback(async (at: { lat: number; lng: number }, first: boolean) => {
    const got = await loadNeighborhood(at.lat, at.lng, places);
    if (!got) { if (first) setState('error'); return; }
    const w = world.current;
    if (first) {
      w.origin = at;
      // the street: the way Google's coverage says it runs; otherwise along the line the buildings lie on
      const pts = got.items.map((i) => toMeters(at, i));
      let ang = got.street ? (got.street.bearing * Math.PI) / 180 : null;
      if (ang === null) {
        if (pts.length >= 2) {
          const mx = pts.reduce((a, p) => a + p.x, 0) / pts.length, my = pts.reduce((a, p) => a + p.y, 0) / pts.length;
          let sxx = 0, syy = 0, sxy = 0;
          for (const p of pts) { sxx += (p.x - mx) ** 2; syy += (p.y - my) ** 2; sxy += (p.x - mx) * (p.y - my); }
          const th = 0.5 * Math.atan2(2 * sxy, sxx - syy); // the direction the buildings spread along (from east, counter-clockwise)
          ang = Math.PI / 2 - th;
        } else ang = 0;
      }
      w.u = { x: Math.sin(ang), y: Math.cos(ang) };
      w.n = { x: w.u.y, y: -w.u.x };
      w.P = got.street ? toMeters(at, got.street) : { x: 0, y: 0 };
    }
    for (const it of got.items) {
      if (w.b.some((b) => b.id === it.id) || w.loading.has(it.id)) continue;
      w.loading.add(it.id);
      const m = toMeters(w.origin, it);
      const rel = { x: m.x - w.P.x, y: m.y - w.P.y };
      const img = await loadImg(it.url);
      const cut = img ? cutOut(img) : null;
      w.b.push({ ...it, s: rel.x * w.u.x + rel.y * w.u.y, t: rel.x * w.n.x + rel.y * w.n.y, img: cut?.canvas ?? null, ratio: cut?.ratio ?? 0.7, width: it.kind === 'house' || it.kind === 'home' ? 15 : 22 });
    }
    w.fetchedAt.push(at);
  }, [places]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await gather(center, true);
      if (cancelled) return;
      const w = world.current;
      if (!w.b.length) { setState('none'); return; }
      const c = toMeters(w.origin, center);
      const here = (c.x - w.P.x) * w.u.x + (c.y - w.P.y) * w.u.y;
      // start at the near end of the stretch of street you are on, looking along it, so the places are ahead of you
      cam.current.s = bounds(here)[0] + 6;
      cam.current.dir = 1;
      if (import.meta.env.DEV) { (window as unknown as { __sw?: unknown; __swcam?: unknown }).__sw = w; (window as unknown as { __swcam?: unknown }).__swcam = cam.current; }
      setState('ready');
    })();
    return () => { cancelled = true; };
  }, [center, gather]); // eslint-disable-line react-hooks/exhaustive-deps

  /** How far the street goes, from where the walker is: a chain of mapped places no more than 200 feet apart. */
  const bounds = useCallback((s: number): [number, number] => {
    const xs = world.current.b.map((b) => b.s).sort((a, b) => a - b);
    if (!xs.length) return [s, s];
    let near = 0;
    for (let i = 0; i < xs.length; i++) if (Math.abs(xs[i] - s) < Math.abs(xs[near] - s)) near = i;
    let lo = near, hi = near;
    while (lo > 0 && xs[lo] - xs[lo - 1] <= FEET_200) lo--;
    while (hi < xs.length - 1 && xs[hi + 1] - xs[hi] <= FEET_200) hi++;
    return [xs[lo] - 12, xs[hi] + 12];
  }, []);

  useEffect(() => {
    if (state !== 'ready') return;
    const c = canvas.current as HTMLCanvasElement;
    const ctx = c.getContext('2d') as CanvasRenderingContext2D;
    let raf = 0, last = performance.now(), blocked = 0, lastFetch = cam.current.s;

    const draw = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      const dpr = window.devicePixelRatio || 1;
      const W = c.clientWidth, H = c.clientHeight;
      if (c.width !== Math.round(W * dpr) || c.height !== Math.round(H * dpr)) { c.width = Math.round(W * dpr); c.height = Math.round(H * dpr); }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const w = world.current, k = cam.current;

      // walking: forward or back along the street, as far as it goes
      const want = (keys.current.fwd ? 1 : 0) - (keys.current.back ? 1 : 0);
      k.vel += (want * 7 - k.vel) * Math.min(1, dt * 6);
      if (Math.abs(k.vel) > 0.05) {
        const [lo, hi] = bounds(k.s);
        const next = k.s + k.dir * k.vel * dt;
        if (next < lo || next > hi) { if (now - blocked > 2500) { blocked = now; say('YOU CANNOT GO THAT WAY: NO MAPPED PLACE WITHIN 200 FEET'); } k.vel = 0; }
        else { k.s = next; k.bob += dt * 9; }
      }
      // farther along than the pictures asked for: ask for what is around here
      if (Math.abs(k.s - lastFetch) > 55) {
        lastFetch = k.s;
        const m = { x: w.P.x + w.u.x * k.s, y: w.P.y + w.u.y * k.s };
        void gather(toLatLng(w.origin, m.x, m.y), false);
      }

      const f = Math.min(W * 0.8, H * 0.6), cx = W / 2 + k.look, hy = H * 0.47 + Math.sin(k.bob) * 1.5;
      const camS = k.s;
      const project = (d: number, t: number, hgt: number): [number, number] => [cx + (t / d) * f, hy + ((CAM_H - hgt) / d) * f];

      // the sky: a dusty haze that is darker overhead
      const sky = ctx.createLinearGradient(0, 0, 0, hy);
      sky.addColorStop(0, '#4a463c'); sky.addColorStop(0.55, '#8e7f5e'); sky.addColorStop(1, '#c9a46a');
      ctx.fillStyle = sky; ctx.fillRect(0, 0, W, hy + 2);
      for (let i = 0; i < 7; i++) { const cxx = ((hash(i * 7.1) * 1.4 - 0.2 + (camS * 0.0006)) % 1.4) * W; ctx.fillStyle = 'rgba(60,54,44,0.22)'; ctx.beginPath(); ctx.ellipse(cxx, hy * (0.2 + hash(i) * 0.5), W * 0.28, hy * 0.07, 0, 0, Math.PI * 2); ctx.fill(); }
      // the ground, dust and broken earth, then the road
      const ground = ctx.createLinearGradient(0, hy, 0, H);
      ground.addColorStop(0, '#6f6249'); ground.addColorStop(1, '#2b2518');
      ctx.fillStyle = ground; ctx.fillRect(0, hy, W, H - hy);
      const roadPoly = (a: number, b: number, t0: number, t1: number, fill: string) => {
        const [x00, y00] = project(a, t0, 0), [x10, y10] = project(a, t1, 0), [x01, y01] = project(b, t0, 0), [x11, y11] = project(b, t1, 0);
        ctx.fillStyle = fill; ctx.beginPath(); ctx.moveTo(x00, y00); ctx.lineTo(x10, y10); ctx.lineTo(x11, y11); ctx.lineTo(x01, y01); ctx.closePath(); ctx.fill();
      };
      roadPoly(NEAR, FAR, -ROAD_HALF, ROAD_HALF, '#3b3a37');
      roadPoly(NEAR, FAR, -ROAD_HALF - 0.4, -ROAD_HALF, '#8a8372'); roadPoly(NEAR, FAR, ROAD_HALF, ROAD_HALF + 0.4, '#8a8372');
      // the middle line, broken, and cracks that run across and along the road
      for (let d0 = Math.floor((camS * k.dir) / 4) * 4 - camS * k.dir; d0 < FAR; d0 += 4) { const a = Math.max(NEAR, d0 + 0.2), b2 = d0 + 2.2; if (b2 > NEAR) roadPoly(a, b2, -0.12, 0.12, 'rgba(200,180,90,0.7)'); }
      ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.lineWidth = 1.3;
      for (let i = 0; i < 26; i++) {
        const sw = Math.floor((camS * k.dir) / 3) + i;
        const d = (sw * 3 - camS * k.dir) + hash(sw * 3.3) * 3;
        if (d < NEAR || d > FAR * 0.8) continue;
        let t = (hash(sw * 5.1) - 0.5) * 2 * ROAD_HALF;
        ctx.beginPath(); let [px, py] = project(d, t, 0); ctx.moveTo(px, py);
        for (let j = 1; j < 6; j++) { t += (hash(sw * 9 + j) - 0.5) * 2.2; const dd = d + (hash(sw * 2 + j * 1.7) - 0.3) * 0.9; [px, py] = project(Math.max(NEAR, dd), Math.max(-ROAD_HALF, Math.min(ROAD_HALF, t)), 0); ctx.lineTo(px, py); }
        ctx.stroke();
      }

      // the things beside the road, far to near: pictures of the places that are mapped, and rubble, dead trees and bent poles where nothing is
      type Thing = { d: number; draw: () => void };
      const things: Thing[] = [];
      const rel = (s: number): number => (s - camS) * k.dir;
      const placed = w.b.map((b) => ({ b, d: rel(b.s), side: (b.t * k.dir) >= 0 ? 1 : -1 }));
      for (const { b, d, side } of placed) {
        if (d < -b.width || d > FAR + b.width) continue;
        things.push({ d: Math.max(d, -5) + b.width / 2, draw: () => {
          // the front of the building is square to the road, set back from it; seen in strips so it has perspective
          const tf = side * Math.min(ROAD_HALF + 13, Math.max(ROAD_HALF + 3.5, Math.abs(b.t) - 5));
          const hm = b.width * b.ratio;
          const N = 28;
          for (let i = 0; i < N; i++) {
            const s0 = b.s - b.width / 2 + (i / N) * b.width * (k.dir > 0 ? 1 : 1), s1 = b.s - b.width / 2 + ((i + 1) / N) * b.width;
            const d0 = rel(s0), d1 = rel(s1);
            const dn = Math.min(d0, d1), df = Math.max(d0, d1);
            if (df < NEAR) continue;
            const dd0 = Math.max(NEAR, dn), dd1 = Math.max(NEAR, df);
            const [xa, ya] = project(dd0, tf, hm), [xb] = project(dd1, tf, 0);
            const [, yb] = project(dd0, tf, 0), [, yc] = project((dd0 + dd1) / 2, tf, hm);
            const left = Math.min(xa, xb), wid = Math.abs(xb - xa);
            if (wid < 0.3 || left > W || left + wid < 0) continue;
            if (b.img) {
              const srcI = k.dir > 0 ? i : N - 1 - i;
              const sw = b.img.width / N;
              ctx.globalAlpha = Math.max(0.35, Math.min(1, 1.25 - dd0 / FAR));
              ctx.drawImage(b.img, srcI * sw, 0, sw + 1, b.img.height, left, yc, wid + 0.8, yb - yc);
              ctx.globalAlpha = 1;
            } else { ctx.fillStyle = '#4a4338'; ctx.fillRect(left, yc, wid + 0.8, yb - yc); }
            void ya;
          }
          // the foot of the building: broken ground and rubble across it
          const dm = Math.max(NEAR, rel(b.s));
          const [bx, by] = project(dm, tf, 0), sz = (b.width / dm) * f;
          ctx.fillStyle = 'rgba(30,26,18,0.55)'; ctx.beginPath(); ctx.ellipse(bx, by, sz * 0.62, sz * 0.05, 0, 0, Math.PI * 2); ctx.fill();
        } });
      }
      // empty lots: seeded, so they are always the same
      const span = 6;
      for (let i = Math.floor((camS * k.dir) / span) - 2; i < Math.floor((camS * k.dir + FAR) / span) + 2; i++) {
        for (const side of [-1, 1]) {
          const sAlong = (i * span + hash(i * 3 + side) * span) * k.dir;
          // nothing of the lot if a building stands there
          if (w.b.some((b) => Math.abs(b.s - sAlong) < b.width * 0.65 + 3 && (b.t >= 0 ? 1 : -1) === side * k.dir)) continue;
          const d = rel(sAlong);
          if (d < NEAR || d > FAR) continue;
          const t = side * (ROAD_HALF + 2 + hash(i * 7.7 + side) * 15);
          const r = hash(i * 11 + side * 5);
          things.push({ d, draw: () => {
            const [x, y] = project(d, t, 0);
            const size = (1.4 + r * 3.4) / d * f;
            ctx.globalAlpha = Math.max(0.3, Math.min(1, 1.3 - d / FAR));
            if (r < 0.58) {
              // a pile of broken concrete and twisted metal
              ctx.fillStyle = '#4e463a'; ctx.beginPath(); ctx.moveTo(x - size, y); ctx.lineTo(x - size * 0.5, y - size * 0.55); ctx.lineTo(x - size * 0.1, y - size * 0.8); ctx.lineTo(x + size * 0.45, y - size * 0.5); ctx.lineTo(x + size, y); ctx.closePath(); ctx.fill();
              ctx.fillStyle = '#6a6050'; ctx.beginPath(); ctx.moveTo(x - size * 0.4, y); ctx.lineTo(x - size * 0.1, y - size * 0.8); ctx.lineTo(x + size * 0.3, y); ctx.closePath(); ctx.fill();
              ctx.strokeStyle = '#2a2520'; ctx.lineWidth = Math.max(1, size * 0.04);
              for (let j = 0; j < 3; j++) { ctx.beginPath(); ctx.moveTo(x - size * 0.5 + j * size * 0.4, y - size * 0.4); ctx.lineTo(x - size * 0.8 + j * size * 0.7, y - size * (0.9 + hash(i + j) * 0.5)); ctx.stroke(); }
            } else if (r < 0.82) {
              // a dead tree
              ctx.strokeStyle = '#2b251c'; ctx.lineWidth = Math.max(1.2, size * 0.12);
              ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - size * 2.4); ctx.stroke();
              for (let j = 0; j < 4; j++) { ctx.lineWidth = Math.max(1, size * 0.06); ctx.beginPath(); ctx.moveTo(x, y - size * (1 + j * 0.4)); ctx.lineTo(x + (j % 2 ? 1 : -1) * size * 0.8, y - size * (1.5 + j * 0.45)); ctx.stroke(); }
            } else {
              // a crater, and a bent pole
              ctx.fillStyle = 'rgba(20,16,10,0.6)'; ctx.beginPath(); ctx.ellipse(x, y, size * 1.3, size * 0.22, 0, 0, Math.PI * 2); ctx.fill();
              ctx.strokeStyle = '#3a3128'; ctx.lineWidth = Math.max(1.5, size * 0.1); ctx.beginPath(); ctx.moveTo(x + size, y); ctx.lineTo(x + size * 1.05, y - size * 2.2); ctx.lineTo(x + size * 0.4, y - size * 2.6); ctx.stroke();
            }
            ctx.globalAlpha = 1;
          } });
        }
      }
      things.sort((a, b) => b.d - a.d).forEach((t) => t.draw());
      // distance haze, so the far end of the street fades into the dust
      const fog = ctx.createLinearGradient(0, hy - H * 0.08, 0, hy + H * 0.09);
      fog.addColorStop(0, 'rgba(201,164,106,0)'); fog.addColorStop(0.5, 'rgba(201,164,106,0.55)'); fog.addColorStop(1, 'rgba(201,164,106,0)');
      ctx.fillStyle = fog; ctx.fillRect(0, hy - H * 0.08, W, H * 0.17);
      // the old monitor look: scan lines and a dark edge
      ctx.fillStyle = 'rgba(0,0,0,0.12)'; for (let y = 0; y < H; y += 4) ctx.fillRect(0, y, W, 1.5);
      const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
      vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.55)'); ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);

      // the name of the nearest place
      let nearest: Building | null = null, nd = 1e9;
      for (const b of w.b) { const dd = Math.abs(rel(b.s)); if (dd < nd && dd < 40) { nd = dd; nearest = b; } }
      if (nearest && names.current !== nearest.id) { names.current = nearest.id; }
      if (nearest) { ctx.font = "22px 'VT323', monospace"; ctx.textAlign = 'center'; ctx.fillStyle = '#e8d58a'; ctx.shadowColor = '#000'; ctx.shadowBlur = 4; ctx.fillText(nearest.name.toUpperCase(), W / 2, H - 92); ctx.shadowBlur = 0; }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [state, bounds, gather, say]);

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
      {state === 'loading' && <div className="rm-sw-center">MAPPING THE STREET…</div>}
      {state === 'none' && <div className="rm-sw-center"><p>NO RENDERED PLACE NEAR ENOUGH TO WALK TO FROM HERE.</p><button type="button" className="rm-btn" onClick={onClose}>BACK</button></div>}
      {state === 'error' && <div className="rm-sw-center"><p>THE STREET COULD NOT BE MAPPED RIGHT NOW. TRY AGAIN IN A MOMENT.</p><button type="button" className="rm-btn" onClick={onClose}>BACK</button></div>}
      {flash && <p className="rm-sw-flash" role="status">{flash}</p>}
      {state === 'ready' && (
        <div className="rm-sw-pad">
          <button type="button" className="rm-btn" onClick={() => { cam.current.dir = (cam.current.dir * -1) as 1 | -1; }} aria-label="Turn around">TURN</button>
          <button type="button" className="rm-btn rm-sw-go" {...hold('back')} aria-label="Walk back">▼</button>
          <button type="button" className="rm-btn rm-sw-go" {...hold('fwd')} aria-label="Walk forward">▲</button>
        </div>
      )}
    </div>,
    document.body,
  );
}
