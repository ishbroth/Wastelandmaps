// Checks on how enemies walk in: the gameplay must be the same as before (the same time to get to the survivor), and the motion must be smooth (no start-stop
// jerks, never backwards). The old law is kept here as a reference ("legacy") to compare against. Run: npx tsx _tools/enemymotion.check.ts
import { DEFAULT_SPAWNS, Game, type Enemy } from '../src/lib/raid/engine.ts';
import { seeded } from '../src/lib/wasteland.ts';
import type { RaidPlan } from '../src/lib/raid/raid.ts';

let bad = 0;
const check = (name: string, ok: boolean, detail = '') => { if (!ok) bad++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : '  ' + detail}`); };
const DT = 1 / 60;

/** The law used before the smoothing: p jumps its target by a step every stepGap and chases it exponentially (7 a second). Returns the time it strikes, and p each frame. */
function legacy(steps: number, gap: number, stepT0: number) {
  let p = 0, step = 0, stepT = stepT0, t = 0;
  const trace: number[] = [];
  for (let i = 0; i < 100_000; i++) {
    t += DT;
    p += (step / steps - p) * Math.min(1, DT * 7);
    stepT -= DT;
    if (stepT <= 0) { stepT = gap; if (step < steps) step++; }
    trace.push(p);
    if (step >= steps && p > 0.97) return { t, trace };
  }
  throw new Error('legacy never arrived');
}

/** One ordinary enemy walking in the real game, with nobody shooting: its parameters, the time it starts to strike, and p each frame. */
function real(seed: number, wave = 0) {
  const plan: RaidPlan = { worth: 10, enemies: ['ghoul'], boss: null, waves: [1, 1, 1, 1, 1, 1, 1, 1], total: 8, lootTypes: ['steel'], lootRange: [2, 3] };
  const g = new Game({ plan, spawns: DEFAULT_SPAWNS, arsenal: { pistol: 1, automatic: 0, sniper: 0, explosive: 0 }, random: seeded(seed) });
  (g as unknown as { pause: number }).pause = 0;
  (g as unknown as { wave: number }).wave = wave - 1; // so the first wave counts as `wave`
  let e: Enemy | undefined; let t = 0; let first: { steps: number; gap: number; stepT: number } | null = null;
  const trace: number[] = [];
  for (let i = 0; i < 100_000; i++) {
    g.update(DT); t += DT;
    e = g.enemies[0];
    if (!e) continue;
    if (!first) first = { steps: e.steps, gap: e.stepGap, stepT: e.stepT + DT };
    trace.push(e.p);
    if (e.state === 'striking') return { t, trace, ...first };
  }
  throw new Error('enemy never arrived');
}

const speeds = (trace: number[]) => trace.slice(1).map((p, i) => (p - trace[i]) / DT);
const maxJerk = (trace: number[]) => { const v = speeds(trace); let m = 0; for (let i = 1; i < v.length; i++) m = Math.max(m, Math.abs(v[i] - v[i - 1]) / DT); return m; };

const runs = Array.from({ length: 250 }, (_, i) => { const r = real(1000 + i, i % 8); return { r, old: legacy(r.steps, r.gap, r.stepT) }; });
const diffs = runs.map(({ r, old }) => r.t - old.t);
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const meanAbs = mean(diffs.map(Math.abs));
const worst = Math.max(...diffs.map(Math.abs));
console.log(`      time to reach the survivor, new minus old: mean ${mean(diffs).toFixed(3)} s, mean |diff| ${meanAbs.toFixed(3)} s, worst ${worst.toFixed(3)} s (walks of ${mean(runs.map(({ old }) => old.t)).toFixed(1)} s on average)`);
check('same pace: on average the enemy arrives within 0.1 s of when it used to', Math.abs(mean(diffs)) < 0.1, `${mean(diffs).toFixed(3)}`);
check('same pace: no single enemy arrives more than 0.35 s earlier or later than before', worst < 0.35, `${worst.toFixed(3)}`);
check('the same steps and the same cadence as before (gaps, step counts untouched)', runs.every(({ r }) => r.steps >= 6 && r.steps <= 8 && r.gap > 0.4 && r.gap < 1.7));

const newJerk = mean(runs.map(({ r }) => maxJerk(r.trace)));
const oldJerk = mean(runs.map(({ old }) => maxJerk(old.trace)));
console.log(`      sharpest change of speed (average over the enemies): old ${oldJerk.toFixed(0)}, new ${newJerk.toFixed(0)} (in p per second per second)`);
check('the motion has far fewer sudden changes of speed than before (under a quarter of the jerk)', newJerk < oldJerk * 0.25, `${newJerk.toFixed(0)} vs ${oldJerk.toFixed(0)}`);
check('an enemy never moves backwards while it walks in', runs.every(({ r }) => speeds(r.trace).every((v) => v > -1e-6)));
const stalls = (xs: number[]) => { let n = 0; const v = speeds(xs); const avg = mean(v); for (const s of v) if (s < avg * 0.05) n++; return n; };
console.log(`      frames spent almost stopped while walking: old ${mean(runs.map(({ old }) => stalls(old.trace))).toFixed(0)}, new ${mean(runs.map(({ r }) => stalls(r.trace))).toFixed(0)}`);
check('it no longer comes to a standstill between steps (far fewer almost-stopped frames)', mean(runs.map(({ r }) => stalls(r.trace))) < mean(runs.map(({ old }) => stalls(old.trace))) * 0.35);

// the hit box follows what is drawn, and the survivor is still struck at the same moment: three strikes still end the fight
const plan: RaidPlan = { worth: 10, enemies: ['ghoul'], boss: null, waves: [3], total: 3, lootTypes: ['steel'], lootRange: [2, 3] };
const g = new Game({ plan, spawns: DEFAULT_SPAWNS, arsenal: { pistol: 1, automatic: 0, sniper: 0, explosive: 0 }, random: seeded(7) });
let t = 0; while (g.outcome === 'fighting' && t < 120) { g.update(DT); t += DT; }
check('left alone, three enemies strike three times and take about three blows off the bar', g.hits === 3 && g.health <= g.maxHealth - 75 && g.health >= g.maxHealth - 99, `${g.outcome} ${g.hits} ${g.health.toFixed(1)}`);

process.exit(bad ? 1 : 0);
