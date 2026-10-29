// Floods the coasts: for every metro on the sea, a handful of flooded patches just inland of the shoreline, in the blank spots between the
// streets. The shore comes from Natural Earth's land outlines (public domain). Not many, and never in the middle of the city.
//   npx tsx _tools/build-flood.ts          (needs _data/ne_10m_land.geojson)
// Output: public/data/flood.json  { "<metro id>": [[lat, lng, radiusMeters, aspect, angleDegrees, seed], ...] }

import fs from 'node:fs';
import path from 'node:path';
import { hashString, seeded } from '../src/lib/wasteland.ts';

const ROOT = path.resolve(import.meta.dirname, '..');
type Ring = [number, number][]; // [lng, lat]

// land: outer rings only (so lakes inside a landmass are not coast), each with its bounding box
const land = JSON.parse(fs.readFileSync(path.join(ROOT, '_data', 'ne_10m_land.geojson'), 'utf8')) as {
  features: { geometry: { type: string; coordinates: number[][][] | number[][][][] } }[];
};
interface Shore { ring: Ring; minLng: number; maxLng: number; minLat: number; maxLat: number }
const shores: Shore[] = [];
for (const f of land.features) {
  const polys = (f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates) as number[][][][];
  for (const poly of polys) {
    const ring = poly[0] as unknown as Ring;
    let [minLng, maxLng, minLat, maxLat] = [Infinity, -Infinity, Infinity, -Infinity];
    for (const [x, y] of ring) { minLng = Math.min(minLng, x); maxLng = Math.max(maxLng, x); minLat = Math.min(minLat, y); maxLat = Math.max(maxLat, y); }
    shores.push({ ring, minLng, maxLng, minLat, maxLat });
  }
}

function inside(ring: Ring, lng: number, lat: number): boolean {
  let hit = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

const mLat = 1 / 111_320;
const mLng = (lat: number) => 1 / (111_320 * Math.max(0.2, Math.cos((lat * Math.PI) / 180)));
const km = (aLat: number, aLng: number, bLat: number, bLng: number) => Math.hypot((aLat - bLat) * 111.32, (aLng - bLng) * 111.32 * Math.cos((aLat * Math.PI) / 180));

interface Entry { id: string; lat: number; lng: number; radiusKm: number; pop: number }
const index = JSON.parse(fs.readFileSync(path.join(ROOT, 'public', 'data', 'index.json'), 'utf8')) as Entry[];

const out: Record<string, number[][]> = {};
for (const metro of index) {
  const reach = Math.min(metro.radiusKm, 45) + 3;
  const dLat = reach / 111.32;
  const dLng = reach / (111.32 * Math.cos((metro.lat * Math.PI) / 180));
  // shore points within reach of the center, with the ring they belong to
  const points: { lat: number; lng: number; ring: Ring; at: number }[] = [];
  for (const s of shores) {
    if (s.maxLat < metro.lat - dLat || s.minLat > metro.lat + dLat || s.maxLng < metro.lng - dLng || s.minLng > metro.lng + dLng) continue;
    s.ring.forEach(([x, y], at) => {
      if (km(metro.lat, metro.lng, y, x) <= reach) points.push({ lat: y, lng: x, ring: s.ring, at });
    });
  }
  if (points.length < 12) continue; // not on the sea

  const rand = seeded(hashString(`flood:${metro.id}`));
  const want = metro.pop > 3_000_000 ? 9 : metro.pop > 1_000_000 ? 7 : 5;
  const picks: number[][] = [];
  const spots: { lat: number; lng: number }[] = [];
  for (let tries = 0; tries < 400 && picks.length < want; tries++) {
    const p = points[Math.floor(rand() * points.length)];
    if (spots.some((s) => km(s.lat, s.lng, p.lat, p.lng) < 2.5)) continue; // spread along the coast
    const prev = p.ring[(p.at - 1 + p.ring.length) % p.ring.length];
    const next = p.ring[(p.at + 1) % p.ring.length];
    const tx = next[0] - prev[0];
    const ty = next[1] - prev[1];
    const len = Math.hypot(tx * Math.cos((p.lat * Math.PI) / 180), ty);
    if (len === 0) continue;
    // the two sides of the shore: the one on land is inland
    const nx = -ty / len;
    const ny = (tx * Math.cos((p.lat * Math.PI) / 180)) / len;
    const probe = 250;
    const sideLand = (sign: number) => inside(p.ring, p.lng + (sign * nx * probe * mLng(p.lat)), p.lat + sign * ny * probe * mLat);
    const sign = sideLand(1) ? 1 : sideLand(-1) ? -1 : 0;
    if (sign === 0) continue;
    const depth = 350 + rand() * 1500; // how far inland the patch sits
    const along = (rand() - 0.5) * 900;
    const lat = p.lat + sign * ny * depth * mLat + (ty / len) * along * mLat * 0;
    const lng = p.lng + sign * nx * depth * mLng(p.lat) + (tx / len) * along * mLng(p.lat) * 0;
    // never in the heart of the city
    if (km(metro.lat, metro.lng, lat, lng) < Math.min(3, metro.radiusKm * 0.15)) continue;
    // the patch must itself be on land, or it is just more sea
    if (!inside(p.ring, lng, lat)) continue;
    const radius = 140 + rand() * 420;
    const angle = (Math.atan2(ty, tx * Math.cos((p.lat * Math.PI) / 180)) * 180) / Math.PI;
    picks.push([Number(lat.toFixed(5)), Number(lng.toFixed(5)), Math.round(radius), Number((1.2 + rand() * 1.8).toFixed(2)), Math.round(angle), Math.floor(rand() * 1e6)]);
    spots.push({ lat: p.lat, lng: p.lng });
  }
  if (picks.length > 0) out[metro.id] = picks;
}

const file = path.join(ROOT, 'public', 'data', 'flood.json');
fs.writeFileSync(file, JSON.stringify(out));
console.log(`${Object.keys(out).length} coastal metros, ${Object.values(out).reduce((a, v) => a + v.length, 0)} flooded patches, ${(fs.statSync(file).size / 1024).toFixed(0)} KB`);
