// The things a place can be looted for. A survivor keeps any amount of each; they are spent to unlock and upgrade guns (weapons.ts).

export const LOOT_TYPES = [
  { id: 'steel', name: 'Steel' },
  { id: 'wood', name: 'Wood' },
  { id: 'springs', name: 'Springs' },
  { id: 'adhesive', name: 'Adhesive' },
  { id: 'screws', name: 'Screws' },
  { id: 'fiberoptics', name: 'Fiber Optics' },
  { id: 'glass', name: 'Glass' },
  { id: 'circuitry', name: 'Circuitry' },
  { id: 'oil', name: 'Oil' },
  { id: 'gears', name: 'Gears' },
  { id: 'plastic', name: 'Plastic' },
] as const;

export type LootId = (typeof LOOT_TYPES)[number]['id'];
export type LootBag = Partial<Record<LootId, number>>;

export const lootName = (id: LootId): string => LOOT_TYPES.find((l) => l.id === id)?.name ?? id;

export const bagTotal = (bag: LootBag): number => Object.values(bag).reduce((sum, n) => sum + (n ?? 0), 0);

/** Does the survivor have everything in the recipe? */
export const canAfford = (have: LootBag, cost: LootBag): boolean => (Object.entries(cost) as [LootId, number][]).every(([id, n]) => (have[id] ?? 0) >= n);

/** "3 Steel, 2 Springs" */
export const describeBag = (bag: LootBag): string =>
  (Object.entries(bag) as [LootId, number][]).filter(([, n]) => n > 0).map(([id, n]) => `${n} ${lootName(id)}`).join(', ');
