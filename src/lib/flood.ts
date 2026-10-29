// Flooded patches along the coasts (made ahead of time by _tools/build-flood.ts): a few pools of standing water just inland of the shore.
// Each is [lat, lng, radius in meters, aspect, angle in degrees, seed]; the outline is a wobbly oval drawn from the seed, so it is always the same.

import { seeded, type LatLng } from './wasteland';

export type FloodPatch = number[];

let loading: Promise<Record<string, FloodPatch[]>> | null = null;
export function loadFlood(): Promise<Record<string, FloodPatch[]>> {
  if (!loading) {
    loading = fetch(`${import.meta.env.BASE_URL}data/flood.json`)
      .then((r) => (r.ok ? (r.json() as Promise<Record<string, FloodPatch[]>>) : {}))
      .catch(() => ({}));
  }
  return loading;
}

/** The outline of a patch: an oval along the shore with an uneven edge. */
export function patchOutline([lat, lng, radius, aspect, angle, seed]: FloodPatch): LatLng[] {
  const rand = seeded(seed);
  const turn = (angle * Math.PI) / 180;
  const points: LatLng[] = [];
  const steps = 16;
  for (let i = 0; i < steps; i++) {
    const t = (i / steps) * Math.PI * 2;
    const wobble = 0.72 + rand() * 0.5;
    const x = Math.cos(t) * radius * aspect * wobble; // along the shore
    const y = Math.sin(t) * radius * wobble;
    const east = x * Math.cos(turn) - y * Math.sin(turn);
    const north = x * Math.sin(turn) + y * Math.cos(turn);
    points.push({ lat: lat + north / 111_320, lng: lng + east / (111_320 * Math.max(0.2, Math.cos((lat * Math.PI) / 180))) });
  }
  return points;
}
