// The pre-built wasteland: for each metro area, a handful of notable real places with their wasteland names and icons, made ahead of time
// (see _tools/build-metros.ts) from open data. Nothing is asked of Google here; these are plain files served with the site.

import { LORE_TOWNS } from './loreSites';
import { FAMOUS } from './famous';
import { FREE_RENDERS } from './renders';
import { assignVaults } from './vaults';
import { distanceMeters, hashString, locationFromData, type CategoryId, type LatLng, type Location } from './wasteland';

export interface MetroEntry {
  id: string;
  name: string;
  country: string;
  lat: number;
  lng: number;
  pop: number;
  radiusKm: number;
  /** The region's wasteland name: "The Commonwealth", "Atomlanta". */
  title: string;
  canon: boolean;
  places: number;
}

/** Things on Wikidata with coordinates that are not places on a map: electoral districts, telephone area codes and the like. */
/** Places that are not wanted on the map at all (the Statue of Liberty National Monument is the same spot as the Statue of Liberty). */
const HIDDEN_IDS = new Set(['wd:Q359939']);
const NOT_A_PLACE = /congressional district|legislative district|school district|electoral|area codes?|zip codes?|postal code|time zone|telephone|numbering plan/i;

const base = `${import.meta.env.BASE_URL}data/`;
let index: Promise<MetroEntry[]> | null = null;
const loaded = new Map<string, Promise<Location[]>>();

/** Every metro that has a pre-built map. */
export function loadIndex(): Promise<MetroEntry[]> {
  if (!index) {
    const attempt = async (): Promise<MetroEntry[]> => {
      const res = await fetch(`${base}index.json`);
      if (!res.ok) throw new Error('no index');
      return (await res.json()) as MetroEntry[];
    };
    // one more try after a moment, then give up for this visit but do not remember the failure
    index = attempt()
      .catch(() => new Promise<MetroEntry[]>((resolve) => setTimeout(() => attempt().then(resolve, () => { index = null; resolve([]); }), 700)));
  }
  return index;
}

/** The metro a point belongs to: the one whose area it falls in (nearest first), else the nearest within `slackKm` of its edge. */
export function metroAt(metros: MetroEntry[], point: LatLng, slackKm = 0): MetroEntry | null {
  let best: MetroEntry | null = null;
  let bestGap = Infinity;
  for (const m of metros) {
    const gap = distanceMeters(point, { lat: m.lat, lng: m.lng }) / 1000 - m.radiusKm;
    if (gap <= slackKm && gap < bestGap) { best = m; bestGap = gap; }
  }
  return best;
}

/**
 * Parts of a metro that carry a name of their own on the title as the map moves over them (the metro, its places and its count stay as they are). The East Bay is
 * Smokeland when you cross the bay from San Francisco, and San Blam again when you cross back. Each area is a rough outline, as [latitude, longitude] points.
 */
const AREA_TITLES: Record<string, { title: string; outline: [number, number][] }[]> = {
  'us-ca-san-francisco': [{
    title: 'Smokeland',
    outline: [[38.0, -122.42], [38.0, -122.1], [37.9, -121.98], [37.62, -121.9], [37.48, -121.95], [37.5, -122.07], [37.62, -122.16], [37.7, -122.21], [37.77, -122.33], [37.8, -122.36], [37.88, -122.42], [37.95, -122.45]],
  }],
};

const inside = (point: LatLng, outline: [number, number][]): boolean => {
  let in_ = false;
  for (let i = 0, j = outline.length - 1; i < outline.length; j = i++) {
    const [yi, xi] = outline[i];
    const [yj, xj] = outline[j];
    if (yi > point.lat !== yj > point.lat && point.lng < ((xj - xi) * (point.lat - yi)) / (yj - yi) + xi) in_ = !in_;
  }
  return in_;
};

/** The name on the title for a spot in a metro: the metro's own, or that of the named part of it the spot is in (Smokeland, east of the bay). */
export function titleAt(metro: MetroEntry, point: LatLng): string {
  const area = AREA_TITLES[metro.id]?.find((a) => inside(point, a.outline));
  return area?.title ?? metro.title;
}

/**
 * The landmarks with a free snapshot always appear on the map of the metro they stand in, even if the pre-built list left them out, and the ones
 * with a special wasteland name carry it ("F&F Tower" is "Revolution Tower").
 */
function withFreeLandmarks(metro: MetroEntry, places: Location[]): Location[] {
  for (const [id, landmark] of Object.entries(FREE_RENDERS)) {
    if (landmark.lat === undefined || landmark.lng === undefined) continue;
    const here = { lat: landmark.lat, lng: landmark.lng };
    if (distanceMeters({ lat: metro.lat, lng: metro.lng }, here) > metro.radiusKm * 1000 + 8000) continue;
    const key = `wd:${id}`;
    let spot = places.find((p) => p.id === key);
    if (!spot) {
      spot = locationFromData(key, landmark.real ?? landmark.name, here, 'other', 999);
      places.push(spot);
    }
    if (landmark.postName) spot.name = landmark.postName;
  }
  return places;
}

/**
 * The world's most famous buildings always appear on the map of the metro they stand in, drawn as themselves: one already in the list (under its
 * real name, or standing at the same spot) is upgraded, and one that is missing is added.
 */
function withFamous(metro: MetroEntry, places: Location[]): Location[] {
  for (const f of FAMOUS) {
    const here = { lat: f.lat, lng: f.lng };
    if (f.metro ? f.metro !== metro.id : distanceMeters({ lat: metro.lat, lng: metro.lng }, here) > metro.radiusKm * 1000 + 8000) continue;
    let spot = (f.qid ? places.find((p) => p.id === `wd:${f.qid}` && !p.famous) : undefined)
      ?? places.find((p) => !p.famous && (p.id.startsWith('wd:') || p.id.startsWith('famous:')) && f.match.test(p.oldName) && distanceMeters(p.position, here) < 2500);
    // (a landmark with its own Wikidata item is never taken to be some other building that happens to stand next to it)
    spot ??= f.qid ? undefined : places.find((p) => !p.famous && !freeLandmark(p.id) && p.id.startsWith('wd:') && distanceMeters(p.position, here) < 120);
    if (!spot) {
      spot = locationFromData(f.qid ? `wd:${f.qid}` : `famous:${f.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`, f.name, here, 'other', 999);
      dropLeastOf(metro, places);
      places.push(spot);
    }
    if (f.move) { spot.position = here; spot.name = f.name; spot.neighborhood = false; }
    spot.icon = f.icon;
    spot.famous = true;
  }
  return places;
}
/** The local landmarks of the world's cities (made by _tools/build-locals.ts): one to five buildings per metro, by its size. */
type Locals = Record<string, [string, string][]>;
let localsLoading: Promise<Locals> | null = null;
const loadLocals = (): Promise<Locals> =>
  (localsLoading ??= fetch(`${import.meta.env.BASE_URL}data/locals.json`)
    .then(async (r): Promise<Locals> => (r.ok ? ((await r.json()) as Locals) : {}))
    .catch((): Locals => ({})));
function withLocals(places: Location[], picks: [string, string][]): Location[] {
  for (const [qid, kind] of picks) {
    const spot = places.find((p) => p.id === `wd:${qid}` && !p.famous);
    if (!spot) continue;
    spot.icon = `local:${kind}:${hashString(qid) % 100000}`;
    spot.famous = true;
  }
  return places;
}

/** A landmark added to a metro takes the place of one of its least important places, so the count stays what it was. */
function dropLeastOf(metro: MetroEntry, places: Location[]) {
  let worst = -1;
  for (let i = 0; i < places.length; i++) {
    const p = places[i];
    if (!p.id.startsWith('wd:') || p.famous || p.neighborhood || p.lore || p.vault || freeLandmark(p.id)) continue;
    if (worst < 0) { worst = i; continue; }
    const w = places[worst];
    const fame = p.fame ?? 0, wf = w.fame ?? 0;
    const far = distanceMeters(p.position, { lat: metro.lat, lng: metro.lng }) > distanceMeters(w.position, { lat: metro.lat, lng: metro.lng });
    if (fame < wf || (fame === wf && far)) worst = i;
  }
  if (worst >= 0) places.splice(worst, 1);
}
const freeLandmark = (id: string) => id.startsWith('wd:') && id.slice(3) in FREE_RENDERS;

/** The buildings and landmarks the games' stories name, around the lore towns that fall inside this metro. */
function withLoreSites(metro: MetroEntry, places: Location[]): Location[] {
  for (const town of LORE_TOWNS) {
    if (distanceMeters({ lat: metro.lat, lng: metro.lng }, town.anchor) > metro.radiusKm * 1000 + 4000) continue;
    for (const site of town.sites) {
      const id = `lore:${site.slug}`;
      if (places.some((p) => p.id === id)) continue;
      if (site.real) {
        // it stands on one named real place: that place, if this metro has it (it keeps its spot and its snapshot), otherwise a spot at the real place's own coordinates
        const has = places.findIndex((p) => p.id === `wd:${site.real?.qid}`);
        const text = `${site.text} In the world before the bombs this was ${site.real.name}.`;
        if (has >= 0) {
          const was = places[has];
          places[has] = { ...was, name: `${site.name} (formerly ${was.oldName || was.name})`, icon: site.icon, lore: { town: town.town, text } };
        } else {
          places.push({ id, oldName: site.real.name, name: `${site.name} (formerly ${site.real.name})`, category: 'other', position: { lat: site.real.lat, lng: site.real.lng }, loot: 'A story or two', threat: 'Quiet', rads: 0, icon: site.icon, lore: { town: town.town, text } });
        }
        continue;
      }
      const lat = town.anchor.lat + site.dy / 111_320;
      const lng = town.anchor.lng + site.dx / (111_320 * Math.max(0.2, Math.cos((town.anchor.lat * Math.PI) / 180)));
      if (site.on) {
        // it stands on a real place instead: the nearest ordinary one, which keeps its spot and its snapshot and gets the site's name ("formerly ...")
        let best = -1;
        let reach = 3000;
        places.forEach((p, i) => {
          if (!p.id.startsWith('wd:') || p.famous || p.neighborhood || p.lore || p.vault || p.personal || p.category === 'transit' || p.category === 'guard' || freeLandmark(p.id)) return;
          const d = distanceMeters(p.position, { lat, lng });
          if (d < reach) { reach = d; best = i; }
        });
        if (best >= 0) {
          const was = places[best];
          places[best] = { ...was, name: `${site.name} (formerly ${was.oldName || was.name})`, icon: site.icon, lore: { town: town.town, text: `${site.text} Before the ghouls came to an arrangement with it, this was ${was.oldName || was.name}.` } };
          continue;
        }
      }
      places.push({
        id, oldName: '', name: site.name, category: 'other', position: { lat, lng }, loot: 'A story or two', threat: 'Quiet', rads: 0,
        icon: site.icon, lore: { town: town.town, text: site.text },
      });
    }
  }
  return places;
}

/** A name stripped of the words that only say "the general area", so "Mission Valley" and "Mission Valley District" read the same. */
const stem = (name: string): string => name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9 ]/g, ' ')
  .replace(/\b(the|of|de|la|el|district|neighbou?rhood|area|historic|old|east|west|north|south|upper|lower|central|downtown|heights|hills|park|village|town|city|county|community|quarter|section|zone|region)\b/g, ' ')
  .replace(/\s+/g, ' ').trim();

/**
 * Takes out places that are the same place named twice (a neighborhood and the mall of the same name, or the same area listed by two metros): the same name,
 * close together (4 km for areas, 500 m for buildings). The more famous one stays; landmarks, vaults, story sites and personal places are never dropped.
 */
export function dedupePlaces(places: Location[]): Location[] {
  const keep = (p: Location) => !!(p.famous || p.lore || p.vault || p.personal || freeLandmark(p.id));
  const drop = new Set<number>();
  const byStem = new Map<string, number[]>();
  places.forEach((p, i) => {
    const key = stem(p.oldName || p.name);
    if (key.length < 3) return;
    const list = byStem.get(key);
    if (list) list.push(i); else byStem.set(key, [i]);
  });
  for (const list of byStem.values()) {
    for (let a = 0; a < list.length; a++) for (let b = a + 1; b < list.length; b++) {
      const x = places[list[a]], y = places[list[b]];
      if (drop.has(list[a]) || drop.has(list[b])) continue;
      const area = !!(x.neighborhood || y.neighborhood);
      if (distanceMeters(x.position, y.position) > (area ? 4000 : 500)) continue;
      const loser = keep(x) && !keep(y) ? list[b] : keep(y) && !keep(x) ? list[a] : keep(x) && keep(y) ? -1 : (x.fame ?? 0) >= (y.fame ?? 0) ? list[b] : list[a];
      if (loser >= 0) drop.add(loser);
    }
  }
  return drop.size ? places.filter((_, i) => !drop.has(i)) : places;
}

/** The places of one metro, as wasteland locations. */
export function loadMetro(metro: MetroEntry): Promise<Location[]> {
  const id = metro.id;
  let hit = loaded.get(id);
  if (!hit) {
    hit = fetch(`${base}metros/${id}.json`)
      .then((r) => (r.ok ? (r.json() as Promise<{ places: [string, string, number, number, string, number?, number?][] }>) : { places: [] }))
      .then((m) => m.places.map(([pid, name, lat, lng, category, fame, area]) => locationFromData(`wd:${pid}`, name, { lat, lng }, category as CategoryId, fame ?? 0, area === 1)))
      .then((places) => places.filter((p) => !NOT_A_PLACE.test(p.oldName) && !HIDDEN_IDS.has(p.id)))
      .then(async (places) => withLocals(places, (await loadLocals())[metro.id] ?? []))
      .then((places) => dedupePlaces(assignVaults(metro, withLoreSites(metro, withFamous(metro, withFreeLandmarks(metro, places))))))
      .catch(() => [] as Location[]);
    loaded.set(id, hit);
  }
  return hit;
}
