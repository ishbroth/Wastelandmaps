// Your home vault, the place you enter once its snapshot is bought and it is cleared: a floorplan of rooms (up to five levels of it) that you build out of loot, furnish out of loot, and fill
// with settlers whose happiness you look after. These are the rules; the server (supabase/functions/vault) enforces them with a copy of this file
// (node _tools/sync-vault.mjs), so the browser can only ask. Nothing here imports anything, so the copy is exact.

export type LootBag = Partial<Record<string, number>>;

/** One level of the floorplan: eleven cells by eleven, room enough to grow in any direction from the entryway in the middle (15 rooms is the most there can be). */
export const COLS = 11;
export const ROWS = 11;
/** Levels down: the one you start on and four more. */
export const LEVELS = 5;
/** The most room slots a vault can hold, on whatever levels (a wide room takes two). Hallways and stairwells do not count. */
export const MAX_SLOTS = 20;
/** The most hallways on one level. */
export const MAX_HALLWAYS_PER_LEVEL = 4;
/** What the dearest room costs, in pieces of loot (the cheapest costs 4). */
export const MAX_ROOM_PRICE = 40;
/** A level needs this many rooms before the next one can be dug under it: the entryway counts for the first level, so you can dig down at once once the decontamination shower is in. */
export const ROOMS_TO_DIG = 1;
/** Rooms it takes before a vacation vault can be bought, and how many of them a person can have. */
export const ROOMS_FOR_VACATION = 10;
export const MAX_VACATIONS = 4;
/** Where the entryway stands on the first level. */
export const ENTRY_AT = { col: 5, row: 5 };

export type RoomType = 'entry' | 'living' | 'kitchen' | 'bedroom' | 'dining' | 'bathroom' | 'laundry' | 'entertainment' | 'workshop' | 'game' | 'stairs' | 'hallway' | 'garden';

export interface FurnitureDef { id: string; name: string }
export interface RoomDef {
  id: RoomType;
  name: string;
  /** How many room slots across: 1, or 2 for the big rooms. */
  slots: 1 | 2;
  /** The most of this kind a vault can hold. */
  max: number;
  furniture: FurnitureDef[];
  /** False for the entryway: every vault has it from the start and it cannot be built. */
  buildable?: boolean;
  /** A small room (the entryway, the bathroom, the laundry room): drawn smaller than the standard room that fills a cell. It still takes one slot. */
  small?: boolean;
}

export const ROOM_DEFS: RoomDef[] = [
  { id: 'entry', name: 'Entryway', slots: 1, max: 1, buildable: false, small: true, furniture: [{ id: 'coatrack', name: 'Coat Rack' }, { id: 'shoebench', name: 'Shoe Bench' }, { id: 'decon', name: 'Decontamination Shower' }] },
  // the way down: digging to a new level makes this stairwell there (under the room you dug from, which gets a hole in its floor with stairs going down); it is not built from the list and does not count toward the slots
  { id: 'stairs', name: 'Stairwell', slots: 1, max: LEVELS - 1, buildable: false, small: true, furniture: [] },
  // a narrow passage, long and thin: it joins to rooms and to other hallways (straight, or turning a corner); four to a level, no slot, no happiness; one piece in it
  { id: 'hallway', name: 'Hallway', slots: 1, max: MAX_HALLWAYS_PER_LEVEL * LEVELS, small: true, furniture: [{ id: 'fishtank', name: 'Fish Tank' }, { id: 'weaponrack', name: 'Weapon Rack' }, { id: 'statue', name: 'Art Statue' }, { id: 'plant', name: 'Indoor Tree' }] },
  { id: 'garden', name: 'Garden', slots: 2, max: 2, furniture: [{ id: 'corn', name: 'Corn' }, { id: 'tatoes', name: 'Tato Plants' }, { id: 'mutfruit', name: 'Mutfruit Plants' }] },
  { id: 'living', name: 'Living Room', slots: 1, max: 3, furniture: [{ id: 'couch', name: 'Couch' }, { id: 'tv', name: 'TV' }, { id: 'armchair', name: 'Chair' }, { id: 'coffeetable', name: 'Coffee Table' }] },
  { id: 'dining', name: 'Dining Room', slots: 1, max: 3, furniture: [{ id: 'table', name: 'Dining Table' }, { id: 'chairs', name: 'Dining Chairs' }, { id: 'chandelier', name: 'Candle Chandelier' }, { id: 'chinacabinet', name: 'China Cabinet' }] },
  { id: 'kitchen', name: 'Kitchen', slots: 1, max: 3, furniture: [{ id: 'sinkcabinets', name: 'Cabinets & Sink' }, { id: 'fridge', name: 'Refrigerator' }, { id: 'stove', name: 'Stove' }] },
  { id: 'bedroom', name: 'Bedroom', slots: 1, max: 6, furniture: [{ id: 'bed', name: 'Bed' }, { id: 'nightstand', name: 'Nightstands' }, { id: 'dresser', name: 'Dresser' }, { id: 'lamp', name: 'Lamp' }] },
  { id: 'laundry', name: 'Laundry Room', slots: 1, max: 2, small: true, furniture: [{ id: 'washer', name: 'Washer' }, { id: 'dryer', name: 'Dryer' }, { id: 'ironingboard', name: 'Ironing Board' }] },
  { id: 'bathroom', name: 'Bathroom', slots: 1, max: 3, small: true, furniture: [{ id: 'toilet', name: 'Toilet' }, { id: 'bathsink', name: 'Sink' }, { id: 'shower', name: 'Shower' }] },
  { id: 'entertainment', name: 'Entertainment Room', slots: 2, max: 1, furniture: [{ id: 'seating', name: 'Theatre Seating' }, { id: 'screen', name: 'Screen' }, { id: 'speakers', name: 'Speakers' }] },
  { id: 'game', name: 'Game Room', slots: 2, max: 1, furniture: [{ id: 'pooltable', name: 'Pool Table' }, { id: 'bar', name: 'Bar' }, { id: 'pinball', name: 'Pinball Machine' }] },
  { id: 'workshop', name: 'Workshop', slots: 2, max: 1, furniture: [{ id: 'toolchest', name: 'Tool Chest' }, { id: 'armorstand', name: 'Power Armor Stand' }, { id: 'craftingtable', name: 'Weapon Crafting Table' }] },
];

export const roomDef = (t: RoomType): RoomDef => ROOM_DEFS.find((r) => r.id === t) as RoomDef;

export interface VaultRoom {
  type: RoomType;
  /** The level it is on: 0 is the first, down to LEVELS - 1. */
  level: number;
  /** Left cell of the room (a 2-slot room covers col and col + 1). */
  col: number;
  row: number;
  /** Furniture placed, in the order it was placed. */
  furniture: string[];
}

export type SettlerKind = 'male' | 'female' | 'dog' | 'cat';
export const SETTLER_KINDS: SettlerKind[] = ['male', 'female', 'dog', 'cat'];
export interface Settler { id: number; kind: SettlerKind; /** What the owner calls them (up to ten characters). Settlers from before names have none. */ name?: string }
export const SETTLER_NAME_MAX = 10;
/** A settler's name as it is kept (one space at a time, ten characters at most, letters and numbers), or null if it is not a name. */
export function cleanSettlerName(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const n = raw.normalize('NFC').replace(/\s+/g, ' ').trim();
  if (n.length < 1 || n.length > SETTLER_NAME_MAX) return null;
  if (!/^[\p{L}\p{N} '.-]+$/u.test(n)) return null;
  return n;
}

export interface VaultHome {
  rooms: VaultRoom[];
  settlers: Settler[];
  /** Happiness when the latest visit began (can be above 100: the surplus is a cushion of extra 4-hour blocks), when it began, and when it was last seen open (ms). */
  from: number;
  sessionAt: number;
  seenAt: number;
  /** A temporary lift from building, in points, and when it was given (ms). */
  boost: number;
  boostAt: number;
  /** Decides which mix of loot each room and piece of furniture costs in this vault (the server makes it up when the vault is made). */
  seed?: number;
  /** 2 for the floorplan layout. A vault saved before it has no number and is converted when it is opened (see normalize). */
  layout?: number;
  /** A converted old vault: it keeps the rooms it had, so the decontamination and dig-down rules do not apply to it. */
  legacy?: boolean;
}

export const newVault = (now: number, seed = 0): VaultHome => ({ seed, layout: 3, rooms: [{ type: 'entry', level: 0, ...ENTRY_AT, furniture: [] }], settlers: [], from: 50, sessionAt: now, seenAt: now, boost: 0, boostAt: now });

// ---- the grid ----

export const slotsOf = (r: VaultRoom): number => roomDef(r.type).slots;
/** Stairwells and hallways are passages: they take no slot, add no happiness and make no settlers. */
export const isPassage = (r: { type: RoomType }): boolean => r.type === 'stairs' || r.type === 'hallway';
export const slotsUsed = (v: VaultHome): number => v.rooms.reduce((n, r) => n + (isPassage(r) ? 0 : slotsOf(r)), 0);
export const furnitureCount = (v: VaultHome): number => v.rooms.reduce((n, r) => n + (isPassage(r) ? 0 : r.furniture.length), 0);
export const hallwaysOn = (v: VaultHome, level: number): number => v.rooms.filter((r) => r.type === 'hallway' && r.level === level).length;
export const roomsOn = (v: VaultHome, level: number): VaultRoom[] => v.rooms.filter((r) => r.level === level);
/** The deepest level that has a room. */
export const deepestLevel = (v: VaultHome): number => v.rooms.reduce((m, r) => Math.max(m, r.level), 0);

/** The room covering a cell of a level, or undefined. */
export const roomAt = (v: VaultHome, level: number, col: number, row: number): VaultRoom | undefined => v.rooms.find((r) => r.level === level && r.row === row && col >= r.col && col < r.col + slotsOf(r));

/** What the vault says if you try to build before the entryway's decontamination shower is in. It is never written on the furniture itself. */
export const DECON_REASON = 'The vault will not let you build until everyone coming in has been decontaminated';
export const hasDecon = (v: VaultHome): boolean => v.legacy === true || v.rooms.some((r) => r.type === 'entry' && r.furniture.includes('decon'));

/** Can this level be dug under now (it has enough rooms, and there is a level left)? Returns null if yes, or the reason. */
export function whyNotDig(v: VaultHome, level: number): string | null {
  if (level + 1 >= LEVELS) return 'There is nothing below the fifth level';
  if (roomsOn(v, level + 1).length > 0) return null;
  if (!hasDecon(v)) return DECON_REASON;
  if (!v.legacy && roomsOn(v, level).length < ROOMS_TO_DIG) return ROOMS_TO_DIG === 1 ? 'Build a room on this level before digging down' : `Build at least ${ROOMS_TO_DIG} rooms on this level before digging down`;
  if (roomsOn(v, level).length === 0) return 'There is nothing to dig under';
  return null;
}

/** The cell on the entryway's front-left side stays empty for good: that wall holds the vault door. */
export const isDoorCell = (v: VaultHome, level: number, col: number, row: number): boolean =>
  v.rooms.some((r) => r.type === 'entry' && r.level === level && col === r.col && row === r.row + 1);

/** Can a stairwell be dug at this cell of this level (the first thing on a new level, under a room of the level above that is not a stairwell)? Null if yes, or the reason. */
export function whyNotStairs(v: VaultHome, level: number, col: number, row: number): string | null {
  if (level < 1 || level >= LEVELS) return 'There is nothing to dig down to there';
  if (roomsOn(v, level).length > 0) return 'This level is already dug: build onto it';
  const dig = whyNotDig(v, level - 1);
  if (dig) return dig;
  const above = roomAt(v, level - 1, col, row);
  if (!above) return 'It has to be dug under a room of the level above';
  if (above.type === 'stairs') return 'You cannot dig down under a stairwell: pick another room';
  if (above.type === 'hallway') return 'You cannot dig down under a hallway: pick a room';
  return null;
}

/** Can a room of this type be built with its left cell here? Returns null if yes, or the reason. */
export function whyNotBuild(v: VaultHome, type: RoomType, level: number, col: number, row: number): string | null {
  const def = roomDef(type);
  if (type === 'stairs') return whyNotStairs(v, level, col, row);
  if (def.buildable === false) return 'There is only one entryway';
  if (!hasDecon(v)) return DECON_REASON;
  if (level < 0 || level >= LEVELS || row < 0 || row >= ROWS || col < 0 || col + def.slots > COLS) return 'There is no room for it there';
  if (type !== 'hallway' && slotsUsed(v) + def.slots > MAX_SLOTS) return `A vault holds at most ${MAX_SLOTS} rooms (hallways and stairwells do not count)`;
  if (type === 'hallway' && hallwaysOn(v, level) >= MAX_HALLWAYS_PER_LEVEL) return `A level holds at most ${MAX_HALLWAYS_PER_LEVEL} hallways`;
  if (type !== 'hallway' && v.rooms.filter((r) => r.type === type).length >= def.max) return `A vault holds at most ${def.max} ${def.name}${def.max > 1 ? 's' : ''}`;
  for (let c = col; c < col + def.slots; c++) if (roomAt(v, level, c, row)) return 'That space is taken';
  for (let c = col; c < col + def.slots; c++) if (isDoorCell(v, level, c, row)) return 'That wall is the vault door: it stays clear';
  if (roomsOn(v, level).length === 0) {
    // a new level starts with its stairwell, dug under a room of the level above (see whyNotStairs)
    if (level === 0) return 'There is nothing here to build on';
    return 'Dig a stairwell down to this level first';
  }
  // after that, it must touch a room of the same level, not at a corner
  let touches = false;
  for (let c = col; c < col + def.slots; c++) {
    for (const [dc, dr] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      const o = roomAt(v, level, c + dc, row + dr);
      if (o && !(o.row === row && c + dc >= col && c + dc < col + def.slots)) touches = true;
    }
  }
  return touches ? null : 'It has to connect to a room you already have';
}

/**
 * Brings a vault saved in the old layout (three rooms across, five down, side view) into the floorplan: each old row becomes a level, the rooms keep their
 * furniture, and an entryway is added next to the first room. Such a vault is marked legacy: it keeps what it has and the new rules (decontamination,
 * three rooms to dig down) do not apply to it. A vault already in the new layout is returned as it is.
 */
export function normalize(v: VaultHome): VaultHome {
  // a vault that was only ever the first living room (and the entryway added beside it): nothing was built, so it starts again as the entryway alone
  const untouched = (rooms: { type: string; furniture: string[] }[]) => rooms.length > 0 && rooms.length <= 2 && rooms.every((r) => (r.type === 'living' || r.type === 'entry') && r.furniture.length === 0) && rooms.some((r) => r.type === 'living');
  if (v.settlers.length === 0 && untouched(v.rooms)) return { ...newVault(v.seenAt || Date.now(), v.seed ?? 0), from: v.from, sessionAt: v.sessionAt, seenAt: v.seenAt, boost: v.boost, boostAt: v.boostAt };
  let w: VaultHome = v;
  if (w.layout !== 2 && w.layout !== 3) {
    const rooms: VaultRoom[] = w.rooms.map((r) => ({ type: r.type, furniture: r.furniture, level: (r as unknown as { row: number }).row, col: r.col + 1, row: 1 }));
    const ahead: [number, number][] = [[0, 1], [4, 1], [1, 0], [1, 2], [2, 0], [2, 2], [3, 0], [3, 2]];
    const spot = ahead.find(([c, r]) => !rooms.some((x) => x.level === 0 && x.row === r && c >= x.col && c < x.col + roomDef(x.type).slots)) ?? [0, 1];
    rooms.unshift({ type: 'entry', level: 0, col: spot[0], row: spot[1], furniture: [] });
    w = { ...w, layout: 2, legacy: true, rooms };
  }
  // the first floorplan was five by three: it moves into the middle of the bigger one
  if (w.layout === 2) w = { ...w, layout: 3, rooms: w.rooms.map((r) => ({ ...r, col: r.col + 3, row: r.row + 3 })) };
  return w;
}

/** The price of the nth room slot: the second is 4 (the cheapest), the twentieth is 40 (the dearest), and it climbs gently at first and faster toward the end. */
export const slotPrice = (n: number): number => {
  if (n <= 2) return 4;
  if (n >= MAX_SLOTS) return MAX_ROOM_PRICE;
  return Math.round(4 + (MAX_ROOM_PRICE - 4) * Math.pow((n - 2) / (MAX_SLOTS - 2), 1.3));
};

/** Pieces of loot to build a room of this type now: the price of each slot it takes. A 2-slot room as your 4th slot costs 8 + 10. */
export function buildCost(v: VaultHome, type: RoomType): number {
  // a hallway is priced by how many hallways there are already, on the same climb as the rooms (the first costs what the cheapest room does)
  if (type === 'hallway') return slotPrice(v.rooms.filter((r) => r.type === 'hallway').length + 2);
  const first = slotsUsed(v) + 1;
  return roomDef(type).slots === 2 ? Math.min(MAX_ROOM_PRICE, slotPrice(first) + slotPrice(first + 1)) : slotPrice(first);
}

/** Pieces of loot for the next piece of furniture in a room (3, 4, 5, then 6 for the last of four). */
export function furnishCost(r: VaultRoom): number {
  return 3 + r.furniture.length;
}

export const furnitureOf = (type: RoomType): FurnitureDef[] => roomDef(type).furniture;
export const roomComplete = (r: VaultRoom): boolean => r.furniture.length >= (r.type === 'hallway' ? 1 : furnitureOf(r.type).length);

// ---- what things cost, as a mix of loot ----

const KINDS = ['steel', 'wood', 'springs', 'adhesive', 'screws', 'fiberoptics', 'glass', 'circuitry', 'oil', 'gears', 'plastic'];

/** A small repeatable random stream from a seed and a name (the same on the phone and on the server). */
function stream(seed: number, key: string): () => number {
  let h = (2166136261 ^ seed) >>> 0;
  for (let i = 0; i < key.length; i++) { h ^= key.charCodeAt(i); h = Math.imul(h, 16777619); }
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * The mix of loot that adds up to this many pieces: two to five kinds, at least one of each, the rest dealt out at random ("2 wood, 1 plastic"; "1 steel,
 * 1 fiber optics, 1 screws"). The same seed and name always give the same mix. The cheap ones lean on steel and wood, which the very first raid pays.
 */
export function recipeFor(seed: number, key: string, pieces: number): LootBag {
  const next = stream(seed, key);
  const pool = KINDS.map((k) => ({ k, w: pieces <= 8 && (k === 'steel' || k === 'wood') ? 4 : 1 }));
  const most = Math.max(1, Math.min(pieces, 3 + Math.floor(pieces / 8), 5));
  const least = Math.min(pieces, 2);
  const kinds = least + Math.floor(next() * (most - least + 1));
  const chosen: string[] = [];
  for (let i = 0; i < kinds; i++) {
    let x = next() * pool.reduce((n, p) => n + p.w, 0);
    let at = 0;
    for (; at < pool.length - 1; at++) { x -= pool[at].w; if (x < 0) break; }
    chosen.push(pool[at].k);
    pool.splice(at, 1);
  }
  const bag: LootBag = {};
  chosen.forEach((k) => { bag[k] = 1; });
  for (let i = kinds; i < pieces; i++) { const k = chosen[Math.floor(next() * chosen.length)]; bag[k] = (bag[k] ?? 0) + 1; }
  return bag;
}

/** What building a room of this type costs now, as a mix of loot. */
export const buildRecipe = (v: VaultHome, type: RoomType): LootBag => recipeFor(v.seed ?? 0, `room:${type}:${type === 'hallway' ? v.rooms.filter((r) => r.type === 'hallway').length : slotsUsed(v)}`, buildCost(v, type));
/** Pieces of loot a vacation vault costs, as a random mix (the same for the same place in the same vault, on the phone and on the server). */
export const VACATION_PIECES = 8;
export const vacationRecipe = (v: VaultHome, placeId: string): LootBag => recipeFor(v.seed ?? 0, `vacation:${placeId}`, VACATION_PIECES);
/** What the next piece of furniture in a room costs, as a mix of loot (each piece has its own). */
export const furnishRecipe = (v: VaultHome, roomIndex: number, item: string): LootBag => {
  const room = v.rooms[roomIndex];
  return room ? recipeFor(v.seed ?? 0, `item:${roomIndex}:${room.type}:${item}:${room.furniture.length}`, furnishCost(room)) : {};
};

// ---- settlers ----

/** A settler arrives with the third slot, and another with every three slots after it. */
export const settlersEarned = (v: VaultHome): number => Math.floor(slotsUsed(v) / 3);
export const settlersWaiting = (v: VaultHome): number => settlersEarned(v) - v.settlers.length;

// ---- happiness ----

export const DECAY_MS = 4 * 3_600_000;
export const VISIT_MS = 120_000;
/** A visit still counts as the same one if the screen was seen this recently. */
export const VISIT_GAP_MS = 60_000;
/** A temporary lift fades by one point per this long. */
export const BOOST_FADE_MS = 30 * 60_000;

/** Points from the rooms and furniture: they raise the floor and the baseline together. */
export const bonusPoints = (v: VaultHome): number => slotsUsed(v) + furnitureCount(v);
export const baselineOf = (v: VaultHome): number => 50 + bonusPoints(v);
export const floorOf = (v: VaultHome): number => 15 + bonusPoints(v);

export interface Mood { value: number; shown: number; baseline: number; floor: number; word: string }

export const FACES: { min: number; word: string }[] = [
  { min: 90, word: 'ECSTATIC' },
  { min: 75, word: 'HAPPY' },
  { min: 60, word: 'CONTENT' },
  { min: 45, word: 'INDIFFERENT' },
  { min: 35, word: 'DISPLEASED' },
  { min: 25, word: 'SAD' },
  { min: -1, word: 'ANGRY' },
];

/** How happy the vault is at a moment: climbing toward the baseline during a visit, then slipping a point every four hours down to the floor. */
export function moodAt(v: VaultHome, now: number): Mood {
  const base = baselineOf(v);
  const floor = floorOf(v);
  const end = Math.min(now, v.seenAt);
  const progress = Math.max(0, Math.min(1, (end - v.sessionAt) / VISIT_MS));
  let value = v.from < base ? v.from + (base - v.from) * progress : v.from;
  value -= Math.floor(Math.max(0, now - end) / DECAY_MS);
  value = Math.max(value, floor);
  const lift = Math.max(0, v.boost - Math.floor(Math.max(0, now - v.boostAt) / BOOST_FADE_MS));
  const shown = Math.max(0, Math.min(100, Math.round(value + lift)));
  const f = FACES.find((x) => shown >= x.min) ?? FACES[FACES.length - 1];
  return { value, shown, baseline: base, floor, word: f.word };
}

/** Records that the vault is being looked at: a new visit starts if it has been a while, otherwise the current one goes on. */
export function checkIn(v: VaultHome, now: number): VaultHome {
  if (now - v.seenAt <= VISIT_GAP_MS) return { ...v, seenAt: now };
  const m = moodAt(v, now);
  return { ...v, from: m.value, sessionAt: now, seenAt: now };
}

/** However many things are built at once, the temporary lift never goes above this. */
export const MAX_BOOST = 30;

/** The temporary lift for spending this many pieces: 5 to 20 points. */
export const boostFor = (pieces: number): number => Math.max(5, Math.min(20, Math.round(4 + pieces * 0.55)));

/** Puts the current mood into the stored fields, so a change to the floor or baseline (a new room) starts from where the vault is now. */
function settle(v: VaultHome, now: number): VaultHome {
  const m = moodAt(v, now);
  const lift = Math.max(0, v.boost - Math.floor(Math.max(0, now - v.boostAt) / BOOST_FADE_MS));
  return { ...v, from: m.value, sessionAt: now, seenAt: now, boost: lift, boostAt: now };
}

// ---- the things you can do (each returns the new vault, or the reason it cannot be done) ----

export type Action<T> = { ok: true; vault: VaultHome; cost: number; /** The exact mix of loot it costs. */ recipe: LootBag } & T | { ok: false; reason: string };

export function applyBuild(v: VaultHome, type: RoomType, level: number, col: number, row: number, now: number): Action<unknown> {
  if (!ROOM_DEFS.some((d) => d.id === type)) return { ok: false, reason: 'No such room' };
  const why = whyNotBuild(v, type, level, col, row);
  if (why) return { ok: false, reason: why };
  const cost = buildCost(v, type);
  const recipe = buildRecipe(v, type);
  const s = settle(v, now);
  return { ok: true, cost, recipe, vault: { ...s, rooms: [...s.rooms, { type, level, col, row, furniture: [] }], boost: Math.min(MAX_BOOST, s.boost + boostFor(cost)) } };
}

export function applyFurnish(v: VaultHome, roomIndex: number, item: string, now: number): Action<unknown> {
  const room = v.rooms[roomIndex];
  if (!room) return { ok: false, reason: 'No such room' };
  if (!furnitureOf(room.type).some((f) => f.id === item)) return { ok: false, reason: 'That does not belong in this room' };
  if (room.furniture.includes(item)) return { ok: false, reason: 'Already there' };
  if (room.type === 'hallway' && room.furniture.length >= 1) return { ok: false, reason: 'A hallway holds one piece' };
  const cost = furnishCost(room);
  const recipe = furnishRecipe(v, roomIndex, item);
  const s = settle(v, now);
  return { ok: true, cost, recipe, vault: { ...s, rooms: s.rooms.map((r, i) => (i === roomIndex ? { ...r, furniture: [...r.furniture, item] } : r)), boost: Math.min(MAX_BOOST, s.boost + boostFor(cost)) } };
}

export function applySettler(v: VaultHome, kind: string, name?: unknown): Action<unknown> {
  if (!SETTLER_KINDS.includes(kind as SettlerKind)) return { ok: false, reason: 'Not a settler' };
  if (settlersWaiting(v) < 1) return { ok: false, reason: 'No settler is waiting' };
  const clean = name === undefined ? undefined : cleanSettlerName(name);
  if (clean === null) return { ok: false, reason: 'A name is 1 to 10 letters or numbers' };
  const id = v.settlers.reduce((m, s) => Math.max(m, s.id), 0) + 1;
  return { ok: true, cost: 0, recipe: {}, vault: { ...v, settlers: [...v.settlers, { id, kind: kind as SettlerKind, ...(clean ? { name: clean } : {}) }] } };
}

/** Gives a settler a new name. */
export function applyRename(v: VaultHome, id: number, name: unknown): Action<unknown> {
  const clean = cleanSettlerName(name);
  if (!clean) return { ok: false, reason: 'A name is 1 to 10 letters or numbers' };
  if (!v.settlers.some((s) => s.id === id)) return { ok: false, reason: 'No such settler' };
  return { ok: true, cost: 0, recipe: {}, vault: { ...v, settlers: v.settlers.map((s) => (s.id === id ? { ...s, name: clean } : s)) } };
}
