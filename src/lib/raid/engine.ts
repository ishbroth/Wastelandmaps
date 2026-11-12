// The shooting gallery's rules, with no drawing in it. Enemies come out of the picture small and far away and close in on the survivor in steps (six to
// eight of them, more the farther away they start); the survivor shoots them as they come. An enemy that gets all the way to the screen strikes once
// (a bullet hole, a slash, or a blast flashes across the screen) and goes off the side; the waves go on. Three strikes and the survivor dies. The boss strikes,
// backs off three steps and comes again until the survivor has taken three in all. Everything is in the picture's own coordinates (u across, v down,
// both 0 to 1) and the screen maps them (see RaidScreen).

import { ENEMIES, STRIKE_DAMAGE, enemyById, threatOf, type BossId, type EnemyType } from './enemies';
import type { RaidPlan } from './raid';
import { magazineOf, WEAPON_CLASS_IDS, usesMagazine, weaponAt, type Arsenal, type Weapon, type WeaponClass } from './weapons';

/** Where enemies come from: the line of the horizon (v), and the spots on the ground (u, v) they step out of. */
export interface Spawns {
  horizon: number;
  points: { u: number; v: number }[];
  /** How big enemies look when they start, against the usual (1): a picture taken from far away (a big landmark) makes them small, a close one (a house) bigger. */
  scale?: number;
  /** Spots high on a building or a ruin (an enemy starting here climbs down), and spots at the edges of the picture on the ground (it walks in from the side). Only pictures that were looked at have them. */
  high?: { u: number; v: number }[];
  edges?: { u: number; v: number }[];
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
/** The survivor's health bar at level 0 (a blow takes 25 to 40 of it, so about three blows end it), and how much more it holds at each level: one per cent. The weakest enemy cannot take three blows' worth (99) once the bar passes it, around level 10. */
export const BASE_HEALTH = 91;
export const healthForLevel = (level: number): number => BASE_HEALTH * (1 + 0.01 * Math.max(0, level));
/** How fast the enemies move while Legendary Time lasts, as a share of their usual speed, and how long it lasts in seconds. */
export const SLOW_FACTOR = 0.3;
export const SLOW_SECONDS = 4;

/**
 * Seconds between one step of an enemy and the next (each enemy then varies 15% either way around this). Later waves step faster, and so do the quick kinds
 * of creature; a boss keeps its own slow tread. This is the one formula for it: spawn() uses it, and the reload time is built on it.
 */
export function stepGapFor(type: EnemyType, wave: number, boss = false): number {
  const wavePace = Math.max(0.6, 1.25 - 0.1 * Math.max(0, wave));
  const kindPace = Math.min(1.2, Math.max(0.8, Math.sqrt(0.08 / type.speed)));
  return boss ? 0.95 : wavePace * kindPace;
}

/**
 * HOW AN ENEMY WALKS IN. The steps themselves (how many, and how often: stepGapFor) are unchanged, so the time to reach the survivor is the same. What changed is
 * how the picture follows them: it used to jump toward each new step and then ease off (a lurch, a stop, a lurch), and now it moves continuously, pulsing with
 * the stride, with a little sway and bob on each step, a small wander to the path, and a rear-back and lunge before a blow. To go back to the old lurch,
 * revert the commit that added this block.
 */
/** How strongly the forward speed pulses within a step: 0 is a steady glide, 1 stops it at each footfall. It is fastest in the middle of a step. */
const STRIDE_PULSE = 0.6;
/** Seconds the picture trails behind the step count, so the enemy arrives when it used to (the old easing lagged by about this much). */
const WALK_LAG = 0.45;
/** The wind-up before a blow (seconds): it rears back a little for most of it, then lunges. */
const STRIKE_WINDUP = 0.32;

/** The typical step of an ordinary enemy: the average over every kind of creature and over the first eight waves (the most any place sends), in seconds. */
export const AVERAGE_STEP_SECONDS = (() => {
  const kinds = Object.values(ENEMIES);
  let sum = 0;
  for (const kind of kinds) for (let wave = 0; wave < 8; wave++) sum += stepGapFor(kind, wave);
  return sum / (kinds.length * 8);
})();

/** A reload takes about as long as one and a half of those steps, so it costs the survivor the time it takes an enemy to get a step and a half nearer. */
export const RELOAD_STEPS = 1.5;
export const RELOAD_SECONDS = RELOAD_STEPS * AVERAGE_STEP_SECONDS;

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
  /** How far along it is for drawing (0 to 1): it follows a smooth curve through the steps (see HOW AN ENEMY WALKS IN). */
  p: number;
  /** Where it is in its walk, counted in steps (3.5 = half way through the fourth): drives the sway, the bob and which walking pose is shown. */
  gait: number;
  /** How far it is lifted off the ground by the bob of its step (a share of the picture's height); its shadow stays on the ground. */
  lift: number;
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
  /** How it arrives: stepping out of the ground or the rubble (the usual), climbing down from somewhere high, or walking in from the side of the picture. */
  entry: 'ground' | 'climb' | 'side';
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

/** A grenade lobbed in an arc, or a missile flying straight, on its way to where it will go off. */
export interface Projectile {
  kind: 'grenade' | 'missile';
  /** Where it leaves the gun, and where it lands (the picture's coordinates). */
  u0: number; v0: number; u: number; v: number;
  t: number; life: number;
  damage: number; splash: number; aspect: number; ratio: (e: Enemy) => number;
}

export type Outcome = 'fighting' | 'won' | 'lost';

export interface GameOptions {
  plan: RaidPlan;
  spawns: Spawns;
  arsenal: Arsenal;
  random?: () => number;
  /** The survivor's level: it sets how much health the bar holds. */
  level?: number;
}

export class Game {
  readonly plan: RaidPlan;
  readonly spawns: Spawns;
  readonly arsenal: Arsenal;
  /** Strikes taken so far. */
  hits = 0;
  /** The survivor's health, and the most the bar holds at their level (a blow takes a share of it by how strong the enemy is; none left is death). */
  maxHealth: number;
  health: number;
  /** The action is stopped (the weapon wheel is open). */
  paused = false;
  /** Seconds of Legendary Time left: the enemies walk, wait and strike at a fraction of their speed (the survivor's own gun, reloads and strikes are not slowed). */
  slowLeft = 0;
  /** The survivor carries a stimpak: the third strike does not kill them yet, the fight stops and they are asked. */
  canRevive = false;
  /** Struck down the third time and waiting to answer whether to use a stimpak. */
  downed = false;
  enemies: Enemy[] = [];
  effects: Effect[] = [];
  projectiles: Projectile[] = [];
  /** How many times something has gone off (the screen plays the boom for each). */
  boomed = 0;
  strikes: Strike[] = [];
  outcome: Outcome = 'fighting';
  /** The weapon class in hand. */
  selected: WeaponClass = 'pistol';
  /** Shots left for the weapons that run out (the flamethrower's whole supply, the launchers' rockets): the reserve, including what is in the magazine. */
  ammo: Partial<Record<WeaponClass, number>> = {};
  /** Rounds in the magazine of each class that has one (the automatics and the flamethrower): they reload by themselves at 0. */
  mag: Partial<Record<WeaponClass, number>> = {};
  /** Seconds of reload still to go, per class, while one is under way. It runs on whichever weapon is in hand, and pauses when the game does. */
  reloadLeft: Partial<Record<WeaponClass, number>> = {};
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
    this.maxHealth = healthForLevel(opts.level ?? 0);
    this.health = this.maxHealth;
    for (const cls of WEAPON_CLASS_IDS) {
      const tier = opts.arsenal[cls];
      if (tier > 0) {
        const w = weaponAt(cls, tier as 1 | 2 | 3 | 4);
        if (w.ammo) this.ammo[cls] = w.ammo;
        if (usesMagazine(w)) this.mag[cls] = Math.min(magazineOf(w), w.ammo ?? magazineOf(w));
      }
    }
    // who comes in each wave: the kinds of enemy this place has, mixed, with the boss last
    // (a boss-only raid, Vault 0, sends bosses in every wave: each one is a boss, with the boss's behavior and health bar)
    this.order = this.plan.waves.map((size) => Array.from({ length: size }, () => ({ type: enemyById(this.plan.enemies[Math.floor(this.random() * this.plan.enemies.length)]), boss: !!this.plan.bossOnly })));
    this.banner = 'WAVE 1';
    this.bannerT = 2.2;
  }

  /** The weapon in hand (null if the class has none built). */
  get weapon(): Weapon | null {
    const tier = this.arsenal[this.selected];
    return tier > 0 ? weaponAt(this.selected, tier as 1 | 2 | 3 | 4) : null;
  }

  /** Is the weapon in hand being reloaded? (Then pulling the trigger does nothing until it is done.) */
  get reloading(): boolean {
    return (this.reloadLeft[this.selected] ?? 0) > 0;
  }

  /** How far through the reload of the weapon in hand (0 to 1), or null when it is not reloading. */
  get reloadProgress(): number | null {
    const left = this.reloadLeft[this.selected];
    return left === undefined || left <= 0 ? null : 1 - left / RELOAD_SECONDS;
  }

  /** Rounds one magazine of this class holds (0 if the class has none). */
  capacity(cls: WeaponClass): number {
    const tier = this.arsenal[cls];
    return tier === 0 ? 0 : magazineOf(weaponAt(cls, tier as 1 | 2 | 3 | 4));
  }

  /** Reloads the weapon in hand now (tapping the ammo): when its magazine is not full and it is not being reloaded already. */
  reload() {
    if (this.outcome === 'fighting' && !this.paused) this.startReload(this.selected);
  }

  /** Starts a reload of this class's magazine, if it has a magazine and anything left to load. */
  private startReload(cls: WeaponClass) {
    const tier = this.arsenal[cls];
    if (tier === 0 || !usesMagazine(weaponAt(cls, tier as 1 | 2 | 3 | 4))) return;
    if ((this.mag[cls] ?? 0) >= this.capacity(cls) || (this.reloadLeft[cls] ?? 0) > 0) return;
    if (this.ammo[cls] !== undefined && (this.ammo[cls] ?? 0) <= 0) return; // the flamethrower's last fuel is gone: nothing to load
    this.reloadLeft[cls] = RELOAD_SECONDS;
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
    let point = pts[Math.floor(this.random() * pts.length)] ?? { u: 0.5, v: 0.64 };
    // a picture that was looked at can send some of them down from high up, or in from the side of the picture, to keep the survivor guessing (flyers always come the usual way)
    let entry: 'ground' | 'climb' | 'side' = 'ground';
    const roll = this.random();
    let airborne = false;
    if (type.flying && this.spawns.high?.length && roll < 0.55) {
      // a flyer does not have to start on the ground: it can come from up among the buildings
      point = this.spawns.high[Math.floor(this.random() * this.spawns.high.length)];
      airborne = true;
    }
    if (!type.flying && !boss) {
      if (roll < 0.2 && this.spawns.high?.length) { entry = 'climb'; point = this.spawns.high[Math.floor(this.random() * this.spawns.high.length)]; }
      else if (roll < 0.4 && this.spawns.edges?.length) { entry = 'side'; point = this.spawns.edges[Math.floor(this.random() * this.spawns.edges.length)]; }
    }
    const v0 = entry === 'climb' || airborne ? point.v : Math.max(this.spawns.horizon + 0.02, point.v);
    // the farther away it starts (the smaller it looks), the more steps it takes to arrive: eight at the farthest, six at the nearest (a climb or a walk in from the side takes a few more)
    const steps = 6 + Math.round(2 * (1 - this.depthAt(v0))) + (entry === 'climb' ? 3 : entry === 'side' ? 2 : 0);
    // later waves come faster; faster creatures take their steps sooner (see stepGapFor)
    const stepGap = stepGapFor(type, this.wave, boss) * (0.85 + this.random() * 0.3);
    this.enemies.push({
      id: this.nextId++, type, boss, u0: point.u, v0, toU: 0.15 + this.random() * 0.7, u: point.u, v: v0, step: 0, steps, stepGap, stepT: stepGap * (0.6 + this.random() * 0.5), p: 0, gait: 0, lift: 0,
      hp: type.hp, maxHp: type.hp, state: 'walking', t: 0, hurt: 0, phase: this.random() * 6.28, exit: this.random() < 0.5 ? -1 : 1, entry,
    });
  }

  /**
   * Where a walking enemy is along its way (p, 0 to 1) and in its walk (gait, in steps), as a smooth function of the time since its last step began. Each leg
   * from one step to the next takes one stepGap, starting WALK_LAG after the step count goes up, and the speed within it pulses (fastest mid-step); the
   * pulse is periodic, so the speed is continuous from one step into the next and the enemy never stops.
   */
  private walkCurve(e: Enemy): { p: number; gait: number } {
    const since = Math.min(e.stepGap, Math.max(0, e.stepGap - e.stepT)); // seconds since the step count last went up
    const leg = since >= WALK_LAG ? e.step : e.step - 1;
    const f = since >= WALK_LAG ? (since - WALK_LAG) / e.stepGap : (e.stepGap - WALK_LAG + since) / e.stepGap; // how far through the leg
    if (leg < 0) return { p: 0, gait: 0 };
    const stride = f - (STRIDE_PULSE / (2 * Math.PI)) * Math.sin(2 * Math.PI * f);
    return { p: Math.min(1, (leg + stride) / e.steps), gait: leg + f };
  }

  /** Where an enemy is drawn: its feet, from how far along it is, with the wander of its path and the sway and bob of its step. */
  private place(e: Enemy) {
    const q = Math.min(1, Math.max(0, e.p));
    if (e.entry === 'climb') {
      // down the face of the building first (straight down, a little sideways), then across the ground
      e.v = e.v0 + (STRIKE_V - e.v0) * (1 - Math.pow(1 - q, 1.8));
      e.u = e.u0 + (e.toU - e.u0) * Math.pow(q, 1.5) * 0.7;
    } else if (e.entry === 'side') {
      // in from the edge along the ground (across first, then toward the survivor)
      const across = Math.min(1, q * 1.7);
      e.v = e.v0 + (STRIKE_V - e.v0) * Math.pow(q, 1.4);
      e.u = e.u0 + (e.toU - e.u0) * (1 - Math.pow(1 - across, 2)) * 0.95;
    } else {
      e.v = e.v0 + (STRIKE_V - e.v0) * q;
      e.u = e.u0 + (e.toU - e.u0) * q * 0.7;
    }
    // a small wander across the path that dies away as it arrives, so the blow still lands where the enemy is
    e.u += Math.sin(e.phase + q * 6.5) * 0.018 * (1 - q);
    // each step sways it a little to one side and the next step to the other, and lifts it a little between footfalls
    const frac = e.gait - Math.floor(e.gait);
    const swing = e.state === 'walking' || e.state === 'retreating' ? Math.sin(Math.PI * frac) : 0;
    const h = this.heightOf(e);
    e.u += (Math.floor(e.gait) % 2 ? 1 : -1) * swing * 0.02 * h;
    e.lift = e.type.flying ? 0 : swing * 0.012 * h;
  }

  /** The wind-up of a blow: the enemy rears back a little, then lunges at the screen. 1 when it is not striking. */
  private attackScale(e: Enemy): number {
    if (e.state !== 'striking') return 1;
    const q = Math.min(1, e.t / STRIKE_WINDUP);
    return q < 0.65 ? 1 - 0.05 * Math.sin((q / 0.65) * (Math.PI / 2)) : 0.95 + 0.15 * Math.pow((q - 0.65) / 0.35, 2);
  }

  /** An enemy's height in picture heights: small and far away at the start, filling the screen when it strikes. */
  heightOf(e: Enemy): number {
    // The size at the start follows the picture (scale) and is not so very different between a small creature and a big one: they are all far away. Only the strike is big.
    const scale = this.spawns.scale ?? 1;
    const start = Math.max(0.035 * Math.max(1, scale * 0.7), PERSON_HEIGHT * this.depthAt(e.v0) * scale * Math.pow(e.type.size, 0.55));
    const end = Math.max(start, strikeHeight(e.type.size));
    return start * Math.pow(end / start, Math.min(1.08, Math.max(0, e.p))) * this.attackScale(e);
  }

  update(dt: number) {
    if (this.outcome !== 'fighting' || this.paused) return;
    this.cooldown = Math.max(0, this.cooldown - dt);
    // reloads run in the background whichever weapon is in hand, and finish by filling the magazine from what is left
    for (const cls of WEAPON_CLASS_IDS) {
      const left = this.reloadLeft[cls];
      if (left === undefined) continue;
      if (left - dt > 0) { this.reloadLeft[cls] = left - dt; continue; }
      delete this.reloadLeft[cls];
      this.mag[cls] = Math.min(this.capacity(cls), this.ammo[cls] ?? this.capacity(cls));
    }
    this.recoil = Math.max(0, this.recoil - dt * 6);
    this.shake = Math.max(0, this.shake - dt * 3);
    this.hitFlash = Math.max(0, this.hitFlash - dt * 2.5);
    this.bannerT = Math.max(0, this.bannerT - dt);
    // Legendary Time runs out in real seconds; meanwhile what the enemies and the waves do is measured in slowed ones
    this.slowLeft = Math.max(0, this.slowLeft - dt);
    const edt = this.slowLeft > 0 ? dt * SLOW_FACTOR : dt;

    // waves: one, then two, then more, with a breath between; the boss after the last
    if (this.toSpawn.length === 0 && this.alive.length === 0 && !this.enemies.some((e) => e.state === 'leaving')) {
      if (this.wave + 1 < this.order.length) {
        this.pause -= edt;
        if (this.pause <= 0) {
          this.wave++;
          this.toSpawn = [...this.order[this.wave]];
          this.pause = 1.6;
          this.banner = `WAVE ${this.wave + 1}`;
          this.bannerT = 2;
        }
      } else if (this.plan.boss && !this.bossDone) {
        this.pause -= edt;
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
    this.spawnGap -= edt;
    if (this.toSpawn.length > 0 && this.spawnGap <= 0) {
      const next = this.toSpawn.shift() as { type: EnemyType; boss: boolean };
      this.spawn(next.type, next.boss);
      this.spawnGap = Math.max(0.4, 1.5 - 0.1 * Math.max(0, this.wave)) + this.random() * 0.6;
    }

    for (const e of this.enemies) {
      e.t += edt;
      e.hurt = Math.max(0, e.hurt - dt * 4);
      if (e.state === 'dying') continue;
      if (e.state === 'leaving') {
        e.u += e.exit * edt * 1.4;
        continue;
      }
      // walking follows a continuous curve through the steps; the other states (a boss backing off, an enemy at the screen) ease toward their step as before
      if (e.state === 'walking') {
        const w = this.walkCurve(e);
        e.gait = w.gait;
        e.p += (w.p - e.p) * Math.min(1, dt * 20);
      } else e.p += (e.step / e.steps - e.p) * Math.min(1, dt * 7);
      this.place(e);
      if (e.state === 'walking') {
        e.stepT -= edt;
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
        e.stepT -= edt;
        if (e.stepT <= 0) {
          e.stepT = 0.45;
          e.step = Math.max(0, e.step - 1);
        }
        if (e.step <= e.steps - 3) { e.state = 'walking'; e.stepT = e.stepGap; }
      }
    }
    this.enemies = this.enemies.filter((e) => (e.state === 'dying' ? e.t < 1.2 : e.state === 'leaving' ? e.t < 0.9 : true));
    for (const p of [...this.projectiles]) { p.t += dt; if (p.t >= p.life) { this.projectiles.splice(this.projectiles.indexOf(p), 1); this.detonate(p); } }
    for (const fx of this.effects) fx.t += dt;
    this.effects = this.effects.filter((fx) => fx.t < fx.life);
    for (const s of this.strikes) s.t += dt;
    this.strikes = this.strikes.filter((s) => s.t < s.life);
  }

  /** A grenade or missile goes off: a big blast, and everything near it is hurt, whether or not it was aimed at one (the rubble will do). */
  private detonate(p: Projectile) {
    const radius = p.splash * 1.3;
    this.boomed++;
    this.effects.push({ kind: 'explosion', u: p.u, v: p.v, size: radius * 1.25, t: 0, life: 0.9 });
    this.effects.push({ kind: 'explosion', u: p.u, v: p.v, size: radius * 0.7, t: 0, life: 0.5 });
    this.shake = Math.max(this.shake, 1);
    for (const e of this.alive) {
      const [l, t, r, b] = this.box(e, p.aspect, p.ratio(e));
      const cx = (l + r) / 2, cy = (t + b) / 2;
      const d = Math.hypot((cx - p.u) * p.aspect, cy - p.v);
      const reach = radius * p.aspect + Math.max(r - l, 0) * p.aspect * 0.4;
      if (d <= reach) this.damage(e, p.damage * (1 - 0.5 * (d / reach)));
    }
  }

  /** Legendary Time: the enemies slow down for this many seconds. */
  slow(seconds: number) {
    this.slowLeft = Math.max(this.slowLeft, seconds);
  }

  /** A stimpak: the survivor has all their health back. */
  heal() {
    this.hits = 0;
    this.health = this.maxHealth;
    this.hitFlash = 0;
  }

  /** An enemy lands its blow: a bullet hole, a slash across the screen, or a blast, and the survivor has one strike fewer. */
  private strike(e: Enemy) {
    const kind: DamageKind = this.random() < (e.boss ? 0.3 : 0.14) ? 'blast' : e.type.ranged ? 'bullet' : 'slash';
    const u = Math.min(0.85, Math.max(0.15, e.u + (this.random() - 0.5) * 0.2));
    const v = 0.3 + this.random() * 0.4;
    this.strikes.push({ kind, u, v, t: 0, life: kind === 'blast' ? 0.7 : 1.1, seed: Math.floor(this.random() * 1e6) });
    this.hits++;
    // how hard it hits: by how strong the enemy is, a share of the bar that is a bit more or less than a third
    const [lo, hi] = STRIKE_DAMAGE[threatOf(e.type)];
    this.health = Math.max(0, this.health - (lo + this.random() * (hi - lo)));
    this.hitFlash = 1;
    this.shake = Math.max(this.shake, kind === 'blast' ? 1 : 0.6);
    if (this.health <= 0) {
      if (this.canRevive) { this.downed = true; this.paused = true; } else this.outcome = 'lost';
    }
  }

  /** An enemy's box in the picture's coordinates: [left, top, right, bottom], given the picture's width and height in pixels (for the shape). */
  box(e: Enemy, aspect: number, spriteRatio: number): [number, number, number, number] {
    const h = this.heightOf(e);
    const w = (h * spriteRatio) / aspect;
    const bob = e.type.flying ? Math.sin(e.phase + e.t * 4) * 0.045 * h - 0.1 * h : 0;
    return [e.u - w / 2, e.v - h + bob - e.lift, e.u + w / 2, e.v + bob - e.lift];
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
    // a weapon with a magazine: nothing happens while it reloads (a held trigger simply carries on firing when it is done), and an empty one reloads
    const magazine = usesMagazine(w);
    if (magazine) {
      if (this.reloading) return false;
      if ((this.mag[this.selected] ?? 0) <= 0) { this.startReload(this.selected); return false; }
    }
    if (w.ammo !== undefined) this.ammo[this.selected] = (ammoLeft ?? 0) - 1;
    if (magazine) {
      const rounds = (this.mag[this.selected] ?? 0) - 1;
      this.mag[this.selected] = rounds;
      if (rounds <= 0) this.startReload(this.selected); // empty: the reload begins at once, by itself
    }
    this.cooldown = 1 / w.rate;
    this.recoil = this.selected === 'sniper' || this.selected === 'explosive' ? 1 : 0.5;
    this.effects.push({ kind: 'muzzle', u: 0.5, v: 1.02, size: 0.03, t: 0, life: 0.07 });

    // the nearest enemy under the crosshair takes the bullet; being small and far away is what makes the early ones hard
    const inBox = (e: Enemy) => {
      const [l, t, r, b] = this.box(e, aspect, ratio(e));
      const pad = 0.012; // a little forgiveness for a fingertip
      return u >= l - pad && u <= r + pad && v >= t - pad && v <= b + pad;
    };
    if (w.splash && !w.auto) {
      // a grenade is lobbed and a missile flies: each goes off where it lands, some moments after the shot (see detonate)
      const grenade = w.id === 'm79';
      this.projectiles.push({ kind: grenade ? 'grenade' : 'missile', u0: 0.68, v0: 1.06, u, v, t: 0, life: grenade ? 0.95 : w.id === 'fatman' ? 0.7 : 0.42, damage: w.damage, splash: w.splash, aspect, ratio });
      return true;
    }
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
