// Vaults in a metro: one for every 250,000 people (1,000,000 outside the richer countries), at least one. Each is a local place, not a famous one,
// that stops having a new wasteland name and becomes the entrance to a numbered vault ("Entrance to Vault 042. Formerly ..."). The games' own vaults
// (see loreVaults.ts) are put in first, where they stand.

import { LORE_VAULTS } from './loreVaults';
import { isFamous } from './placeNames';
import { FREE_RENDERS } from './renders';
import { distanceMeters, hashString, seeded, type Location } from './wasteland';

/** Countries measured at 250,000 people a vault: North America, Europe, Australia, China, Japan, South Korea, New Zealand, Argentina, Uruguay, Brazil. */
const RICH = new Set([
  'US', 'CA', 'MX', 'AL', 'AD', 'AT', 'BY', 'BE', 'BA', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IS', 'IE', 'IT', 'XK', 'LV', 'LI', 'LT', 'LU',
  'MT', 'MD', 'MC', 'ME', 'NL', 'MK', 'NO', 'PL', 'PT', 'RO', 'RU', 'SM', 'RS', 'SK', 'SI', 'ES', 'SE', 'CH', 'UA', 'GB', 'VA', 'AU', 'CN', 'HK', 'MO', 'JP', 'KR', 'NZ', 'AR', 'UY', 'BR',
]);

export const vaultCount = (country: string, population: number): number =>
  Math.max(1, Math.floor(population / (RICH.has(country) ? 250_000 : 1_000_000)));

interface Metro { id: string; lat: number; lng: number; radiusKm: number; pop: number; country: string }

const LORE_NUMBERS = new Set(LORE_VAULTS.map((v) => v.number));

/** Returns the metro's places with its vaults in: lore vaults where they stand, and local places turned into entrances. */
export function assignVaults(metro: Metro, places: Location[]): Location[] {
  const out = places.map((p) => ({ ...p }));
  const taken = new Set<number>();
  const rand = seeded(hashString(`vaults:${metro.id}`));
  const toNumber = () => {
    for (let tries = 0; tries < 500; tries++) {
      const n = 1 + Math.floor(rand() * 998);
      if (!taken.has(n) && !LORE_NUMBERS.has(n)) { taken.add(n); return n; }
    }
    return 999;
  };
  const makeVault = (p: Location, number: number, lore?: string) => {
    p.vault = { number, ...(lore ? { lore } : {}) };
    p.icon = 'vault';
    p.name = `VAULT ${String(number).padStart(3, '0')}`;
  };

  // the games' own vaults that stand in this metro
  let lore = 0;
  for (const v of LORE_VAULTS) {
    if (distanceMeters({ lat: metro.lat, lng: metro.lng }, v) / 1000 > metro.radiusKm) continue;
    lore++;
    taken.add(v.number);
    // does a place on the map stand where the vault does? then that place is its entrance
    let near: Location | null = null;
    let best = 700;
    for (const p of out) {
      const d = distanceMeters(p.position, v);
      if (d < best && !p.vault) { best = d; near = p; }
    }
    if (near) makeVault(near, v.number, v.lore);
    else {
      out.push({
        id: `vault:${v.number}`, oldName: '', name: `VAULT ${String(v.number).padStart(3, '0')}`, category: 'other', position: { lat: v.lat, lng: v.lng },
        loot: 'Not much anyone has come back to tell', threat: 'Quiet', rads: 0, icon: 'vault', vault: { number: v.number, lore: v.lore },
      });
    }
  }

  // the rest: local, not-famous places, spread across the metro
  const want = Math.max(0, vaultCount(metro.country, metro.pop) - lore);
  const candidates = out.filter((p) => !p.vault && p.category !== 'transit' && p.id.startsWith('wd:') && !p.famous && !FREE_RENDERS[p.id.slice(3)] && !isFamous(p.category, p.fame ?? 0) && !/\b(exercise|operation|festival|exhibition|games|tournament|championship|expedition)\b/i.test(p.oldName));
  const chosen: Location[] = [];
  while (chosen.length < want && candidates.length > chosen.length) {
    // the candidate farthest from the vaults already chosen (the first is picked at random)
    let pick: Location | null = null;
    if (chosen.length === 0) pick = candidates[Math.floor(rand() * candidates.length)];
    else {
      let far = -1;
      for (const c of candidates) {
        if (chosen.includes(c)) continue;
        const nearest = Math.min(...chosen.map((o) => distanceMeters(o.position, c.position)));
        if (nearest > far) { far = nearest; pick = c; }
      }
    }
    if (!pick) break;
    chosen.push(pick);
    makeVault(pick, toNumber());
  }
  return out;
}
