// Writes public/data/ferry.json: the ids of the places that cannot be driven to: on a small island, or on a rock or pier a little off the coast (lighthouses, forts).
// The app tries the road first; if there is none (or it stops well short of the place), fast travel opens a search for ferries instead of the flight search.
//   npx tsx _tools/ferry-list.ts
import fs from 'node:fs';
import path from 'node:path';
import { loadLand } from './land.ts';

const ROOT = path.resolve(import.meta.dirname, '..');
const land = loadLand();
const dir = path.join(ROOT, 'public', 'data', 'metros');
/** An island smaller than this (km²) is a ferry trip, unless it is the one the metro's center is on. */
const SMALL_ISLAND_KM2 = 300;
const ids: string[] = [];
for (const f of fs.readdirSync(dir)) {
  const m = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')) as { center: [number, number]; places: [string, string, number, number][] };
  const home = land.landAreaKm2(m.center[0], m.center[1]);
  for (const [id, , lat, lng] of m.places) {
    const area = land.landAreaKm2(lat, lng);
    // not on the land at all (a lighthouse on a rock, a fort on a shoal, a pier): by boat
    if (area === null) { ids.push(id); continue; }
    if (area < SMALL_ISLAND_KM2 && area !== home) ids.push(id);
  }
}
fs.writeFileSync(path.join(ROOT, 'public', 'data', 'ferry.json'), JSON.stringify([...new Set(ids)].sort()));
console.log(`${new Set(ids).size} places are reached by ferry`);
