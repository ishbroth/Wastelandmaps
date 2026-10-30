// Points and levels. Reaching a place earns points by how famous or important it is; points fill a level bar, and every level reached gives a free
// snapshot credit. Level 1 is eight of the least valuable places (8 x 10 = 80 points); every level after that asks for 5% more points than the one before.

import { freeRenderFor } from './renders';
import type { Location } from './wasteland';

export const FIRST_LEVEL_POINTS = 80;
/** Each level needs this many times the points of the one before. */
export const LEVEL_GROWTH = 1.05;

/** What each kind of place is worth, top to bottom, for the explanation in the Data tab. */
export const POINT_TIERS: { points: number; label: string }[] = [
  { points: 100, label: 'Landmarks with a permanent snapshot' },
  { points: 50, label: 'Other world-famous landmarks' },
  { points: 30, label: 'Government buildings, museums, skyscrapers, places from the stories' },
  { points: 20, label: 'Libraries, office plazas, arenas, restaurants, stores' },
  { points: 15, label: 'Bridges, schools, labs, universities, hospitals' },
  { points: 10, label: 'Transit, parks, neighborhoods and everything else' },
];

const GOVERNMENT = /capitol|city hall|town hall|courthouse|court house|parliament|congress|legislat|state house|statehouse|government|council|rathaus|ayuntamiento|mairie|senate|assembly|palace|castle|embassy|consulate|county (?:building|hall)/i;
const MUSEUM = /museum|mus[eé]e|museo|gallery|galerie|aquarium|planetarium/i;
const SKYSCRAPER = /skyscraper|\btower\b(?! bridge)|\bwtc\b|world trade|one \w+ (?:plaza|center)|hochhaus|rascacielos/i;
const TIER_20 = /library|biblioth|plaza|office|arena|stadium|ballpark|theat(?:re|er)|restaurant|diner|grill|bistro|caf[eé]|pub\b|store|shop|mall|market|department|opera|casino/i;
const TIER_15 = /bridge|pont\b|school|college|university|universit|institute|academy|laborator|\blab\b|hospital|clinic|medical/i;

/** Points for reaching a place. */
export function pointsFor(loc: Location): number {
  if (freeRenderFor(loc.id)) return 100;
  if (loc.famous) return 50;
  if (loc.lore || loc.vault) return 30;
  if (loc.neighborhood) return 10;
  const real = loc.oldName || loc.name;
  const icon = loc.icon;
  if (loc.category === 'guard' && GOVERNMENT.test(real)) return 30;
  if (icon === 'capitol' || icon === 'museum' || icon === 'skyscraper') return 30;
  if (GOVERNMENT.test(real) && loc.category !== 'park') return 30;
  if (MUSEUM.test(real)) return 30;
  if (SKYSCRAPER.test(real)) return 30;
  if (icon === 'book' || icon === 'theatre' || icon === 'stadium' || icon === 'fork' || icon === 'cart' || TIER_20.test(real)) return 20;
  if (icon === 'bridge' || icon === 'school' || icon === 'beaker' || icon === 'hospital' || TIER_15.test(real)) return 15;
  return 10;
}

/** Total points needed to reach a level (level 0 needs none). */
export const pointsForLevel = (level: number): number => Math.ceil((FIRST_LEVEL_POINTS * (Math.pow(LEVEL_GROWTH, level) - 1)) / (LEVEL_GROWTH - 1) - 1e-9);

export interface LevelInfo {
  level: number;
  /** Points earned inside the current level. */
  into: number;
  /** Points the current level asks for. */
  needed: number;
  /** Points still to go to the next level. */
  toGo: number;
}

/** Where a points total puts someone: their level and how far through the next one they are. */
export function levelInfo(points: number): LevelInfo {
  let level = Math.max(0, Math.floor(Math.log(1 + (points * (LEVEL_GROWTH - 1)) / FIRST_LEVEL_POINTS) / Math.log(LEVEL_GROWTH) + 1e-9));
  while (pointsForLevel(level + 1) <= points) level++;
  while (level > 0 && pointsForLevel(level) > points) level--;
  const from = pointsForLevel(level);
  const to = pointsForLevel(level + 1);
  return { level, into: points - from, needed: to - from, toGo: to - points };
}
