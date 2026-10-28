// Turns a real place into a wasteland one. Everything here is deterministic: the same city always gets the same vault, the same radiation
// zones and the same names, so a shared link shows everyone the same map. No network, no Google: just math on the place's name and position.

export interface LatLng {
  lat: number;
  lng: number;
}

/** 32-bit FNV-1a hash. */
export function hashString(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Small seeded random number generator (mulberry32). */
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type CategoryId = 'medical' | 'school' | 'market' | 'fuel' | 'park' | 'guard' | 'cantina' | 'chapel' | 'transit' | 'arena' | 'lodging' | 'other';

export interface Category {
  id: CategoryId;
  label: string;
  /** Google place types (Places API New) that belong here. */
  types: string[];
  /** Wasteland names to pick from. */
  names: string[];
  /** What a survivor will find there. */
  loot: string[];
}

export const CATEGORIES: Category[] = [
  {
    id: 'medical', label: 'Medical', types: ['hospital', 'pharmacy', 'doctor', 'drugstore', 'dentist', 'medical_lab'],
    names: ['Old World Med Center', 'Mercy Clinic Ruins', 'Stimpak Depot', 'Rad-Away Dispensary', 'Abandoned Surgery'],
    loot: ['Stimpaks', 'Rad-Away', 'Med-X', 'Surgical tools', 'Expired antibiotics'],
  },
  {
    id: 'school', label: 'Schools & Archives', types: ['school', 'primary_school', 'secondary_school', 'university', 'library'],
    names: ['Collapsed Schoolhouse', 'Old World Academy', 'The Dusty Archive', 'Scrapped Lecture Hall', 'Chalkboard Ruins'],
    loot: ['Pre-war books', 'Skill magazines', 'Terminal logs', 'Science kits', 'Holotapes'],
  },
  {
    id: 'market', label: 'Markets', types: ['supermarket', 'grocery_store', 'convenience_store', 'shopping_mall', 'department_store', 'store'],
    names: ['Scavenged Market', 'Ration Depot', 'Pre-War Grocery', 'Collapsed Mall', 'Trader Stall Row'],
    loot: ['Canned food', 'Purified water', 'Bottle caps', 'Cloth and leather', 'Scrap'],
  },
  {
    id: 'fuel', label: 'Fuel & Garages', types: ['gas_station', 'car_repair', 'car_dealer', 'electric_vehicle_charging_station'],
    names: ['Rusted Pump Station', 'Dry Gas Stop', 'Scrapyard Garage', 'Fusion Core Stash', 'Burnt-Out Chassis Lot'],
    loot: ['Fusion cells', 'Motor oil', 'Steel scrap', 'Toolboxes', 'A suspicious number of tires'],
  },
  {
    id: 'park', label: 'Wilds', types: ['park', 'national_park', 'campground', 'hiking_area', 'garden'],
    names: ['Overgrown Green', 'Mutant Fern Grove', 'The Dead Meadow', 'Brahmin Pasture', 'Wild Thicket'],
    loot: ['Mutfruit', 'Herbs', 'Hunting spots', 'Wood', 'Mole rat burrows'],
  },
  {
    id: 'guard', label: 'Guard Posts', types: ['police', 'fire_station', 'city_hall', 'courthouse', 'embassy', 'local_government_office'],
    names: ['Settlement Guard Post', 'Wasteland Watch Station', 'Ironclad Precinct', 'Fire Brigade Bunker', 'Old Town Hall Fort'],
    loot: ['Ammo', 'Riot gear', 'Armor plates', 'Security terminals', 'Wanted posters'],
  },
  {
    id: 'cantina', label: 'Cantinas', types: ['restaurant', 'bar', 'cafe', 'bakery', 'night_club', 'pub', 'fast_food_restaurant'],
    names: ['The Rusty Mug', 'Nuka-Fizz Cantina', 'Last Call Saloon', 'Cap & Gear Tavern', 'Wasteland Diner'],
    loot: ['Cold-ish drinks', 'Rumors', 'Bounty boards', 'Hot meals', 'Card games'],
  },
  {
    id: 'chapel', label: 'Chapels', types: ['church', 'mosque', 'synagogue', 'hindu_temple', 'place_of_worship'],
    names: ['Chapel of the Fallen', 'Sanctuary Ruins', 'The Quiet Shrine', 'Pilgrim Hall', 'Bell Tower Hollow'],
    loot: ['Safe rest', 'Candles', 'Old hymnals', 'Pilgrims', 'A hidden cellar'],
  },
  {
    id: 'transit', label: 'Transit', types: ['airport', 'train_station', 'subway_station', 'transit_station', 'bus_station', 'light_rail_station'],
    names: ['Old World Airfield', 'Derelict Rail Depot', 'Tunnel Junction', 'Collapsed Terminal', 'Ghost Platform'],
    loot: ['Rail tokens', 'Luggage caches', 'Fast-travel point', 'Raider camps', 'Maps'],
  },
  {
    id: 'arena', label: 'Arenas', types: ['stadium', 'amusement_park', 'movie_theater', 'zoo', 'museum', 'bowling_alley'],
    names: ['The Broken Arena', 'Fairground Wreck', 'Cinema of Ghosts', 'Rollercoaster Skeleton', 'Hall of Relics'],
    loot: ['Collectibles', 'Raider fights', 'Ticket stubs', 'Scrap steel', 'A great view'],
  },
  {
    id: 'lodging', label: 'Lodging', types: ['hotel', 'lodging', 'motel', 'resort_hotel'],
    names: ['Rest Stop Hotel', 'Bunk House', 'The Sleepless Inn', 'Penthouse Ruins', 'Traveler\'s Rest'],
    loot: ['A bed', 'Safe rest', 'Room keys', 'Minibar (empty)', 'Pre-war luggage'],
  },
  {
    id: 'other', label: 'Landmarks', types: [],
    names: ['Unmarked Ruins', 'Old World Relic', 'Strange Settlement', 'Hidden Cache', 'Forgotten Site'],
    loot: ['Mystery', 'Scrap', 'Junk', 'Something glowing', 'Probably nothing'],
  },
];

const BY_ID = new Map(CATEGORIES.map((c) => [c.id, c]));
export const categoryById = (id: CategoryId): Category => BY_ID.get(id) ?? (BY_ID.get('other') as Category);

/** Which category a Google place belongs to, from its primary type first and its other types after. */
export function categorize(primaryType: string | null | undefined, types: string[] | null | undefined): Category {
  const candidates = [primaryType, ...(types ?? [])].filter(Boolean) as string[];
  for (const t of candidates) {
    const hit = CATEGORIES.find((c) => c.types.includes(t));
    if (hit) return hit;
  }
  return categoryById('other');
}

/** The search groups sent to Google: a few requests, each limited to 20 results, so a city costs only a handful of lookups. */
export const SEARCH_GROUPS: string[][] = [
  ['hospital', 'pharmacy', 'doctor', 'drugstore', 'police', 'fire_station'],
  ['school', 'university', 'library', 'museum', 'stadium', 'airport', 'train_station'],
  ['supermarket', 'grocery_store', 'shopping_mall', 'department_store', 'gas_station', 'hotel'],
  ['park', 'church', 'mosque', 'synagogue', 'movie_theater', 'amusement_park'],
  ['restaurant', 'bar', 'cafe', 'convenience_store', 'car_repair', 'city_hall'],
  // the famous places and neighborhood landmarks: the ones people would name if you asked what the city is known for
  ['tourist_attraction', 'historical_landmark', 'monument', 'cultural_landmark'],
];

export interface Wasteland {
  /** "The Seattle Wasteland" */
  regionName: string;
  vault: { position: LatLng; number: string };
  zones: { position: LatLng; radiusMeters: number; rads: number }[];
}

const metersToDegLat = (m: number) => m / 111_320;
const metersToDegLng = (m: number, lat: number) => m / (111_320 * Math.max(0.2, Math.cos((lat * Math.PI) / 180)));

/** The wasteland version of a city: its name, a vault, and a few irradiated zones, placed around the center. */
export function generateWasteland(cityName: string, center: LatLng, spreadMeters: number, regionName?: string): Wasteland {
  const seed = hashString(`${cityName.toLowerCase()}|${center.lat.toFixed(2)},${center.lng.toFixed(2)}`);
  const rand = seeded(seed);
  const place = (minFrac: number, maxFrac: number): LatLng => {
    const angle = rand() * Math.PI * 2;
    const dist = spreadMeters * (minFrac + rand() * (maxFrac - minFrac));
    return { lat: center.lat + metersToDegLat(Math.sin(angle) * dist), lng: center.lng + metersToDegLng(Math.cos(angle) * dist, center.lat) };
  };
  const vault = place(0.15, 0.55);
  // radiation zones keep their distance from each other and from the vault, so their labels never pile up
  const zoneCount = 3 + Math.floor(rand() * 3);
  const minGap = spreadMeters * 0.32;
  const zones: Wasteland['zones'] = [];
  for (let i = 0; i < zoneCount; i++) {
    let best: LatLng | null = null;
    for (let tries = 0; tries < 25 && !best; tries++) {
      const candidate = place(0.2, 0.9);
      const clear = distanceMeters(candidate, vault) > minGap * 0.8 && zones.every((z) => distanceMeters(candidate, z.position) > minGap);
      if (clear) best = candidate;
    }
    if (!best) continue; // no room left: fewer zones is fine
    zones.push({ position: best, radiusMeters: Math.round(spreadMeters * (0.06 + rand() * 0.1)), rads: 40 + Math.floor(rand() * 360) });
  }
  return {
    regionName: regionName ?? `The ${cityName} Wasteland`,
    vault: { position: vault, number: String(1 + Math.floor(rand() * 998)).padStart(3, '0') },
    zones,
  };
}

export interface Location {
  id: string;
  /** The real name of the place, as Google knows it. */
  oldName: string;
  /** What the wasteland calls it. */
  name: string;
  category: CategoryId;
  position: LatLng;
  loot: string;
  threat: 'Quiet' | 'Scavengers' | 'Raiders' | 'Feral Ghouls' | 'Super Mutants' | 'Radiation';
  rads: number;
}

const THREATS: Location['threat'][] = ['Quiet', 'Quiet', 'Scavengers', 'Scavengers', 'Raiders', 'Feral Ghouls', 'Super Mutants', 'Radiation'];

/** Gives a real place its wasteland identity. */
export function toLocation(place: { id: string; name: string; position: LatLng; primaryType?: string | null; types?: string[] | null }): Location {
  return locationIn(categorize(place.primaryType, place.types), place);
}

/** The same, for a place whose category is already known (the pre-built maps). */
export function locationFromData(id: string, name: string, position: LatLng, categoryId: CategoryId): Location {
  return locationIn(categoryById(categoryId), { id, name, position });
}

function locationIn(category: Category, place: { id: string; name: string; position: LatLng }): Location {
  const rand = seeded(hashString(place.id || place.name));
  const threat = THREATS[Math.floor(rand() * THREATS.length)];
  return {
    id: place.id,
    oldName: place.name,
    name: category.names[Math.floor(rand() * category.names.length)],
    category: category.id,
    position: place.position,
    loot: category.loot[Math.floor(rand() * category.loot.length)],
    threat,
    rads: threat === 'Radiation' ? 80 + Math.floor(rand() * 300) : Math.floor(rand() * 40),
  };
}

/** Distance in meters between two points (haversine). */
export function distanceMeters(a: LatLng, b: LatLng): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Coordinates the way a Pip-Boy would say them. */
export function formatCoords(p: LatLng): string {
  const f = (v: number, pos: string, neg: string) => `${Math.abs(v).toFixed(4)}° ${v >= 0 ? pos : neg}`;
  return `${f(p.lat, 'N', 'S')}  ${f(p.lng, 'E', 'W')}`;
}

// ---------------------------------------------------------------------------
// What a survivor writes in their journal about a place
// ---------------------------------------------------------------------------

const OPENERS: Record<CategoryId, string[]> = {
  medical: ['The red cross on the wall is faded to pink, but the doors still hang on their hinges.', 'Rows of gurneys sit where the waiting room used to be. Someone has been here before you, but not recently.', 'A generator hums somewhere below the floor. The place is not as dead as it looks.'],
  school: ['Desks are stacked against the windows like a barricade. Faded finger-paintings still cling to one wall.', 'The bell tower leans, and the flag it carried is long gone. Chalk equations cover a blackboard nobody can read now.', 'Lockers hang open down a corridor of broken glass. Whatever they taught here, it was not this.'],
  market: ['Shelves lean into each other like tired drunks. A few cans survived, and so did the people who want them.', 'The sign out front still flickers on the third letter. Carts are strewn across the lot like fallen soldiers.', 'Someone has chalked prices on the walls in bottle caps. The trade here is honest, mostly.'],
  fuel: ['The pumps are dry and rusted, but the canopy is solid enough to shelter under. Oil stains have turned the ground black.', 'A wrecked sedan sits half-dismantled by the air pump. Scrappers got the good parts years ago.', 'The price sign still advertises a gallon at a number that would buy you a small city today.'],
  park: ['Nature took the place back first and never gave it up. Mutated ferns grow thick around the benches.', 'The fountain is a nest of weeds now, and the paths have vanished under grass taller than a man.', 'A rope swing sways over a pond that glows faintly at night. Nothing should drink from it.'],
  guard: ['Sandbags and scrap plating wall in the entrance. Somebody still believes in order here, and keeps a rifle on the roof.', 'The flag out front is stitched from three others. Wanted posters, decades old, still hold the notice board.', 'Cells sit empty in the back. The people who built this place meant to keep something out, not in.'],
  cantina: ['Light spills from the windows, and so does laughter. Drinks are cheap, and the rumors are free.', 'A mug-shaped sign buzzes over the door. Inside, a card game has been running since before you were born.', 'The bar is made from a pre-war door on two oil drums. The bartender has heard every lie there is.'],
  chapel: ['The steeple is cracked but standing. Candles burn in the windows, and nobody will say who lights them.', 'Pews are pushed against the walls to make room for cots. The altar is a workbench now, and just as holy.', 'The bell hangs silent, wrapped in wire so raiders cannot steal it. The stained glass is mostly cardboard.'],
  transit: ['The departure board is dark, but its last message is still scratched into the dust: everything delayed.', 'Rails run off into the dark of a tunnel nobody walks alone. Luggage lies where it fell on the last day.', 'A control tower leans over a runway full of cracks and weeds. The planes will not be flying again.'],
  arena: ['The stands are half collapsed, but the field is still a good place to settle things. The crowds are smaller now, and louder.', 'Rusted floodlights loom over the pitch like skeletal giants. The scoreboard is frozen on a final score.', 'Fairground rides stand as skeletons against the sky. The carousel horses are still smiling.'],
  lodging: ['Room keys hang behind the front desk in neat rows. Some of the rooms are still occupied, in a manner of speaking.', 'The hotel stands taller than anything for a mile, which makes it both a landmark and a target.', 'The lobby chandelier lies in pieces across the marble. A bed upstairs is still made.'],
  other: ['It is not much to look at, but it is on the map, so somebody thought it mattered once.', 'You cannot tell what this place was for. That is not the same as it being empty.', 'The ruins keep their secrets well. Walking in is the only way to find out.'],
};

const THREAT_LINES: Record<Location['threat'], string> = {
  Quiet: 'Nothing moves. That is either very good or very bad.',
  Scavengers: 'Scavengers work the area, and they will trade if you do not look hungry.',
  Raiders: 'Raiders have claimed the place. Come armed, or come quietly.',
  'Feral Ghouls': 'Feral ghouls shuffle in the dark. Do not make noise.',
  'Super Mutants': 'Super mutants hold this ground, and they do not share.',
  Radiation: 'The Geiger counter will not stop. Bring Rad-Away.',
};

/** Anything on the map you can select and travel to: a location, or the vault. */
export interface Spot {
  id: string;
  name: string;
  oldName: string | null;
  kind: CategoryId | 'vault';
  position: LatLng;
  threat: Location['threat'];
  loot: string;
  rads: number;
}

export const VAULT_ID = 'vault';

export const spotFromLocation = (l: Location): Spot => ({ id: l.id, name: l.name, oldName: l.oldName, kind: l.category, position: l.position, threat: l.threat, loot: l.loot, rads: l.rads });

export const vaultSpot = (w: Wasteland): Spot => ({ id: VAULT_ID, name: `VAULT ${w.vault.number}`, oldName: null, kind: 'vault', position: w.vault.position, threat: 'Quiet', loot: 'Clean water, a bed and a very large door', rads: 0 });

const VAULT_LINES = [
  'The door is sealed from the inside, or from the outside. The sign says nobody has been in or out in a long time.',
  'A vault door as wide as a house, with a gear on it that has not turned in two centuries. Someone keeps the bolts oiled.',
  'The hazard stripes are still bright. Behind the door, a hum. Survivors say the lights never went out.',
];

/** A few lines for a place's journal entry, the same every time for the same place. */
export function describeSpot(spot: Spot, regionName: string): string[] {
  const rand = seeded(hashString(`${spot.id}|journal`));
  if (spot.kind === 'vault') {
    return [`${spot.name}, ${regionName}.`, VAULT_LINES[Math.floor(rand() * VAULT_LINES.length)], 'Home, for some of us. Safe, for now.'];
  }
  const openers = OPENERS[spot.kind] ?? OPENERS.other;
  return [
    `${spot.name}, ${regionName}. Formerly ${spot.oldName}.`,
    openers[Math.floor(rand() * openers.length)],
    `${THREAT_LINES[spot.threat]} Worth a look for: ${spot.loot.toLowerCase()}.`,
  ];
}
