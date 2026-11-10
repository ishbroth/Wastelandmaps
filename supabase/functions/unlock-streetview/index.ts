// The address atlas, one address at a time: a street-level snapshot of any address that is not one of the map's landmarks.
//
// The first person to unlock an address makes the render happen: 4 credits, taken FIRST; only then is Street View asked for anything and the image model
// run. The render is kept for good, with the address and where it is, and everyone who unlocks that same address later pays the same 4 credits and is shown
// the same picture (what they find when they loot it differs). A person who has unlocked the whole metro (see address-atlas) sees it for nothing.
// If there is no usable Street View picture, or the render fails, the credits are returned.
//
// The Street View picture is used once to make the render and is not stored: only the finished render is kept.
//
// POST { ..., home: true }  the person's own saved home with their vault door drawn in (see homeFlow); same replies, kept per person
// POST { action: 'check', placeId }                     ->  { exists, owned }          (free)
// POST { action?: 'unlock', placeId, kind?, metroId? }  ->  { status: 'ready', url } | { status: 'working' } | { error }
// Secrets: GEMINI_API_KEY, STREETVIEW_API_KEY (Street View Static API and Places API (New) switched on).  Optional: GEMINI_MODEL, DAILY_RENDER_CAP.
// Deploy: supabase functions deploy unlock-streetview

import { callerId, corsHeaders, reply, serviceClient, dailyRenderCap, nextRenderReset } from '../_shared/common.ts';
import { rubblePrompt, streetPrompt } from '../_shared/streetPrompt.ts';

const COST = 4;
/** A place that cannot be shown as it was (blurred out, or no street picture): only the rubble is rendered, so only this much is kept and the rest is paid back. */
const RUBBLE_COST = 1;
const STALE_AFTER_MS = 150_000;
const KINDS = ['house', 'park', 'office', 'church', 'medical', 'gov'];

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

/** What Google says a place is (its name, address and where it is): the record is made from this, never from what the browser claims. */
async function placeDetails(googleId: string): Promise<{ name: string; address: string; lat: number; lng: number } | null> {
  const key = Deno.env.get('STREETVIEW_API_KEY');
  if (!key) throw new Error('street view is not set up');
  const res = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(googleId)}`, { headers: { 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': 'id,displayName,formattedAddress,location' } });
  if (!res.ok) return null;
  const p = await res.json();
  if (!p.location || typeof p.location.latitude !== 'number') return null;
  const address = String(p.formattedAddress ?? '');
  const line = address.split(',')[0];
  const name = String(p.displayName?.text ?? line ?? 'Address').slice(0, 80) || 'Address';
  return { name, address: address.slice(0, 200), lat: p.location.latitude, lng: p.location.longitude };
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

/** A top-down picture of the place, for the landscape when there is no street picture. */
async function satellitePicture(lat: number, lng: number): Promise<{ bytes: Uint8Array; mime: string } | null> {
  const key = Deno.env.get('STREETVIEW_API_KEY');
  if (!key) return null;
  try {
    const res = await fetch(`https://maps.googleapis.com/maps/api/staticmap?${new URLSearchParams({ center: `${lat},${lng}`, zoom: '19', size: '640x640', maptype: 'satellite', key })}`);
    if (!res.ok) return null;
    const mime = res.headers.get('content-type') ?? '';
    if (!mime.startsWith('image/')) return null;
    return { bytes: new Uint8Array(await res.arrayBuffer()), mime };
  } catch { return null; }
}

/** Is the property in the middle of this street picture hidden behind Google's privacy blur? (If the check cannot be made, it is not.) */
async function looksBlurred(picture: { bytes: Uint8Array; mime: string }): Promise<boolean> {
  const key = Deno.env.get('GEMINI_API_KEY');
  if (!key) return false;
  const model = Deno.env.get('GEMINI_TEXT_MODEL') ?? 'gemini-2.5-flash';
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: 'This is a Google Street View picture looking at one address. Is the main house or building in the middle of the picture hidden behind a privacy blur (a smeared, pixelated or mosaic patch where the property is), as opposed to being merely far away, small, or partly behind trees? Answer with exactly one word: BLURRED or CLEAR.' }, { inline_data: { mime_type: picture.mime, data: toBase64(picture.bytes) } }] }],
        generationConfig: { temperature: 0, maxOutputTokens: 8 },
      }),
    });
    if (!res.ok) return false;
    const body = await res.json();
    const text = String(body.candidates?.[0]?.content?.parts?.[0]?.text ?? '').toUpperCase();
    return text.includes('BLURRED');
  } catch { return false; }
}

/** The aftermath alone: a crater or a heap of burnt rubble on the landscape of the picture (a street picture, or an aerial one, or none at all). */
async function generateRubble(picture: { bytes: Uint8Array; mime: string } | null, aerial: boolean, name: string, seed: string, flooded = false, irradiated = false): Promise<Uint8Array> {
  const key = Deno.env.get('GEMINI_API_KEY');
  if (!key) throw new Error('image generation is not set up');
  const model = Deno.env.get('GEMINI_MODEL') ?? 'gemini-3-pro-image';
  const parts: unknown[] = [{ text: rubblePrompt(name, seed, aerial, flooded, irradiated) }];
  if (picture) parts.push({ inline_data: { mime_type: picture.mime, data: toBase64(picture.bytes) } });
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts }], generationConfig: { responseModalities: ['TEXT', 'IMAGE'] } }),
  });
  if (!res.ok) throw new Error(`image model said ${res.status}`);
  const body = await res.json();
  const part = (body.candidates?.[0]?.content?.parts ?? []).find((p: any) => p.inlineData?.data || p.inline_data?.data);
  const b64: string | undefined = part?.inlineData?.data ?? part?.inline_data?.data;
  if (!b64) throw new Error('the image model returned no image');
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

async function generate(picture: { bytes: Uint8Array; mime: string }, kind: string, name: string, vaultNumber?: string, flooded = false, irradiated = false): Promise<Uint8Array> {
  const key = Deno.env.get('GEMINI_API_KEY');
  if (!key) throw new Error('image generation is not set up');
  const model = Deno.env.get('GEMINI_MODEL') ?? 'gemini-3-pro-image';
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: streetPrompt(kind, name, vaultNumber, flooded, irradiated) }, { inline_data: { mime_type: picture.mime, data: toBase64(picture.bytes) } }] }],
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

// Their own home, blown up with their vault door in it: kept per person (the number on the door is theirs), 4 credits, charged first and refunded on failure.
// Only the home they saved (and its vault number) can be rendered this way: both come from their account, never from the browser.
// deno-lint-ignore no-explicit-any
async function homeFlow(req: Request, db: any, user: string, googleId: string, checkOnly: boolean, flooded: boolean, irradiated: boolean): Promise<Response> {
  const { data: home } = await db.from('user_home').select('place_id,vault_number').eq('user_id', user).maybeSingle();
  if (!home || home.place_id !== googleId || home.vault_number === null || home.vault_number === undefined) return reply(req, { error: 'bad_place' }, 400);
  const number = home.vault_number as number;
  const unlockKey = `vault:${googleId}:${number}`;
  // one picture for each home address the person has had (so going back to an old one finds it), never shared: the number on the door is theirs
  const { data: existing } = await db.from('home_renders').select('*').eq('user_id', user).eq('google_id', googleId).maybeSingle();
  const mine = existing && existing.google_id === googleId && existing.vault_number === number ? existing : null;
  const ready = mine?.status === 'ready' && !!mine.storage_path;
  if (checkOnly) return reply(req, { exists: ready, owned: ready });
  const signed = async (path: string) => {
    const s = await db.storage.from('renders').createSignedUrl(path, 3600);
    return s.error || !s.data ? null : (s.data.signedUrl as string);
  };
  if (ready) {
    const url = await signed(mine.storage_path as string);
    return url ? reply(req, { status: 'ready', url, charged: false }) : reply(req, { error: 'server' }, 500);
  }
  if (mine?.status === 'generating' && Date.now() - new Date(mine.started_at as string).getTime() < STALE_AFTER_MS) return reply(req, { status: 'working' });

  const { data: spent, error: spendError } = await db.rpc('unlock_personal', { p_user: user, p_place: unlockKey, p_cost: COST });
  if (spendError) return reply(req, { error: 'server' }, 500);
  if (spent === 'no_credits') return reply(req, { error: 'no_credits' }, 402);
  const giveBack = async () => { if (spent === 'spent') await db.rpc('refund_personal', { p_user: user, p_place: unlockKey, p_cost: COST }); };
  try {
    let details;
    try { details = await placeDetails(googleId); } catch { await giveBack(); return reply(req, { error: 'server' }, 500); }
    if (!details) { await giveBack(); return reply(req, { error: 'unknown_place' }, 404); }
    const cap = dailyRenderCap();
    const since = new Date(); since.setUTCHours(0, 0, 0, 0);
    const counts = await Promise.all(['renders', 'address_renders', 'home_renders', 'vacation_vault'].map((t) => db.from(t).select('*', { count: 'exact', head: true }).gte('started_at', since.toISOString())));
    if (counts.reduce((n: number, c: { count: number | null }) => n + (c.count ?? 0), 0) >= cap) { await giveBack(); return reply(req, { error: 'busy', resetsAt: nextRenderReset() }, 503); }
    const row = { user_id: user, google_id: googleId, vault_number: number, status: 'generating', storage_path: null, started_at: new Date().toISOString() };
    const claim = existing
      ? await db.from('home_renders').update(row).eq('user_id', user).eq('google_id', googleId).eq('started_at', existing.started_at).select()
      : await db.from('home_renders').insert(row).select();
    if (claim.error || !claim.data || claim.data.length === 0) { await giveBack(); return reply(req, { status: 'working' }); }
    const picture = await streetPicture(details.lat, details.lng);
    if (!picture) {
      await db.from('home_renders').delete().eq('user_id', user).eq('google_id', googleId);
      await giveBack();
      return reply(req, { error: 'no_streetview' }, 404);
    }
    const png = await generate(picture, 'house', details.name, String(number).padStart(4, '0'), flooded, irradiated);
    const path = `home/${user}/${googleId}.png`;
    const up = await db.storage.from('renders').upload(path, png, { contentType: 'image/png', upsert: true });
    if (up.error) throw new Error('could not store the image');
    await db.from('home_renders').update({ status: 'ready', storage_path: path, created_at: new Date().toISOString() }).eq('user_id', user).eq('google_id', googleId);
    const url = await signed(path);
    if (!url) throw new Error('no link');
    return reply(req, { status: 'ready', url, charged: spent === 'spent' });
  } catch (e) {
    await db.from('home_renders').update({ status: 'failed' }).eq('user_id', user).eq('google_id', googleId);
    await giveBack();
    console.error('home render failed', googleId, e instanceof Error ? e.message : e);
    return reply(req, { error: 'failed' }, 502);
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) });
  if (req.method !== 'POST') return reply(req, { error: 'POST only' }, 405);
  const user = await callerId(req);
  if (!user) return reply(req, { error: 'sign_in' }, 401);

  const body = (await req.json().catch(() => ({}))) as { action?: string; placeId?: string; kind?: string; metroId?: string; home?: boolean; flooded?: boolean; irradiated?: boolean };
  if (!body.placeId || !/^me:[A-Za-z0-9_-]{10,200}$/.test(body.placeId)) return reply(req, { error: 'bad_place' }, 400);
  const placeId = body.placeId;
  const googleId = placeId.slice(3);
  const db = serviceClient();
  if (body.home === true) return homeFlow(req, db, user, googleId, body.action === 'check', body.flooded === true, body.irradiated === true);

  const { data: existing } = await db.from('address_renders').select('*').eq('place_id', googleId).maybeSingle();
  const { data: unlocked } = await db.from('unlocks').select('place_id').eq('user_id', user).eq('place_id', placeId).maybeSingle();
  let owned = !!unlocked;
  if (!owned && existing?.metro_id) {
    const { data: wholeMetro } = await db.from('metro_unlocks').select('metro_id').eq('user_id', user).eq('metro_id', existing.metro_id as string).maybeSingle();
    owned = !!wholeMetro;
  }
  const ready = existing?.status === 'ready' && !!existing.storage_path;

  if (body.action === 'check') return reply(req, { exists: ready, owned: ready && owned, rubble: ready && existing?.rubble === true });

  const signed = async (path: string) => {
    const s = await db.storage.from('renders').createSignedUrl(path, 3600);
    return s.error || !s.data ? null : s.data.signedUrl;
  };

  // the render exists already (someone made it): they only pay to unlock it
  if (ready) {
    let charged = false;
    if (!owned) {
      const price = existing!.rubble === true ? RUBBLE_COST : COST;
      const { data: spent, error } = await db.rpc('unlock_personal', { p_user: user, p_place: placeId, p_cost: price });
      if (error) return reply(req, { error: 'server' }, 500);
      if (spent === 'no_credits') return reply(req, { error: 'no_credits' }, 402);
      charged = spent === 'spent';
    }
    const url = await signed(existing!.storage_path as string);
    if (!url) {
      if (charged) await db.rpc('refund_personal', { p_user: user, p_place: placeId, p_cost: existing!.rubble === true ? RUBBLE_COST : COST });
      return reply(req, { error: 'server' }, 500);
    }
    return reply(req, { status: 'ready', url, charged, ...(existing!.rubble === true ? { rubble: true } : {}) });
  }

  if (existing?.status === 'generating' && Date.now() - new Date(existing.started_at as string).getTime() < STALE_AFTER_MS) return reply(req, { status: 'working' });

  // nobody has made it yet: what the place is comes from Google (asked for once the credits are taken), not from the browser
  // one person cannot start more than this many new renders an hour
  const hourAgo = new Date(Date.now() - 3_600_000).toISOString();
  const { count: recent } = await db.from('address_renders').select('place_id', { count: 'exact', head: true }).eq('created_by', user).gte('started_at', hourAgo);
  if ((recent ?? 0) >= 30) return reply(req, { error: 'too_many' }, 429);
  const kind = KINDS.includes(String(body.kind)) ? String(body.kind) : 'house';
  const metro = /^[a-z0-9-]{3,80}$/.test(String(body.metroId ?? '')) ? String(body.metroId) : null;

  // 1. the credits, before anything else is asked of Google
  const { data: spent, error: spendError } = await db.rpc('unlock_personal', { p_user: user, p_place: placeId, p_cost: COST });
  if (spendError) return reply(req, { error: 'server' }, 500);
  if (spent === 'no_credits') return reply(req, { error: 'no_credits' }, 402);
  const giveBack = async () => { await db.rpc('refund_personal', { p_user: user, p_place: placeId, p_cost: COST }); };

  try {
    let details;
    try { details = await placeDetails(googleId); } catch { await giveBack(); return reply(req, { error: 'server' }, 500); }
    if (!details) { await giveBack(); return reply(req, { error: 'unknown_place' }, 404); }
    // a daily cap on new renders (shared with the landmark ones), so one bad day cannot run up a bill
    const cap = dailyRenderCap();
    const since = new Date(); since.setUTCHours(0, 0, 0, 0);
    const [a, b] = await Promise.all([
      db.from('renders').select('place_id', { count: 'exact', head: true }).gte('started_at', since.toISOString()),
      db.from('address_renders').select('place_id', { count: 'exact', head: true }).gte('started_at', since.toISOString()),
    ]);
    if ((a.count ?? 0) + (b.count ?? 0) >= cap) { await giveBack(); return reply(req, { error: 'busy', resetsAt: nextRenderReset() }, 503); }

    const now = new Date().toISOString();
    const row = { name: details.name, address: details.address, lat: details.lat, lng: details.lng, kind, metro_id: metro, status: 'generating', started_at: now, created_by: user };
    const claim = existing
      ? await db.from('address_renders').update(row).eq('place_id', googleId).eq('started_at', existing.started_at).select()
      : await db.from('address_renders').insert({ place_id: googleId, ...row }).select();
    if (claim.error || !claim.data || claim.data.length === 0) { await giveBack(); return reply(req, { status: 'working' }); }

    // 2. only now Street View
    const picture = await streetPicture(details.lat, details.lng);
    // no street picture at all, or the property is blurred out: no pre-war footage, only the aftermath (a crater or a heap of burnt rubble on the landscape)
    const blurred = !!picture && await looksBlurred(picture);
    const rubble = !picture || blurred;
    const png = rubble
      ? await generateRubble(picture ?? await satellitePicture(details.lat, details.lng), !picture, details.name, googleId.slice(-8), body.flooded === true, body.irradiated === true)
      : await generate(picture as { bytes: Uint8Array; mime: string }, kind, details.name, undefined, body.flooded === true, body.irradiated === true);
    const path = `address/${googleId}.png`;
    const up = await db.storage.from('renders').upload(path, png, { contentType: 'image/png', upsert: true });
    if (up.error) throw new Error('could not store the image');
    // a shared address render is part of the public atlas: a copy goes where its page can show it
    await db.storage.from('public-renders').upload(path, png, { contentType: 'image/png', upsert: true }).catch(() => null);
    await db.from('address_renders').update({ status: 'ready', storage_path: path, created_at: new Date().toISOString(), rubble }).eq('place_id', googleId);
    const url = await signed(path);
    if (!url) throw new Error('no link');
    // the rubble is a lesser picture: three of the four credits (300 caps) go back, one stays for the making
    if (rubble && spent === 'spent') await db.rpc('part_refund_personal', { p_user: user, p_place: placeId, p_refund: COST - RUBBLE_COST });
    return reply(req, { status: 'ready', url, charged: spent === 'spent', ...(rubble ? { rubble: true, refunded: COST - RUBBLE_COST } : {}) });
  } catch (e) {
    await db.from('address_renders').update({ status: 'failed' }).eq('place_id', googleId);
    await giveBack();
    console.error('street snapshot failed', placeId, e instanceof Error ? e.message : e);
    return reply(req, { error: 'failed' }, 502);
  }
});
