// The home vault: rooms, furniture, settlers and happiness. The browser asks for an action; the server checks the home is the person's own, bought and
// cleared, works out the result with the shared rules, and saves it with the loot spent in one step (vault_commit in the home_vault migration).
//
// POST { action: 'visit' }                                 -> { ok, vault, version }   (also records that the vault is being looked at)
// POST { action: 'build', type, col, row }                 -> { ok, vault, version } or { ok: false, reason }
// POST { action: 'furnish', room, item }                   -> same
// POST { action: 'settler', kind }                         -> same
// What a step costs is a fixed mix of loot ("2 wood, 1 plastic"), worked out here from the vault's seed: the player does not choose it, and it is taken from their loot.
// Deploy: supabase functions deploy vault

import { callerId, corsHeaders, reply, serviceClient } from '../_shared/common.ts';
import { applyBuild, applyFurnish, applySettler, checkIn, newVault, type LootBag, type VaultHome } from '../_shared/vaultHome.ts';

const newSeed = (): number => Math.floor(Math.random() * 2147483646) + 1;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) });
  if (req.method !== 'POST') return reply(req, { error: 'POST only' }, 405);
  const user = await callerId(req);
  if (!user) return reply(req, { error: 'sign_in' }, 401);

  const b = (await req.json().catch(() => ({}))) as { action?: string; type?: string; col?: number; row?: number; room?: number; item?: string; kind?: string };
  const db = serviceClient();

  // only their own home, with its snapshot bought and the place cleared
  const { data: home } = await db.from('user_home').select('place_id').eq('user_id', user).maybeSingle();
  if (!home) return reply(req, { ok: false, reason: 'no_home' });
  const [{ data: bought }, { data: won }] = await Promise.all([
    db.from('unlocks').select('place_id').eq('user_id', user).like('place_id', `vault:${home.place_id}:%`).limit(1),
    db.from('raid_runs').select('id').eq('user_id', user).eq('place_id', `me:${home.place_id}`).eq('won', true).limit(1),
  ]);
  if (!bought?.length || !won?.length) return reply(req, { ok: false, reason: 'not_cleared' });

  const now = Date.now();
  const { data: row } = await db.from('home_vault').select('state,version').eq('user_id', user).maybeSingle();
  const version = (row?.version as number | undefined) ?? 0;
  const vault = (row?.state as VaultHome | undefined) ?? newVault(now, newSeed());
  if (vault.seed === undefined || vault.seed === 0) vault.seed = newSeed(); // a vault made before recipes existed gets its seed now (saved with the next change)

  let next: VaultHome;
  let spend: LootBag = {};
  switch (b.action) {
    case 'visit': next = checkIn(vault, now); break;
    case 'build': {
      const r = applyBuild(checkIn(vault, now), String(b.type) as never, Number(b.col), Number(b.row), now);
      if (!r.ok) return reply(req, { ok: false, reason: r.reason });
      next = r.vault; spend = r.recipe; break;
    }
    case 'furnish': {
      const r = applyFurnish(checkIn(vault, now), Number(b.room), String(b.item), now);
      if (!r.ok) return reply(req, { ok: false, reason: r.reason });
      next = r.vault; spend = r.recipe; break;
    }
    case 'settler': {
      const r = applySettler(vault, String(b.kind));
      if (!r.ok) return reply(req, { ok: false, reason: r.reason });
      next = r.vault; break;
    }
    default: return reply(req, { error: 'bad_action' }, 400);
  }

  const { data, error } = await db.rpc('vault_commit', { p_user: user, p_state: next, p_cost: spend, p_version: version });
  if (error) return reply(req, { error: 'server' }, 500);
  const res = data as { ok: boolean; version?: number; reason?: string };
  if (!res.ok) return reply(req, { ok: false, reason: res.reason });
  return reply(req, { ok: true, vault: next, version: res.version });
});
