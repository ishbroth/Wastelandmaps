// Places that cannot be driven to: on a small island, or on a rock or pier a little off the coast (public/data/ferry.json, from _tools/ferry-list.ts),
// plus the famous ones by name (the Statue of Liberty, Alcatraz...). Fast travel to one of these opens a search for ferries instead of a flight search.

let ids: Promise<Set<string>> | null = null;

/** The ids of the places that are reached by boat. */
export function loadFerryIds(): Promise<Set<string>> {
  ids ??= fetch('/data/ferry.json').then((r) => (r.ok ? (r.json() as Promise<string[]>) : [])).then((list) => new Set(list)).catch(() => new Set<string>());
  return ids;
}

/** The famous places on islands, by name: always a ferry, whatever the road map says. */
const FERRY_NAMES = /statue of liberty|liberty island|ellis island|alcatraz|fort sumter|governors island|angel island|catalina island|avalon, california|block island|mackinac island|fire island|martha'?s vineyard|nantucket|santa cruz island|channel islands|fort jefferson|dry tortugas|isle royale|mont[- ]saint[- ]michel/i;
export const isFerryByName = (name: string): boolean => FERRY_NAMES.test(name);

/** The search for ferries to a place. */
export const ferryUrl = (placeName: string): string => `https://www.google.com/search?q=${encodeURIComponent(`ferry to ${placeName}`)}`;

/** How far (meters) a road may stop short of a ferry place and still count as reaching it. */
export const ROAD_STOPS_SHORT_M = 500;
