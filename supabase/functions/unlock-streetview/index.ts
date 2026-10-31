// A street-level snapshot of a person's own place (an address they travelled to): 4 credits, once. The credits are taken FIRST; only then is Street View
// asked for anything and the image model run. If there turns out to be no usable Street View picture, or the render fails, the credits are returned.
//
// The Street View picture is used once to make the render and is not stored: only the finished render is kept, in the person's own folder, and shown only to them.
//
// POST { placeId: 'me:<google place id>' }  ->  { status: 'ready', url } | { status: 'working' } | { error }
// Secrets: GEMINI_API_KEY, STREETVIEW_API_KEY (a Google key with the "Street View Static API" switched on).  Optional: GEMINI_MODEL, DAILY_RENDER_CAP.
// Deploy: supabase functions deploy unlock-streetview

import { callerId, corsHeaders, reply, serviceClient } from '../_shared/common.ts';
import { streetPrompt } from '../_shared/streetPrompt.ts';

const COST = 4;
const STALE_AFTER_MS = 150_000;

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

/** The compass heading (0-360) from one point to another, so the camera looks at the address from where the street picture was taken. */
function bearing(from: { lat: number; lng: number }, to: { lat: number; lng: number }): number {
  const r = Math.PI / 180;
  const y = Math.sin((to.lng - from.lng) * r) * Math.cos(to.lat * r);
  const x = Math.cos(from.lat * r) * Math.sin(to.lat * r) - Math.sin(from.lat * r) * Math.cos(to.lat * r) * Math.cos((to.lng - from.lng) * r);
  return (Math.atan2(y, x) / r + 360) % 360;
}

async function streetPicture(lat: number, lng: number): Promise<{ bytes: Uint8Array; mime: string } | null> {
  const key = Deno.env.get('STREETVIEW_API_KEY');
  if (!key) throw new Error('street view is not set up');
  const meta = await (await fetch(`https://maps.googleapis.com/maps/api/streetview/metadata?${new URLSearchParams({ location: `${lat},${lng}`, radius: '60', source: 'outdoor', key })}`)).json();
  if (meta.status !== 'OK' || !meta.location) return null;
  const heading = Math.round(bearing({ lat: meta.location.lat, lng: meta.location.lng }, { lat, lng }));
  const res = await fetch(`https://maps.googleapis.com/maps/api/streetview?${new URLSearchParams({
    size: '640x640', location: `${meta.location.lat},${meta.location.lng}`, heading: String(heading), pitch: '6', fov: '90', source: 'outdoor', return_error_codes: 'true', key,
  })}`);
  if (!res.ok) return null;
  return { bytes: new Uint8Array(await res.arrayBuffer()), mime: res.headers.get('content-type') ?? 'image/jpeg' };
}

async function generate(picture: { bytes: Uint8Array; mime: string }, kind: string, name: string): Promise<Uint8Array> {
  const key = Deno.env.get('GEMINI_API_KEY');
  if (!key) throw new Error('image generation is not set up');
  const model = Deno.env.get('GEMINI_MODEL') ?? 'gemini-3-pro-image';
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: streetPrompt(kind, name) }, { inline_data: { mime_type: picture.mime, data: toBase64(picture.bytes) } }] }],
      generationConfig: { responseModalities: ['TEXT', 'IMAGE'] },
    }),
  });
  if (!res.ok) throw new Error(`image model said ${res.status}`);
  const body = await res.json();
  const part = (body.candidates?.[0]?.content?.parts ?? []).find((p: any) => p.inlineData?.data || p.inline_data?.data);
  const b64: string | undefined = part?.inlineData?.data ?? part?.inline_data?.data;
  if (!b64) throw new Error('the image model returned no image');
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) });
  if (req.method !== 'POST') return reply(req, { error: 'POST only' }, 405);
  const user = await callerId(req);
  if (!user) return reply(req, { error: 'sign_in' }, 401);

  const { placeId } = (await req.json().catch(() => ({}))) as { placeId?: string };
  if (!placeId || !/^me:[A-Za-z0-9_-]{10,200}$/.test(placeId)) return reply(req, { error: 'bad_place' }, 400);
  const googleId = placeId.slice(3);
  const db = serviceClient();

  // the place has to be one of theirs; where it is comes from our own record, never from the browser
  const { data: mine } = await db.from('personal_places').select('name,lat,lng,kind').eq('user_id', user).eq('place_id', googleId).maybeSingle();
  if (!mine) return reply(req, { error: 'unknown_place' }, 404);

  const { data: existing } = await db.from('personal_renders').select('*').eq('user_id', user).eq('place_id', googleId).maybeSingle();
  const signed = async (path: string) => {
    const s = await db.storage.from('renders').createSignedUrl(path, 3600);
    return s.error || !s.data ? null : s.data.signedUrl;
  };
  if (existing?.status === 'ready' && existing.storage_path) {
    const url = await signed(existing.storage_path as string);
    if (url) return reply(req, { status: 'ready', url, charged: false });
  }
  if (existing?.status === 'generating' && Date.now() - new Date(existing.started_at as string).getTime() < STALE_AFTER_MS) return reply(req, { status: 'working' });

  // 1. the credits, before anything else is asked of Google
  const { data: spent, error: spendError } = await db.rpc('unlock_personal', { p_user: user, p_place: placeId, p_cost: COST });
  if (spendError) return reply(req, { error: 'server' }, 500);
  if (spent === 'no_credits') return reply(req, { error: 'no_credits' }, 402);
  const giveBack = async () => { await db.rpc('refund_personal', { p_user: user, p_place: placeId, p_cost: COST }); };

  try {
    // a daily cap on new renders (shared with the landmark ones), so one bad day cannot run up a bill
    const cap = Number(Deno.env.get('DAILY_RENDER_CAP') ?? '150');
    const since = new Date(); since.setUTCHours(0, 0, 0, 0);
    const [a, b] = await Promise.all([
      db.from('renders').select('place_id', { count: 'exact', head: true }).gte('started_at', since.toISOString()),
      db.from('personal_renders').select('place_id', { count: 'exact', head: true }).gte('started_at', since.toISOString()),
    ]);
    if ((a.count ?? 0) + (b.count ?? 0) >= cap) { await giveBack(); return reply(req, { error: 'busy' }, 503); }

    const now = new Date().toISOString();
    const claim = existing
      ? await db.from('personal_renders').update({ status: 'generating', started_at: now }).eq('user_id', user).eq('place_id', googleId).eq('started_at', existing.started_at).select()
      : await db.from('personal_renders').insert({ user_id: user, place_id: googleId, status: 'generating', started_at: now }).select();
    if (claim.error || !claim.data || claim.data.length === 0) return reply(req, { status: 'working' });

    // 2. only now Street View
    const picture = await streetPicture(mine.lat as number, mine.lng as number);
    if (!picture) {
      await db.from('personal_renders').delete().eq('user_id', user).eq('place_id', googleId);
      await giveBack();
      return reply(req, { error: 'no_streetview' }, 404);
    }
    const png = await generate(picture, mine.kind as string, mine.name as string);
    const path = `personal/${user}/${googleId}.png`;
    const up = await db.storage.from('renders').upload(path, png, { contentType: 'image/png', upsert: true });
    if (up.error) throw new Error('could not store the image');
    await db.from('personal_renders').update({ status: 'ready', storage_path: path, created_at: new Date().toISOString() }).eq('user_id', user).eq('place_id', googleId);
    const url = await signed(path);
    if (!url) throw new Error('no link');
    return reply(req, { status: 'ready', url, charged: spent === 'spent' });
  } catch (e) {
    await db.from('personal_renders').update({ status: 'failed' }).eq('user_id', user).eq('place_id', googleId);
    await giveBack();
    console.error('street snapshot failed', placeId, e instanceof Error ? e.message : e);
    return reply(req, { error: 'failed' }, 502);
  }
});
