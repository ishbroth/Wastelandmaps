// The home vault: rooms, furniture, settlers and happiness. The browser asks for an action; the server checks the home is the person's own, bought and
// cleared, works out the result with the shared rules, and saves it with the loot spent in one step (vault_commit in the home_vault migration).
//
// POST { action: 'visit' }                                 -> { ok, vault, version }   (also records that the vault is being looked at)
// POST { action: 'build', type, level, col, row }          -> { ok, vault, version } or { ok: false, reason }
// POST { action: 'furnish', room, item }                   -> same
// POST { action: 'settler', kind, name }                   -> same (the settler's name: 1 to 10 letters or numbers)
// POST { action: 'rename', id, name }                      -> same
// POST { action: 'instrument', room, choice }                -> same (the study's instrument: guitar, piano, harp or drums)
// POST { action: 'demolish', room }                        -> same, and { refund } (half of the loot the room cost, picked at random)
// Every request first works out what neglect has done since the vault was last seen (see neglectAt): crowded settlers who have waited a day at the lowest happiness leave, and
// unhappy settlers who have enough rooms take one random piece of loot per day. The reply says so ({ left: [{ kind, name }], stolen: ['steel', ...] }).
// What a step costs is a fixed mix of loot ("2 wood, 1 plastic"), worked out here from the vault's seed: the player does not choose it, and it is taken from their loot.
// Deploy: supabase functions deploy vault

import { callerId, corsHeaders, reply, serviceClient } from '../_shared/common.ts';
import { applyBuild, applyDemolish, applyFurnish, applyInstrument, applyPlace, applyRename, applySettler, checkIn, neglectAt, newVault, normalize, type LootBag, type VaultHome } from '../_shared/vaultHome.ts';

const newSeed = (): number => Math.floor(Math.random() * 2147483646) + 1;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) });
  if (req.method !== 'POST') return reply(req, { error: 'POST only' }, 405);
  const user = await callerId(req);
  if (!user) return reply(req, { error: 'sign_in' }, 401);

  const b = (await req.json().catch(() => ({}))) as { vault?: string; action?: string; type?: string; level?: number; col?: number; row?: number; room?: number; item?: string; kind?: string; at?: unknown; dir?: string; shape?: string };
  const db = serviceClient();

  // which vault: their home (default), or one of their vacation vaults, named by its place id
  const key = typeof b.vault === 'string' && b.vault && b.vault !== 'home' ? b.vault : 'home';
  if (key === 'home') {
    // only their own home, with its snapshot bought and the place cleared
    const { data: home } = await db.from('user_home').select('place_id').eq('user_id', user).maybeSingle();
    if (!home) return reply(req, { ok: false, reason: 'no_home' });
    const [{ data: bought }, { data: won }] = await Promise.all([
      db.from('unlocks').select('place_id').eq('user_id', user).like('place_id', `vault:${home.place_id}:%`).limit(1),
      db.from('raid_runs').select('id').eq('user_id', user).eq('place_id', `me:${home.place_id}`).eq('won', true).limit(1),
    ]);
    if (!bought?.length || !won?.length) return reply(req, { ok: false, reason: 'not_cleared' });
  } else {
    // a vacation vault they have unlocked (its picture made and the loot paid)
    const { data: vac } = await db.from('vacation_vault').select('status').eq('user_id', user).eq('place_id', key).maybeSingle();
    if (!vac || vac.status !== 'ready') return reply(req, { ok: false, reason: 'no_vacation' });
  }

  const now = Date.now();
  const { data: row } = await db.from('home_vault').select('state,version').eq('user_id', user).eq('vault_key', key).maybeSingle();
  const version = (row?.version as number | undefined) ?? 0;
  const vault = normalize((row?.state as VaultHome | undefined) ?? newVault(now, newSeed())); // a vault in the old side-view layout is converted to the floorplan here
  if (vault.seed === undefined || vault.seed === 0) vault.seed = newSeed(); // a vault made before recipes existed gets its seed now (saved with the next change)

  // what neglect has done: settlers leaving, and pieces of loot picked at random (every piece they own is as likely as any other) to go missing
  const neglect = neglectAt(vault, now);
  const stolen: string[] = [];
  if (neglect.thefts > 0) {
    const { data: held } = await db.from('player_loot').select('loot,qty').eq('user_id', user).gt('qty', 0);
    const pool = (held ?? []).map((h) => ({ loot: String(h.loot), qty: Number(h.qty) }));
    for (let i = 0; i < neglect.thefts; i++) {
      const total = pool.reduce((n, h) => n + h.qty, 0);
      if (total < 1) break;
      let pick = Math.floor(Math.random() * total);
      const hit = pool.find((h) => (pick -= h.qty) < 0) ?? pool[0];
      hit.qty -= 1;
      stolen.push(hit.loot);
    }
  }
  const taken: LootBag = {};
  for (const k of stolen) taken[k] = (taken[k] ?? 0) + 1;
  const base = neglect.vault;
  let next: VaultHome;
  let spend: LootBag = {};
  let refund: LootBag | null = null;
  switch (b.action) {
    case 'visit': next = checkIn(base, now); break;
    case 'build': {
      const r = applyBuild(checkIn(base, now), String(b.type) as never, Number(b.level ?? 0), Number(b.col), Number(b.row), now, b.dir === 'up' ? 'up' : 'down', b.shape === 'u' ? 'u' : 'straight');
      if (!r.ok) return reply(req, { ok: false, reason: r.reason });
      next = r.vault; spend = r.recipe; break;
    }
    case 'furnish': {
      const r = applyFurnish(checkIn(base, now), Number(b.room), String(b.item), now, b.at);
      if (!r.ok) return reply(req, { ok: false, reason: r.reason });
      next = r.vault; spend = r.recipe; break;
    }
    case 'place': {
      const r = applyPlace(base, Number(b.room), String(b.item), b.at);
      if (!r.ok) return reply(req, { ok: false, reason: r.reason });
      next = r.vault; break;
    }
    case 'settler': {
      const r = applySettler(base, String(b.kind), b.name);
      if (!r.ok) return reply(req, { ok: false, reason: r.reason });
      next = r.vault; break;
    }
    case 'instrument': {
      const r = applyInstrument(base, Number(b.room), String(b.choice));
      if (!r.ok) return reply(req, { ok: false, reason: r.reason });
      next = r.vault; break;
    }
    case 'demolish': {
      const r = applyDemolish(checkIn(base, now), Number(b.room), now);
      if (!r.ok) return reply(req, { ok: false, reason: r.reason });
      next = r.vault; refund = r.refund; break;
    }
    case 'rename': {
      const r = applyRename(base, Number(b.id), b.name);
      if (!r.ok) return reply(req, { ok: false, reason: r.reason });
      next = r.vault; break;
    }
    default: return reply(req, { error: 'bad_action' }, 400);
  }

  // what the settlers took is paid in the same step that saves the vault (a demolition's step only pays out, so they let it go that once)
  if (refund) stolen.length = 0;
  else for (const [k, n] of Object.entries(taken)) spend[k] = (spend[k] ?? 0) + n;
  // a demolished room's refund is paid in the same step that saves the vault (the loot is kept to 99 of each)
  const { data, error } = refund
    ? await db.rpc('vault_demolish', { p_user: user, p_state: next, p_refund: refund, p_version: version, p_key: key })
    : await db.rpc('vault_commit', { p_user: user, p_state: next, p_cost: spend, p_version: version, p_key: key });
  if (error) return reply(req, { error: 'server' }, 500);
  const res = data as { ok: boolean; version?: number; reason?: string };
  if (!res.ok) return reply(req, { ok: false, reason: res.reason });
  return reply(req, { ok: true, vault: next, version: res.version, ...(refund ? { refund } : {}), ...(stolen.length ? { stolen } : {}), ...(neglect.left.length ? { left: neglect.left.map((x) => ({ kind: x.kind, ...(x.name ? { name: x.name } : {}) })) } : {}) });
});
