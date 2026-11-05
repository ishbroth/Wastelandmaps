// Checks on Vault 0, Vault Tech Headquarters (Antarctica): the Antarctica test, the boss-only raid, the region and the places on the map, and (by running the
// real raid and report-discovery functions against an in-memory database) what the SERVER pays and refuses. Run: npx tsx _tools/vaultzero.check.ts
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { inAntarctica } from '../supabase/functions/_shared/antarctica.ts';
import * as V from '../supabase/functions/_shared/vaultZero.ts';
import { vaultZeroPlan, raidFor, planFor, planEnemies } from '../src/lib/raid/raid.ts';
import { BOSS_IDS } from '../src/lib/raid/enemies.ts';
import { DEFAULT_SPAWNS, Game } from '../src/lib/raid/engine.ts';
import { spawnsFor } from '../src/lib/raid/spawnData.ts';
import { allLabels, nameForZoom } from '../src/lib/regions.ts';
import { VAULT_ZERO } from '../src/lib/vaultZero.ts';
import { GLOBAL_LANDMARKS } from '../src/lib/globalLandmarks.ts';
import { FREE_RENDERS } from '../src/lib/renders.ts';
import { pointsFor } from '../src/lib/points.ts';
import { describeSpot, spotFromLocation } from '../src/lib/wasteland.ts';

let bad = 0;
const check = (name: string, ok: boolean, detail = '') => { if (!ok) bad++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : '  ' + detail}`); };
const sum = (o: Record<string, number>) => Object.values(o).reduce((a, b) => a + b, 0);

// ---- is this position in Antarctica
const inside: Record<string, [number, number]> = { 'South Pole': [-89.99, 0], McMurdo: [-77.85, 166.67], Vostok: [-78.46, 106.84], 'Palmer Station': [-64.77, -64.05], 'King George Island': [-62.2, -58.9], Rothera: [-67.57, -68.13], 'Ross Ice Shelf': [-80, -170], 'near the pole, date line': [-85, 179.9], Halley: [-75.58, -26.66], 'Ronne Ice Shelf': [-78, -60], 'Vault 0 itself': [V.VAULT_ZERO_AT.lat, V.VAULT_ZERO_AT.lng] };
const outside: Record<string, [number, number]> = { Ushuaia: [-54.8, -68.3], 'Cape Horn': [-55.98, -67.27], 'Drake Passage, middle': [-60, -60], 'Drake Passage, far south': [-61, -62], Hobart: [-42.9, 147.3], Falklands: [-51.7, -57.8], 'South Georgia': [-54.3, -36.5], 'Punta Arenas': [-53.2, -70.9], 'open Ross Sea': [-68, 180], 'open Weddell Sea': [-64, -40], Equator: [0, 0], Boston: [42.36, -71.06], Invercargill: [-46.4, 168.4], 'not a number': [NaN, 0] };
for (const [n, [la, lo]] of Object.entries(inside)) check(`in Antarctica: ${n}`, inAntarctica(la, lo));
for (const [n, [la, lo]] of Object.entries(outside)) check(`not Antarctica: ${n}`, !inAntarctica(la, lo));
check('longitude past the date line is wrapped (-80, 540 is 180)', inAntarctica(-80, 540) === inAntarctica(-80, 180));

// ---- the loot and the raid plan
let allExact = true;
for (let i = 0; i < 300; i++) { const l = V.rollVaultZeroLoot(); if (sum(l) !== 20 || Object.keys(l).sort().join() !== [...V.VAULT_ZERO_LOOT].sort().join() || Object.values(l).some((n) => n < 1)) allExact = false; }
check('the loot is exactly 20 pieces, at least one of each of its three kinds', allExact);
const plan = vaultZeroPlan();
check('eight waves, one boss then one more each wave (36 bosses)', JSON.stringify(plan.waves) === '[1,2,3,4,5,6,7,8]' && plan.total === 36 && V.VAULT_ZERO_BOSSES === 36);
check('every kind of enemy in it is a boss, and it is flagged boss-only', plan.bossOnly === true && plan.boss === null && plan.enemies.length === BOSS_IDS.length && plan.enemies.every((e) => (BOSS_IDS as string[]).includes(e)));
check('its loot range is exactly 20', plan.lootRange[0] === 20 && plan.lootRange[1] === 20);
check('raidFor(Vault 0) and planFor(id, any worth) are the same boss-only plan', JSON.stringify(raidFor(VAULT_ZERO)) === JSON.stringify(plan) && JSON.stringify(planFor(V.VAULT_ZERO_ID, 1000)) === JSON.stringify(plan) && JSON.stringify(planFor(V.VAULT_ZERO_ID, 10)) === JSON.stringify(plan));
check('the card lists only bosses', planEnemies(plan).split(', ').length === 4 && !/Raider|Roach|Mole/.test(planEnemies(plan)), planEnemies(plan));
check('an ordinary place is untouched (Eiffel is not boss-only)', !planFor('wd:Q243', 75).bossOnly && planFor('wd:Q243', 75).waves.reduce((a, b) => a + b, 0) === planFor('wd:Q243', 75).total);
const g = new Game({ plan, spawns: DEFAULT_SPAWNS, arsenal: { pistol: 1, automatic: 0, sniper: 0, explosive: 0 }, random: Math.random });
const order = (g as unknown as { order: { type: { id: string }; boss: boolean }[][] }).order;
check('the game sends those eight waves, and every enemy in them is a boss', order.map((w) => w.length).join() === '1,2,3,4,5,6,7,8' && order.flat().every((e) => e.boss && (BOSS_IDS as string[]).includes(e.type.id)));
check('the game counts 36 enemies to beat and starts on wave 1', g.totalEnemies === 36 && g.banner === 'WAVE 1');
check('it has its own spawn points (the snowfield), not the default ground band', spawnsFor(V.VAULT_ZERO_ID) !== DEFAULT_SPAWNS && spawnsFor(V.VAULT_ZERO_ID).horizon === 0.62);

// ---- the region and the place on the map
const data = { countries: [], states: [] } as never;
check('the continent name over Antarctica, at every zoom a name shows', [2, 3, 4, 5, 6, 8].every((z) => nameForZoom(data, { lat: -80, lng: 10 }, z) === 'Vault Tech Headquarters') && nameForZoom(data, { lat: -66, lng: -60 }, 2) === 'Vault Tech Headquarters');
check('south of 60 only: the tip of South America is not Vault-Tec', nameForZoom(data, { lat: -54, lng: -68 }, 2) !== 'Vault Tech Headquarters');
check('it is a continent label on the map, at the bottom of the world', allLabels(data).some((l) => l.level === 'continent' && l.name === 'Vault Tech Headquarters' && l.position.lat < -70));
check('Vault 0 stands on the map wherever you look (among the global landmarks), once', GLOBAL_LANDMARKS.filter((l) => l.id === V.VAULT_ZERO_ID).length === 1);
check('it uses the vault icon, is a landmark with a raid (not a made-up `vault` entrance)', VAULT_ZERO.icon === 'vault' && !VAULT_ZERO.vault && !VAULT_ZERO.lore && VAULT_ZERO.name === 'Vault 0' && VAULT_ZERO.oldName === 'Vault Tech Headquarters');
const free = FREE_RENDERS[V.VAULT_ZERO_ID];
check('it has a permanent snapshot that is pristine (no bomb, no after picture)', !!free && free.pristine === true && free.name === 'Vault 0');
check('the picture is there', fs.existsSync(path.resolve(import.meta.dirname, '..', 'public', 'renders', 'famous-vault-0.png')));
check('its XP shows as 1000 on the card', pointsFor(VAULT_ZERO) === 1000);
check('its journal is its own', describeSpot(spotFromLocation(VAULT_ZERO), 'The Commonwealth').join(' ').includes('no bomb ever fell'));

// ---- the server, for real: the raid and report-discovery functions run against an in-memory database
type Row = Record<string, unknown>;
const tables: Record<string, Row[]> = {};
const loot: Record<string, Record<string, number>> = {};
let xpCeiling = 1000; // 1000 once the migration is applied, 100 before
function builder(table: string) {
  const rows = (tables[table] ??= []);
  const st = { op: 'select', payload: {} as Row, filters: [] as ((r: Row) => boolean)[], count: false, head: false, limit: Infinity, single: false, maybe: false };
  // deno-lint-ignore no-explicit-any
  const api: any = {
    select(_c?: string, o?: { count?: string; head?: boolean }) { if (st.op === 'select') { st.count = !!o?.count; st.head = !!o?.head; } return api; },
    insert(p: Row) { st.op = 'insert'; st.payload = p; return api; },
    update(p: Row) { st.op = 'update'; st.payload = p; return api; },
    eq(k: string, v: unknown) { st.filters.push((r) => r[k] === v); return api; },
    gte(k: string, v: unknown) { st.filters.push((r) => (r[k] as string) >= (v as string)); return api; },
    like(k: string, v: string) { const re = new RegExp('^' + v.replace(/%/g, '.*') + '$'); st.filters.push((r) => re.test(String(r[k]))); return api; },
    in(k: string, vs: unknown[]) { st.filters.push((r) => vs.includes(r[k])); return api; },
    limit(n: number) { st.limit = n; return api; },
    maybeSingle() { st.maybe = true; return api; },
    single() { st.single = true; return api; },
    then(res: (v: unknown) => unknown, rej: (e: unknown) => unknown) { return Promise.resolve(run()).then(res, rej); },
  };
  function run() {
    if (st.op === 'insert') { const row = { id: crypto.randomUUID(), started_at: new Date().toISOString(), paid: true, finished_at: null, won: null, ...st.payload }; rows.push(row); return { data: st.single ? row : [row], error: null }; }
    const hit = rows.filter((r) => st.filters.every((f) => f(r)));
    if (st.op === 'update') { hit.forEach((r) => Object.assign(r, st.payload)); return { data: null, error: null }; }
    const got = hit.slice(0, st.limit);
    if (st.head) return { count: got.length, data: null, error: null };
    if (st.maybe || st.single) return { data: got[0] ?? null, error: null };
    return { data: got, error: null };
  }
  return api;
}
const fakeDb = {
  from: builder,
  rpc(name: string, a: Record<string, unknown>) {
    if (name === 'grant_loot') {
      const bag = (loot[a.p_user as string] ??= {});
      const granted: Record<string, number> = {};
      for (const [k, n] of Object.entries(a.p_loot as Record<string, number>)) { const take = Math.min(n, Math.max(0, 99 - (bag[k] ?? 0))); bag[k] = (bag[k] ?? 0) + take; granted[k] = take; }
      return Promise.resolve({ data: { granted, lost: {} }, error: null });
    }
    if (name === 'record_discovery') {
      const t = (tables.discoveries ??= []);
      if (t.some((r) => r.user_id === a.p_user && r.place_id === a.p_place)) return Promise.resolve({ data: { added: 0, bonus: false, given: 0 }, error: null });
      const points = Math.max(1, Math.min(Number(a.p_points ?? 10), xpCeiling));
      t.push({ user_id: a.p_user, place_id: a.p_place, points });
      return Promise.resolve({ data: { added: points, bonus: false, given: 0 }, error: null });
    }
    return Promise.resolve({ data: null, error: { message: 'unknown rpc ' + name } });
  },
};
(globalThis as unknown as { __db: unknown }).__db = fakeDb;

const SRC = path.resolve(import.meta.dirname, '..');
const TMP = path.join(SRC, '_data', 'vaultzero-check');
fs.mkdirSync(TMP, { recursive: true });
fs.writeFileSync(path.join(TMP, 'fakeCommon.ts'), `export const corsHeaders = (_r: Request) => ({});
export const reply = (_r: Request, body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
export const serviceClient = () => (globalThis as any).__db;
export const callerId = async (r: Request) => (r.headers.get('authorization') ?? '').replace(/^Bearer\\s+/i, '') || null;
`);
let handler: ((req: Request) => Promise<Response>) | null = null;
(globalThis as unknown as { Deno: unknown }).Deno = { serve: (h: (req: Request) => Promise<Response>) => { handler = h; }, env: { get: () => undefined } };
async function load(name: string) {
  let code = fs.readFileSync(path.join(SRC, 'supabase', 'functions', name, 'index.ts'), 'utf8');
  code = code.replace(/from '\.\.\/_shared\/common\.ts'/, "from './fakeCommon.ts'").replace(/from '\.\.\/_shared\/([A-Za-z]+)\.ts'/g, (_m, f) => `from '${pathToFileURL(path.join(SRC, 'supabase', 'functions', '_shared', f + '.ts')).href}'`);
  const file = path.join(TMP, `${name}.ts`);
  fs.writeFileSync(file, code);
  handler = null;
  await import(pathToFileURL(file).href + '?' + Date.now());
  return handler as unknown as (req: Request) => Promise<Response>;
}
const call = async (h: (req: Request) => Promise<Response>, user: string, body: unknown) => {
  const res = await h(new Request('http://test/', { method: 'POST', headers: { authorization: `Bearer ${user}`, origin: 'capacitor://localhost' }, body: JSON.stringify(body) }));
  return { status: res.status, body: (await res.json()) as Record<string, any> }; // eslint-disable-line @typescript-eslint/no-explicit-any
};
const raid = await load('raid');
const discover = await load('report-discovery');

// the raid: the browser lies about every number, and is nowhere near Antarctica and has discovered nothing
const lies = { action: 'start', placeId: V.VAULT_ZERO_ID, worth: 10, enemies: 1, lootTypes: ['wood'] };
const start = await call(raid, 'ann', lies);
check('a raid on Vault 0 starts for anyone, undiscovered, with no unlock', start.status === 200 && !!start.body.runId, JSON.stringify(start));
const run = (tables.raid_runs ?? []).find((r) => r.id === start.body.runId) as Row;
check('the server used its own numbers, not the browser\'s (36 bosses, worth 75)', run?.enemies === 36 && run?.worth === 75, JSON.stringify(run));
check('the run holds exactly 20 pieces of its three kinds, not the browser\'s "wood"', sum(run.loot as Record<string, number>) === 20 && Object.keys(run.loot as object).every((k) => V.VAULT_ZERO_LOOT.includes(k)));
const early = await call(raid, 'ann', { action: 'finish', runId: start.body.runId, won: true });
check('a "win" in no time at all pays nothing (nobody shoots 36 bosses in seconds)', early.body.won === false && !loot.ann && !(tables.discoveries ?? []).length, JSON.stringify(early.body));
const start2 = await call(raid, 'ann', lies);
(tables.raid_runs.find((r) => r.id === start2.body.runId) as Row).started_at = new Date(Date.now() - 400_000).toISOString();
const won = await call(raid, 'ann', { action: 'finish', runId: start2.body.runId, won: true });
check('a real win pays at once, undiscovered: 20 pieces and 100 XP', won.body.won === true && !won.body.pending && sum(loot.ann ?? {}) === 20 && won.body.xp === 100, JSON.stringify(won.body));
check('the XP is a bonus row, and Vault 0 is still NOT discovered', (tables.discoveries ?? []).some((r) => r.place_id === V.VAULT_ZERO_RAID_XP_ID && r.points === 100) && !(tables.discoveries ?? []).some((r) => r.place_id === V.VAULT_ZERO_ID) && !(tables.found_places ?? []).length);
const again = await call(raid, 'ann', lies);
check('it can be won only once: the next try is refused as cleared', again.status === 409 && again.body.error === 'cleared', JSON.stringify(again));
const bo = await call(raid, 'bob', lies);
check('another person can still fight it (their own run)', bo.status === 200);
// the ordinary rules are untouched
const undisc = await call(raid, 'cy', { action: 'start', placeId: 'wd:Q999999', worth: 10, enemies: 3, lootTypes: ['wood'] });
check('an ordinary undiscovered place is still refused', undisc.status === 403 && undisc.body.error === 'undiscovered', JSON.stringify(undisc));
const eiffel = await call(raid, 'cy', { action: 'start', placeId: 'wd:Q243', worth: 75, enemies: 10, lootTypes: ['steel'] });
(tables.raid_runs.find((r) => r.id === eiffel.body.runId) as Row).started_at = new Date(Date.now() - 400_000).toISOString();
const eWon = await call(raid, 'cy', { action: 'finish', runId: eiffel.body.runId, won: true });
check('a permanent landmark fought from afar still waits for its discovery', eWon.body.pending === true && !loot.cy, JSON.stringify(eWon.body));

// discovery: only by being in Antarctica, once
const far = { placeId: V.VAULT_ZERO_ID, lat: -77.85, lng: 166.67, userLat: -54.8, userLng: -68.3 };
const refused = await call(discover, 'dee', far);
check('being near the vault\'s coordinates from the wrong place pays nothing (Ushuaia is not Antarctica)', refused.status === 400 && refused.body.error === 'not_in_antarctica' && !loot.dee, JSON.stringify(refused));
const noPos = await call(discover, 'dee', { placeId: V.VAULT_ZERO_ID });
check('no position is refused too', noPos.status === 400 && !loot.dee);
const here = await call(discover, 'dee', { placeId: V.VAULT_ZERO_ID, lat: 1, lng: 2, userLat: -80.5, userLng: 20 });
check('anywhere in Antarctica finds it (the place\'s own coordinates are ignored): 1000 XP and 20 pieces', here.status === 200 && here.body.added === 1000 && sum(loot.dee ?? {}) === 20, JSON.stringify(here));
check('the discovery is recorded for that place', (tables.discoveries ?? []).some((r) => r.user_id === 'dee' && r.place_id === V.VAULT_ZERO_ID && r.points === 1000));
const twice = await call(discover, 'dee', { placeId: V.VAULT_ZERO_ID, userLat: -75, userLng: 100 });
check('a second report pays nothing more (once only)', twice.body.added === 0 && sum(loot.dee ?? {}) === 20 && sum((twice.body.loot ?? {}) as Record<string, number>) === 0, JSON.stringify(twice.body));
const ed = await call(discover, 'ed', { placeId: V.VAULT_ZERO_ID, userLat: -82, userLng: -40 });
check('another person is paid separately', ed.body.added === 1000 && sum(loot.ed ?? {}) === 20);
// ordinary discoveries keep their own rules (500 m reach, 100 point ceiling)
const tooFar = await call(discover, 'fay', { placeId: 'wd:Q243', lat: 48.8584, lng: 2.2945, userLat: 40, userLng: -70, points: 75 });
check('an ordinary place still needs you within reach of it', tooFar.status === 400 && tooFar.body.error === 'too_far', JSON.stringify(tooFar.body));
const ok = await call(discover, 'fay', { placeId: 'wd:Q243', lat: 48.8584, lng: 2.2945, userLat: 48.8585, userLng: 2.2946, points: 5000 });
check('an ordinary place is still clamped to 100 points', ok.body.added === 100, JSON.stringify(ok.body));
// before the migration is applied: the vault still works, it just pays the old ceiling
xpCeiling = 100;
const old = await call(discover, 'gus', { placeId: V.VAULT_ZERO_ID, userLat: -80, userLng: 0 });
check('before the migration (ceiling 100) it still pays the loot, with 100 XP instead of 1000', old.body.added === 100 && sum(loot.gus ?? {}) === 20, JSON.stringify(old.body));

fs.rmSync(TMP, { recursive: true, force: true });
process.exit(bad ? 1 : 0);
