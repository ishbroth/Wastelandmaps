// Which tier of each class of gun the survivor has chosen to take into battle. They own every tier up to the highest one they built, and may go back to a lower one;
// the choice is kept on this device, per account. With no choice made, the best one owned is used.

import type { Arsenal, WeaponClass } from './weapons';
import { WEAPON_CLASS_IDS } from './weapons';

export type Equipped = Partial<Record<WeaponClass, 1 | 2 | 3 | 4>>;
const key = (userId: string): string => `wastelandmaps:guns:v1:${userId}`;

export function loadEquipped(userId: string | undefined): Equipped {
  if (!userId) return {};
  try { return JSON.parse(localStorage.getItem(key(userId)) ?? '{}') as Equipped; } catch { return {}; }
}

export function saveEquipped(userId: string | undefined, eq: Equipped): void {
  if (!userId) return;
  try { localStorage.setItem(key(userId), JSON.stringify(eq)); } catch { /* storage unavailable */ }
}

/** The guns that go into battle: the chosen tier of each class, never above what is owned (and the best owned where none was chosen). */
export function battleArsenal(owned: Arsenal, eq: Equipped): Arsenal {
  const out = { ...owned };
  for (const cls of WEAPON_CLASS_IDS) {
    const chosen = eq[cls];
    if (chosen && owned[cls] > 0) out[cls] = Math.min(chosen, owned[cls]) as 1 | 2 | 3 | 4;
  }
  return out;
}
