// Radiation zones: soft, uneven clouds rather than circles. Where they sit comes from _tools/build-zones.ts (sparse parts of each city, on land);
// the cloud may drift out over water. Each is [lat, lng, radius in meters, rads, seed, name of the neighborhood or suburb it sits over].

import { hashString, seeded, type LatLng } from './wasteland';

export type ZoneEntry = (number | string)[];

let loading: Promise<Record<string, ZoneEntry[]>> | null = null;
export function loadZones(): Promise<Record<string, ZoneEntry[]>> {
  if (!loading) {
    loading = fetch(`${import.meta.env.BASE_URL}data/zones.json`)
      .then((r) => (r.ok ? (r.json() as Promise<Record<string, ZoneEntry[]>>) : {}))
      .catch(() => ({}));
  }
  return loading;
}

export const zoneFromEntry = ([lat, lng, radiusMeters, rads, seed, name]: ZoneEntry) => ({
  position: { lat: lat as number, lng: lng as number }, radiusMeters: radiusMeters as number, rads: rads as number, seed: seed as number,
  ...(typeof name === 'string' && name ? { name } : {}),
});

/** An uneven cloud outline around a point: the radius swells and shrinks lobe by lobe, differently for each layer. */
export function cloudOutline(center: LatLng, radius: number, seed: number, layer: number): LatLng[] {
  const rand = seeded(hashString(`cloud:${seed}:${layer}`));
  const [p1, p2, p3, p4] = [rand() * 6.28, rand() * 6.28, rand() * 6.28, rand() * 6.28];
  const points: LatLng[] = [];
  const steps = 40;
  for (let i = 0; i < steps; i++) {
    const t = (i / steps) * Math.PI * 2;
    const r = radius * (0.78 + 0.13 * Math.sin(2 * t + p1) + 0.1 * Math.sin(3 * t + p2) + 0.07 * Math.sin(5 * t + p3) + 0.05 * Math.sin(7 * t + p4));
    points.push({
      lat: center.lat + (Math.sin(t) * r) / 111_320,
      lng: center.lng + (Math.cos(t) * r) / (111_320 * Math.max(0.2, Math.cos((center.lat * Math.PI) / 180))),
    });
  }
  return points;
}
