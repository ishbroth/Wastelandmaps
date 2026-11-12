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

/**
 * The outline of a patch: a pool lying along the shore, with a smooth, natural edge. It is made of a few slow waves around the oval (a lobe here, an inlet there, a
 * long bay along the shore) and no random spikes, so the edge flows like a real waterline. The same seed always gives the same outline, and the nested layers that
 * give the water its depth (the same outline at smaller sizes) stay neatly inside one another.
 */
export function patchOutline([lat, lng, radius, aspect, angle, seed]: FloodPatch): LatLng[] {
  const rand = seeded(seed);
  const turn = (angle * Math.PI) / 180;
  const phase = [rand() * 6.283, rand() * 6.283, rand() * 6.283, rand() * 6.283];
  const amp = [0.13 + rand() * 0.09, 0.09 + rand() * 0.07, 0.05 + rand() * 0.04, 0.025 + rand() * 0.02];
  const points: LatLng[] = [];
  const steps = 56;
  for (let i = 0; i < steps; i++) {
    const t = (i / steps) * Math.PI * 2;
    const wobble = 0.9 + amp[0] * Math.sin(2 * t + phase[0]) + amp[1] * Math.sin(3 * t + phase[1]) + amp[2] * Math.sin(4 * t + phase[2]) + amp[3] * Math.sin(6 * t + phase[3]);
    const x = Math.cos(t) * radius * aspect * wobble; // along the shore
    const y = Math.sin(t) * radius * wobble;
    const east = x * Math.cos(turn) - y * Math.sin(turn);
    const north = x * Math.sin(turn) + y * Math.cos(turn);
    points.push({ lat: lat + north / 111_320, lng: lng + east / (111_320 * Math.max(0.2, Math.cos((lat * Math.PI) / 180))) });
  }
  return points;
}

/** Is this point over one of the flooded patches? (The patch is taken as the plain oval, without its uneven edge.) */
export function isFlooded(point: LatLng, patches: FloodPatch[]): boolean {
  return patches.some(([lat, lng, radius, aspect, angle]) => {
    const north = (point.lat - lat) * 111_320;
    const east = (point.lng - lng) * 111_320 * Math.max(0.2, Math.cos((lat * Math.PI) / 180));
    if (Math.abs(north) > radius * aspect * 1.3 || Math.abs(east) > radius * aspect * 1.3) return false;
    const turn = (-angle * Math.PI) / 180;
    const x = east * Math.cos(turn) - north * Math.sin(turn);
    const y = east * Math.sin(turn) + north * Math.cos(turn);
    return (x / (radius * aspect)) ** 2 + (y / radius) ** 2 <= 1;
  });
}

// ---- the main roads that run into the water: they fade and thin toward the middle of each patch (made ahead of time by _tools/build-flood-roads.ts) ----

let loadingRoads: Promise<Record<string, number[][]>> | null = null;
/** The main roads (motorways to tertiary roads) inside each patch, by the patch's seed: [class, lat0, lng0, dLat, dLng, ...] in 1e-5 degrees (class 0: motorway or trunk, 1: primary, 2: secondary). */
export function loadFloodRoads(): Promise<Record<string, number[][]>> {
  if (!loadingRoads) {
    loadingRoads = fetch(`${import.meta.env.BASE_URL}data/flood-roads.json`)
      .then((r) => (r.ok ? (r.json() as Promise<Record<string, number[][]>>) : {}))
      .catch(() => ({}));
  }
  return loadingRoads;
}

/** One road of a patch, as points. */
export function decodeRoad(road: number[]): { cls: number; points: LatLng[] } {
  const points: LatLng[] = [];
  let la = 0, ln = 0;
  for (let i = 1; i + 1 < road.length; i += 2) { la += road[i]; ln += road[i + 1]; points.push({ lat: la / 1e5, lng: ln / 1e5 }); }
  return { cls: road[0], points };
}

/** How deep a point is in a patch: 1 at its edge (the same outline patchOutline draws) down to 0 in the middle; more than 1 outside it. */
export function patchDepth([lat, lng, radius, aspect, angle, seed]: FloodPatch): (la: number, ln: number) => number {
  const rand = seeded(seed);
  const turn = (angle * Math.PI) / 180;
  const phase = [rand() * 6.283, rand() * 6.283, rand() * 6.283, rand() * 6.283];
  const amp = [0.13 + rand() * 0.09, 0.09 + rand() * 0.07, 0.05 + rand() * 0.04, 0.025 + rand() * 0.02];
  const mx = 111_320 * Math.max(0.2, Math.cos((lat * Math.PI) / 180));
  return (la, ln) => {
    const east = (ln - lng) * mx, north = (la - lat) * 111_320;
    const x = east * Math.cos(turn) + north * Math.sin(turn);
    const y = -east * Math.sin(turn) + north * Math.cos(turn);
    const ux = x / (radius * aspect), uy = y / radius;
    const t = Math.atan2(uy, ux);
    const wobble = 0.9 + amp[0] * Math.sin(2 * t + phase[0]) + amp[1] * Math.sin(3 * t + phase[1]) + amp[2] * Math.sin(4 * t + phase[2]) + amp[3] * Math.sin(6 * t + phase[3]);
    return Math.hypot(ux, uy) / wobble;
  };
}
