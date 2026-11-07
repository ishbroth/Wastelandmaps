// What spare loot buys. The server uses these lists (the browser only names a trade and how many), and the Data tab shows them: three ways to pay for a stimpak, and
// three for Legendary Time. Each trade is for ONE of the item; buying several multiplies the cost.

export type Trade = { id: string; cost: Record<string, number> };

/** Three ways to buy a stimpak (a strike-restoring shot in the shooting gallery). */
export const STIMPAK_TRADES: Trade[] = [
  { id: 'wood', cost: { wood: 3, screws: 3, adhesive: 2 } },
  { id: 'steel', cost: { steel: 3, oil: 2, springs: 2 } },
  { id: 'plastic', cost: { plastic: 3, glass: 2, adhesive: 2 } },
];

/** Three ways to buy Legendary Time (slows the enemies for four seconds). */
export const TIME_TRADES: Trade[] = [
  { id: 'circuit', cost: { circuitry: 2, fiberoptics: 2, plastic: 2 } },
  { id: 'gears', cost: { gears: 3, oil: 3, screws: 2 } },
  { id: 'springs', cost: { springs: 3, gears: 2, glass: 2 } },
];

/** How many of a trade the loot pays for: the most whole multiples of its cost that the bag holds. */
export function affordableQty(have: Partial<Record<string, number>>, cost: Record<string, number>): number {
  let most = Infinity;
  for (const [id, n] of Object.entries(cost)) most = Math.min(most, Math.floor((have[id] ?? 0) / n));
  return Number.isFinite(most) ? Math.max(0, most) : 0;
}
