// A person reached a place on foot (the app saw their GPS within reach of it). Records it once, and every 10th discovery earns a free snapshot
// credit (at most 2 a day). The place and the person's position are checked to be close to each other, which stops casual cheating; it cannot
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

  const b = (await req.json().catch(() => ({}))) as { placeId?: string; lat?: number; lng?: number; userLat?: number; userLng?: number };
  if (!b.placeId || !/^(wd:Q\d+|vault:\d+)$/.test(b.placeId)) return reply(req, { error: 'bad_place' }, 400);
  const nums = [b.lat, b.lng, b.userLat, b.userLng];
  if (nums.some((n) => typeof n !== 'number' || !Number.isFinite(n))) return reply(req, { error: 'bad_position' }, 400);
  if (meters(b.lat as number, b.lng as number, b.userLat as number, b.userLng as number) > REACH_METERS) return reply(req, { error: 'too_far' }, 400);

  const { data, error } = await serviceClient().rpc('record_discovery', { p_user: user, p_place: b.placeId });
  if (error) return reply(req, { error: 'server' }, 500);
  return reply(req, data);
});
