// The wasteland's names for the big picture: continents, countries and US states, shown when the map is zoomed out. The few that come from the
// Fallout games and their lore are marked; the rest are ours. (The cities have their own names: see lore.ts.)

import { hashString, type LatLng } from './wasteland';

export interface RegionLabel {
  name: string;
  level: 'continent' | 'country' | 'state';
  position: LatLng;
  canon: boolean;
  /** The country's code, for country labels. */
  iso?: string;
  /** How big the place is: when labels would overlap on screen, the bigger one stays. */
  weight: number;
}

interface Outline { rings: number[][]; label: [number, number] }
interface StateData extends Outline { code: string; name: string }
interface CountryData extends Outline { iso: string; name: string; continent: string }
interface RegionsFile { countries: CountryData[]; states: StateData[] }

// ---- names ----

/** The big divisions of the wasteland, bigger than a country: the continents, cut up a little differently. */
const SUPER: Record<string, { name: string; at: LatLng }> = {
  frontier: { name: 'The Nuclear Frontier', at: { lat: 46, lng: -100 } },
  unfrozen: { name: 'The Unfrozen Lands', at: { lat: 70, lng: -42 } },
  dustlands: { name: 'The Dustlands', at: { lat: 19, lng: -92 } },
  amazon: { name: 'The Burnt Amazon', at: { lat: -4, lng: -60 } },
  cone: { name: 'Tierra del Fuego', at: { lat: -41, lng: -66 } },
  oldworld: { name: 'The Old Continent', at: { lat: 49, lng: 15 } },
  cold: { name: 'The Coldlands', at: { lat: 63, lng: 17 } },
  sands: { name: 'The Sands', at: { lat: 26, lng: 22 } },
  congo: { name: 'The Burnt Congo', at: { lat: -8, lng: 24 } },
  subcontinent: { name: 'The Subcontinent', at: { lat: 22, lng: 79 } },
  east: { name: 'The Eastern Wastes', at: { lat: 38, lng: 102 } },
  under: { name: 'The Underlands', at: { lat: -25, lng: 134 } },
};
const SET = (list: string) => list.split(' ');
const REGION_OF: Record<string, string> = {};
const assign = (id: string, list: string) => SET(list).forEach((iso) => { REGION_OF[iso] = id; });
assign('cone', 'CL AR UY FK');
assign('amazon', 'BR CO VE GY SR GF EC PE BO PY');
assign('dustlands', 'MX GT BZ SV HN NI CR PA CU HT DO JM BS PR TT');
assign('frontier', 'US CA');
assign('unfrozen', 'GL');
assign('cold', 'SE NO FI DK IS EE LV LT');
assign('sands', 'MA DZ TN LY EG EH MR ML NE TD SD ER DJ SO ET IR IQ SY LB IL PS JO SA YE OM AE QA KW TR CY');
assign('congo', 'NG GH TG BJ CI GN SL LR GM GW SN BF CM GQ GA CG CD CF SS UG KE RW BI TZ AO ZM MW MZ ZW BW NA ZA LS SZ MG');
assign('subcontinent', 'IN');
assign('east', 'CN JP KR KP MN KZ UZ TM KG TJ AF PK BD NP BT LK MM TH LA KH VN MY BN ID PH TL TW GE AM AZ');
assign('under', 'AU NZ PG FJ VU NC SB');

/** Which division of the wasteland a point is in. A few countries are split: Greenland and the Canadian Arctic, and Russia either side of the Urals. */
function superOf(iso: string, p: LatLng, continent: string): string {
  if (iso === 'CA' && (p.lat >= 66 || (p.lat >= 62 && p.lng >= -90 && p.lng <= -60))) return 'unfrozen';
  if (iso === 'RU') return p.lng >= 60 ? 'east' : 'oldworld';
  if (REGION_OF[iso]) return REGION_OF[iso];
  return continent === 'Europe' ? 'oldworld' : continent === 'Asia' ? 'east' : continent === 'Africa' ? 'congo' : continent === 'Oceania' ? 'under' : 'frontier';
}

/** Countries with a name of their own. */
const COUNTRY_NAMES: Record<string, string> = {
  US: 'The Commonwealths of America', CA: 'The Great White Wasteland', MX: 'The United Mexican States', BR: 'The Burnt Amazon', AR: 'The Pampas Ashes', CL: 'The Long Scorched Strip',
  PE: 'Peruvian Ruins', CO: 'Bogo-Boom Country', VE: 'The Dry Delta', CU: 'The Last Cigar', UY: 'Burntuguay', DO: 'Dominican Reclamation Zone', HT: 'The Haitian Refuge',
  GB: 'Gutted Britannia', IE: 'The Emerald Embers', FR: 'Zone des Frites', DE: 'Deutschland Dust', ES: 'The Rainy Plains', PT: 'Portu-Gone', IT: 'New Roman Republic', CH: 'The Neutral Crater',
  AT: 'The Alpine Ashes', NL: 'The Drowned Lowlands', BE: 'The Waffle Wastes', PL: 'The Polish Pits', SE: 'The Swedish Cinders', NO: 'Fallout Fjords', FI: 'The Frozen Thousand Lakes',
  DK: 'The Danish Dead Zone', GR: 'The Classical Ruins', TR: 'The Burning Bridge', RU: 'The Ironed Curtain', BY: 'The Pale Plains', RO: 'The Carpathian Cinders',
  CN: 'The Red Wastes', JP: 'Jablam', KR: 'South Krater', KP: 'North Krater', IN: 'The Subcontinent', PK: 'The Indus Cinders', ID: 'The Ring of Fire Islands', TH: 'Bye-Land',
  VN: 'The Delta Dead Zone', PH: 'The Thousand Burning Isles', IR: 'The Persian Dust', SA: 'The Oil-Slick Sands', EG: 'The Dusty Dynasty', ZA: 'The Scorched Cape', NG: 'The Niger Nuke Zone',
  KE: 'The Savanna Scorch', ET: 'The Highland Husk', AU: 'The Radioactive Outback', NZ: 'The Long Black Cloud', KZ: 'The Great Steppe Scar', MN: 'The Empty Steppe',
  CD: 'The Burnt Congo', CG: 'The Burnt Congo Basin', MG: 'The Red Island Ruins', GL: 'The Frozen Ice Waste', IS: 'The Ash Isle',
};

// Neighbors share a style, so a run of countries along a coast reads as one stretch of country: "(Condemned)", "Fallout Zone", "Scrap Belt"...
const condemned = (c: string) => c + ' (Condemned)';
const obliterated = (c: string) => c + ' (Obliterated)';
const fallout = (c: string) => c + ' Fallout Zone';
const scrap = (c: string) => c + ' Scrap Belt';
const scorched = (c: string) => 'Scorched ' + c;
const wastes = (c: string) => 'The ' + c + ' Wastes';
const GROUPS: { isos: string[]; style: (c: string) => string }[] = [
  { isos: ['MR', 'SN', 'GM', 'GW', 'ML', 'BF', 'NE', 'TD'], style: condemned }, // the Sahel and the bulge of West Africa
  { isos: ['GN', 'SL', 'LR', 'CI'], style: fallout }, // the coast below
  { isos: ['GH', 'TG', 'BJ'], style: scrap }, // the Gulf of Guinea
  { isos: ['CM', 'GQ', 'GA', 'CF', 'SS'], style: obliterated }, // Central Africa
  { isos: ['AO', 'NA', 'BW', 'ZW', 'ZM', 'MW', 'MZ', 'LS', 'SZ'], style: obliterated }, // Southern Africa
  { isos: ['TZ', 'UG', 'RW', 'BI', 'SO', 'DJ', 'ER', 'SD'], style: scorched }, // East Africa
  { isos: ['MA', 'DZ', 'TN', 'LY', 'EH'], style: fallout }, // North Africa
  { isos: ['GT', 'BZ', 'SV', 'HN', 'NI', 'CR', 'PA'], style: condemned }, // Central America
  { isos: ['EC', 'BO', 'PY', 'GY', 'SR', 'GF'], style: fallout }, // inner South America
  { isos: ['LA', 'KH', 'MM', 'MY', 'BN', 'TL'], style: scrap }, // Southeast Asia
  { isos: ['BD', 'LK', 'NP', 'BT'], style: fallout }, // around the Subcontinent
  { isos: ['UZ', 'TM', 'KG', 'TJ', 'AF'], style: obliterated }, // Central Asia
  { isos: ['JO', 'OM', 'AE', 'QA', 'KW'], style: fallout }, // the Gulf and Jordan
  { isos: ['RS', 'BA', 'HR', 'SI', 'ME', 'MK', 'AL', 'XK', 'BG', 'MD'], style: fallout }, // the Balkans
  { isos: ['EE', 'LV', 'LT'], style: scrap }, // the Baltics
  { isos: ['CZ', 'SK', 'HU'], style: condemned }, // Central Europe
  { isos: ['GE', 'AM', 'AZ'], style: obliterated }, // the Caucasus
];
const PLAIN_COUNTRIES = new Set(['UA', 'IL', 'PS', 'LB', 'SY', 'IQ', 'YE', 'AF', 'SD', 'SS', 'MM']);
const ANY = [condemned, fallout, scrap, scorched, obliterated, wastes];

/** Natural Earth abbreviates some names ("Dem. Rep. Congo"); spell them out. */
function plainName(name: string): string {
  return name
    .replace('Dem. Rep.', 'Democratic Republic of the').replace('Rep.', 'Republic').replace('Herz.', 'Herzegovina').replace('Eq.', 'Equatorial')
    .replace(/^S\. /, 'South ').replace(/^W\. /, 'Western ').replace(/^N\. /, 'Northern ').replace(' Is.', ' Islands').replace('Solomon Is.', 'Solomon Islands');
}

/** US states: the lore names where the games give one, ours elsewhere. */
const STATE_NAMES: Record<string, [string, boolean]> = {
  AL: ['Dixie Dust', false], AK: ['The Frozen Front', true], AZ: ['The Scorched Southwest', false], AR: ['The Ozark Ashes', false], CA: ['The New California Republic', true],
  CO: ['The Mile-High Divide', false], CT: ['The Nutmeg Ruins', false], DE: ['The First State of Ruin', false], DC: ['The Capital Wasteland', true], FL: ['The Sunshine Meltdown', false],
  GA: ['The Peach Pit Wastes', false], HI: ['The Isles of Rad', false], ID: ['The Spud Wastes', false], IL: ['The Land of Lincoln\'s Last Stand', false], IN: ['The Hoosier Hollows', false],
  IA: ['The Corn Husk Wastes', false], KS: ['Toto\'s Wasteland', false], KY: ['The Bluegrass Burn', false], LA: ['The Bayou Glow', false], ME: ['The Lobster Wastes', false],
  MD: ['The Old Line Rubble', false], MA: ['The Commonwealth', true], MI: ['The Mitten Meltdown', false], MN: ['The Land of 10,000 Craters', false], MS: ['The Delta Dust', false],
  MO: ['The Show-Me Rubble', false], MT: ['The Big Sky Wastes', false], NE: ['The Cornhusker Crater', false], NV: ['The Mojave Wasteland', true], NH: ['The Granite Ruins', false],
  NJ: ['The Garden of Ash', false], NM: ['Breaking Rad Country', false], NY: ['The Empire State of Ruin', false], NC: ['The Tar Heel Wastes', false], ND: ['The Bakken Burn', false],
  OH: ['The Buckeye Badlands', false], OK: ['The Sooner Ashes', false], OR: ['The End of the Oregon Trail', false], PA: ['The Keystone Ruins', false], RI: ['The Rhode Rubble', false],
  SC: ['The Palmetto Wastes', false], SD: ['The Black Hills Burn', false], TN: ['The Volunteer Wastes', false], TX: ['The Lone Star Fallout', false], UT: ['New Canaan', true],
  VT: ['The Green Mountain Ruins', false], VA: ['The Old Dominion Ruins', false], WA: ['The Evergreen Ashlands', false], WV: ['Appalachia', true], WI: ['The Dairyland Dead Zone', false],
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

export interface Where { continent: string; region: string; country: string | null; countryName: string | null; state: string | null }

/** Which continent, country and US state a point is in; null where the map is open sea. */
export function whereIs(data: RegionsFile, p: LatLng): Where | null {
  let country = data.countries.find((c) => contains(c, p)) ?? null;
  if (!country) {
    // the outlines are coarse, so a coast or an island can fall just outside: take the nearest country within a few hundred km
    let nearest = 600;
    for (const c of data.countries) {
      const km = Math.hypot((c.label[0] - p.lat) * 111.32, (c.label[1] - p.lng) * 111.32 * Math.cos((p.lat * Math.PI) / 180));
      if (km < nearest) { nearest = km; country = c; }
    }
  }
  if (!country) return null;
  const state = country.iso === 'US' ? data.states.find((s) => contains(s, p)) ?? null : null;
  return { continent: country.continent, region: superOf(country.iso, p, country.continent), country: country.iso, countryName: country.name, state: state?.code ?? null };
}

export const regionName = (id: string): string | null => SUPER[id]?.name ?? null;
export const stateName = (code: string): { name: string; canon: boolean } | null => (STATE_NAMES[code] ? { name: STATE_NAMES[code][0], canon: STATE_NAMES[code][1] } : null);
export function countryName(iso: string, realName: string): string {
  // places in the middle of a war keep their plain names: no joke
  if (PLAIN_COUNTRIES.has(iso)) return plainName(realName);
  if (COUNTRY_NAMES[iso]) return COUNTRY_NAMES[iso];
  const name = plainName(realName);
  const group = GROUPS.find((g) => g.isos.includes(iso));
  if (group) return group.style(name);
  return ANY[hashString(iso) % ANY.length](name);
}

/** The name for the middle of the map at this zoom: a continent when far out, a country, then a US state; null when close in (cities name themselves). */
export function nameForZoom(data: RegionsFile, p: LatLng, zoom: number): string | null {
  if (zoom >= 9) return null;
  const where = whereIs(data, p);
  if (!where) return null;
  if (zoom < 4) return regionName(where.region);
  if (zoom >= 6 && where.state) return stateName(where.state)?.name ?? null;
  return where.country ? countryName(where.country, where.countryName ?? where.country) : null;
}

/** Roughly how big a place is on the map (the box around its largest piece), for deciding which label stays when two would overlap. */
function areaOf(o: Outline): number {
  let best = 0;
  for (const ring of o.rings) {
    let [west, east, south, north] = [Infinity, -Infinity, Infinity, -Infinity];
    for (let i = 0; i < ring.length; i += 2) { west = Math.min(west, ring[i]); east = Math.max(east, ring[i]); south = Math.min(south, ring[i + 1]); north = Math.max(north, ring[i + 1]); }
    best = Math.max(best, (east - west) * (north - south));
  }
  return best;
}

/** Every label that can appear on the map, with the level it belongs to. */
export function allLabels(data: RegionsFile): RegionLabel[] {
  const labels: RegionLabel[] = Object.values(SUPER).map((c) => ({ name: c.name, level: 'continent', position: c.at, canon: false, weight: 1e9 }));
  for (const c of data.countries) labels.push({ name: countryName(c.iso, c.name), level: 'country', position: { lat: c.label[0], lng: c.label[1] }, canon: false, iso: c.iso, weight: areaOf(c) });
  for (const s of data.states) {
    const n = stateName(s.code);
    if (n) labels.push({ name: n.name, level: 'state', position: { lat: s.label[0], lng: s.label[1] }, canon: n.canon, weight: areaOf(s) * 3 });
  }
  // places the stories name that are smaller than any metro on the map
  for (const place of LORE_PLACES) labels.push({ name: place.name, level: 'state', position: place.at, canon: true, weight: 1e7 });
  return labels;
}

/** The country this device is probably in, from its language setting (en-GB) or time zone; null when it cannot tell. */
export function deviceCountry(): string | null {
  try {
    const tag = (navigator.languages?.[0] ?? navigator.language ?? '').trim();
    const region = /[-_]([A-Za-z]{2})$/.exec(tag);
    if (region) return region[1].toUpperCase();
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone ?? '';
    const byZone: [RegExp, string][] = [
      [/^Europe\/London/, 'GB'], [/^Europe\/Paris/, 'FR'], [/^Europe\/Berlin/, 'DE'], [/^Europe\/Madrid/, 'ES'], [/^Europe\/Rome/, 'IT'], [/^Europe\/Moscow/, 'RU'],
      [/^Asia\/Tokyo/, 'JP'], [/^Asia\/Seoul/, 'KR'], [/^Asia\/Shanghai/, 'CN'], [/^Asia\/Kolkata|^Asia\/Calcutta/, 'IN'], [/^Australia\//, 'AU'], [/^Pacific\/Auckland/, 'NZ'],
      [/^America\/(Toronto|Vancouver|Edmonton|Winnipeg|Halifax)/, 'CA'], [/^America\/Mexico_City/, 'MX'], [/^America\/(Sao_Paulo|Bahia|Fortaleza)/, 'BR'],
      [/^America\/Argentina|^America\/Buenos_Aires/, 'AR'], [/^America\//, 'US'],
    ];
    return byZone.find(([re]) => re.test(zone))?.[1] ?? null;
  } catch {
    return null;
  }
}

/** North America: where the map starts when nothing says otherwise. */
export const NORTH_AMERICA: google.maps.LatLngBoundsLiteral = { north: 58, south: 14, west: -135, east: -58 };

/** A frame around a country's mainland (its largest piece), with a little room. Null if we have no outline for it. */
export function countryBounds(data: RegionsFile, iso: string | null): google.maps.LatLngBoundsLiteral | null {
  const country = iso ? data.countries.find((c) => c.iso === iso) : null;
  if (!country) return null;
  let best: number[] | null = null;
  let bestArea = -1;
  for (const ring of country.rings) {
    let area = 0;
    for (let i = 0; i < ring.length - 2; i += 2) area += ring[i] * ring[i + 3] - ring[i + 2] * ring[i + 1];
    if (Math.abs(area) > bestArea) { bestArea = Math.abs(area); best = ring; }
  }
  if (!best) return null;
  let [west, east, south, north] = [Infinity, -Infinity, Infinity, -Infinity];
  for (let i = 0; i < best.length; i += 2) { west = Math.min(west, best[i]); east = Math.max(east, best[i]); south = Math.min(south, best[i + 1]); north = Math.max(north, best[i + 1]); }
  const padLng = (east - west) * 0.08;
  const padLat = (north - south) * 0.08;
  return { north: north + padLat, south: south - padLat, east: east + padLng, west: west - padLng };
}

/** Which levels show at a zoom. */
export function levelsAt(zoom: number): RegionLabel['level'][] {
  if (zoom < 4) return ['continent'];
  if (zoom < 6) return ['country'];
  if (zoom < 9) return ['state', 'country'];
  return [];
}
