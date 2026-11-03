// A person reached a place on foot (the app saw their GPS within reach of it). Records it once with the points it is worth (clamped to 1-100), and
// each new level reached earns a free snapshot credit (at most 2 a day; see the levels migration). The place and the person's position are checked to be close to each other, which stops casual cheating; it cannot
// stop someone determined to fake a GPS, which is why the daily limit exists.
//
// Deploy: supabase functions deploy report-discovery

import { callerId, corsHeaders, reply, serviceClient } from '../_shared/common.ts';

const REACH_METERS = 500;

function meters(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const r = 6_371_000;
  const rad = (d: number) => (d * Math.PI) / 180;
  const h = Math.sin(rad(bLat - aLat) / 2) ** 2 + Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(rad(bLng - aLng) / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(h));
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) });
  if (req.method !== 'POST') return reply(req, { error: 'POST only' }, 405);

  const user = await callerId(req);
  if (!user) return reply(req, { error: 'sign_in' }, 401);

  const b = (await req.json().catch(() => ({}))) as { placeId?: string; lat?: number; lng?: number; userLat?: number; userLng?: number; points?: number };
  const atlas = typeof b.placeId === 'string' && /^me:[A-Za-z0-9_-]{6,120}$/.test(b.placeId);
  if (!b.placeId || !(atlas || /^(wd:Q\d+|vault:\d+|famous:[a-z0-9-]+|lore:[a-z0-9-]+)$/.test(b.placeId))) return reply(req, { error: 'bad_place' }, 400);
  // an address from the atlas of a city they bought: somebody else's address, worth 1 point, at the position the server has for it
  if (atlas) {
    const db = serviceClient();
    const { data: render } = await db.from('address_renders').select('metro_id,lat,lng,created_by').eq('place_id', b.placeId!.slice(3)).eq('status', 'ready').maybeSingle();
    if (!render || render.created_by === user) return reply(req, { error: 'not_atlas' }, 400);
    const { data: has } = await db.from('metro_unlocks').select('metro_id').eq('user_id', user).eq('metro_id', render.metro_id).maybeSingle();
    if (!has) return reply(req, { error: 'not_atlas' }, 403);
    b.lat = render.lat as number;
    b.lng = render.lng as number;
    b.points = 1;
  }
  const nums = [b.lat, b.lng, b.userLat, b.userLng];
  if (nums.some((n) => typeof n !== 'number' || !Number.isFinite(n))) return reply(req, { error: 'bad_position' }, 400);
  if (meters(b.lat as number, b.lng as number, b.userLat as number, b.userLng as number) > REACH_METERS) return reply(req, { error: 'too_far' }, 400);

  const points = Math.max(1, Math.min(100, Math.round(Number(b.points) || 10)));
  let { data, error } = await serviceClient().rpc('record_discovery', { p_user: user, p_place: b.placeId, p_points: points });
  // the levels migration has not been run yet: the older two-argument function still counts the place
  if (error) ({ data, error } = await serviceClient().rpc('record_discovery', { p_user: user, p_place: b.placeId }));
  if (error) return reply(req, { error: 'server' }, 500);
  return reply(req, data);
});
