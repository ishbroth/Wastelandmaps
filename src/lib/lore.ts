// What the wasteland calls a region. A few real places already have names in the Fallout games and their lore; those keep them. Everything
// else gets a name in the same spirit: a hand-made play on the name for the bigger cities, a rule-made pun where the city's name allows one, and
// for the rest a name built from the city's own in one of a couple of dozen shapes (always the same name for the same city). Place names are
// lore references only, no game text or art is used.

import { hashString } from './wasteland';

export interface RegionName {
  name: string;
  /** True when the name comes from the Fallout games or lore, false when it is ours. */
  canon: boolean;
}

/** Lowercase, accents removed: "São Paulo" is "sao paulo". */
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/** Real cities (and a whole state) with a name in the games and lore. Keys are "city|ST", lowercased city. */
const CANON: Record<string, string> = {
  'cathedral city|ca': 'Shady Sands', // Palm Springs and its neighbors: the metro's biggest town
  'palm springs|ca': 'Shady Sands',
  'redding|ca': 'Redding',
  'klamath falls|or': 'Klamath',
  'ontario|ca': 'The Hub',
  'san bernardino|ca': 'The Hub',
  'riverside|ca': 'The Hub',
  'sacramento|ca': 'New California Republic City',
  'bakersfield|ca': 'Necropolis',
  'washington|dc': 'The Capital Wasteland',
  'boston|ma': 'The Commonwealth',
  'cambridge|ma': 'The Commonwealth',
  'las vegas|nv': 'New Vegas',
  'north las vegas|nv': 'New Vegas',
  'henderson|nv': 'The Mojave Wasteland',
  'boulder city|nv': 'The Mojave Wasteland',
  'san diego|ca': 'Dayglow',
  'pittsburgh|pa': 'The Pitt',
  'anchorage|ak': 'Anchorage, the Frozen Front',
  'los angeles|ca': 'The Boneyard',
  'reno|nv': 'New Reno',
};
/** Whole states: the games set a region over all of it. */
const CANON_STATE: Record<string, string> = {
  wv: 'Appalachia',
  ut: 'New Canaan',
};

/** Places where a joke would be in poor taste: they keep their own names. Keys are "city|ST" (US) or "city|CC" (elsewhere). */
const PLAIN = new Set(['hiroshima|jp', 'nagasaki|jp', 'fukushima|jp', 'oklahoma city|ok', 'slavutych|ua']);
/** Whole countries where it would be in poor taste (an ongoing war). */
const PLAIN_COUNTRY = new Set(['UA']);


/**
 * Names made up for the bigger cities. About half are a play on the city's name, the rest are plain and descriptive ("Metro Paris Ruins",
 * "San Fran Ruins"). The very biggest cities lean plain: an old megacity is a place, not a punchline. Keys are "city|ST" (US) or "city|CC"
 * (elsewhere), accents removed.
 */
const NICKNAMES: Record<string, string> = {
  'bridgeport|ct': 'The Bridge',
  // United States: plays on the name
  'detroit|mi': 'The Motor City Wasteland',
  'atlanta|ga': 'Atomlanta',
  'chicago|il': 'Chicagoland Wastes',
  'new york|ny': 'Nuke York City',
  'new york city|ny': 'Nuke York City',
  'seattle|wa': 'The Emerald Ashlands',
  'miami|fl': 'Miami Flood Zone',
  'orlando|fl': 'Magic Kingdom Come',
  'houston|tx': 'H-Town',
  'dallas|tx': 'Big D',
  'austin|tx': 'Austin Ruins',
  'amarillo|tx': 'Amarillo Armageddon',
  'phoenix|az': 'Phoenix Ruins',
  'albuquerque|nm': 'Querque',
  'salt lake city|ut': 'The Great Salt Waste',
  'nashville|tn': 'Nukeville',
  'memphis|tn': 'Mud City',
  'new south memphis|tn': 'Mud City',
  'memphis|ms': 'Mud City',
  'memphis|ar': 'Mud City',
  'green bay|wi': 'Green Ray',
  'grand rapids|mi': 'Ground Zero Rapids',
  'toledo|oh': 'Totaled-ledo',
  'little rock|ar': 'Little Wreck',
  'west palm beach|fl': 'West Bombed Beach',
  'hamilton|ca': 'Bamilton',
  'hamilton|on': 'Bamilton',
  'new orleans|la': 'Nuke Orleans',
  'minneapolis|mn': 'The Twin Craters Area',
  'saint paul|mn': 'The Twin Craters Area',
  'new haven|ct': 'Nuke Haven',
  'rochester|ny': 'Roach-ester',
  'san jose|ca': 'Silicon Rubble',
  'raleigh|nc': 'The Triangle Glow',
  'birmingham|al': 'Burn-ingham',
  'mobile|al': 'Mobile Home Ruins',
  'des moines|ia': 'Des Moines Minefield',
  'omaha|ne': 'Ohmygod',
  'tulsa|ok': 'Tulsa Oil Fields',
  'kansas city|mo': 'The Barbecue Badlands',
  'denver|co': 'Mile High Ruins',
  'tampa|fl': 'The Tampa Bay Glow',
  'cleveland|oh': 'The Cleve',
  'buffalo|ny': 'The Buffalo Blight',
  'honolulu|hi': 'The Isles of Rad',
  'chattanooga|tn': 'Chattanuke-a',
  // United States: plain
  'philadelphia|pa': 'New Philly',
  'atlantic city|nj': 'Atlantic City Boardwalk Ruins',
  'portland|or': 'Portlandia',
  'portland|me': 'The Lobster Wastes',
  'jacksonville|fl': 'Jax',
  'st. petersburg|fl': 'Saint Pete',
  'saint petersburg|fl': 'Saint Pete',
  'fort worth|tx': 'The Fort',
  'san antonio|tx': 'Military City',
  'el paso|tx': 'El Paso Borderlands',
  'lubbock|tx': 'Lubbock Dust Bowl',
  'corpus christi|tx': 'Corpus Christi Blast Area',
  'colorado springs|co': 'Colorado Springs Bunkers',
  'tucson|az': 'Two-Sun',
  'santa fe|nm': 'Santa Fe Remnants',
  'knoxville|tn': 'Old Knoxville Ruins',
  'saint louis|mo': 'Arch City Ruins',
  'st. louis|mo': 'Arch City Ruins',
  'cincinnati|oh': 'Cincinnukey',
  'columbus|oh': 'C-Bust',
  'indianapolis|in': 'Indianucleus',
  'milwaukee|wi': 'The Brew Town Bunkers',
  'louisville|ky': 'Derby City Ruins',
  'baltimore|md': 'Charm City Ruins',
  'providence|ri': 'The Rhode Rubble',
  'hartford|ct': 'The Hartford Hollows',
  'albany|ny': 'Albany Remnants',
  'san francisco|ca': 'San Blam',
  'oakland|ca': 'Smokeland',
  'sacramento|ca': 'Sacramento Golden Ruins',
  'bakersfield|ca': 'Bakersfield Dustlands',
  'fresno|ca': 'Fresno Dust Fields',
  'anaheim|ca': 'Anaheim Wreckage',
  'long beach|ca': 'Long Beach Blast Area',
  'richmond|va': 'The Richmond Remains',
  'virginia beach|va': 'Virginia Beach Ruins',
  'charlotte|nc': 'The Queen City Craters',
  'charleston|sc': 'The Lowlands',
  'savannah|ga': 'Savannah Hollows',
  'huntsville|al': 'Rocket City Ruins',
  'tacoma|wa': 'Tacoma Dome Ruins',
  // Canada and Mexico
  'montreal|ca': 'Mont-Rubble',
  'toronto|ca': 'Ronto',
  'vancouver|ca': 'Bamcouver',
  'calgary|ca': 'Calgary Stampede Ruins',
  'ottawa|ca': 'Ottawa Ashes',
  'mexico city|mx': 'Mexi-Crater City',
  // Europe
  'rome|it': 'New Rome',
  'vienna|at': 'Vienna Sausage Ruins',
  'budapest|hu': 'Buda-Pest Control',
  'amsterdam|nl': 'Amsterblam',
  'brussels|be': 'The Brux',
  'munich|de': 'Munich Munitions Depot',
  'glasgow|gb': 'Glass-Gone',
  'istanbul|tr': 'Istan-Bulldozed',
  'athens|gr': 'Atom-hens',
  'paris|fr': 'Metro Paris Ruins',
  'london|gb': 'The Smoke',
  'berlin|de': 'Berlin Disputed Territories',
  'madrid|es': 'Madrid Remnants',
  'barcelona|es': 'Bombcelona',
  'milan|it': 'Milan Remnants',
  'naples|it': 'Naples Ash Fields',
  'warsaw|pl': 'Warsaw Warlands',
  'prague|cz': 'Old Prague Remnants',
  'lisbon|pt': 'Lisbon Blast Area',
  'dublin|ie': 'Dublin Embattlement',
  'moscow|ru': 'Moscow Warlands',
  'saint petersburg|ru': 'Old Petersburg Abandonment',
  'hamburg|de': 'Die Burg',
  'cologne|de': 'The Colony',
  'stockholm|se': 'Stockholm Ruins',
  'copenhagen|dk': 'Copenhagen Remnants',
  'edinburgh|gb': 'Edinburgh Old Town Ruins',
  'manchester|gb': 'Manchester Mill Ruins',
  'birmingham|gb': 'Old Birmingham Smokestacks',
  'liverpool|gb': 'Liverpool Docklands Ruins',
  // Asia and Oceania
  'tokyo|jp': 'Tokyo Kaiju Crater',
  'seoul|kr': 'Seoul-Less',
  'hong kong|hk': 'Hong-Gone',
  'bangkok|th': 'Bang-Kaboom',
  'jakarta|id': 'Jakarta-strophe',
  'manila|ph': 'Manila Wreckage',
  'delhi|in': 'Delhi Dust Bowl',
  'new delhi|in': 'Delhi Dust Bowl',
  'karachi|pk': 'Karachi Crater',
  'melbourne|au': 'Meltburn',
  'perth|au': 'Boorloo',
  'brisbane|au': 'Brisbane Blast Zone',
  'beijing|cn': 'The Forbidden Zone',
  'shanghai|cn': 'The Shanghai Colony',
  'mumbai|in': 'Old Mumbai Abandonment',
  'osaka|jp': 'Osaka Blast Area',
  'kyoto|jp': 'Old Kyoto Temple Ruins',
  'nagoya|jp': 'Nagoya Ruins',
  'busan|kr': 'Busan Port Ruins',
  'guangzhou|cn': 'Guangzhou Remnants',
  'shenzhen|cn': 'Shenzhen Silicon Ruins',
  'chongqing|cn': 'Chongqing Mountain Ruins',
  'taipei|tw': 'Taipei Ruins',
  'singapore|sg': 'Singapore Scrapyard',
  'kuala lumpur|my': 'Kabooma Lumpur',
  'ho chi minh city|vn': 'The Ho',
  'thanh pho ho chi minh|vn': 'The Ho',
  'saigon|vn': 'The Ho',
  'kolkata|in': 'Old Calcutta Ruins',
  'bangalore|in': 'Bangalore Ruins',
  'dhaka|bd': 'Dhaka Delta Ruins',
  'sydney|au': 'Sydney Harbour Ruins',
  'auckland|nz': 'Auckland Remnants',
  'dubai|ae': 'Dubai Dust Fields',
  // Africa and the Americas
  'johannesburg|za': 'Jo\'Burn',
  'cape town|za': 'Cape-Down',
  'buenos aires|ar': 'Buenos Ashes',
  'cairo|eg': 'Old Cairo Ruins',
  'lagos|ng': 'Lagos Embattlement',
  'nairobi|ke': 'Nairobi Savanna Ruins',
  'sao paulo|br': 'Old São Paulo Abandonment',
  'rio de janeiro|br': 'Rio de Janeiro Ruins',
  'santiago|cl': 'Santiago Remnants',
  'lima|pe': 'Lima Ruins',
  'bogota|co': 'Bogotá Highland Ruins',
  'caracas|ve': 'Caracas Ruins',
  'havana|cu': 'Havana Hollows',
  'medellin|co': 'Medellín Valley Ruins',
};

/**
 * Plain, descriptive shapes: what a place that was abandoned and fought over in the years since might be called. Used for most cities and
 * always for the biggest ones.
 */
const PLAIN_TEMPLATES = [
  (c: string) => `${c} Ruins`,
  (c: string) => `Metro ${c} Ruins`,
  (c: string) => `Greater ${c} Ruins`,
  (c: string) => `Old ${c}`,
  (c: string) => `Old ${c} Abandonment`,
  (c: string) => `${c} Remnants`,
  (c: string) => `The ${c} Colony`,
  (c: string) => `${c} Warlands`,
  (c: string) => `${c} Blast Area`,
  (c: string) => `${c} Embattlement`,
  (c: string) => `${c} Disputed Territories`,
  (c: string) => `The Condemned ${c}`,
  (c: string) => `Abandoned ${c}`,
  (c: string) => `${c} Fields`,
  (c: string) => `${c} Ash Fields`,
  (c: string) => `${c} Badlands`,
  (c: string) => `The ${c} Wasteland`,
  (c: string) => `${c} Dead Zone`,
  (c: string) => `${c} Lost Settlement`,
  (c: string) => `${c} Frontier`,
  (c: string) => `The ${c} Reclamation Zone`,
  (c: string) => `${c} Scrap Belt`,
  (c: string) => `The Fallen ${c}`,
  (c: string) => `${c} Outskirts Ruins`,
  (c: string) => `${c} Hollows`,
  (c: string) => `The ${c} Fallout Zone`,
  (c: string) => `${c} Wreckage`,
  (c: string) => `The Shattered ${c}`,
  (c: string) => `Shattered ${c}`,
  (c: string) => `Blasted ${c}`,
  (c: string) => `${c} Debris Field`,
  (c: string) => `${c} Relic`,
  (c: string) => `Relic of ${c}`,
  (c: string) => `Melted ${c}`,
  (c: string) => `The Melted ${c}`,
  (c: string) => `${c} Wreck`,
  (c: string) => `The Wreck of ${c}`,
  (c: string) => `${c} Depot`,
  (c: string) => `${c} Graveyard`,
  (c: string) => `The ${c} Graveyard`,
  (c: string) => `${c} Sanctuary`,
  (c: string) => `${c} Refuge`,
  (c: string) => `The ${c} Refuge`,
  (c: string) => `${c} Stronghold`,
  (c: string) => `${c} Relocation Zone`,
  (c: string) => `${c} Occupied Zone`,
  (c: string) => `${c} Military Zone`,
  (c: string) => `${c} Camp`,
  (c: string) => `${c} Internment Camp`,
  (c: string) => `${c} Asylum`,
  (c: string) => `${c} Trenches`,
  (c: string) => `${c} Minefields`,
];

/** Punchier shapes, for smaller cities only. */
const PUNCHY_TEMPLATES = [
  (c: string) => `${c} Ground Zero`,
  (c: string) => `${c} Crater`,
  (c: string) => `${c} Cinders`,
  (c: string) => `${c}'s Last Stand`,
  (c: string) => `The ${c} Glowlands`,
  (c: string) => `${c} Rad-Lands`,
  (c: string) => `Nuclear ${c}`,
  (c: string) => `The Burnt ${c}`,
  (c: string) => `${c} After Dark`,
  (c: string) => `${c} Heap`,
  (c: string) => `The ${c} Heap`,
  (c: string) => `${c} Scrapyard`,
  (c: string) => `The ${c} Scrapyard`,
  (c: string) => `${c} Rust Pit`,
  (c: string) => `The ${c} Pit`,
  (c: string) => `${c} Hole`,
  (c: string) => `${c} Refuse`,
  (c: string) => `${c} Debris`,
  (c: string) => `${c} Slag Heap`,
  (c: string) => `Blasted ${c} Pit`,
];

/** Where an oasis makes sense: dry country and desert states. */
const ARID_COUNTRIES = new Set(['SA', 'AE', 'QA', 'KW', 'BH', 'OM', 'YE', 'JO', 'IQ', 'IR', 'EG', 'LY', 'DZ', 'TN', 'MA', 'ML', 'NE', 'TD', 'SD', 'MR', 'NA', 'BW', 'AF', 'PK', 'UZ', 'TM', 'IL']);
const ARID_STATES = new Set(['nv', 'az', 'nm', 'ut']);
const OASIS_TEMPLATES = [
  (c: string) => `${c} Oasis`,
  (c: string) => `The ${c} Oasis`,
];

/** Puns that follow from the way a name is built. Returns null when the name offers none. */
function pun(name: string): string | null {
  const t = name.trim();
  if (/^new\s/i.test(t)) return `Nuke ${t.slice(4)}`;
  if (/^at[a-z]{3,}$/i.test(t)) return `Atom${t.slice(2).toLowerCase()}`;
  if (/^fort\s/i.test(t)) return `Fallout ${t.slice(5)}`;
  if (/^glen/i.test(t) && t.length > 5) return `Glow${t.slice(4).toLowerCase()}`;
  if (/^[a-z]{3,}burgh?$/i.test(t)) return t.replace(/burgh?$/i, 'burn');
  if (/^[a-z]{3,}bury$/i.test(t)) return t.replace(/bury$/i, 'burial');
  if (/^[a-z]{4,}ville$/i.test(t)) return t.replace(/ville$/i, 'villain');
  if (/^[a-z]{4,}field$/i.test(t)) return t.replace(/field$/i, 'fallout');
  if (/\scity$/i.test(t)) return `${t.replace(/\scity$/i, '')} Crater City`;
  return null;
}

/**
 * The wasteland's name for a city: from the lore if there is one, a name we made up, or a name built from the city's own. For the rest, roughly
 * half get a pun when the name allows one and the others a plain descriptive name. Cities of more than 5 million are always plain.
 */
export function wastelandName(city: string, state?: string, country?: string, population = 0): RegionName {
  const name = city.trim();
  if (!name) return { name: 'The Wasteland', canon: false };
  const lower = norm(name);
  const st = (state ?? '').toLowerCase();
  const cc = (country ?? '').toUpperCase();

  // lore, then our own names (by state for the US, by country elsewhere)
  for (const place of [st, cc.toLowerCase()]) {
    if (place && CANON[`${lower}|${place}`]) return { name: CANON[`${lower}|${place}`], canon: true };
  }
  if (cc === 'US' || !cc) {
    if (CANON_STATE[st]) return { name: CANON_STATE[st], canon: true };
  }
  if (PLAIN.has(`${lower}|${st}`) || PLAIN.has(`${lower}|${cc.toLowerCase()}`) || PLAIN_COUNTRY.has(cc)) return { name, canon: false };
  for (const place of [st, cc.toLowerCase()]) {
    if (place && NICKNAMES[`${lower}|${place}`]) return { name: NICKNAMES[`${lower}|${place}`], canon: false };
  }

  const h = hashString(lower);
  const big = population > 5_000_000;
  const punny = !big && h % 2 === 0;
  if (punny) {
    const joke = pun(name);
    if (joke) return { name: joke, canon: false };
  }
  // among the rest, about one in four of the smaller cities gets a punchier shape
  const arid = ARID_COUNTRIES.has(cc) || (cc === 'US' && ARID_STATES.has(st));
  const base = !big && (h >>> 3) % 4 === 0 ? PUNCHY_TEMPLATES : PLAIN_TEMPLATES;
  // about one dry place in four is an oasis
  const useful = arid && (h >>> 9) % 4 === 0 ? OASIS_TEMPLATES : base;
  return { name: useful[(h >>> 5) % useful.length](name), canon: false };
}
