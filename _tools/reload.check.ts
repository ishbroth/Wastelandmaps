// Checks on the reload system: the automatic guns and the flamethrower reload by themselves every 100 rounds, in about a step and a half of an enemy's walk;
// nothing fires during a reload; the other weapons are untouched. Run: npx tsx _tools/reload.check.ts
import { AVERAGE_STEP_SECONDS, DEFAULT_SPAWNS, Game, RELOAD_SECONDS, RELOAD_STEPS, stepGapFor } from '../src/lib/raid/engine.ts';
import { ENEMIES } from '../src/lib/raid/enemies.ts';
import { MAGAZINE, WEAPON_CLASSES, usesMagazine, type Arsenal } from '../src/lib/raid/weapons.ts';
import type { RaidPlan } from '../src/lib/raid/raid.ts';

let bad = 0;
const check = (name: string, ok: boolean, detail = '') => { if (!ok) bad++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : '  ' + detail}`); };

// ---- where the reload time comes from
const kinds = Object.values(ENEMIES);
let sum = 0; for (const k of kinds) for (let w = 0; w < 8; w++) sum += stepGapFor(k, w);
check('the average enemy step is measured from the movement formula (every kind, waves 1 to 8)', Math.abs(AVERAGE_STEP_SECONDS - sum / (kinds.length * 8)) < 1e-9, `${AVERAGE_STEP_SECONDS}`);
check('that step is about a second (0.8 to 1.1 s)', AVERAGE_STEP_SECONDS > 0.8 && AVERAGE_STEP_SECONDS < 1.1, `${AVERAGE_STEP_SECONDS.toFixed(3)}`);
check('a reload is one and a half steps', RELOAD_STEPS === 1.5 && Math.abs(RELOAD_SECONDS - 1.5 * AVERAGE_STEP_SECONDS) < 1e-9, `${RELOAD_SECONDS.toFixed(3)}`);
console.log(`      (average step ${AVERAGE_STEP_SECONDS.toFixed(3)} s, reload ${RELOAD_SECONDS.toFixed(3)} s)`);
check('the quick waves and quick creatures really step faster than the slow ones', stepGapFor(ENEMIES.bloatfly, 7) < stepGapFor(ENEMIES.raider, 0));

// ---- which weapons have a magazine
const mags = Object.entries(WEAPON_CLASSES).flatMap(([cls, c]) => c.tiers.filter(usesMagazine).map((w) => `${cls}:${w.id}`));
check('only the automatics and the flamethrower use a magazine', mags.join() === 'automatic:uzi,automatic:mp5,automatic:ak47,automatic:m249,explosive:flamethrower', mags.join());
check('the magazine is 100 rounds', MAGAZINE === 100);

// ---- a game with nothing coming (so nothing strikes) to shoot into
const plan: RaidPlan = { worth: 10, enemies: ['raider'], boss: null, waves: [1], total: 1, lootTypes: ['steel'], lootRange: [2, 3] };
function game(arsenal: Partial<Arsenal>) {
  const g = new Game({ plan, spawns: DEFAULT_SPAWNS, arsenal: { pistol: 1, automatic: 0, sniper: 0, explosive: 0, ...arsenal }, random: () => 0.5 });
  (g as unknown as { pause: number }).pause = 1e9; // the first wave never starts: the fight stays on, with no enemies
  return g;
}
const shoot = (g: Game) => g.fire(0.5, 0.5, 1.5, () => 0.5);
/** Holds the trigger down for a number of seconds at 60 frames a second; returns how many shots went off. */
function hold(g: Game, seconds: number) { let shots = 0; for (let t = 0; t < seconds; t += 1 / 60) { g.update(1 / 60); if (shoot(g)) shots++; } return shots; }

const a = game({ automatic: 4 }); a.select('automatic'); // M249, 12 rounds a second
check('it starts with a full magazine', a.mag.automatic === 100 && !a.reloading);
let n = 0; while (n < 100) { a.update(1 / 60); if (shoot(a)) n++; }
check('after 100 rounds the magazine is at 0 and the reload has begun by itself', a.mag.automatic === 0 && a.reloading && a.reloadProgress !== null && a.reloadProgress < 0.05, `${a.mag.automatic} ${a.reloading}`);
let fired = 0; for (let t = 0; t < RELOAD_SECONDS * 0.9; t += 1 / 60) { a.update(1 / 60); if (shoot(a)) fired++; }
check('holding the trigger during the reload fires nothing', fired === 0 && a.mag.automatic === 0 && a.reloading, `fired ${fired}`);
for (let t = 0; t < 0.3; t += 1 / 60) a.update(1 / 60);
check('when it is done the magazine is full again and firing resumes by itself', !a.reloading && a.mag.automatic === 100 && (a.update(1 / 60), shoot(a)) && a.mag.automatic === 99);
// time to fire 300 rounds: shooting time plus two reloads
const timeFor = (rounds: number) => { const x = game({ automatic: 4 }); x.select('automatic'); let shots = 0, time = 0; while (shots < rounds) { x.update(1 / 60); time += 1 / 60; if (shoot(x)) shots++; } return time; };
const t100 = timeFor(100), t300 = timeFor(300); // (at 60 frames a second the cooldown rounds up to whole frames, so measure the real rate rather than assume 12 a second)
check('300 rounds cost three magazines of shooting plus two reloads', Math.abs(t300 - (3 * t100 + 2 * RELOAD_SECONDS)) < 0.15, `${t300.toFixed(2)} vs ${(3 * t100 + 2 * RELOAD_SECONDS).toFixed(2)}`);
const pausedGame = game({ automatic: 1 }); pausedGame.select('automatic'); for (let i = 0; i < 100; i++) { pausedGame.update(0.2); shoot(pausedGame); }
const left = pausedGame.reloadLeft.automatic ?? 0; pausedGame.paused = true; for (let i = 0; i < 60; i++) pausedGame.update(0.1);
check('a reload does not tick while the game is paused (weapon wheel, downed)', pausedGame.reloadLeft.automatic === left && left > 0 || left === 0, `${left} -> ${pausedGame.reloadLeft.automatic}`);

// ---- switching weapons during a reload
const c = game({ automatic: 2 }); c.select('automatic');
let m = 0; while (m < 100) { c.update(1 / 60); if (shoot(c)) m++; }
const before = c.reloadLeft.automatic as number;
c.select('pistol'); c.update(0.3);
check('switching to the pistol: it can fire at once, and the reload carries on in the background', shoot(c) && (c.reloadLeft.automatic as number) < before - 0.25 && c.reloadLeft.automatic! > 0, `${before} -> ${c.reloadLeft.automatic}`);
c.select('automatic');
check('switching back during the reload: still reloading, not restarted and not cancelled', c.reloading && (c.reloadLeft.automatic as number) < before, `${c.reloadLeft.automatic}`);
for (let t = 0; t < RELOAD_SECONDS; t += 1 / 60) c.update(1 / 60);
check('and it finishes while the pistol was in hand (the magazine is full when you come back)', !c.reloading && c.mag.automatic === 100);
check('each magazine is its own: the pistol has none', c.mag.pistol === undefined);

// ---- the flamethrower: 600 rounds in all, as before, six magazines
const f = game({ explosive: 1 }); f.select('explosive');
check('the flamethrower starts with a full magazine and 600 rounds in all', f.mag.explosive === 100 && f.ammo.explosive === 600);
let burned = 0, reloads = 0, was = false;
for (let t = 0; t < 120; t += 1 / 60) { f.update(1 / 60); if (shoot(f)) burned++; if (f.reloading && !was) reloads++; was = f.reloading; }
check('it burns exactly 600 rounds in all, with five reloads between the six magazines, and then is out', burned === 600 && reloads === 5 && f.ammo.explosive === 0 && f.mag.explosive === 0 && !f.reloading, `burned ${burned}, reloads ${reloads}, ammo ${f.ammo.explosive}`);
check('out of fuel it does not start a reload and fires nothing more', !shoot(f) && !f.reloading);

// ---- the other weapons are untouched
const o = game({ sniper: 1, explosive: 2 });
o.select('sniper'); let s1 = 0; for (let t = 0; t < 30; t += 1 / 60) { o.update(1 / 60); if (shoot(o)) s1++; }
check('the sniper rifle has no magazine and never reloads', o.mag.sniper === undefined && !o.reloading && s1 >= 25, `${s1}`);
o.select('explosive'); let s2 = 0; for (let t = 0; t < 60; t += 1 / 60) { o.update(1 / 60); if (shoot(o)) s2++; }
check('the grenade launcher keeps its 20 shots a fight, with no magazine', o.mag.explosive === undefined && !o.reloading && s2 === 20 && o.ammo.explosive === 0, `${s2}`);
const p = game({}); let s3 = 0; for (let t = 0; t < 20; t += 1 / 60) { p.update(1 / 60); if (shoot(p)) s3++; }
check('the pistol fires without limit', s3 >= 55 && p.mag.pistol === undefined);

process.exit(bad ? 1 : 0);
