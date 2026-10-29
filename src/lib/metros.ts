// The pre-built wasteland: for each metro area, a handful of notable real places with their wasteland names and icons, made ahead of time
// (see _tools/build-metros.ts) from open data. Nothing is asked of Google here; these are plain files served with the site.

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

/** The places of one metro, as wasteland locations. */
export function loadMetro(id: string): Promise<Location[]> {
  let hit = loaded.get(id);
  if (!hit) {
    hit = fetch(`${base}metros/${id}.json`)
      .then((r) => (r.ok ? (r.json() as Promise<{ places: [string, string, number, number, string, number?][] }>) : { places: [] }))
      .then((m) => m.places.map(([pid, name, lat, lng, category, fame]) => locationFromData(`wd:${pid}`, name, { lat, lng }, category as CategoryId, fame ?? 0)))
      .catch(() => [] as Location[]);
    loaded.set(id, hit);
  }
  return hit;
}
