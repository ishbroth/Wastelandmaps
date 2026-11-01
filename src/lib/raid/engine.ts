// The shooting gallery's rules, with no drawing in it. Enemies come out of the picture small and far away and close in on the survivor in steps (six to
// eight of them, more the farther away they start); the survivor shoots them as they come. An enemy that gets all the way to the screen strikes once
// (a bullet hole, a slash, or a blast flashes across the screen) and goes off the side; the waves go on. Three strikes and the survivor dies. The boss strikes,
// backs off three steps and comes again until the survivor has taken three in all. Everything is in the picture's own coordinates (u across, v down,
// both 0 to 1) and the screen maps them (see RaidScreen).

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
export const PERSON_HEIGHT = 0.3;
/** Where an enemy's feet are when it strikes: at the bottom of the picture. */
const STRIKE_V = 0.98;
/** How many strikes the survivor can take. */
export const MAX_HITS = 3;

/** How tall an enemy is, in picture heights, when it has reached the survivor and strikes. */
const strikeHeight = (size: number) => Math.min(0.95, 0.5 * Math.pow(size, 0.7));

export type DamageKind = 'bullet' | 'slash' | 'blast';

export interface Enemy {
  id: number;
  type: EnemyType;
  boss: boolean;
  /** Where it began, and where along u it drifts to as it comes. */
  u0: number;
  v0: number;
  toU: number;
  u: number;
  v: number;
  /** Which step it is on (0 to steps), and how many steps it takes to reach the survivor. */
  step: number;
  steps: number;
  /** Seconds between its steps, and until the next. */
  stepGap: number;
  stepT: number;
  /** How far along it is for drawing (0 to 1), easing toward step / steps. */
  p: number;
  hp: number;
  maxHp: number;
  state: 'walking' | 'striking' | 'retreating' | 'leaving' | 'dying';
  /** Seconds in the current state, for the animation. */
  t: number;
  /** How long a hit flash lasts. */
  hurt: number;
  /** Flying things bob. */
  phase: number;
  /** Which way it goes when it leaves the screen. */
  exit: number;
}

export interface Effect {
  kind: 'explosion' | 'spark' | 'flame' | 'muzzle';
  u: number;
  v: number;
  /** Radius in the picture's widths (explosions, flames). */
  size: number;
  t: number;
  life: number;
}

/** What flashes on the screen when the survivor is struck (positions in the picture's coordinates). */
export interface Strike {
  kind: DamageKind;
  u: number;
  v: number;
  t: number;
  life: number;
  seed: number;
}

export type Outcome = 'fighting' | 'won' | 'lost';

export interface GameOptions {
  plan: RaidPlan;
  spawns: Spawns;
  arsenal: Arsenal;
  random?: () => number;
}

export class Game {
  readonly plan: RaidPlan;
  readonly spawns: Spawns;
  readonly arsenal: Arsenal;
  /** Strikes taken so far (three is death). */
  hits = 0;
  enemies: Enemy[] = [];
  effects: Effect[] = [];
  strikes: Strike[] = [];
  outcome: Outcome = 'fighting';
  /** The weapon class in hand. */
  selected: WeaponClass = 'pistol';
  /** Shots left for the weapons that run out. */
  ammo: Partial<Record<WeaponClass, number>> = {};
  killed = 0;
  /** Enemies that got to the survivor and left the screen. */
  escaped = 0;
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

  /** The enemies that can still be shot. */
  get alive(): Enemy[] {
    return this.enemies.filter((e) => e.state !== 'dying' && e.state !== 'leaving');
  }

  /** Total enemies this raid will send, bosses included. */
  get totalEnemies(): number {
    return this.plan.total + (this.plan.boss ? 1 : 0);
  }

  /** How many are left to deal with: still to come, or on the screen. */
  get remaining(): number {
    return Math.max(0, this.totalEnemies - this.killed - this.escaped);
  }

  private depthAt(v: number): number {
    return Math.min(1, Math.max(0, (v - this.spawns.horizon) / (1 - this.spawns.horizon)));
  }

  private spawn(type: EnemyType, boss: boolean) {
    const pts = this.spawns.points;
    const point = pts[Math.floor(this.random() * pts.length)] ?? { u: 0.5, v: 0.64 };
    const v0 = Math.max(this.spawns.horizon + 0.02, point.v);
    // the farther away it starts (the smaller it looks), the more steps it takes to arrive: eight at the farthest, six at the nearest
    const steps = 6 + Math.round(2 * (1 - this.depthAt(v0)));
    // later waves come faster; faster creatures take their steps sooner
    const wavePace = Math.max(0.6, 1.25 - 0.1 * Math.max(0, this.wave));
    const kindPace = Math.min(1.2, Math.max(0.8, Math.sqrt(0.08 / type.speed)));
    const stepGap = (boss ? 0.95 : wavePace * kindPace) * (0.85 + this.random() * 0.3);
    this.enemies.push({
      id: this.nextId++, type, boss, u0: point.u, v0, toU: 0.15 + this.random() * 0.7, u: point.u, v: v0, step: 0, steps, stepGap, stepT: stepGap * (0.6 + this.random() * 0.5), p: 0,
      hp: type.hp, maxHp: type.hp, state: 'walking', t: 0, hurt: 0, phase: this.random() * 6.28, exit: this.random() < 0.5 ? -1 : 1,
    });
  }

  /** Where an enemy is drawn: its feet, from how far along it is. */
  private place(e: Enemy) {
    const q = Math.min(1, Math.max(0, e.p));
    e.v = e.v0 + (STRIKE_V - e.v0) * q;
    e.u = e.u0 + (e.toU - e.u0) * q * 0.7;
  }

  /** An enemy's height in picture heights: small and far away at the start, filling the screen when it strikes. */
  heightOf(e: Enemy): number {
    const start = Math.max(0.035, PERSON_HEIGHT * this.depthAt(e.v0) * e.type.size);
    const end = Math.max(start, strikeHeight(e.type.size));
    return start * Math.pow(end / start, Math.min(1.08, Math.max(0, e.p)));
  }

  update(dt: number) {
    if (this.outcome !== 'fighting') return;
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.recoil = Math.max(0, this.recoil - dt * 6);
    this.shake = Math.max(0, this.shake - dt * 3);
    this.hitFlash = Math.max(0, this.hitFlash - dt * 2.5);
    this.bannerT = Math.max(0, this.bannerT - dt);

    // waves: one, then two, then more, with a breath between; the boss after the last
    if (this.toSpawn.length === 0 && this.alive.length === 0 && !this.enemies.some((e) => e.state === 'leaving')) {
      if (this.wave + 1 < this.order.length) {
        this.pause -= dt;
        if (this.pause <= 0) {
          this.wave++;
          this.toSpawn = [...this.order[this.wave]];
          this.pause = 1.6;
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
    // they come out staggered, a little closer together in each wave
    this.spawnGap -= dt;
    if (this.toSpawn.length > 0 && this.spawnGap <= 0) {
      const next = this.toSpawn.shift() as { type: EnemyType; boss: boolean };
      this.spawn(next.type, next.boss);
      this.spawnGap = Math.max(0.4, 1.5 - 0.1 * Math.max(0, this.wave)) + this.random() * 0.6;
    }

    for (const e of this.enemies) {
      e.t += dt;
      e.hurt = Math.max(0, e.hurt - dt * 4);
      if (e.state === 'dying') continue;
      if (e.state === 'leaving') {
        e.u += e.exit * dt * 1.4;
        continue;
      }
      // it eases toward its step instead of jumping
      const target = e.step / e.steps;
      e.p += (target - e.p) * Math.min(1, dt * 7);
      this.place(e);
      if (e.state === 'walking') {
        e.stepT -= dt;
        if (e.stepT <= 0) {
          e.stepT = e.stepGap;
          if (e.step < e.steps) e.step++;
        }
        if (e.step >= e.steps && e.p > 0.97) { e.state = 'striking'; e.t = 0; }
      } else if (e.state === 'striking') {
        // a moment of wind-up at the screen, and then the blow lands
        if (e.t >= 0.32) {
          this.strike(e);
          if (e.boss) { e.state = 'retreating'; e.t = 0; e.stepT = 0.45; }
          else { e.state = 'leaving'; e.t = 0; this.escaped++; }
        }
      } else if (e.state === 'retreating') {
        // the boss backs off three steps, then comes on again
        e.stepT -= dt;
        if (e.stepT <= 0) {
          e.stepT = 0.45;
          e.step = Math.max(0, e.step - 1);
        }
        if (e.step <= e.steps - 3) { e.state = 'walking'; e.stepT = e.stepGap; }
      }
    }
    this.enemies = this.enemies.filter((e) => (e.state === 'dying' ? e.t < 1.2 : e.state === 'leaving' ? e.t < 0.9 : true));
    for (const fx of this.effects) fx.t += dt;
    this.effects = this.effects.filter((fx) => fx.t < fx.life);
    for (const s of this.strikes) s.t += dt;
    this.strikes = this.strikes.filter((s) => s.t < s.life);
  }

  /** An enemy lands its blow: a bullet hole, a slash across the screen, or a blast, and the survivor has one strike fewer. */
  private strike(e: Enemy) {
    const kind: DamageKind = this.random() < (e.boss ? 0.3 : 0.14) ? 'blast' : e.type.ranged ? 'bullet' : 'slash';
    const u = Math.min(0.85, Math.max(0.15, e.u + (this.random() - 0.5) * 0.2));
    const v = 0.3 + this.random() * 0.4;
    this.strikes.push({ kind, u, v, t: 0, life: kind === 'blast' ? 0.7 : 1.1, seed: Math.floor(this.random() * 1e6) });
    this.hits++;
    this.hitFlash = 1;
    this.shake = Math.max(this.shake, kind === 'blast' ? 1 : 0.6);
    if (this.hits >= MAX_HITS) this.outcome = 'lost';
  }

  /** An enemy's box in the picture's coordinates: [left, top, right, bottom], given the picture's width and height in pixels (for the shape). */
  box(e: Enemy, aspect: number, spriteRatio: number): [number, number, number, number] {
    const h = this.heightOf(e);
    const w = (h * spriteRatio) / aspect;
    const bob = e.type.flying ? Math.sin(e.phase + e.t * 4) * 0.045 * h - 0.1 * h : 0;
    return [e.u - w / 2, e.v - h + bob, e.u + w / 2, e.v + bob];
  }

  private damage(e: Enemy, amount: number) {
    if (e.state === 'dying' || e.state === 'leaving') return;
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

    // the nearest enemy under the crosshair takes the bullet; being small and far away is what makes the early ones hard
    const inBox = (e: Enemy) => {
      const [l, t, r, b] = this.box(e, aspect, ratio(e));
      const pad = 0.012; // a little forgiveness for a fingertip
      return u >= l - pad && u <= r + pad && v >= t - pad && v <= b + pad;
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
