// What waits in a place. Everything here comes from the place's id and what it is worth, so every survivor finds the same thing in the same place:
// the kind of enemy (or a mix), how many, the waves they come in, whether there is a boss, and what can be looted (1 to 3 kinds of loot).

import { pointsFor } from '../points';
import { hashString, seeded, type Location } from '../wasteland';
import { BOSS_IDS, enemyById, type BossId, type EnemyId } from './enemies';
import { LOOT_TYPES, type LootId } from './loot';

export interface RaidPlan {
  worth: number;
  /** The kinds of enemy here (one, or a mix of two). */
  enemies: EnemyId[];
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

/** The least and most pieces of loot for a place of this worth: 3 to 4 at the bottom, 3 to 10 at the top. */
export function lootRangeFor(worth: number): [number, number] {
  return [3, Math.min(10, 4 + Math.floor(worth / 12.5))];
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
  const rand = seeded(hashString(`${id}|raid`));
  const pool = poolFor(worth);
  const first = pool[Math.floor(rand() * pool.length)];
  // about one place in three is a mix of two kinds
  const second = rand() < 0.34 ? pool.filter((e) => e !== first)[Math.floor(rand() * (pool.length - 1))] : null;
  const enemies = second ? [first, second] : [first];
  const boss = worth >= BOSS_FROM ? BOSS_IDS[Math.floor(rand() * BOSS_IDS.length)] : null;

  // the same hit points of enemy for the same worth: many weak ones or a few strong ones
  const budget = 120 + worth * 24;
  const avgHp = enemies.reduce((sum, e) => sum + enemyById(e).hp, 0) / enemies.length;
  const hardest = Math.max(...enemies.map((e) => enemyById(e).hp));
  const least = hardest > 300 ? 2 : hardest > 150 ? 3 : 5;
  let total = Math.max(least, Math.min(40, Math.round((boss ? budget * 0.6 : budget) / avgHp)));
  if (boss) total = Math.max(3, Math.min(total, 24));

  const kinds = 1 + Math.floor(rand() * 3);
  const loot = [...LOOT_TYPES].map((l) => l.id).sort(() => rand() - 0.5).slice(0, kinds) as LootId[];
  return { worth, enemies, boss, waves: wavesFor(total), total, lootTypes: loot, lootRange: lootRangeFor(worth) };
}

/** The plan for a place on the map. */
export const raidFor = (loc: Location): RaidPlan => planFor(loc.id, pointsFor(loc));

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
