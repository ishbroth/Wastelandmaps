// What the wasteland calls a region. A few real places already have names in the Fallout games and their lore; those keep them. Everything
// else gets a name in the same spirit: a hand-made nickname for the big cities, and for the rest a generated one built from the city's own
// name (always the same name for the same city). Place names are lore references only, no game text or art is used.

import { hashString } from './wasteland';

export interface RegionName {
  name: string;
  /** True when the name comes from the Fallout games or lore, false when it is ours. */
  canon: boolean;
}

/** Real cities (and a whole state) with a name in the games and lore. Keys are "city|ST", lowercased city. */
const CANON: Record<string, string> = {
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
};

/** Nicknames we made up for bigger cities, in the style of the games' own. Keys are "city|ST". */
const NICKNAMES: Record<string, string> = {
  'detroit|mi': 'The Motor City Wasteland',
  'atlanta|ga': 'Atomlanta',
  'chicago|il': 'The Windy Wastes',
  'new york|ny': 'The Big Rotten Apple',
  'philadelphia|pa': 'The City of Brotherly Mutants',
  'seattle|wa': 'The Emerald Ashlands',
  'portland|or': 'The Rose Ruins',
  'portland|me': 'The Lobster Wastes',
  'miami|fl': 'Miami Meltdown',
  'orlando|fl': 'Magic Kingdom Come',
  'tampa|fl': 'The Tampa Bay Glow',
  'houston|tx': 'Houston, We Have Fallout',
  'dallas|tx': 'The Dallas Dustbowl',
  'austin|tx': 'Keep Austin Irradiated',
  'san antonio|tx': 'Remember the Alamo, Ruins',
  'denver|co': 'The Mile-High Fallout',
  'phoenix|az': 'Phoenix From The Ashes',
  'tucson|az': 'The Tucson Scorch',
  'albuquerque|nm': 'Breaking Rad',
  'salt lake city|ut': 'The Great Salt Waste',
  'nashville|tn': 'Nukeville',
  'memphis|tn': 'The Graceland Graveyard',
  'new orleans|la': 'Nuke Orleans',
  'minneapolis|mn': 'The Twin Craters',
  'saint paul|mn': 'The Twin Craters',
  'st. louis|mo': 'The Gateway to Nowhere',
  'saint louis|mo': 'The Gateway to Nowhere',
  'kansas city|mo': 'The Barbecue Badlands',
  'cleveland|oh': 'The Rust Belt Wastes',
  'cincinnati|oh': 'Cincinuclear',
  'columbus|oh': 'The Buckeye Badlands',
  'indianapolis|in': 'The Speedway Wastes',
  'milwaukee|wi': 'The Brew Town Bunkers',
  'baltimore|md': 'Charm Crater',
  'providence|ri': 'The Rhode Rubble',
  'hartford|ct': 'The Hartford Hollows',
  'new haven|ct': 'Nuke Haven',
  'buffalo|ny': 'The Buffalo Blight',
  'san francisco|ca': 'The Golden Gate Ruins',
  'oakland|ca': 'The Golden Gate Ruins',
  'san jose|ca': 'Silicon Rubble',
  'sacramento|ca': 'The Capital of the Golden Wastes',
  'honolulu|hi': 'The Isles of Rad',
  'richmond|va': 'The Richmond Remains',
  'charlotte|nc': 'The Queen City Craters',
  'raleigh|nc': 'The Research Triangle Glow',
  'charleston|sc': 'The Lowcountry Lowlands',
  'savannah|ga': 'The Haunted Hollows of Savannah',
};

const TEMPLATES = [
  (c: string) => `The ${c} Wasteland`,
  (c: string) => `${c} Badlands`,
  (c: string) => `The ${c} Ashlands`,
  (c: string) => `The Glowing ${c}`,
  (c: string) => `${c} Ruins`,
  (c: string) => `The ${c} Fallout Zone`,
  (c: string) => `Greater ${c} Ruins`,
  (c: string) => `The ${c} Dead Zone`,
  (c: string) => `${c} Rad-Lands`,
];

/** The wasteland's name for a city: from the lore if there is one, a nickname, or a name built from the city's own. */
export function wastelandName(city: string, state?: string): RegionName {
  const name = city.trim();
  if (!name) return { name: 'The Wasteland', canon: false };
  const lower = name.toLowerCase();
  const st = (state ?? '').toLowerCase();
  const key = `${lower}|${st}`;

  if (CANON[key]) return { name: CANON[key], canon: true };
  if (CANON_STATE[st]) return { name: CANON_STATE[st], canon: true };
  if (NICKNAMES[key]) return { name: NICKNAMES[key], canon: false };

  // wordplay on the city's own name
  if (/^new\s/i.test(name)) return { name: `Nuke ${name.slice(4)}`, canon: false };
  if (/^at[a-z]{3,}/i.test(name)) return { name: `Atom${lower.slice(2)}`.replace(/^./, (m) => m.toUpperCase()), canon: false };
  if (/^(?:saint|st\.?)\s/i.test(name)) return { name: `The ${name.replace(/^(?:saint|st\.?)\s/i, 'Saint ')} Sanctuary Ruins`, canon: false };

  return { name: TEMPLATES[hashString(lower) % TEMPLATES.length](name), canon: false };
}
