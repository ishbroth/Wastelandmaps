// Unlocks one place's game-style render for the signed-in person (one credit, once) and returns a short-lived link to the image.
//
// The first person to unlock a place makes the render happen: the freely licensed Wikimedia photo of the place is sent to Google's image
// model, and the result is stored. Everyone after that is shown the stored image, and spends their own credit.
//
// Calling it again for a place already unlocked costs nothing: that is how the app asks "is it ready yet?" and how it shows an unlocked render
// the next time. If the render cannot be made, the credit is given back.
//
// Secrets: GEMINI_API_KEY.  Optional: GEMINI_MODEL (default gemini-3-pro-image), DAILY_RENDER_CAP (default 1000 new renders a day).
// Deploy: supabase functions deploy unlock-render

import { callerId, corsHeaders, reply, serviceClient, dailyRenderCap, nextRenderReset } from '../_shared/common.ts';
import { renderPrompt } from '../_shared/renderPrompt.ts';
import { findPhotoFor } from '../_shared/photoSources.ts';
import { streetPrompt } from '../_shared/streetPrompt.ts';

const UA = { 'User-Agent': 'WastelandMaps/1.0 (https://wastelandmaps.com; fan project)' };
const STALE_AFTER_MS = 150_000; // a render "being made" for longer than this is taken to have been abandoned

interface Photo { bytes: Uint8Array; mime: string; title: string; author: string; license: string; page: string }

/** The photo for a place (Wikidata's picture, Wikipedia's, Wikimedia Commons, Openverse: see _shared/photoSources.ts), downloaded. Null if there is none that may be used. */
async function fetchPhoto(entity: string, name: string): Promise<Photo | null> {
  const hit = await findPhotoFor({ entityId: entity, name }, UA);
  if (!hit) return null;
  const image = await fetch(hit.imageUrl, { headers: UA });
  const mime = (image.headers.get('content-type') ?? '').split(';')[0];
  if (!image.ok || !/^image\/(jpeg|png)$/.test(mime)) return null;
  const bytes = new Uint8Array(await image.arrayBuffer());
  if (bytes.length > 12_000_000) return null;
  return { bytes, mime, title: hit.title, author: hit.author, license: hit.license, page: hit.pageUrl };
}

// ---- the last resort: a place with no freely licensed photo can be made from Google Street View instead (it costs more, and only where Street View covers the spot) ----
const STREET_COST = 4;
const kindFor = (category?: string): string => (category === 'chapel' ? 'church' : category === 'medical' ? 'medical' : category === 'guard' ? 'gov' : category === 'park' ? 'park' : 'office');

function bearing(from: { lat: number; lng: number }, to: { lat: number; lng: number }): number {
  const r = Math.PI / 180;
  const y = Math.sin((to.lng - from.lng) * r) * Math.cos(to.lat * r);
  const x = Math.cos(from.lat * r) * Math.sin(to.lat * r) - Math.sin(from.lat * r) * Math.cos(to.lat * r) * Math.cos((to.lng - from.lng) * r);
  return (Math.atan2(y, x) / r + 360) % 360;
}

/** A Street View picture looking at the spot from the nearest street, or null where Google has none. */
async function streetPhoto(lat: number, lng: number): Promise<Photo | null> {
  const key = Deno.env.get('STREETVIEW_API_KEY');
  if (!key) return null;
  const meta = await (await fetch(`https://maps.googleapis.com/maps/api/streetview/metadata?${new URLSearchParams({ location: `${lat},${lng}`, radius: '60', source: 'outdoor', key })}`)).json();
  if (meta.status !== 'OK' || !meta.location) return null;
  const heading = Math.round(bearing({ lat: meta.location.lat, lng: meta.location.lng }, { lat, lng }));
  const res = await fetch(`https://maps.googleapis.com/maps/api/streetview?${new URLSearchParams({ size: '640x640', location: `${meta.location.lat},${meta.location.lng}`, heading: String(heading), pitch: '6', fov: '90', source: 'outdoor', return_error_codes: 'true', key })}`);
  if (!res.ok) return null;
  return { bytes: new Uint8Array(await res.arrayBuffer()), mime: res.headers.get('content-type') ?? 'image/jpeg', title: 'Google Street View', author: 'Google', license: 'Google Street View (used to make this picture)', page: 'https://www.google.com/streetview/' };
}

async function generateFromStreet(photo: Photo, name: string, category: string | undefined, flooded: boolean, irradiated: boolean): Promise<Uint8Array> {
  const key = Deno.env.get('GEMINI_API_KEY');
  if (!key) throw new Error('image generation is not set up');
  const model = Deno.env.get('GEMINI_MODEL') ?? 'gemini-3-pro-image';
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: streetPrompt(kindFor(category), name, undefined, flooded, irradiated) }, { inline_data: { mime_type: photo.mime, data: toBase64(photo.bytes) } }] }], generationConfig: { responseModalities: ['TEXT', 'IMAGE'] } }),
  });
  if (!res.ok) throw new Error(`image model said ${res.status}`);
  const body = await res.json();
  const part = (body.candidates?.[0]?.content?.parts ?? []).find((p: any) => p.inlineData?.data || p.inline_data?.data);
  const b64: string | undefined = part?.inlineData?.data ?? part?.inline_data?.data;
  if (!b64) throw new Error('the image model returned no image');
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

async function generate(photo: Photo, name: string, entity: string, flooded: boolean, irradiated: boolean, vaultNumber?: number, category?: string): Promise<Uint8Array> {
  const key = Deno.env.get('GEMINI_API_KEY');
  if (!key) throw new Error('image generation is not set up');
  const model = Deno.env.get('GEMINI_MODEL') ?? 'gemini-3-pro-image';
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: renderPrompt(name, entity, flooded, irradiated, vaultNumber, category) }, { inline_data: { mime_type: photo.mime, data: toBase64(photo.bytes) } }] }],
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

  const { placeId, name, flooded, irradiated, vault, category, streetView, lat, lng } = (await req.json().catch(() => ({}))) as { placeId?: string; name?: string; flooded?: boolean; irradiated?: boolean; vault?: number; category?: string; streetView?: boolean; lat?: number; lng?: number };
  // what kind of place it is (a park has no building to put the vault door in)
  const kindOf = typeof category === 'string' && /^[a-z]{2,20}$/.test(category) ? category : undefined;
  // a place that is the entrance to a vault: its picture has the vault door in it (the number is the vault's)
  const vaultNum = Number.isInteger(vault) && (vault as number) >= 1 && (vault as number) <= 999 ? (vault as number) : null;
  // a Wikidata place, or the one second-tier landmark whose render was supplied (see the renders row for it)
  if (!placeId || !/^(wd:Q\d+|famous:east-county-courthouse-el-cajon-)$/.test(placeId)) return reply(req, { error: 'bad_place' }, 400);
  const entity = placeId.slice(3);
  const placeName = (name ?? '').slice(0, 120);
  const db = serviceClient();

  // a place with no photo may ask to be made from Street View: that costs more, and only if nobody has made it yet (if it is made, everyone pays the usual one credit)
  let useStreet = false;
  if (streetView === true && typeof lat === 'number' && typeof lng === 'number' && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
    const { data: pre } = await db.from('renders').select('status').eq('place_id', placeId).maybeSingle();
    useStreet = pre?.status !== 'ready';
  }
  // 1. the credit (nothing is charged if this person already unlocked the place)
  const { data: spent, error: spendError } = useStreet
    ? await db.rpc('unlock_personal', { p_user: user, p_place: placeId, p_cost: STREET_COST })
    : await db.rpc('unlock_place', { p_user: user, p_place: placeId });
  if (spendError) return reply(req, { error: 'server' }, 500);
  if (spent === 'no_credits') return reply(req, { error: 'no_credits' }, 402);
  const charged = spent === 'spent';
  // If the render cannot be delivered, this person's unlock is undone and the credit returned (also when they paid on an earlier try that failed).
  const giveBack = async () => { if (useStreet && charged) await db.rpc('refund_personal', { p_user: user, p_place: placeId, p_cost: STREET_COST }); else await db.rpc('refund_unlock', { p_user: user, p_place: placeId }); };

  try {
    // 2. is the render already made, or being made?
    const { data: existing } = await db.from('renders').select('*').eq('place_id', placeId).maybeSingle();
    let row = existing;

    if (row?.status === 'generating' && Date.now() - new Date(row.started_at).getTime() < STALE_AFTER_MS) {
      return reply(req, { status: 'working' });
    }

    // a render made before this place became a vault entrance (or after it stopped being one) has the wrong picture: it is made again, once, for everyone
    const before = row;
    const stale = row?.status === 'ready' && ((row.vault_number as number | null) ?? null) !== vaultNum;
    if (row?.status !== 'ready' || stale) {
      // 3. make it. First, the daily cap on new renders, so one bad day cannot run up a bill.
      const cap = dailyRenderCap();
      const since = new Date(); since.setUTCHours(0, 0, 0, 0);
      const { count } = await db.from('renders').select('place_id', { count: 'exact', head: true }).gte('started_at', since.toISOString());
      if ((count ?? 0) >= cap) {
        if (stale) { /* the old picture is shown for today */ } else { await giveBack(); return reply(req, { error: 'busy', resetsAt: nextRenderReset() }, 503); }
      } else {
        // claim it, so two people unlocking the same place at once make one render, not two
        const now = new Date().toISOString();
        const claim = row
          ? await db.from('renders').update({ status: 'generating', started_at: now }).eq('place_id', placeId).eq('status', row.status).eq('started_at', row.started_at).select()
          : await db.from('renders').insert({ place_id: placeId, status: 'generating', place_name: placeName, started_at: now }).select();
        if (claim.error || !claim.data || claim.data.length === 0) return reply(req, { status: 'working' }); // someone else just claimed it
        // a picture that was already made stays as it was if the new one cannot be
        const keepOld = async () => { await db.from('renders').update({ status: 'ready', started_at: (before as { started_at: string }).started_at }).eq('place_id', placeId); row = before; };

        const photo = useStreet ? await streetPhoto(lat as number, lng as number).catch(() => null) : await fetchPhoto(entity, placeName).catch(() => null);
        if (!photo) {
          if (stale) await keepOld();
          else { await db.from('renders').delete().eq('place_id', placeId); await giveBack(); return reply(req, { error: 'no_photo' }, 404); }
        } else {
          try {
            const png = useStreet ? await generateFromStreet(photo, placeName, kindOf, flooded === true, irradiated === true) : await generate(photo, placeName, entity, flooded === true, irradiated === true, vaultNum ?? undefined, kindOf);
            const path = `${entity}.png`;
            const up = await db.storage.from('renders').upload(path, png, { contentType: 'image/png', upsert: true });
            if (up.error) throw new Error('could not store the image');
            // the render is part of the public atlas: a copy goes where its page can show it
            await db.storage.from('public-renders').upload(`wd/${entity}.png`, png, { contentType: 'image/png', upsert: true }).catch(() => null);
            const done = await db.from('renders').update({
              status: 'ready', storage_path: path, place_name: placeName, photo_title: photo.title, photo_author: photo.author,
              photo_license: photo.license, photo_page: photo.page, created_at: new Date().toISOString(), vault_number: vaultNum,
            }).eq('place_id', placeId).select().single();
            row = done.data;
          } catch (e) {
            console.error('render failed', placeId, e instanceof Error ? e.message : e);
            if (stale) await keepOld();
            else { await db.from('renders').update({ status: 'failed' }).eq('place_id', placeId); await giveBack(); return reply(req, { error: 'failed' }, 502); }
          }
        }
      }
    }

    // 4. a link that works for an hour
    const signed = await db.storage.from('renders').createSignedUrl(row.storage_path, 3600);
    if (signed.error || !signed.data) { await giveBack(); return reply(req, { error: 'server' }, 500); }
    return reply(req, {
      status: 'ready',
      url: signed.data.signedUrl,
      credit: { photo: row.photo_title, author: row.photo_author, license: row.photo_license, page: row.photo_page },
      charged,
    });
  } catch (e) {
    await giveBack();
    console.error('unlock failed', placeId, e instanceof Error ? e.message : e);
    return reply(req, { error: 'server' }, 500);
  }
});
