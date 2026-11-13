// What spare loot buys. The server uses these lists (the browser only names a trade and how many), and the Data tab shows them: three ways to pay for a stimpak, and
// three for Legendary Time. Each trade is for ONE of the item, and the board holds three of them for four hours at a time: each can be bought once, then it is spent until the board changes.

export type Trade = { id: string; cost: Record<string, number> };

/** Three ways to buy a stimpak (a strike-restoring shot in the shooting gallery). */
export const STIMPAK_TRADES: Trade[] = [
  { id: 'wood', cost: { wood: 3, screws: 3, adhesive: 2 } },
  { id: 'steel', cost: { steel: 3, oil: 2, springs: 2 } },
  { id: 'plastic', cost: { plastic: 3, glass: 2, adhesive: 2 } },
  { id: 'glass', cost: { glass: 3, oil: 2, wood: 2 } },
  { id: 'concrete', cost: { concrete: 3, screws: 2, steel: 2 } },
  { id: 'circuitry', cost: { circuitry: 2, adhesive: 3, springs: 2 } },
];

/** Three ways to buy Legendary Time (slows the enemies for four seconds). */
export const TIME_TRADES: Trade[] = [
  { id: 'circuit', cost: { circuitry: 2, concrete: 2, plastic: 2 } },
  { id: 'gears', cost: { gears: 3, oil: 3, screws: 2 } },
  { id: 'springs', cost: { springs: 3, gears: 2, glass: 2 } },
  { id: 'oilgears', cost: { circuitry: 2, gears: 3, oil: 2 } },
  { id: 'steelconcrete', cost: { concrete: 3, springs: 2, steel: 2 } },
  { id: 'plasticgears', cost: { plastic: 3, gears: 2, screws: 2 } },
];

/** How many of a trade the loot pays for: the most whole multiples of its cost that the bag holds. */
export function affordableQty(have: Partial<Record<string, number>>, cost: Record<string, number>): number {
  let most = Infinity;
  for (const [id, n] of Object.entries(cost)) most = Math.min(most, Math.floor((have[id] ?? 0) / n));
  return Number.isFinite(most) ? Math.max(0, most) : 0;
}

/** The board changes every four hours. */
export const TRADE_WINDOW_MS = 4 * 3_600_000;
export const tradeWindow = (now: number = Date.now()): number => Math.floor(now / TRADE_WINDOW_MS);
/** When the board next changes. */
export const tradeWindowEnds = (now: number = Date.now()): number => (tradeWindow(now) + 1) * TRADE_WINDOW_MS;

/** The three trades on the board for an item in a four-hour window: the same for everyone, and different from one window to the next. */
export function offersFor(item: 'stimpak' | 'time', windowNo: number): Trade[] {
  const pool = item === 'time' ? TIME_TRADES : STIMPAK_TRADES;
  let h = (2166136261 ^ (windowNo >>> 0)) >>> 0;
  for (const ch of item) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; }
  const rand = () => { h = (Math.imul(h ^ (h >>> 15), 2246822519) + 0x6d2b79f5) >>> 0; return h / 4294967296; };
  const idx = pool.map((_, i) => i);
  for (let i = idx.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
  return idx.slice(0, 3).sort((a, b) => a - b).map((i) => pool[i]);
}
