// The shooting gallery's rules, with no drawing in it: enemies walk out of the picture toward the survivor, the survivor shoots them, they hurt the
// survivor when they get close. Everything is in the picture's own coordinates (u across, v down, both 0 to 1) and the screen maps them (see RaidScreen).

import { enemyById, type BossId, type EnemyType } from './enemies';
import type { RaidPlan } from './raid';
import { WEAPON_CLASS_IDS, weaponAt, type Arsenal, type Weapon, type WeaponClass } from './weapons';

/** Where enemies come from: the line of the horizon (v), and the spots on the ground (u, v) they step out of. */
export interface Spawns {
  horizon: number;
  points: { u: number; v: number }[];
}

/** For a picture nobody has marked: the ground band across the lower half. */
export const DEFAULT_SPAWNS: Spawns = {
  horizon: 0.56,
  points: [0.1, 0.25, 0.4, 0.55, 0.7, 0.85, 0.18, 0.5, 0.78].map((u, i) => ({ u, v: 0.62 + (i % 3) * 0.05 })),
};

/** A grown person's height as a share of the picture's height, standing at the bottom edge (nearer things are bigger, down to nothing at the horizon). */
export const PERSON_HEIGHT = 0.52;
/** Below this line an enemy is close enough to attack. */
const CONTACT_V = 0.9;
/** Ranged enemies stop here and shoot. */
const RANGED_V = 0.74;

export interface Enemy {
  id: number;
  type: EnemyType;
  boss: boolean;
  u: number;
  v: number;
  /** Where along u it is walking to. */
  toU: number;
  hp: number;
  maxHp: number;
  state: 'walking' | 'attacking' | 'dying';
  /** Seconds in the current state, for the animation. */
  t: number;
  /** Seconds until its next attack. */
  cooldown: number;
  /** How long a hit flash lasts. */
  hurt: number;
  /** Flying things bob. */
  phase: number;
}

export interface Effect {
  kind: 'explosion' | 'spark' | 'flame' | 'muzzle' | 'damage';
  u: number;
  v: number;
  /** Radius in the picture's widths (explosions, flames). */
  size: number;
  t: number;
  life: number;
}

export type Outcome = 'fighting' | 'won' | 'lost';

export interface GameOptions {
  plan: RaidPlan;
  spawns: Spawns;
  arsenal: Arsenal;
  /** The survivor's level (their health grows with it). */
  maxHealth: number;
  random?: () => number;
}

export class Game {
  readonly plan: RaidPlan;
  readonly spawns: Spawns;
  readonly arsenal: Arsenal;
  readonly maxHealth: number;
  health: number;
  enemies: Enemy[] = [];
  effects: Effect[] = [];
  outcome: Outcome = 'fighting';
  /** The weapon class in hand. */
  selected: WeaponClass = 'pistol';
  /** Shots left for the weapons that run out. */
  ammo: Partial<Record<WeaponClass, number>> = {};
  killed = 0;
  /** What the banner says ("WAVE 2", "BOSS"), and for how long. */
  banner = '';
  bannerT = 0;
  /** Screen shake and recoil. */
  shake = 0;
  recoil = 0;
  hitFlash = 0;
  private random: () => number;
  private nextId = 1;
  private wave = -1;
  private toSpawn: { type: EnemyType; boss: boolean }[] = [];
  private spawnGap = 0;
  private pause = 1.2;
  private bossDone = false;
  private cooldown = 0;
  private order: { type: EnemyType; boss: boolean }[][];

  constructor(opts: GameOptions) {
    this.plan = opts.plan;
    this.spawns = opts.spawns;
    this.arsenal = opts.arsenal;
    this.maxHealth = opts.maxHealth;
    this.health = opts.maxHealth;
    this.random = opts.random ?? Math.random;
    for (const cls of WEAPON_CLASS_IDS) {
      const tier = opts.arsenal[cls];
      if (tier > 0) {
        const w = weaponAt(cls, tier as 1 | 2 | 3 | 4);
        if (w.ammo) this.ammo[cls] = w.ammo;
      }
    }
    // who comes in each wave: the kinds of enemy this place has, mixed, with the boss last
    this.order = this.plan.waves.map((size) => Array.from({ length: size }, () => ({ type: enemyById(this.plan.enemies[Math.floor(this.random() * this.plan.enemies.length)]), boss: false })));
    this.banner = 'WAVE 1';
    this.bannerT = 2.2;
  }

  /** The weapon in hand (null if the class has none built). */
  get weapon(): Weapon | null {
    const tier = this.arsenal[this.selected];
    return tier > 0 ? weaponAt(this.selected, tier as 1 | 2 | 3 | 4) : null;
  }

  select(cls: WeaponClass): boolean {
    if (this.arsenal[cls] === 0) return false;
    this.selected = cls;
    return true;
  }

  get alive(): Enemy[] {
    return this.enemies.filter((e) => e.state !== 'dying');
  }

  /** Total enemies this raid will send, bosses included. */
  get totalEnemies(): number {
    return this.plan.total + (this.plan.boss ? 1 : 0);
  }

  private spawn(type: EnemyType, boss: boolean) {
    const pts = this.spawns.points;
    const p = pts[Math.floor(this.random() * pts.length)] ?? { u: 0.5, v: 0.64 };
    const hp = type.hp;
    this.enemies.push({
      id: this.nextId++, type, boss, u: p.u, v: Math.max(this.spawns.horizon + 0.02, p.v), toU: 0.2 + this.random() * 0.6, hp, maxHp: hp, state: 'walking', t: 0,
      cooldown: type.every * (0.5 + this.random() * 0.8), hurt: 0, phase: this.random() * 6.28,
    });
  }

  /** Pixel-independent size of an enemy: its height in picture heights at its place on the ground. */
  heightOf(e: Enemy): number {
    const depth = Math.max(0.02, (e.v - this.spawns.horizon) / (1 - this.spawns.horizon));
    return PERSON_HEIGHT * depth * e.type.size;
  }

  update(dt: number) {
    if (this.outcome !== 'fighting') return;
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.recoil = Math.max(0, this.recoil - dt * 6);
    this.shake = Math.max(0, this.shake - dt * 3);
    this.hitFlash = Math.max(0, this.hitFlash - dt * 2.5);
    this.bannerT = Math.max(0, this.bannerT - dt);

    // waves: one, then two, then more, with a breath between; the boss after the last
    if (this.toSpawn.length === 0 && this.alive.length === 0) {
      if (this.wave + 1 < this.order.length) {
        this.pause -= dt;
        if (this.pause <= 0) {
          this.wave++;
          this.toSpawn = [...this.order[this.wave]];
          this.pause = 2;
          this.banner = `WAVE ${this.wave + 1}`;
          this.bannerT = 2;
        }
      } else if (this.plan.boss && !this.bossDone) {
        this.pause -= dt;
        if (this.pause <= 0) {
          this.bossDone = true;
          this.toSpawn = [{ type: enemyById(this.plan.boss as BossId), boss: true }];
          this.banner = 'BOSS';
          this.bannerT = 2.6;
        }
      } else {
        this.outcome = 'won';
        return;
      }
    }
    this.spawnGap -= dt;
    if (this.toSpawn.length > 0 && this.spawnGap <= 0) {
      const next = this.toSpawn.shift() as { type: EnemyType; boss: boolean };
      this.spawn(next.type, next.boss);
      this.spawnGap = 0.7 + this.random() * 0.8;
    }

    for (const e of this.enemies) {
      e.t += dt;
      e.hurt = Math.max(0, e.hurt - dt * 4);
      if (e.state === 'dying') continue;
      const t = e.type;
      if (e.state === 'walking') {
        const stopAt = t.ranged ? RANGED_V : CONTACT_V;
        e.v += t.speed * 1.5 * dt * (0.4 + 0.9 * ((e.v - this.spawns.horizon) / (1 - this.spawns.horizon)));
        e.u += Math.sign(e.toU - e.u) * Math.min(Math.abs(e.toU - e.u), t.speed * 0.5 * dt);
        if (e.v >= stopAt) { e.v = stopAt; e.state = 'attacking'; e.t = 0; }
      } else {
        e.cooldown -= dt;
        if (e.cooldown <= 0) {
          e.cooldown = t.every * (t.ranged ? 1.5 : 1);
          this.hurtPlayer(t.ranged ? t.bite * 0.6 : t.bite);
          this.effects.push({ kind: t.ranged ? 'muzzle' : 'spark', u: e.u, v: e.v - this.heightOf(e) * 0.5, size: 0.02, t: 0, life: 0.18 });
          e.t = 0;
        }
      }
    }
    this.enemies = this.enemies.filter((e) => e.state !== 'dying' || e.t < 1.2);
    for (const fx of this.effects) fx.t += dt;
    this.effects = this.effects.filter((fx) => fx.t < fx.life);
  }

  private hurtPlayer(amount: number) {
    this.health = Math.max(0, this.health - amount);
    this.hitFlash = 1;
    this.shake = Math.max(this.shake, 0.5);
    if (this.health <= 0) this.outcome = 'lost';
  }

  /** An enemy's box in the picture's coordinates: [left, top, right, bottom], given the picture's width and height in pixels (for the shape). */
  box(e: Enemy, aspect: number, spriteRatio: number): [number, number, number, number] {
    const h = this.heightOf(e);
    const w = (h * spriteRatio) / aspect;
    const bob = e.type.flying ? Math.sin(e.phase + e.t * 4) * 0.015 - 0.1 * h : 0;
    return [e.u - w / 2, e.v - h + bob, e.u + w / 2, e.v + bob];
  }

  private damage(e: Enemy, amount: number) {
    if (e.state === 'dying') return;
    e.hp -= amount;
    e.hurt = 1;
    if (e.hp <= 0) {
      e.state = 'dying';
      e.t = 0;
      this.killed++;
    }
  }

  /**
   * One trigger pull at a point of the picture. `aspect` is the picture's width over its height, and `ratio(e)` the width over height of the enemy's
   * sprite (so a tall figure is a thin target). Returns whether a shot went off.
   */
  fire(u: number, v: number, aspect: number, ratio: (e: Enemy) => number): boolean {
    const w = this.weapon;
    if (!w || this.outcome !== 'fighting' || this.cooldown > 0) return false;
    const ammoLeft = this.ammo[this.selected];
    if (w.ammo !== undefined && (ammoLeft ?? 0) <= 0) return false;
    if (w.ammo !== undefined) this.ammo[this.selected] = (ammoLeft ?? 0) - 1;
    this.cooldown = 1 / w.rate;
    this.recoil = this.selected === 'sniper' || this.selected === 'explosive' ? 1 : 0.5;
    this.effects.push({ kind: 'muzzle', u: 0.5, v: 1.02, size: 0.03, t: 0, life: 0.07 });

    const inBox = (e: Enemy) => {
      const [l, t, r, b] = this.box(e, aspect, ratio(e));
      return u >= l && u <= r && v >= t && v <= b;
    };
    if (w.splash) {
      const radius = w.splash;
      const flame = w.auto;
      this.effects.push({ kind: flame ? 'flame' : 'explosion', u, v, size: radius, t: 0, life: flame ? 0.35 : 0.6 });
      if (!flame) this.shake = Math.max(this.shake, w.splash > 0.12 ? 1 : 0.6);
      for (const e of this.alive) {
        const [l, t, r, b] = this.box(e, aspect, ratio(e));
        const cx = (l + r) / 2, cy = (t + b) / 2;
        const d = Math.hypot((cx - u) * aspect, cy - v);
        const reach = radius * aspect + Math.max(r - l, 0) * aspect * 0.4;
        if (d <= reach) this.damage(e, w.damage * (flame ? 1 : 1 - 0.5 * (d / reach)));
      }
      return true;
    }
    const hit = this.alive.filter(inBox).sort((a, b) => b.v - a.v);
    if (hit.length === 0) {
      this.effects.push({ kind: 'spark', u, v, size: 0.012, t: 0, life: 0.2 });
      return true;
    }
    for (const e of w.pierce ? hit : [hit[0]]) {
      const [, top, , bottom] = this.box(e, aspect, ratio(e));
      const headshot = v < top + (bottom - top) * 0.25;
      this.damage(e, w.damage * (headshot ? 1.5 : 1));
      this.effects.push({ kind: 'spark', u, v, size: 0.015, t: 0, life: 0.2 });
    }
    return true;
  }
}
