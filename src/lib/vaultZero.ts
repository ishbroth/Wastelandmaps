// Vault 0, Vault Tech Headquarters, the one place in Antarctica: the location that stands on the map wherever you look (like the other permanent landmarks),
// so it is there when you scroll to the bottom of the world and zoom in. Its rules (boss-only raid, rewards, discovery by being in Antarctica) live in
// supabase/functions/_shared/vaultZero.ts, which the server functions share.

import { locationFromData, type Location } from './wasteland';
import { VAULT_ZERO_AT, VAULT_ZERO_ID } from '../../supabase/functions/_shared/vaultZero';

export { VAULT_ZERO_ID };

/** A real place on the map. It is not a `vault` (those are made-up entrances that cannot be looted): it is a landmark with a snapshot and a raid. */
export const VAULT_ZERO: Location = {
  ...locationFromData(VAULT_ZERO_ID, 'Vault Tech Headquarters', VAULT_ZERO_AT, 'other', 999),
  name: 'Vault 0',
  icon: 'vault0',
  famous: true,
  threat: 'Super Mutants',
  rads: 0,
  loot: 'Circuitry, fiber optics and gears',
};
