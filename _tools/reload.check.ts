// Checks on the reload system: the automatic guns and the flamethrower reload by themselves every 100 rounds, in about a step and a half of an enemy's walk;
// nothing fires during a reload; the other weapons are untouched. Run: npx tsx _tools/reload.check.ts
import { AVERAGE_STEP_SECONDS, DEFAULT_SPAWNS, Game, RELOAD_SECONDS, RELOAD_STEPS, healthForLevel, stepGapFor } from '../src/lib/raid/engine.ts';
import { ENEMIES, STRIKE_DAMAGE } from '../src/lib/raid/enemies.ts';
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
check('the pistols, the automatics, the sniper rifles and the flamethrower use a magazine (the other heavy weapons do not)', mags.join() === 'pistol:sw29,pistol:m1911,pistol:deagle,pistol:sw500,automatic:uzi,automatic:mp5,automatic:ak47,automatic:m249,sniper:model70,sniper:rem700,sniper:svd,sniper:m82,explosive:flamethrower', mags.join());
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
let m = 0; while (m < c.capacity('automatic')) { c.update(1 / 60); if (shoot(c)) m++; }
const before = c.reloadLeft.automatic as number;
c.select('pistol'); c.update(0.3);
check('switching to the pistol: it can fire at once, and the reload carries on in the background', shoot(c) && (c.reloadLeft.automatic as number) < before - 0.25 && c.reloadLeft.automatic! > 0, `${before} -> ${c.reloadLeft.automatic}`);
c.select('automatic');
check('switching back during the reload: still reloading, not restarted and not cancelled', c.reloading && (c.reloadLeft.automatic as number) < before, `${c.reloadLeft.automatic}`);
for (let t = 0; t < RELOAD_SECONDS; t += 1 / 60) c.update(1 / 60);
check('and it finishes while the pistol was in hand (the magazine is full when you come back)', !c.reloading && c.mag.automatic === c.capacity('automatic'));
check('each magazine is its own: the pistol has fired one of its six, the automatic is full', c.mag.pistol === 5 && c.mag.automatic === 80);

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
check('the sniper rifle holds 12 rounds and then reloads', o.capacity('sniper') === 12 && o.mag.sniper !== undefined && s1 >= 12, `${s1}`);
o.select('explosive'); let s2 = 0; for (let t = 0; t < 60; t += 1 / 60) { o.update(1 / 60); if (shoot(o)) s2++; }
check('the grenade launcher keeps its 20 shots a fight, with no magazine', o.mag.explosive === undefined && !o.reloading && s2 === 20 && o.ammo.explosive === 0, `${s2}`);
const p = game({}); let s3 = 0; for (let t = 0; t < 20; t += 1 / 60) { p.update(1 / 60); if (shoot(p)) s3++; }
check('the first pistol is the Smith & Wesson six-shooter: six rounds, then a reload', p.weapon?.id === 'sw29' && p.capacity('pistol') === 6 && s3 >= 6 && s3 < 55, `${s3}`);
const colt = game({ pistol: 2 });
check('the Colt, the next pistol, holds 16', colt.weapon?.id === 'm1911' && colt.capacity('pistol') === 16);
const autos = [1, 2, 3, 4].map((t) => game({ automatic: t as 1 | 2 | 3 | 4 }).capacity('automatic'));
check('the automatics hold 60, 80, 80 and 100', autos.join() === '60,80,80,100', autos.join());

// ---- the health bar: three of the weakest enemy's hardest blows end a level-0 survivor, and cannot by about level 10
check('at the start the weakest enemy can end the bar in three blows at its hardest', STRIKE_DAMAGE.weak[1] * 3 >= healthForLevel(0));
check('by about level 10 it cannot (the bar has grown by about a tenth)', STRIKE_DAMAGE.weak[1] * 3 < healthForLevel(10) && Math.abs(healthForLevel(10) / healthForLevel(0) - 1.1) < 0.011);
check('the middling and strong enemies still end it in three at their harder blows even at level 10', STRIKE_DAMAGE.medium[1] * 3 > healthForLevel(10) && STRIKE_DAMAGE.strong[1] * 3 > healthForLevel(10));
process.exit(bad ? 1 : 0);
