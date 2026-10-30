// The pre-built wasteland: for each metro area, a handful of notable real places with their wasteland names and icons, made ahead of time
// (see _tools/build-metros.ts) from open data. Nothing is asked of Google here; these are plain files served with the site.

import { LORE_TOWNS } from './loreSites';
import { FAMOUS } from './famous';
import { FREE_RENDERS } from './renders';
import { assignVaults } from './vaults';
import { distanceMeters, locationFromData, type CategoryId, type LatLng, type Location } from './wasteland';

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
    if (distanceMeters({ lat: metro.lat, lng: metro.lng }, here) > metro.radiusKm * 1000 + 8000) continue;
    let spot = places.find((p) => !p.famous && (p.id.startsWith('wd:') || p.id.startsWith('famous:')) && f.match.test(p.oldName) && distanceMeters(p.position, here) < 2500);
    spot ??= places.find((p) => !p.famous && !freeLandmark(p.id) && p.id.startsWith('wd:') && distanceMeters(p.position, here) < 120);
    if (!spot) {
      spot = locationFromData(`famous:${f.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`, f.name, here, 'other', 999);
      places.push(spot);
    }
    spot.icon = f.icon;
    spot.famous = true;
  }
  return places;
}
const freeLandmark = (id: string) => id.startsWith('wd:') && id.slice(3) in FREE_RENDERS;

/** The buildings and landmarks the games' stories name, around the lore towns that fall inside this metro. */
function withLoreSites(metro: MetroEntry, places: Location[]): Location[] {
  for (const town of LORE_TOWNS) {
    if (distanceMeters({ lat: metro.lat, lng: metro.lng }, town.anchor) > metro.radiusKm * 1000 + 4000) continue;
    for (const site of town.sites) {
      const id = `lore:${site.slug}`;
      if (places.some((p) => p.id === id)) continue;
      const lat = town.anchor.lat + site.dy / 111_320;
      const lng = town.anchor.lng + site.dx / (111_320 * Math.max(0.2, Math.cos((town.anchor.lat * Math.PI) / 180)));
      places.push({
        id, oldName: '', name: site.name, category: 'other', position: { lat, lng }, loot: 'A story or two', threat: 'Quiet', rads: 0,
        icon: site.icon, lore: { town: town.town, text: site.text },
      });
    }
  }
  return places;
}

/** The places of one metro, as wasteland locations. */
export function loadMetro(metro: MetroEntry): Promise<Location[]> {
  const id = metro.id;
  let hit = loaded.get(id);
  if (!hit) {
    hit = fetch(`${base}metros/${id}.json`)
      .then((r) => (r.ok ? (r.json() as Promise<{ places: [string, string, number, number, string, number?, number?][] }>) : { places: [] }))
      .then((m) => m.places.map(([pid, name, lat, lng, category, fame, area]) => locationFromData(`wd:${pid}`, name, { lat, lng }, category as CategoryId, fame ?? 0, area === 1)))
      .then((places) => places.filter((p) => !NOT_A_PLACE.test(p.oldName)))
      .then((places) => assignVaults(metro, withLoreSites(metro, withFamous(metro, withFreeLandmarks(metro, places)))))
      .catch(() => [] as Location[]);
    loaded.set(id, hit);
  }
  return hit;
}
