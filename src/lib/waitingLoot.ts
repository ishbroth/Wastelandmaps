import { describeBag, type LootBag } from './raid/loot';

/** The pieces of loot waiting at a place, as a short line: "2 STEEL, 1 GEARS" (empty when none). */
export function waitingLine(bag: LootBag | undefined): string {
  if (!bag) return '';
  const line = describeBag(bag as never).toUpperCase();
  return Object.values(bag).some((n) => (n ?? 0) > 0) ? line : '';
}
