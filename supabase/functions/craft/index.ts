// Builds or upgrades a gun from the survivor's loot. The browser asks for a class ("sniper"); the server works out which tier is next, what it costs, and
// takes the loot and sets the tier in one step (see craft_weapon in the raids migration), so neither can be faked.
//
// POST { class }  ->  { ok: true, tier } or { ok: false, reason: 'tier' | 'loot' | 'maxed' }
// Deploy: supabase functions deploy craft

import { callerId, corsHeaders, reply, serviceClient } from '../_shared/common.ts';
import { WEAPON_CLASSES, type WeaponClass } from '../_shared/arsenal.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) });
  if (req.method !== 'POST') return reply(req, { error: 'POST only' }, 405);

  const user = await callerId(req);
  if (!user) return reply(req, { error: 'sign_in' }, 401);

  const b = (await req.json().catch(() => ({}))) as { class?: string };
  const cls = b.class as WeaponClass;
  if (!cls || !(cls in WEAPON_CLASSES)) return reply(req, { error: 'bad_class' }, 400);

  const db = serviceClient();
  const { data: row } = await db.from('player_weapons').select('tier').eq('user_id', user).eq('weapon_class', cls).maybeSingle();
  const have = (row?.tier as number | undefined) ?? (cls === 'pistol' ? 1 : 0);
  if (have >= 4) return reply(req, { ok: false, reason: 'maxed' });
  const next = have + 1;
  const recipe = WEAPON_CLASSES[cls].tiers[next - 1].recipe;

  const { data, error } = await db.rpc('craft_weapon', { p_user: user, p_class: cls, p_tier: next, p_cost: recipe });
  if (error) return reply(req, { error: 'server' }, 500);
  return reply(req, data);
});
