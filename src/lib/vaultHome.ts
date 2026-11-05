// Your home vault, the place you enter once its snapshot is bought and it is cleared: a grid of rooms that you build out of loot, furnish out of loot, and fill
// with settlers whose happiness you look after. These are the rules; the server (supabase/functions/vault) enforces them with a copy of this file
// (node _tools/sync-vault.mjs), so the browser can only ask. Nothing here imports anything, so the copy is exact.

export type LootBag = Partial<Record<string, number>>;

export const COLS = 3;
export const ROWS = 5;

export type RoomType = 'living' | 'kitchen' | 'bedroom' | 'dining' | 'bathroom' | 'entertainment' | 'workshop' | 'game';

export interface FurnitureDef { id: string; name: string }
export interface RoomDef {
  id: RoomType;
  name: string;
  /** How many room slots across: 1, or 2 for the big rooms. */
  slots: 1 | 2;
  /** The most of this kind a vault can hold. */
  max: number;
  furniture: FurnitureDef[];
}

export const ROOM_DEFS: RoomDef[] = [
  { id: 'living', name: 'Living Room', slots: 1, max: 3, furniture: [{ id: 'couch', name: 'Couch' }, { id: 'tv', name: 'TV' }, { id: 'armchair', name: 'Chair' }, { id: 'coffeetable', name: 'Coffee Table' }] },
  { id: 'dining', name: 'Dining Room', slots: 1, max: 3, furniture: [{ id: 'table', name: 'Dining Table' }, { id: 'chairs', name: 'Dining Chairs' }, { id: 'chandelier', name: 'Candle Chandelier' }, { id: 'chinacabinet', name: 'China Cabinet' }] },
  { id: 'kitchen', name: 'Kitchen', slots: 1, max: 3, furniture: [{ id: 'sinkcabinets', name: 'Cabinets & Sink' }, { id: 'fridge', name: 'Refrigerator' }, { id: 'stove', name: 'Stove' }] },
  { id: 'bedroom', name: 'Bedroom', slots: 1, max: 6, furniture: [{ id: 'bed', name: 'Bed' }, { id: 'nightstand', name: 'Nightstands' }, { id: 'dresser', name: 'Dresser' }, { id: 'lamp', name: 'Lamp' }] },
  { id: 'bathroom', name: 'Bathroom', slots: 1, max: 3, furniture: [{ id: 'toilet', name: 'Toilet' }, { id: 'bathsink', name: 'Sink' }, { id: 'shower', name: 'Shower' }] },
  { id: 'entertainment', name: 'Entertainment Room', slots: 2, max: 1, furniture: [{ id: 'seating', name: 'Theatre Seating' }, { id: 'screen', name: 'Screen' }, { id: 'speakers', name: 'Speakers' }] },
  { id: 'game', name: 'Game Room', slots: 2, max: 1, furniture: [{ id: 'pooltable', name: 'Pool Table' }, { id: 'bar', name: 'Bar' }, { id: 'pinball', name: 'Pinball Machine' }] },
  { id: 'workshop', name: 'Workshop', slots: 2, max: 1, furniture: [{ id: 'toolchest', name: 'Tool Chest' }, { id: 'armorstand', name: 'Power Armor Stand' }, { id: 'craftingtable', name: 'Weapon Crafting Table' }] },
];

export const roomDef = (t: RoomType): RoomDef => ROOM_DEFS.find((r) => r.id === t) as RoomDef;

export interface VaultRoom {
  type: RoomType;
  /** Left cell of the room (a 2-slot room covers col and col + 1). */
  col: number;
  row: number;
  /** Furniture placed, in the order it was placed. */
  furniture: string[];
}

export type SettlerKind = 'male' | 'female' | 'dog' | 'cat';
export const SETTLER_KINDS: SettlerKind[] = ['male', 'female', 'dog', 'cat'];
export interface Settler { id: number; kind: SettlerKind }

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
}

export const newVault = (now: number): VaultHome => ({ rooms: [{ type: 'living', col: 0, row: 0, furniture: [] }], settlers: [], from: 50, sessionAt: now, seenAt: now, boost: 0, boostAt: now });

// ---- the grid ----

export const slotsOf = (r: VaultRoom): number => roomDef(r.type).slots;
export const slotsUsed = (v: VaultHome): number => v.rooms.reduce((n, r) => n + slotsOf(r), 0);
export const furnitureCount = (v: VaultHome): number => v.rooms.reduce((n, r) => n + r.furniture.length, 0);

/** The room covering a cell, or undefined. */
export const roomAt = (v: VaultHome, col: number, row: number): VaultRoom | undefined => v.rooms.find((r) => r.row === row && col >= r.col && col < r.col + slotsOf(r));

/** Can a room of this type be built with its left cell here? Returns null if yes, or the reason. */
export function whyNotBuild(v: VaultHome, type: RoomType, col: number, row: number): string | null {
  const def = roomDef(type);
  if (row < 0 || row >= ROWS || col < 0 || col + def.slots > COLS) return 'There is no room for it there';
  if (v.rooms.filter((r) => r.type === type).length >= def.max) return `A vault holds at most ${def.max} ${def.name}${def.max > 1 ? 's' : ''}`;
  for (let c = col; c < col + def.slots; c++) if (roomAt(v, c, row)) return 'That space is taken';
  // it must touch a room that is already there, not at a corner
  let touches = false;
  for (let c = col; c < col + def.slots; c++) {
    for (const [dc, dr] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      const o = roomAt(v, c + dc, row + dr);
      if (o && !(o.row === row && c + dc >= col && c + dc < col + def.slots)) touches = true;
    }
  }
  return touches ? null : 'It has to connect to a room you already have';
}

/** The price of the nth room slot (the second is 4, the third 6, the fourth 8, and so on). */
export const slotPrice = (n: number): number => 2 * n;

/** Pieces of loot to build a room of this type now: the price of each slot it takes. A 2-slot room as your 4th slot costs 8 + 10. */
export function buildCost(v: VaultHome, type: RoomType): number {
  const first = slotsUsed(v) + 1;
  return roomDef(type).slots === 2 ? slotPrice(first) + slotPrice(first + 1) : slotPrice(first);
}

/** Pieces of loot for the next piece of furniture in a room (3, 4, 5, then 6 for the last of four). */
export function furnishCost(r: VaultRoom): number {
  return 3 + r.furniture.length;
}

export const furnitureOf = (type: RoomType): FurnitureDef[] => roomDef(type).furniture;
export const roomComplete = (r: VaultRoom): boolean => r.furniture.length >= furnitureOf(r.type).length;

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

export type Action<T> = { ok: true; vault: VaultHome; cost: number } & T | { ok: false; reason: string };

export function applyBuild(v: VaultHome, type: RoomType, col: number, row: number, now: number): Action<unknown> {
  if (!ROOM_DEFS.some((d) => d.id === type)) return { ok: false, reason: 'No such room' };
  const why = whyNotBuild(v, type, col, row);
  if (why) return { ok: false, reason: why };
  const cost = buildCost(v, type);
  const s = settle(v, now);
  return { ok: true, cost, vault: { ...s, rooms: [...s.rooms, { type, col, row, furniture: [] }], boost: Math.min(MAX_BOOST, s.boost + boostFor(cost)) } };
}

export function applyFurnish(v: VaultHome, roomIndex: number, item: string, now: number): Action<unknown> {
  const room = v.rooms[roomIndex];
  if (!room) return { ok: false, reason: 'No such room' };
  if (!furnitureOf(room.type).some((f) => f.id === item)) return { ok: false, reason: 'That does not belong in this room' };
  if (room.furniture.includes(item)) return { ok: false, reason: 'Already there' };
  const cost = furnishCost(room);
  const s = settle(v, now);
  return { ok: true, cost, vault: { ...s, rooms: s.rooms.map((r, i) => (i === roomIndex ? { ...r, furniture: [...r.furniture, item] } : r)), boost: Math.min(MAX_BOOST, s.boost + boostFor(cost)) } };
}

export function applySettler(v: VaultHome, kind: string): Action<unknown> {
  if (!SETTLER_KINDS.includes(kind as SettlerKind)) return { ok: false, reason: 'Not a settler' };
  if (settlersWaiting(v) < 1) return { ok: false, reason: 'No settler is waiting' };
  const id = v.settlers.reduce((m, s) => Math.max(m, s.id), 0) + 1;
  return { ok: true, cost: 0, vault: { ...v, settlers: [...v.settlers, { id, kind: kind as SettlerKind }] } };
}

/** Is a payment a legal way to pay this many pieces: whole positive amounts that add up exactly? */
export function validPayment(pay: LootBag, pieces: number, kinds: string[]): boolean {
  let sum = 0;
  for (const [k, n] of Object.entries(pay)) {
    if (!kinds.includes(k) || !Number.isInteger(n) || (n as number) < 0) return false;
    sum += n as number;
  }
  return sum === pieces;
}
