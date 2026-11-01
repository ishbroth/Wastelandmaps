// What spare loot buys: one stimpak per trade. The server uses this list (the browser only names a trade), and the Data tab shows it.

export const STIMPAK_TRADES: { id: string; cost: Record<string, number> }[] = [
  { id: 'wood', cost: { wood: 3, screws: 3, adhesive: 2 } },
  { id: 'plastic', cost: { plastic: 3, glass: 2, adhesive: 2 } },
  { id: 'steel', cost: { steel: 3, oil: 2, springs: 2 } },
  { id: 'circuit', cost: { circuitry: 2, fiberoptics: 2, plastic: 2 } },
  { id: 'gears', cost: { gears: 3, oil: 3, screws: 2 } },
];
