// Stimpaks and Legendary Time. A survivor trades spare loot for them, several at a time, and uses one in the shooting gallery (a stimpak takes back their three
// strikes; Legendary Time slows the enemies for four seconds). The counts change only here.
//
// POST { action: 'trade', item?: 'stimpak' | 'time', trade, qty }  ->  { ok: true, qty } | { ok: false, reason: 'loot' | 'full' }
// POST { action: 'use', item?: 'stimpak' | 'time' }                ->  { ok: true, qty } | { ok: false, reason: 'none' }
// (item is 'stimpak' when it is left out, which is how older copies of the app ask.)
// Deploy: supabase functions deploy stimpak

import { callerId, corsHeaders, reply, serviceClient } from '../_shared/common.ts';
import { offersFor, tradeWindow } from '../_shared/stimpak.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) });
  if (req.method !== 'POST') return reply(req, { error: 'POST only' }, 405);
  const user = await callerId(req);
  if (!user) return reply(req, { error: 'sign_in' }, 401);
  const b = (await req.json().catch(() => ({}))) as { action?: string; item?: string; trade?: string; qty?: number };
  const item = b.item === 'time' ? 'time' : 'stimpak';
  const db = serviceClient();

  if (b.action === 'use') {
    const { data, error } = await db.rpc(item === 'time' ? 'use_time' : 'use_stimpak', { p_user: user });
    return error ? reply(req, { error: 'server' }, 500) : reply(req, data);
  }
  if (b.action === 'trade') {
    // one of the three on the board right now, and only once: it is marked as bought first, and the mark is taken back if the loot is not there
    const win = tradeWindow();
    const trade = offersFor(item, win).find((t) => t.id === b.trade);
    if (!trade) return reply(req, { error: 'bad_trade' }, 400);
    const mark = await db.from('trade_purchases').insert({ user_id: user, item, trade_id: trade.id, window_no: win });
    if (mark.error) return mark.error.code === '23505' ? reply(req, { ok: false, reason: 'bought' }) : reply(req, { error: 'server' }, 500);
    const { data, error } = await db.rpc('trade_item', { p_user: user, p_item: item, p_cost: trade.cost, p_qty: 1 });
    if (error || !(data as { ok?: boolean })?.ok) await db.from('trade_purchases').delete().eq('user_id', user).eq('item', item).eq('trade_id', trade.id).eq('window_no', win);
    return error ? reply(req, { error: 'server' }, 500) : reply(req, data);
  }
  return reply(req, { error: 'bad_action' }, 400);
});
