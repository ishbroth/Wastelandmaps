// How much of an area a person has explored: the pre-plotted places (and permanent landmarks) they have discovered out of all the pre-plotted places there, plus their
// home vault, which counts as one place in its own metro. Personal address lookups and atlas unlocks are not counted.

import type { MetroEntry } from './metros';
import { whereIs, type ExploreScope, type RegionsFile } from './regions';

export type Scope = ExploreScope | { level: 'metro'; key: string };

let regionOfCountry: Map<string, string> | null = null;
/** The region each country belongs to (worked out once, from each country's biggest metro). */
function regionsOf(index: MetroEntry[], data: RegionsFile): Map<string, string> {
  if (regionOfCountry) return regionOfCountry;
  const biggest = new Map<string, MetroEntry>();
  for (const m of index) { const b = biggest.get(m.country); if (!b || m.pop > b.pop) biggest.set(m.country, m); }
  const out = new Map<string, string>();
  for (const [iso, m] of biggest) { const w = whereIs(data, { lat: m.lat, lng: m.lng }); if (w) out.set(iso, w.region); }
  return (regionOfCountry = out);
}

/** Percent explored (0 to 100) in the scope, or null when there is nothing to measure. `found` counts the discovered pre-plotted places by metro. */
export function exploredPercent(scope: Scope, index: MetroEntry[], data: RegionsFile | null, found: Map<string, number>, home: { metro: string | null; /** The home is one of the pre-plotted places (it is not a place of its own). */ preplotted: boolean; /** ...and it is already among the places found. */ found: boolean }): number | null {
  let match: (m: MetroEntry) => boolean;
  if (scope.level === 'metro') match = (m) => m.id === scope.key;
  else if (scope.level === 'country') match = (m) => m.country === scope.key;
  else if (scope.level === 'state') match = (m) => m.country === 'US' && m.id.split('-')[1]?.toUpperCase() === scope.key;
  else {
    if (!data) return null;
    const of = regionsOf(index, data);
    match = (m) => of.get(m.country) === scope.key;
  }
  let have = 0, total = 0;
  for (const m of index) {
    if (!match(m)) continue;
    const here = m.id === home.metro;
    // a home vault is one more place in its metro, unless it already is one of the pre-plotted places (then it is counted once, as found)
    total += m.places + (here && !home.preplotted ? 1 : 0);
    have += Math.min(found.get(m.id) ?? 0, m.places) + (here && (!home.preplotted || !home.found) ? 1 : 0);
  }
  return total > 0 ? (have / total) * 100 : null;
}

export const percentText = (p: number): string => {
  // always one decimal (56.8, 60.0); a bit explored never reads 0.0, and a bit short of everything never reads 100.0
  const t = p > 0 ? Math.max(p, 0.1) : 0;
  return (p < 100 ? Math.min(t, 99.9) : 100).toFixed(1);
};
