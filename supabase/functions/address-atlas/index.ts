// The address atlas by metro: every address anyone has unlocked a street snapshot for. 48 credits unlock all of the rendered addresses in one metro
// (and the ones rendered there later); another metro is another 48.
//
// POST { action: 'count', metroId }   ->  { count, unlocked }       (how many are rendered there, and whether this person has the metro)
// POST { action: 'unlock', metroId }  ->  { ok, charged }           (48 credits)
// POST { action: 'list', metroId }    ->  { places: [{ placeId, name, address, lat, lng, kind }] }   (only for a metro they have unlocked)
// Deploy: supabase functions deploy address-atlas

import { callerId, corsHeaders, reply, serviceClient } from '../_shared/common.ts';

const METRO_COST = 48;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) });
  if (req.method !== 'POST') return reply(req, { error: 'POST only' }, 405);
  const user = await callerId(req);
  if (!user) return reply(req, { error: 'sign_in' }, 401);

  const { action, metroId } = (await req.json().catch(() => ({}))) as { action?: string; metroId?: string };
  if (!metroId || !/^[a-z0-9-]{3,80}$/.test(metroId)) return reply(req, { error: 'bad_metro' }, 400);
  const db = serviceClient();
  const { data: has } = await db.from('metro_unlocks').select('metro_id').eq('user_id', user).eq('metro_id', metroId).maybeSingle();

  if (action === 'count') {
    const { count } = await db.from('address_renders').select('place_id', { count: 'exact', head: true }).eq('metro_id', metroId).eq('status', 'ready');
    return reply(req, { count: count ?? 0, unlocked: !!has });
  }

  if (action === 'unlock') {
    const { data: spent, error } = await db.rpc('unlock_metro', { p_user: user, p_metro: metroId, p_cost: METRO_COST });
    if (error) return reply(req, { error: 'server' }, 500);
    if (spent === 'no_credits') return reply(req, { error: 'no_credits' }, 402);
    return reply(req, { ok: true, charged: spent === 'spent' });
  }

  if (action === 'list') {
    if (!has) return reply(req, { error: 'locked' }, 403);
    const { data } = await db.from('address_renders').select('place_id,name,address,lat,lng,kind').eq('metro_id', metroId).eq('status', 'ready').limit(2000);
    return reply(req, { places: (data ?? []).map((r) => ({ placeId: r.place_id, name: r.name, address: r.address, lat: r.lat, lng: r.lng, kind: r.kind })) });
  }

  return reply(req, { error: 'bad_action' }, 400);
});
