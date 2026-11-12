// Fetches the main roads that run through each flooded patch (from OpenStreetMap, once, ahead of time) so the app can draw them fading and thinning toward the middle of the water.
// Only the major routes (motorways and trunk roads, primary roads, secondary roads): the map hides the rest, and so must the water.
//   npx esbuild _tools/build-flood-roads.ts --bundle --platform=node --format=esm --outfile=_data/build-flood-roads.mjs && node _data/build-flood-roads.mjs [metro-id ...]
// With metro ids it only does those (to try it); with none it does every metro and writes public/data/flood-roads.json (a few minutes, a polite pause between requests).
// Output: { "<patch seed>": [[class, lat0, lng0, dLat, dLng, dLat, dLng ...], ...] } with coordinates in 1e-5 degrees (class 0: motorway/trunk, 1: primary, 2: secondary).
import fs from 'node:fs';
import { patchOutline, type FloodPatch } from '../src/lib/flood';

const only = process.argv.slice(2);
const flood = JSON.parse(fs.readFileSync('public/data/flood.json', 'utf8')) as Record<string, FloodPatch[]>;
const OUT = 'public/data/flood-roads.json';
const ENDPOINTS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const inside = (poly: { lat: number; lng: number }[], lat: number, lng: number): boolean => {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a.lng > lng) !== (b.lng > lng) && lat < ((b.lat - a.lat) * (lng - a.lng)) / (b.lng - a.lng) + a.lat) c = !c;
  }
  return c;
};
/** The outline grown a little around its middle (so the road that is just reaching the water is kept). */
const grown = (p: FloodPatch, k: number) => {
  const poly = patchOutline(p);
  return poly.map((q) => ({ lat: p[0] + (q.lat - p[0]) * k, lng: p[1] + (q.lng - p[1]) * k }));
};

type Way = { type: 'way'; id: number; tags?: Record<string, string>; geometry?: { lat: number; lon: number }[] };
async function overpass(query: string): Promise<Way[]> {
  for (let attempt = 0; attempt < 6; attempt++) {
    const url = ENDPOINTS[attempt % ENDPOINTS.length];
    try {
      const res = await fetch(url, { method: 'POST', body: 'data=' + encodeURIComponent(query), headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'WastelandMapsBuild/1.0' } });
      if (res.ok) return ((await res.json()) as { elements: Way[] }).elements.filter((e) => e.type === 'way' && e.geometry);
    } catch { /* try again */ }
    await sleep(15000 * (attempt + 1));
  }
  throw new Error('overpass would not answer');
}

const PROGRESS = '_data/flood-roads-progress.json';
const result: Record<string, number[][]> = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : {};
const done = new Set<number>(fs.existsSync(PROGRESS) && !only.length ? (JSON.parse(fs.readFileSync(PROGRESS, 'utf8')) as number[]) : []);
const save = () => { fs.writeFileSync(OUT, JSON.stringify(result)); fs.writeFileSync(PROGRESS, JSON.stringify([...done])); };
const metros = only.length ? only : Object.keys(flood);
// every patch of every metro asked for, in batches that may span metros (one request answers many patches)
const all: FloodPatch[] = metros.flatMap((m) => flood[m] ?? []);
let patches = 0, withRoads = 0;
const BATCH = 25;
const failed: number[] = [];
const runBatch = async (i: number): Promise<boolean> => {
  const batch = all.slice(i, i + BATCH);
  const around = batch.map((p) => `way(around:${Math.round(p[2] * Math.max(1, p[3]) * 1.2)},${p[0]},${p[1]})["highway"~"^(motorway|trunk|primary|secondary)(_link)?$"];`).join('');
  let ways: Way[];
  try { ways = await overpass(`[out:json][timeout:120];(${around});out geom;`); } catch { return false; }
  for (const p of batch) {
    patches++;
    const poly = grown(p, 1.08);
    const roads: number[][] = [];
    for (const w of ways) {
      const g = w.geometry ?? [];
      // the stretch of the road inside the patch (plus the point just outside each end, so it joins the road beyond)
      let run: { lat: number; lng: number }[] = [];
      const flush = () => {
        if (run.length >= 2) {
          const hw = w.tags?.highway ?? '';
          const cls = /^(motorway|trunk)/.test(hw) ? 0 : /^primary/.test(hw) ? 1 : 2;
          const out: number[] = [cls];
          let pl = 0, pn = 0;
          run.forEach((q, k) => { const la = Math.round(q.lat * 1e5), ln = Math.round(q.lng * 1e5); out.push(k === 0 ? la : la - pl, k === 0 ? ln : ln - pn); pl = la; pn = ln; });
          roads.push(out);
        }
        run = [];
      };
      for (let k = 0; k < g.length; k++) {
        const pt = { lat: g[k].lat, lng: g[k].lon };
        const here = inside(poly, pt.lat, pt.lng);
        const next = k + 1 < g.length && inside(poly, g[k + 1].lat, g[k + 1].lon);
        const prev = k > 0 && inside(poly, g[k - 1].lat, g[k - 1].lon);
        if (here || next || prev) run.push(pt); else flush();
      }
      flush();
    }
    if (roads.length) { result[String(p[5])] = roads; withRoads++; }
  }
  done.add(i);
  return true;
};
for (let i = 0; i < all.length; i += BATCH) {
  if (done.has(i)) continue;
  if (!(await runBatch(i))) { failed.push(i); console.log('batch', i, 'failed for now'); await sleep(30000); }
  if ((i / BATCH) % 8 === 0) { save(); console.log(i, 'of', all.length, 'patches;', Object.keys(result).length, 'have roads'); }
  await sleep(2500);
}
for (let round = 0; round < 3 && failed.length; round++) {
  await sleep(60000);
  for (const i of failed.splice(0)) { if (!(await runBatch(i))) failed.push(i); await sleep(5000); }
}
if (failed.length) console.log('STILL FAILED batches:', failed.join(','));
save();
console.log('written', OUT, (fs.statSync(OUT).size / 1024).toFixed(0), 'KB');
