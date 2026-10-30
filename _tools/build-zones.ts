// Radiation zones: for every metro, two or three hot spots over the parts of the city with the fewest places marked, on land (the cloud may drift
// out over the water, but it is never centered there). Land comes from Natural Earth's outlines (public domain).
//   npx tsx _tools/build-zones.ts          (needs _data/ne_10m_land.geojson and the built metros)
// Output: public/data/zones.json  { "<metro id>": [[lat, lng, radiusMeters, rads, seed, "neighborhood or suburb it sits over"], ...] }
// Some zones sit in the city itself (in the parts with the fewest places marked); each is named for the neighborhood or suburb under it.

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
// lakes (the Great Lakes, Lake Geneva...) count as water too: a zone is never centered on one (Natural Earth, public domain)
const lakeFile = path.join(ROOT, '_data', 'ne_10m_lakes.geojson');
const lakes: Shore[] = [];
if (fs.existsSync(lakeFile)) {
  const raw = JSON.parse(fs.readFileSync(lakeFile, 'utf8')) as { features: { geometry: { type: string; coordinates: number[][][] | number[][][][] } | null }[] };
  for (const f of raw.features) {
    if (!f.geometry) continue;
    const polys = (f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates) as number[][][][];
    for (const poly of polys) {
      const ring = poly[0] as unknown as Ring;
      let [minLng, maxLng, minLat, maxLat] = [Infinity, -Infinity, Infinity, -Infinity];
      for (const [x, y] of ring) { minLng = Math.min(minLng, x); maxLng = Math.max(maxLng, x); minLat = Math.min(minLat, y); maxLat = Math.max(maxLat, y); }
      lakes.push({ ring, minLng, maxLng, minLat, maxLat });
    }
  }
}
function inLake(lat: number, lng: number): boolean {
  return lakes.some((l) => lat >= l.minLat && lat <= l.maxLat && lng >= l.minLng && lng <= l.maxLng && inside(l.ring, lng, lat));
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
const onLand = (near: Shore[], lat: number, lng: number) => !inLake(lat, lng) && near.some((s) => lat >= s.minLat && lat <= s.maxLat && lng >= s.minLng && lng <= s.maxLng && inside(s.ring, lng, lat));

const km = (aLat: number, aLng: number, bLat: number, bLng: number) => Math.hypot((aLat - bLat) * 111.32, (aLng - bLng) * 111.32 * Math.cos((aLat * Math.PI) / 180));

interface Entry { id: string; lat: number; lng: number; radiusKm: number; pop: number; name: string; country: string }

// suburbs and towns (GeoNames), for naming what a zone sits over
interface Town { name: string; lat: number; lng: number; country: string }
const towns: Town[] = fs.readFileSync(path.join(ROOT, '_data', 'cities15000.txt'), 'utf8').split('\n').filter(Boolean).map((line) => {
  const f = line.split('\t');
  return { name: f[1], lat: Number(f[4]), lng: Number(f[5]), country: f[8] };
});
const index = JSON.parse(fs.readFileSync(path.join(ROOT, 'public', 'data', 'index.json'), 'utf8')) as Entry[];
const out: Record<string, (number | string)[][]> = {};

for (const metro of index) {
  const file = path.join(ROOT, 'public', 'data', 'metros', `${metro.id}.json`);
  if (!fs.existsSync(file)) continue;
  const rawPlaces = (JSON.parse(fs.readFileSync(file, 'utf8')) as { places: [string, string, number, number, string, number, number][] }).places;
  const places = rawPlaces.map((p) => ({ lat: p[2], lng: p[3] }));
  const hoods = rawPlaces.filter((p) => p[6] === 1).map((p) => ({ name: p[1], lat: p[2], lng: p[3] }));
  const suburbs = towns.filter((t) => t.country === metro.country && Math.abs(t.lat - metro.lat) < 1.2 && Math.abs(t.lng - metro.lng) < 1.6);
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
    const dist = reach * (0.03 + 0.95 * Math.sqrt(rand()));
    const lat = metro.lat + (Math.sin(angle) * dist) / 111.32;
    const lng = metro.lng + (Math.cos(angle) * dist) / (111.32 * Math.cos((metro.lat * Math.PI) / 180));
    const room = places.length ? Math.min(...places.map((p) => km(lat, lng, p.lat, p.lng))) : dist;
    spots.push({ lat, lng, room });
  }
  // the zones: the first one inside the city (the emptiest spot in the inner part), the rest in the emptiest spots anywhere
  const centerKm = (c: { lat: number; lng: number }) => km(c.lat, c.lng, metro.lat, metro.lng);
  const inner = spots.filter((c) => centerKm(c) <= reach * 0.4).sort((a, b) => b.room - a.room);
  spots.sort((a, b) => b.room - a.room);
  const ordered = [...inner, ...spots];
  // the emptiest spots first; each is checked to be on land only when it is about to be chosen (the outlines are big, so that check is slow)
  const chosen: { lat: number; lng: number; room: number }[] = [];
  for (const s of ordered) {
    if (chosen.length >= want) break;
    if (!chosen.every((c) => km(c.lat, c.lng, s.lat, s.lng) > reach * 0.3)) continue;
    if (near.length > 0 && !onLand(near, s.lat, s.lng)) continue; // never centered on water
    chosen.push(s);
  }
  if (chosen.length === 0) continue;
  /** The neighborhood or suburb under a spot: a marked neighborhood close by, else the nearest suburb that is not the city center itself. */
  const nameFor = (c: { lat: number; lng: number }): string => {
    const near = <T extends { name: string; lat: number; lng: number }>(list: T[], within: number) =>
      list.map((t) => ({ t, d: km(c.lat, c.lng, t.lat, t.lng) })).filter((x) => x.d <= within).sort((a, b) => a.d - b.d)[0]?.t;
    const hood = near(hoods, 4);
    if (hood) return hood.name;
    const suburb = near(suburbs.filter((t) => t.name !== metro.name), 12) ?? near(suburbs.filter((t) => t.name !== metro.name), 25);
    if (suburb) return suburb.name;
    return near(hoods, 15)?.name ?? near(suburbs, 40)?.name ?? metro.name;
  };
  out[metro.id] = chosen.map((c) => {
    const inCity = centerKm(c) <= reach * 0.4;
    // in the city the cloud is kept small enough not to bury the places around it
    const radius = Math.round(inCity
      ? Math.min(2200, Math.max(700, c.room * 500))
      : Math.min(3400, Math.max(1100, reach * 1000 * (0.07 + rand() * 0.05), Math.min(c.room * 450, 3000))));
    return [Number(c.lat.toFixed(5)), Number(c.lng.toFixed(5)), radius, 60 + Math.floor(rand() * 300), Math.floor(rand() * 1e6), nameFor(c)];
  });
}
const file = path.join(ROOT, 'public', 'data', 'zones.json');
fs.writeFileSync(file, JSON.stringify(out));
console.log(`${Object.keys(out).length} metros, ${Object.values(out).reduce((a, v) => a + v.length, 0)} zones, ${(fs.statSync(file).size / 1024).toFixed(0)} KB`);
