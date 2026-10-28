// Fast travel: how long a trip takes, how much radiation it picks up on the way, and the Pip-Boy clock.

import { distanceMeters, hashString, seeded, type LatLng, type Wasteland } from './wasteland';

/** A survivor walks about 5 km an hour. */
const WALK_METERS_PER_MINUTE = 5000 / 60;

export function travelMinutes(from: LatLng, to: LatLng): number {
  // never instant: even a short hop takes a few minutes of picking your way through rubble
  return Math.max(5, Math.round(distanceMeters(from, to) / WALK_METERS_PER_MINUTE));
}

/** Flat-earth meters from an origin, good enough over a city. */
function toLocal(origin: LatLng, p: LatLng): { x: number; y: number } {
  const lat = (origin.lat * Math.PI) / 180;
  return { x: (p.lng - origin.lng) * 111_320 * Math.cos(lat), y: (p.lat - origin.lat) * 110_540 };
}

/**
 * Radiation picked up crossing the irradiated zones on the straight line from `from` to `to`: each zone that the path cuts through adds
 * a share of its strength, in proportion to how much of the zone the path crosses.
 */
export function radsAlongRoute(from: LatLng, to: LatLng, zones: Wasteland['zones']): number {
  const a = { x: 0, y: 0 };
  const b = toLocal(from, to);
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return 0;
  let total = 0;
  for (const z of zones) {
    const c = toLocal(from, z.position);
    // closest point on the segment to the zone's center
    const t = Math.max(0, Math.min(1, ((c.x - a.x) * dx + (c.y - a.y) * dy) / len2));
    const px = a.x + t * dx;
    const py = a.y + t * dy;
    const d = Math.hypot(c.x - px, c.y - py);
    if (d >= z.radiusMeters) continue;
    // length of the path inside the circle (chord), limited to the part of the path that actually exists
    const half = Math.sqrt(z.radiusMeters ** 2 - d ** 2);
    const segLen = Math.sqrt(len2);
    const tCenter = t * segLen;
    const inside = Math.max(0, Math.min(segLen, tCenter + half) - Math.max(0, tCenter - half));
    total += z.rads * 0.5 * Math.min(1, inside / (2 * z.radiusMeters));
  }
  return Math.round(total);
}

/** "DAY 2  06:45" */
export function formatClock(totalMinutes: number): string {
  const day = Math.floor(totalMinutes / 1440) + 1;
  const m = totalMinutes % 1440;
  const hh = String(Math.floor(m / 60)).padStart(2, '0');
  const mm = String(m % 60).padStart(2, '0');
  return `DAY ${day}  ${hh}:${mm}`;
}

export const START_MINUTES = 8 * 60;

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} MIN`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h} HR` : `${h} HR ${m} MIN`;
}

const ENCOUNTERS = [
  'A radroach scuttles off the road. You let it go.',
  'You pass a burned-out convoy. Nothing worth taking.',
  'A lone brahmin watches you from a ditch and loses interest.',
  'Distant gunfire. You take the long way around.',
  'You find a pre-war vending machine. It is empty. It is always empty.',
  'A rusted billboard promises a better tomorrow. You keep walking.',
  'Wind whistles through a collapsed overpass. You do not linger.',
  'A trader nods and says nothing. Neither do you.',
  'Static on the radio, then a few bars of old music, then nothing.',
  'You spot raider graffiti on a wall and detour around it.',
];

/** A line of travel flavor, the same for the same trip. */
export function encounterFor(fromKey: string, toKey: string): string {
  const rand = seeded(hashString(`${fromKey}>${toKey}`));
  return ENCOUNTERS[Math.floor(rand() * ENCOUNTERS.length)];
}

/** One trip being animated on the map. */
export interface TravelRun {
  id: number;
  from: LatLng;
  to: LatLng;
  durationMs: number;
}
