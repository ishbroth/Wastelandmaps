// One-off rebalance of the pre-built metro files (run once; safe to run again):
//   1. The Inland Empire ("The Hub": the Ontario, Riverside and Highland metros) is separated from Los Angeles and Anaheim: the places that stand in it move out of
//      their lists into the Hub metro they are nearest to, and Los Angeles and Anaheim reach less far east, so the map names the Hub when you are over it.
//   2. No metro keeps more than 400 places (the cap for the biggest metros); each kind of place is trimmed in proportion, so a metro keeps its mix.
//   node _tools/rebalance-metros.mjs
import fs from 'node:fs';

const DIR = 'public/data/metros/';
const CAP = 400;
const file = (id) => DIR + id + '.json';
const read = (id) => JSON.parse(fs.readFileSync(file(id), 'utf8'));
const write = (m) => fs.writeFileSync(file(m.id), JSON.stringify(m));
const km = (aLat, aLng, bLat, bLng) => Math.hypot((bLng - aLng) * 111.32 * Math.cos((aLat * Math.PI) / 180), (bLat - aLat) * 111.32);

// ---- 1. the Hub ----
const HUB = ['us-ca-ontario', 'us-ca-riverside', 'us-ca-highland'].map(read);
const SOURCES = ['us-ca-los-angeles', 'us-ca-anaheim'].map(read);
const EAST = -117.75; // east of Pomona and Chino Hills is the Inland Empire
let moved = 0;
for (const src of SOURCES) {
  const keep = [];
  for (const p of src.places) {
    if (p[3] <= EAST) { keep.push(p); continue; }
    const target = HUB.reduce((best, h) => (km(p[2], p[3], h.center[0], h.center[1]) < km(p[2], p[3], best.center[0], best.center[1]) ? h : best), HUB[0]);
    if (!HUB.some((h) => h.places.some((q) => q[0] === p[0]))) { target.places.push(p); moved++; }
  }
  src.places = keep;
}
// Los Angeles and Anaheim reach less far east, so the Hub is what the map names there
const LA = SOURCES[0], OC = SOURCES[1];
LA.radiusKm = 46;
OC.radiusKm = 40;
console.log('moved into the Hub:', moved, '| Los Angeles', LA.places.length, 'Anaheim', OC.places.length, 'Hub', HUB.map((h) => h.places.length).join('/'));
for (const m of [...HUB, ...SOURCES]) write(m);

// ---- 2. the cap ----
const index = JSON.parse(fs.readFileSync('public/data/index.json', 'utf8'));
let trimmed = 0;
for (const entry of index) {
  const m = read(entry.id);
  if (m.places.length > CAP) {
    // neighborhoods and each kind of place are cut in the same proportion, the better known ones kept
    const factor = CAP / m.places.length;
    const groups = new Map();
    for (const p of m.places) {
      const key = (p[6] === 1 ? 'area:' : '') + p[4];
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(p);
    }
    const keep = new Set();
    for (const list of groups.values()) {
      list.sort((a, b) => (b[5] ?? 0) - (a[5] ?? 0));
      for (const p of list.slice(0, Math.max(1, Math.round(list.length * factor)))) keep.add(p);
    }
    let kept = m.places.filter((p) => keep.has(p));
    if (kept.length > CAP) kept = kept.sort((a, b) => (b[5] ?? 0) - (a[5] ?? 0)).slice(0, CAP);
    m.places = kept;
    write(m);
    trimmed++;
  }
  entry.places = m.places.length;
  if (m.radiusKm !== entry.radiusKm) entry.radiusKm = m.radiusKm;
}
fs.writeFileSync('public/data/index.json', JSON.stringify(index));
console.log('metros trimmed to', CAP + ':', trimmed);
