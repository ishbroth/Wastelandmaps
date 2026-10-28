// Unlocks one place's game-style render for the signed-in person (one credit, once) and returns a short-lived link to the image.
//
// The first person to unlock a place makes the render happen: the freely licensed Wikimedia photo of the place is sent to Google's image
// model, and the result is stored. Everyone after that is shown the stored image, and spends their own credit.
//
// Calling it again for a place already unlocked costs nothing: that is how the app asks "is it ready yet?" and how it shows an unlocked render
// the next time. If the render cannot be made, the credit is given back.
//
// Secrets: GEMINI_API_KEY.  Optional: GEMINI_MODEL (default gemini-3.1-flash-lite-image), DAILY_RENDER_CAP (default 150 new renders a day).
// Deploy: supabase functions deploy unlock-render

import { callerId, corsHeaders, reply, serviceClient } from '../_shared/common.ts';

const UA = { 'User-Agent': 'WastelandMaps/1.0 (https://wastelandmaps.com; fan project)' };
const ALLOWED_LICENSE = /^(CC BY(?!-NC)(?!-ND)|CC BY-SA(?!-NC)|CC0|Public domain|PD)/i;
const STALE_AFTER_MS = 150_000; // a render "being made" for longer than this is taken to have been abandoned

const PROMPT = (name: string) => `Re-render this photograph as a scene from a modern open-world post-apocalyptic video game, in the visual style of Fallout 4 gameplay: the same landmark${name ? ` (${name})` : ''}, from the same angle and framing, recognizable and in the same position, but two hundred years after a nuclear war. Heavily weathered and partly collapsed: broken windows, rusted and peeling surfaces, fallen debris and rubble, cracked ground with dead weeds and scrub, abandoned rusted cars, overgrown patches of vines. A hazy dusty sky in sickly orange-green with heavy clouds and a low sun, soft volumetric light, warm highlights and teal shadows, slightly desaturated colors, painterly realistic game-engine look, subtle film grain. Remove all modern people, boats, flags, cranes and signs. No text, no logos, no UI.`;

const stripHtml = (s: string) => s.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();

interface Photo { bytes: Uint8Array; mime: string; title: string; author: string; license: string; page: string }

/** The photo Wikidata lists for a place, if it is freely licensed. */
async function wikidataPhoto(entity: string): Promise<Photo | null> {
  const claims = await (await fetch(`https://www.wikidata.org/w/api.php?${new URLSearchParams({ action: 'wbgetclaims', entity, property: 'P18', format: 'json' })}`, { headers: UA })).json();
  const file: string | undefined = claims.claims?.P18?.[0]?.mainsnak?.datavalue?.value;
  if (!file) return null;
  const data = await (await fetch(`https://commons.wikimedia.org/w/api.php?${new URLSearchParams({
    action: 'query', format: 'json', titles: `File:${file}`, prop: 'imageinfo', iiprop: 'url|extmetadata|mime', iiurlwidth: '1280',
  })}`, { headers: UA })).json();
  const info = (Object.values(data.query?.pages ?? {}) as { imageinfo?: Record<string, any>[] }[])[0]?.imageinfo?.[0];
  if (!info?.thumburl || !/^image\/(jpeg|png)$/.test(info.mime ?? '')) return null;
  const license = stripHtml(info.extmetadata?.LicenseShortName?.value ?? '');
  if (!ALLOWED_LICENSE.test(license)) return null;
  const image = await fetch(info.thumburl, { headers: UA });
  if (!image.ok) return null;
  return {
    bytes: new Uint8Array(await image.arrayBuffer()),
    mime: info.mime,
    title: stripHtml(file.replace(/\.[a-z]+$/i, '')),
    author: stripHtml(info.extmetadata?.Artist?.value ?? 'Unknown photographer'),
    license,
    page: info.descriptionurl ?? 'https://commons.wikimedia.org',
  };
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

async function generate(photo: Photo, name: string): Promise<Uint8Array> {
  const key = Deno.env.get('GEMINI_API_KEY');
  if (!key) throw new Error('image generation is not set up');
  const model = Deno.env.get('GEMINI_MODEL') ?? 'gemini-3.1-flash-lite-image';
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: PROMPT(name) }, { inline_data: { mime_type: photo.mime, data: toBase64(photo.bytes) } }] }],
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

  const { placeId, name } = (await req.json().catch(() => ({}))) as { placeId?: string; name?: string };
  if (!placeId || !/^wd:Q\d+$/.test(placeId)) return reply(req, { error: 'bad_place' }, 400);
  const entity = placeId.slice(3);
  const placeName = (name ?? '').slice(0, 120);
  const db = serviceClient();

  // 1. the credit (nothing is charged if this person already unlocked the place)
  const { data: spent, error: spendError } = await db.rpc('unlock_place', { p_user: user, p_place: placeId });
  if (spendError) return reply(req, { error: 'server' }, 500);
  if (spent === 'no_credits') return reply(req, { error: 'no_credits' }, 402);
  const charged = spent === 'spent';
  // If the render cannot be delivered, this person's unlock is undone and the credit returned (also when they paid on an earlier try that failed).
  const giveBack = async () => { await db.rpc('refund_unlock', { p_user: user, p_place: placeId }); };

  try {
    // 2. is the render already made, or being made?
    const { data: existing } = await db.from('renders').select('*').eq('place_id', placeId).maybeSingle();
    let row = existing;

    if (row?.status === 'generating' && Date.now() - new Date(row.started_at).getTime() < STALE_AFTER_MS) {
      return reply(req, { status: 'working' });
    }

    if (row?.status !== 'ready') {
      // 3. make it. First, the daily cap on new renders, so one bad day cannot run up a bill.
      const cap = Number(Deno.env.get('DAILY_RENDER_CAP') ?? '150');
      const since = new Date(); since.setUTCHours(0, 0, 0, 0);
      const { count } = await db.from('renders').select('place_id', { count: 'exact', head: true }).gte('started_at', since.toISOString());
      if ((count ?? 0) >= cap) { await giveBack(); return reply(req, { error: 'busy' }, 503); }

      // claim it, so two people unlocking the same place at once make one render, not two
      const now = new Date().toISOString();
      const claim = row
        ? await db.from('renders').update({ status: 'generating', started_at: now }).eq('place_id', placeId).eq('status', row.status).eq('started_at', row.started_at).select()
        : await db.from('renders').insert({ place_id: placeId, status: 'generating', place_name: placeName, started_at: now }).select();
      if (claim.error || !claim.data || claim.data.length === 0) return reply(req, { status: 'working' }); // someone else just claimed it

      const photo = await wikidataPhoto(entity);
      if (!photo) {
        await db.from('renders').delete().eq('place_id', placeId);
        await giveBack();
        return reply(req, { error: 'no_photo' }, 404);
      }
      try {
        const png = await generate(photo, placeName);
        const path = `${entity}.png`;
        const up = await db.storage.from('renders').upload(path, png, { contentType: 'image/png', upsert: true });
        if (up.error) throw new Error('could not store the image');
        const done = await db.from('renders').update({
          status: 'ready', storage_path: path, place_name: placeName, photo_title: photo.title, photo_author: photo.author,
          photo_license: photo.license, photo_page: photo.page, created_at: new Date().toISOString(),
        }).eq('place_id', placeId).select().single();
        row = done.data;
      } catch (e) {
        await db.from('renders').update({ status: 'failed' }).eq('place_id', placeId);
        await giveBack();
        console.error('render failed', placeId, e instanceof Error ? e.message : e);
        return reply(req, { error: 'failed' }, 502);
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
