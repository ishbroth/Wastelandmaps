// Stimpaks. A survivor trades spare loot for them and uses one in the shooting gallery to take back their three strikes. The count changes only here.
//
// POST { action: 'trade', trade }  ->  { ok: true, qty } | { ok: false, reason: 'loot' | 'full' }
// POST { action: 'use' }           ->  { ok: true, qty } | { ok: false, reason: 'none' }
// Deploy: supabase functions deploy stimpak

import { callerId, corsHeaders, reply, serviceClient } from '../_shared/common.ts';
import { STIMPAK_TRADES } from '../_shared/stimpak.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) });
  if (req.method !== 'POST') return reply(req, { error: 'POST only' }, 405);
  const user = await callerId(req);
  if (!user) return reply(req, { error: 'sign_in' }, 401);
  const b = (await req.json().catch(() => ({}))) as { action?: string; trade?: string };
  const db = serviceClient();

  if (b.action === 'use') {
    const { data, error } = await db.rpc('use_stimpak', { p_user: user });
    return error ? reply(req, { error: 'server' }, 500) : reply(req, data);
  }
  if (b.action === 'trade') {
    const trade = STIMPAK_TRADES.find((t) => t.id === b.trade);
    if (!trade) return reply(req, { error: 'bad_trade' }, 400);
    const { data, error } = await db.rpc('trade_stimpak', { p_user: user, p_cost: trade.cost });
    return error ? reply(req, { error: 'server' }, 500) : reply(req, data);
  }
  return reply(req, { error: 'bad_action' }, 400);
});
