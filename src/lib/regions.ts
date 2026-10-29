// The wasteland's names for the big picture: continents, countries and US states, shown when the map is zoomed out. The few that come from the
// Fallout games and their lore are marked; the rest are ours. (The cities have their own names: see lore.ts.)

import { wastelandName } from './lore';
import type { LatLng } from './wasteland';

export interface RegionLabel {
  name: string;
  level: 'continent' | 'country' | 'state';
  position: LatLng;
  canon: boolean;
}

interface Outline { rings: number[][]; label: [number, number] }
interface StateData extends Outline { code: string; name: string }
interface CountryData extends Outline { iso: string; name: string; continent: string }
interface RegionsFile { countries: CountryData[]; states: StateData[] }

// ---- names ----

const CONTINENTS: Record<string, { name: string; at: LatLng }> = {
  'North America': { name: 'The Nuclear Frontier', at: { lat: 46, lng: -100 } },
  'South America': { name: 'The Southern Ashes', at: { lat: -14, lng: -60 } },
  Europe: { name: 'The Old Continent', at: { lat: 52, lng: 18 } },
  Africa: { name: 'The Dust Continent', at: { lat: 5, lng: 20 } },
  Asia: { name: 'The Eastern Wastes', at: { lat: 45, lng: 90 } },
  Oceania: { name: 'The Outback Rads', at: { lat: -26, lng: 134 } },
};

/** Countries with a name of their own. Any other country gets a name built from its own, in the style of the city names. */
const COUNTRY_NAMES: Record<string, string> = {
  US: 'The Shattered States', CA: 'The Great White Wasteland', MX: 'Mexi-Crater', BR: 'The Burnt Amazon', AR: 'The Pampas Ashes', CL: 'The Long Scorched Strip',
  PE: 'The Inca Ruins', CO: 'Bogo-Boom Country', VE: 'The Dry Delta', CU: 'The Last Cigar',
  GB: 'Gutted Britannia', IE: 'The Emerald Embers', FR: 'Fallout France', DE: 'Deutschland Dust', ES: 'Ash-pain', PT: 'Portu-Gone', IT: 'It-Ashy', CH: 'The Neutral Crater',
  AT: 'The Alpine Ashes', NL: 'The Drowned Lowlands', BE: 'The Waffle Wastes', PL: 'The Polish Pits', SE: 'The Swedish Cinders', NO: 'The Fjords of Fallout', FI: 'The Frozen Thousand Lakes',
  DK: 'The Danish Dead Zone', GR: 'The Classical Ruins', TR: 'The Burning Bridge', RU: 'Mother Russia, Melted', UA: 'Ukraine', BY: 'The Pale Plains', RO: 'The Carpathian Cinders',
  CN: 'The Red Wastes', JP: 'The Rising Rad', KR: 'The Hermit Rubble', IN: 'The Subcontinent of Ash', PK: 'The Indus Cinders', ID: 'The Ring of Fire Islands', TH: 'The Land of the Free-Fall',
  VN: 'The Delta Dead Zone', PH: 'The Thousand Burning Isles', IR: 'The Persian Dust', SA: 'The Oil-Slick Sands', EG: 'The Pyramids of Ash', ZA: 'The Scorched Cape', NG: 'The Niger Nuke Zone',
  KE: 'The Savanna Scorch', ET: 'The Highland Husk', AU: 'The Radioactive Outback', NZ: 'The Long Black Cloud', KZ: 'The Great Steppe Scar', MN: 'The Empty Steppe',
};

/** US states: the lore names where the games give one, ours elsewhere. */
const STATE_NAMES: Record<string, [string, boolean]> = {
  AL: ['Dixie Dust', false], AK: ['The Frozen Front', true], AZ: ['The Scorched Southwest', false], AR: ['The Ozark Ashes', false], CA: ['The New California Republic', true],
  CO: ['The Mile-High Divide', false], CT: ['The Nutmeg Ruins', false], DE: ['The First State of Ruin', false], DC: ['The Capital Wasteland', true], FL: ['The Sunshine Meltdown', false],
  GA: ['The Peach Pit Wastes', false], HI: ['The Isles of Rad', false], ID: ['The Spud Wastes', false], IL: ['The Land of Lincoln\'s Last Stand', false], IN: ['The Hoosier Hollows', false],
  IA: ['The Corn Husk Wastes', false], KS: ['Toto\'s Wasteland', false], KY: ['The Bluegrass Burn', false], LA: ['The Bayou Glow', false], ME: ['The Lobster Wastes', false],
  MD: ['The Old Line Rubble', false], MA: ['The Commonwealth', true], MI: ['The Mitten Meltdown', false], MN: ['The Land of 10,000 Craters', false], MS: ['The Delta Dust', false],
  MO: ['The Show-Me Rubble', false], MT: ['The Big Sky Wastes', false], NE: ['The Cornhusker Crater', false], NV: ['The Mojave Wasteland', true], NH: ['The Granite Ghost Towns', false],
  NJ: ['The Garden of Ash', false], NM: ['Breaking Rad Country', false], NY: ['The Empire State of Ruin', false], NC: ['The Tar Heel Wastes', false], ND: ['The Bakken Burn', false],
  OH: ['The Buckeye Badlands', false], OK: ['The Sooner Ashes', false], OR: ['The End of the Oregon Trail', false], PA: ['The Keystone Ruins', false], RI: ['The Rhode Rubble', false],
  SC: ['The Palmetto Wastes', false], SD: ['The Black Hills Burn', false], TN: ['The Volunteer Wastes', false], TX: ['The Lone Star Fallout', false], UT: ['New Canaan', true],
  VT: ['The Green Mountain Ghost Towns', false], VA: ['The Old Dominion Ruins', false], WA: ['The Evergreen Ashlands', false], WV: ['Appalachia', true], WI: ['The Dairyland Dead Zone', false],
  WY: ['The Cowboy Craters', false],
};

/** Places in the lore that are too small to be a metro: shown as labels, with the states. */
const LORE_PLACES: { name: string; at: LatLng }[] = [
  { name: 'Shady Sands', at: { lat: 33.83, lng: -116.55 } }, // the Palm Springs area
];

// ---- the outlines ----

let loading: Promise<RegionsFile | null> | null = null;
export function loadRegions(): Promise<RegionsFile | null> {
  if (!loading) {
    loading = fetch(`${import.meta.env.BASE_URL}data/regions.json`)
      .then((r) => (r.ok ? (r.json() as Promise<RegionsFile>) : null))
      .catch(() => null);
  }
  return loading;
}

/** Is the point inside the ring? (flat [lng, lat, ...] list) */
function inside(ring: number[], lat: number, lng: number): boolean {
  let hit = false;
  for (let i = 0, j = ring.length - 2; i < ring.length; j = i, i += 2) {
    const [xi, yi, xj, yj] = [ring[i], ring[i + 1], ring[j], ring[j + 1]];
    if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}
const contains = (o: Outline, p: LatLng) => o.rings.some((r) => inside(r, p.lat, p.lng));

export interface Where { continent: string; country: string | null; countryName: string | null; state: string | null }

/** Which continent, country and US state a point is in; null where the map is open sea. */
export function whereIs(data: RegionsFile, p: LatLng): Where | null {
  const country = data.countries.find((c) => contains(c, p)) ?? null;
  if (!country) return null;
  const state = country.iso === 'US' ? data.states.find((s) => contains(s, p)) ?? null : null;
  return { continent: country.continent, country: country.iso, countryName: country.name, state: state?.code ?? null };
}

export const continentName = (continent: string): string | null => CONTINENTS[continent]?.name ?? null;
export const stateName = (code: string): { name: string; canon: boolean } | null => (STATE_NAMES[code] ? { name: STATE_NAMES[code][0], canon: STATE_NAMES[code][1] } : null);
export function countryName(iso: string, realName: string): string {
  return COUNTRY_NAMES[iso] ?? wastelandName(realName, '', iso).name;
}

/** The name for the middle of the map at this zoom: a continent when far out, a country, then a US state; null when close in (cities name themselves). */
export function nameForZoom(data: RegionsFile, p: LatLng, zoom: number): string | null {
  if (zoom >= 9) return null;
  const where = whereIs(data, p);
  if (!where) return null;
  if (zoom < 4) return continentName(where.continent);
  if (zoom >= 6 && where.state) return stateName(where.state)?.name ?? null;
  return where.country ? countryName(where.country, where.countryName ?? where.country) : null;
}

/** Every label that can appear on the map, with the level it belongs to. */
export function allLabels(data: RegionsFile): RegionLabel[] {
  const labels: RegionLabel[] = Object.values(CONTINENTS).map((c) => ({ name: c.name, level: 'continent', position: c.at, canon: false }));
  for (const c of data.countries) labels.push({ name: countryName(c.iso, c.name), level: 'country', position: { lat: c.label[0], lng: c.label[1] }, canon: false });
  for (const s of data.states) {
    const n = stateName(s.code);
    if (n) labels.push({ name: n.name, level: 'state', position: { lat: s.label[0], lng: s.label[1] }, canon: n.canon });
  }
  // places the stories name that are smaller than any metro on the map
  for (const place of LORE_PLACES) labels.push({ name: place.name, level: 'state', position: place.at, canon: true });
  return labels;
}

/** Which levels show at a zoom. */
export function levelsAt(zoom: number): RegionLabel['level'][] {
  if (zoom < 4) return ['continent'];
  if (zoom < 6) return ['country'];
  if (zoom < 9) return ['state', 'country'];
  return [];
}
