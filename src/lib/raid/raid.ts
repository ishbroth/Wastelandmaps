// What waits in a place. Everything here comes from the place's id and what it is worth, so every survivor finds the same thing in the same place:
// the kind of enemy (or a mix), how many, the waves they come in, whether there is a boss, and what can be looted (1 to 3 kinds of loot).

import { pointsFor } from '../points';
import { hashString, seeded, type Location } from '../wasteland';
import { BOSS_IDS, HP_SCALE, enemyById, type BossId, type EnemyId } from './enemies';
import { LOOT_TYPES, type LootId } from './loot';
import { VAULT_ZERO_ID, VAULT_ZERO_LOOT, VAULT_ZERO_PIECES, VAULT_ZERO_WAVES, VAULT_ZERO_BOSSES } from '../../../supabase/functions/_shared/vaultZero';

export interface RaidPlan {
  worth: number;
  /** The kinds of enemy here (one, or a mix of two). For a boss-only raid (Vault 0) these are the bosses themselves. */
  enemies: (EnemyId | BossId)[];
  /** The final boss, for the two top tiers of landmarks. */
  boss: BossId | null;
  /** How many come, in the order they arrive: it starts with one, then two, then more, then the onslaught. */
  waves: number[];
  /** Every enemy in the order they arrive. */
  total: number;
  /** What this place can be looted for. */
  lootTypes: LootId[];
  /** The least and most pieces of loot a win gives. */
  lootRange: [number, number];
  /** Every enemy in every wave is a boss (Vault 0): they come with the boss's health bar and behavior instead of the ordinary kind. */
  bossOnly?: boolean;
}

/** The kinds of enemy a place of this worth can have: the small places have the weak things, deathclaws only guard the great landmarks. */
function poolFor(worth: number): EnemyId[] {
  const pool: EnemyId[] = ['raider', 'bloatfly', 'radroach', 'molerat', 'ghoul'];
  if (worth >= 15) pool.push('robot', 'radscorpion');
  if (worth >= 20) pool.push('mirelurk');
  if (worth >= 30) pool.push('supermutant');
  if (worth >= 50) pool.push('deathclaw');
  return pool;
}

/** Worth for the top two tiers: they have a boss. */
const BOSS_FROM = 50;

/** The least and most pieces of loot a win pays, by the place's worth: 2-3 for the smallest, 3-4 for small and mid, 4-5 for larger buildings, 5-8 for the famous, 7-10 for the permanent landmarks. (The server has the same table.) */
export function lootRangeFor(worth: number): [number, number] {
  if (worth >= 75) return [7, 10];
  if (worth >= 50) return [5, 8];
  if (worth >= 30) return [4, 5];
  if (worth >= 15) return [3, 4];
  return [2, 3];
}

/** One wave after another: a single enemy, then two, then growing until the rest arrive together. */
export function wavesFor(total: number): number[] {
  const waves: number[] = [];
  let left = total;
  let next = 1;
  while (left > 0) {
    const size = Math.min(left, next);
    waves.push(size);
    left -= size;
    next = next < 3 ? next + 1 : Math.ceil(next * 1.6);
  }
  return waves;
}

/** Plan for any worth and id (the places with permanent snapshots can also be given a hand-made plan, see landmarkRaids.ts). */
export function planFor(id: string, worth: number): RaidPlan {
  if (id === VAULT_ZERO_ID) return vaultZeroPlan(); // whatever worth it was stored with (the Data tab asks by id and worth)
  const rand = seeded(hashString(`${id}|raid`));
  const pool = poolFor(worth);
  const first = pool[Math.floor(rand() * pool.length)];
  // about one place in three is a mix of two kinds
  const second = rand() < 0.34 ? pool.filter((e) => e !== first)[Math.floor(rand() * (pool.length - 1))] : null;
  const enemies = second ? [first, second] : [first];
  const boss = worth >= BOSS_FROM ? BOSS_IDS[Math.floor(rand() * BOSS_IDS.length)] : null;

  // the same hit points of enemy for the same worth: many weak ones or a few strong ones
  const budget = (120 + worth * 24) * HP_SCALE;
  const avgHp = enemies.reduce((sum, e) => sum + enemyById(e).hp, 0) / enemies.length;
  const hardest = Math.max(...enemies.map((e) => enemyById(e).hp));
  const least = hardest > 300 * HP_SCALE ? 2 : hardest > 150 * HP_SCALE ? 3 : 5;
  let total = Math.max(least, Math.min(40, Math.round((boss ? budget * 0.6 : budget) / avgHp)));
  if (boss) total = Math.max(3, Math.min(total, 24));

  // never more kinds than pieces (a win pays at least one of each kind)
  const kinds = Math.min(lootRangeFor(worth)[0], 1 + Math.floor(rand() * 3));
  const loot = [...LOOT_TYPES].map((l) => l.id).sort(() => rand() - 0.5).slice(0, kinds) as LootId[];
  return { worth, enemies, boss, waves: wavesFor(total), total, lootTypes: loot, lootRange: lootRangeFor(worth) };
}

/** The first fight every survivor has: their own home vault, with four radroaches, the weakest enemy there is. */
export function homePlan(): RaidPlan {
  return { worth: 10, enemies: ['radroach'], boss: null, waves: wavesFor(4), total: 4, lootTypes: ['steel', 'wood'], lootRange: lootRangeFor(10) };
}

/**
 * Vault 0, Vault Tech Headquarters: eight waves of nothing but bosses, one in the first wave and one more in each wave after it (36 in all). Worth 75 so the
 * server's tables accept it; what it pays (exactly 20 pieces, plus XP) is decided by the server (see supabase/functions/raid).
 */
export function vaultZeroPlan(): RaidPlan {
  return { worth: 75, enemies: [...BOSS_IDS], boss: null, waves: VAULT_ZERO_WAVES, total: VAULT_ZERO_BOSSES, lootTypes: VAULT_ZERO_LOOT as LootId[], lootRange: [VAULT_ZERO_PIECES, VAULT_ZERO_PIECES], bossOnly: true };
}

/** The plan for a place on the map (a person's own home vault is always the first fight: four radroaches). */
export const raidFor = (loc: Location): RaidPlan => (loc.id === VAULT_ZERO_ID ? vaultZeroPlan() : loc.personal?.home ? homePlan() : planFor(loc.id, pointsFor(loc)));

/** What a win there really pays, as a line: "Steel, Gears: 7 to 10 pieces". */
export function lootSummary(plan: RaidPlan): string {
  const [min, max] = plan.lootRange;
  const names = plan.lootTypes.map((l) => LOOT_TYPES.find((t) => t.id === l)?.name ?? l).join(', ');
  return `${names}: ${min === max ? min : `${min} to ${max}`} pieces`;
}

/**
 * What a win pays: a random number of pieces within the place's range, divided among its loot types (at least one of each). Pass a random function
 * so the server and a test can use their own.
 */
export function rollLoot(plan: RaidPlan, random: () => number = Math.random): Partial<Record<LootId, number>> {
  const [min, max] = plan.lootRange;
  const pieces = min + Math.floor(random() * (max - min + 1));
  const out: Partial<Record<LootId, number>> = {};
  plan.lootTypes.forEach((id) => { out[id] = 1; });
  for (let i = plan.lootTypes.length; i < pieces; i++) {
    const id = plan.lootTypes[Math.floor(random() * plan.lootTypes.length)];
    out[id] = (out[id] ?? 0) + 1;
  }
  // a place with more loot types than pieces rolled still pays one of each
  return out;
}

/** A health bar that grows with the survivor's level. */
export const maxHealth = (level: number): number => 100 + 10 * level;

const cap = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);

/** What is in a place, as it is shown on its card: the kinds of enemy (and the boss) that the shooting gallery there will actually send. */
export const planEnemies = (plan: { enemies: (EnemyId | BossId)[]; boss: BossId | null }): string => {
  const list = plan.enemies.map((e) => cap(enemyById(e).plural)).join(', ');
  return plan.boss ? `${list} · Boss: ${enemyById(plan.boss).name}` : list;
};
export const enemiesLine = (loc: Location): string => planEnemies(raidFor(loc));
