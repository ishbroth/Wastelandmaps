// Radiation zones: for every metro, two or three hot spots over the parts of the city with the fewest places marked, on land (the cloud may drift
// out over the water, but it is never centered there). Land comes from Natural Earth's outlines (public domain).
//   npx tsx _tools/build-zones.ts          (needs _data/ne_10m_land.geojson and the built metros)
// Output: public/data/zones.json  { "<metro id>": [[lat, lng, radiusMeters, rads, seed], ...] }

import fs from 'node:fs';
import path from 'node:path';
import { hashString, seeded } from '../src/lib/wasteland.ts';

const ROOT = path.resolve(import.meta.dirname, '..');
type Ring = [number, number][];
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
const onLand = (near: Shore[], lat: number, lng: number) => near.some((s) => lat >= s.minLat && lat <= s.maxLat && lng >= s.minLng && lng <= s.maxLng && inside(s.ring, lng, lat));

const km = (aLat: number, aLng: number, bLat: number, bLng: number) => Math.hypot((aLat - bLat) * 111.32, (aLng - bLng) * 111.32 * Math.cos((aLat * Math.PI) / 180));

interface Entry { id: string; lat: number; lng: number; radiusKm: number; pop: number }
const index = JSON.parse(fs.readFileSync(path.join(ROOT, 'public', 'data', 'index.json'), 'utf8')) as Entry[];
const out: Record<string, number[][]> = {};

for (const metro of index) {
  const file = path.join(ROOT, 'public', 'data', 'metros', `${metro.id}.json`);
  if (!fs.existsSync(file)) continue;
  const places = (JSON.parse(fs.readFileSync(file, 'utf8')) as { places: [string, string, number, number][] }).places.map((p) => ({ lat: p[2], lng: p[3] }));
  const reach = Math.min(metro.radiusKm, 40);
  const dLat = reach / 111.32;
  const dLng = reach / (111.32 * Math.cos((metro.lat * Math.PI) / 180));
  const near = shores.filter((s) => s.maxLat >= metro.lat - dLat && s.minLat <= metro.lat + dLat && s.maxLng >= metro.lng - dLng && s.minLng <= metro.lng + dLng);
  const rand = seeded(hashString(`zones:${metro.id}`));
  const want = metro.pop > 1_500_000 ? 3 : 2;

  // candidate spots: on land, away from the very center, scored by how far they are from the nearest marked place
  const spots: { lat: number; lng: number; room: number }[] = [];
  for (let tries = 0; tries < 260; tries++) {
    const angle = rand() * Math.PI * 2;
    const dist = reach * (0.18 + 0.8 * Math.sqrt(rand()));
    const lat = metro.lat + (Math.sin(angle) * dist) / 111.32;
    const lng = metro.lng + (Math.cos(angle) * dist) / (111.32 * Math.cos((metro.lat * Math.PI) / 180));
    const room = places.length ? Math.min(...places.map((p) => km(lat, lng, p.lat, p.lng))) : dist;
    spots.push({ lat, lng, room });
  }
  spots.sort((a, b) => b.room - a.room);
  // the emptiest spots first; each is checked to be on land only when it is about to be chosen (the outlines are big, so that check is slow)
  const chosen: { lat: number; lng: number; room: number }[] = [];
  for (const s of spots) {
    if (chosen.length >= want) break;
    if (!chosen.every((c) => km(c.lat, c.lng, s.lat, s.lng) > reach * 0.4)) continue;
    if (near.length > 0 && !onLand(near, s.lat, s.lng)) continue; // never centered on water
    chosen.push(s);
  }
  if (chosen.length === 0) continue;
  out[metro.id] = chosen.map((c) => {
    const radius = Math.round(Math.min(3400, Math.max(1100, reach * 1000 * (0.07 + rand() * 0.05), Math.min(c.room * 450, 3000))));
    return [Number(c.lat.toFixed(5)), Number(c.lng.toFixed(5)), radius, 60 + Math.floor(rand() * 300), Math.floor(rand() * 1e6)];
  });
}
const file = path.join(ROOT, 'public', 'data', 'zones.json');
fs.writeFileSync(file, JSON.stringify(out));
console.log(`${Object.keys(out).length} metros, ${Object.values(out).reduce((a, v) => a + v.length, 0)} zones, ${(fs.statSync(file).size / 1024).toFixed(0)} KB`);
