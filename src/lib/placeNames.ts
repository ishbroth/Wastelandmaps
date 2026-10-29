// What the wasteland calls a place. The famous ones keep their real names: the Eiffel Tower is still the Eiffel Tower, Fenway is still Fenway.
// Everything else gets a name made on the spot, from a large stock of words, shaped by what the place is (an airfield is not a station is not a
// park) and often twisted from a word in its real name ("Logan" airport becomes "Logan Tarmac"). The same place always gets the same name.

import type { CategoryId } from './wasteland';

type Rand = () => number;
const pick = <T,>(list: readonly T[], rand: Rand): T => list[Math.floor(rand() * list.length)];

// ---- how famous is famous ----
// A place's fame is the number of Wikipedia languages that cover it. The line is lower for landmarks (they are why people come) and higher for
// everyday kinds of place, so a famous station still keeps its name but an ordinary one does not.
const FAME_LINE: Record<CategoryId, number> = {
  other: 14, arena: 22, guard: 24, chapel: 24, school: 30, park: 30, lodging: 45, medical: 60, transit: 60, market: 80, cantina: 80, fuel: 120,
};
export const isFamous = (category: CategoryId, fame: number): boolean => fame >= FAME_LINE[category];

// ---- words ----
const ADJECTIVES = [
  'Rusted', 'Broken', 'Hollow', 'Sunken', 'Burnt', 'Ashen', 'Silent', 'Forgotten', 'Gutted', 'Shattered', 'Bleak', 'Crooked', 'Scorched',
  'Dusty', 'Withered', 'Hungry', 'Cursed', 'Drowned', 'Feral', 'Lost', 'Last', 'Dead', 'Twisted', 'Salted', 'Black', 'Gray', 'Rotten',
  'Splintered', 'Sagging', 'Blasted', 'Cracked', 'Pitted', 'Weeping', 'Skeleton', 'Glowing', 'Sour', 'Bitter', 'Faded', 'Sullen', 'Wretched',
  'Lonesome', 'Tattered', 'Frayed', 'Ragged', 'Smoldering', 'Frozen', 'Leaning', 'Vacant', 'Plundered', 'Haunted', 'Brittle', 'Rancid',
  'Smoke-Stained', 'Bone-Dry', 'Half-Buried', 'Wind-Scoured', 'Rat-Run', 'Ghost', 'Widow\'s', 'Raider', 'Scavenger\'s', 'Survivor\'s',
] as const;

const NOUNS: Record<CategoryId, readonly string[]> = {
  medical: ['Clinic', 'Surgery', 'Ward', 'Dispensary', 'Infirmary', 'Med Center', 'Sickbay', 'Pharmacy', 'Triage Hall', 'Stimpak Stash', 'Sanatorium'],
  school: ['Schoolhouse', 'Classrooms', 'Lecture Hall', 'Archive', 'Stacks', 'Quad', 'Study Hall', 'Reading Room', 'Academy', 'Playground', 'Lab Wing', 'Library'],
  market: ['Market', 'Ration Depot', 'Grocery', 'Mall', 'Bazaar', 'Trader Row', 'Supply Shop', 'Cannery', 'Pantry', 'Trading Post', 'Checkout Lanes'],
  fuel: ['Pump Station', 'Gas Stop', 'Garage', 'Scrapyard', 'Chassis Lot', 'Tire Heap', 'Fuel Depot', 'Mechanic\'s Pit', 'Oil Sump', 'Wreck Yard'],
  park: ['Meadow', 'Grove', 'Green', 'Thicket', 'Pasture', 'Commons', 'Copse', 'Fen', 'Overgrowth', 'Clearing', 'Glade', 'Weed Field', 'Hollow'],
  guard: ['Guard Post', 'Watch Station', 'Precinct', 'Bunker', 'Stronghold', 'Barracks', 'Outpost', 'Garrison', 'Lockup', 'Keep', 'Checkpoint'],
  cantina: ['Cantina', 'Tavern', 'Saloon', 'Diner', 'Bar', 'Mess Hall', 'Brewhouse', 'Watering Hole', 'Cookhouse', 'Drinking Den', 'Canteen'],
  chapel: ['Chapel', 'Sanctuary', 'Shrine', 'Pilgrim Hall', 'Bell Tower', 'Cloister', 'Altar', 'Abbey', 'Meeting House', 'Prayer Hall'],
  transit: ['Depot', 'Platform', 'Junction', 'Terminus', 'Switchyard', 'Signal House', 'Tunnel Mouth', 'Crossing', 'Terminal', 'Waystation', 'Rail Yard'],
  arena: ['Arena', 'Pit', 'Coliseum', 'Fairground', 'Theater', 'Hall of Relics', 'Gallery', 'Big Top', 'Fight Pit', 'Showhouse', 'Stage', 'Dome'],
  lodging: ['Inn', 'Hotel', 'Bunkhouse', 'Rest Stop', 'Lodge', 'Boarding House', 'Penthouse', 'Motel', 'Sleeping Quarters', 'Guest House'],
  other: ['Ruins', 'Relic', 'Site', 'Remains', 'Wreck', 'Monument', 'Settlement', 'Stronghold', 'Cache', 'Outpost', 'Spire', 'Wreckage'],
};

// what a place is, read from its real name in the languages most of them are written in, picks a more fitting noun
const SUBTYPES: [CategoryId, RegExp, readonly string[]][] = [
  ['transit', /\b(?:airport|airfield|aerodrome|airbase|air base|flughafen|a[eé]roport|aeropuerto|aeroporto|heliport|runway)\b/i, ['Runway', 'Tarmac', 'Hangar', 'Crash Field', 'Airstrip', 'Control Tower', 'Wreck Strip', 'Landing Field', 'Flight Line']],
  ['transit', /\b(?:bridge|pont|br[uü]cke|ponte|puente|viaduct|overpass)\b/i, ['Span', 'Crossing', 'Overpass', 'Broken Bridge', 'Girder Walk']],
  ['transit', /\b(?:port|harbou?r|ferry|pier|dock|wharf)\b/i, ['Docks', 'Wharf', 'Drowned Pier', 'Quay', 'Rust Harbor', 'Ship Graveyard']],
  ['transit', /\b(?:station|gare|bahnhof|estaci[oó]n|stazione|terminal|metro|subway|underground|tram)\b/i, ['Platform', 'Depot', 'Junction', 'Terminus', 'Last Stop', 'Signal House', 'Tunnel Mouth', 'Turnstiles', 'Track Bed']],
  ['park', /\b(?:cemetery|graveyard|necropolis|friedhof|cimeti[eè]re)\b/i, ['Boneyard', 'Grave Field', 'Quiet Rows', 'Headstone Hill', 'Tomb Garden']],
  ['park', /\b(?:garden|botanical|arboretum|jardin|garten|giardino)\b/i, ['Overgrowth', 'Thicket', 'Greenhouse Ruin', 'Wild Garden', 'Vine Maze']],
  ['park', /\b(?:zoo|safari|aquarium)\b/i, ['Menagerie', 'Cages', 'Beast Pens', 'Monkey House', 'Empty Enclosures']],
  ['park', /\b(?:beach|lake|pond|river|bay|coast|shore|lago|see)\b/i, ['Shore', 'Slick', 'Sink', 'Tidal Flats', 'Drowned Shore', 'Black Water']],
  ['school', /\b(?:university|college|institute|universit[eéà]|universidad|universit[aä]t|polytechni[a-z]*|campus)\b/i, ['Hall of Learning', 'Quad', 'Lecture Halls', 'Lab Wing', 'Campus Ruins', 'Dormitories', 'Cloisters']],
  ['school', /\b(?:library|biblioth[eè]que|biblioteca|archive|archiv)\b/i, ['Archive', 'Stacks', 'Reading Room', 'Book Vault', 'Card Catalog']],
  ['arena', /\b(?:stadium|stade|stadion|estadio|arena|ballpark|ground)\b/i, ['Pit', 'Arena', 'Coliseum', 'Bleachers', 'Fight Pit', 'The Bowl']],
  ['arena', /\b(?:museum|mus[eé]e|museo|gallery|galerie)\b/i, ['Hall of Relics', 'Gallery', 'Vault of Artifacts', 'Curio Hall', 'Cabinet of Wonders']],
  ['arena', /\b(?:theatre|theater|th[eé][aâ]tre|opera|cinema)\b/i, ['Silent Stage', 'Cinema of Ghosts', 'Last Curtain', 'Gilded Ruin', 'Showhouse']],
];

// words in a real name that say nothing about the place itself, so they are not borrowed
const GENERIC = new Set([
  'the', 'of', 'de', 'la', 'le', 'les', 'del', 'der', 'die', 'das', 'el', 'los', 'las', 'and', 'for', 'at', 'in', 'on', 'park', 'station', 'airport', 'international',
  'university', 'school', 'hospital', 'medical', 'center', 'centre', 'memorial', 'public', 'library', 'church', 'saint', 'st', 'museum', 'stadium', 'hotel',
  'inn', 'national', 'regional', 'city', 'county', 'municipal', 'old', 'new', 'north', 'south', 'east', 'west', 'grand', 'great', 'royal', 'central', 'first',
  'second', 'community', 'general', 'state', 'college', 'institute', 'academy', 'elementary', 'high', 'junior', 'middle', 'primary', 'secondary', 'field',
  'airfield', 'terminal', 'cathedral', 'basilica', 'chapel', 'temple', 'mosque', 'synagogue', 'plaza', 'square', 'garden', 'gardens', 'zoo', 'mall', 'market',
  'cemetery', 'arboretum', 'mount', 'mountain', 'lake', 'pond', 'river', 'bay', 'beach', 'botanical', 'botanic', 'supermarket', 'store', 'shopping', 'restaurant', 'cafe', 'bar', 'pub', 'club', 'house', 'hall', 'building', 'tower', 'bridge', 'metro', 'subway', 'line',
]);

/** A word in the real name worth borrowing: a capitalized word that is not generic, the longest of them. */
function stemOf(realName: string): string | null {
  const words = realName.split(/[\s\-–—/,()'’.&]+/).filter((w) => /^\p{Lu}[\p{L}]{3,}$/u.test(w) && !GENERIC.has(w.toLowerCase()));
  if (words.length === 0) return null;
  return words.sort((a, b) => b.length - a.length)[0];
}

/** The wasteland name for a place that is not famous enough to keep its own. */
export function wastelandPlaceName(realName: string, category: CategoryId, rand: Rand): string {
  const subtype = SUBTYPES.find(([c, re]) => c === category && re.test(realName));
  const noun = pick(subtype ? subtype[2] : NOUNS[category], rand);
  const adjective = pick(ADJECTIVES, rand);
  const stem = stemOf(realName);

  const roll = rand();
  if (stem && roll < 0.42) return `${stem} ${noun}`;
  if (stem && roll < 0.58) return `${adjective} ${stem} ${noun}`;
  if (roll < 0.8) return `${adjective} ${noun}`;
  return `The ${adjective} ${noun}`;
}
