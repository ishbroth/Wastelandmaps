// Vault 0: Vault Tech Headquarters, in Antarctica. One definition shared by the app and the server functions (raid, report-discovery), so they agree.
//
//  - It is a permanent landmark with its own snapshot (a pristine vault door in the snow: no bomb, no "after" picture).
//  - It can be looted from anywhere: eight waves of nothing but boss-level enemies, one boss in the first wave, then one more in each wave after it.
//    Beating it pays VAULT_ZERO_RAID_XP and VAULT_ZERO_PIECES pieces of loot at once, and does NOT discover the place.
//  - It is discovered only by being physically in Antarctica (see antarctica.ts): that pays VAULT_ZERO_FOUND_XP, once, and the same loot again, once.

export const VAULT_ZERO_ID = 'famous:vault-0';
/** Where its icon stands on the map: deep in the continent. */
export const VAULT_ZERO_AT = { lat: -80, lng: 60 };

/** Bosses in each wave: one, then one more every wave, eight waves. */
export const VAULT_ZERO_WAVES = [1, 2, 3, 4, 5, 6, 7, 8];
export const VAULT_ZERO_BOSSES = VAULT_ZERO_WAVES.reduce((a, b) => a + b, 0);

/** The three kinds of loot it holds (the pieces are shared out among them). */
export const VAULT_ZERO_LOOT = ['circuitry', 'fiberoptics', 'gears'];
export const VAULT_ZERO_PIECES = 20;
export const VAULT_ZERO_RAID_XP = 100;
export const VAULT_ZERO_FOUND_XP = 1000;

/** The ids the server stores the two XP awards under (not places: they never show on the map and never count as discoveries). */
export const VAULT_ZERO_RAID_XP_ID = 'bonus:vault-0-raid';

/** Exactly VAULT_ZERO_PIECES pieces, at least one of each kind. Pass a random function so a test can use its own. */
export function rollVaultZeroLoot(random: () => number = Math.random): Record<string, number> {
  const out: Record<string, number> = {};
  VAULT_ZERO_LOOT.forEach((id) => { out[id] = 1; });
  for (let i = VAULT_ZERO_LOOT.length; i < VAULT_ZERO_PIECES; i++) {
    const id = VAULT_ZERO_LOOT[Math.floor(random() * VAULT_ZERO_LOOT.length)];
    out[id] += 1;
  }
  return out;
}
