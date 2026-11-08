// Vacation vaults: a place the person has discovered, far from home, turned into a second (third, fourth, fifth) vault.
//
// With ten or more rooms in the home vault, a person can pick a place they have discovered that is not in their home metro and unlock it for a random mix of
// 8 pieces of loot. The place's picture is made again with a vault door in it (the same image model as the home render), and from then on the map shows it as a
// vault cog with the place's old icon inside, and they can enter it (the vault function, with vault = the place id) and start it with an entryway like the home.
// Up to four of them. The loot is taken only once the picture is made; if it cannot be made nothing is taken. The render counts toward the daily cap.
//
// POST { action: 'check' }                          ->  { vacations: [{ placeId, name, icon, lat, lng }], rooms }    (the person's own, free)
// POST { action: 'url', placeId }                   ->  { url }                                                       (a link to the picture of one of theirs)
// POST { action: 'unlock', placeId, icon }          ->  { status: 'ready', url } | { error }
// Secrets: GEMINI_API_KEY, STREETVIEW_API_KEY.  Optional: GEMINI_MODEL, DAILY_RENDER_CAP.
// Deploy: supabase functions deploy vacation-vault

import { callerId, corsHeaders, reply, serviceClient, dailyRenderCap, nextRenderReset } from '../_shared/common.ts';
import { streetPrompt } from '../_shared/streetPrompt.ts';
import { findPhotoFor } from '../_shared/photoSources.ts';
import { normalize, vacationRecipe, ROOMS_FOR_VACATION, MAX_VACATIONS, type VaultHome } from '../_shared/vaultHome.ts';

const UA = { 'User-Agent': 'WastelandMaps/1.0 (https://wastelandmaps.com; fan project)' };
/** A place this far from home (km) is outside the home metro (metros reach 80 km at most). */
const FAR_KM = 80;

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}
function km(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const r = Math.PI / 180;
  const x = Math.sin(((b.lat - a.lat) * r) / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(((b.lng - a.lng) * r) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(x));
}
function bearing(from: { lat: number; lng: number }, to: { lat: number; lng: number }): number {
  const r = Math.PI / 180;
  const y = Math.sin((to.lng - from.lng) * r) * Math.cos(to.lat * r);
  const x = Math.cos(from.lat * r) * Math.sin(to.lat * r) - Math.sin(from.lat * r) * Math.cos(to.lat * r) * Math.cos((to.lng - from.lng) * r);
  return (Math.atan2(y, x) / r + 360) % 360;
}

interface Picture { bytes: Uint8Array; mime: string }

async function streetPicture(lat: number, lng: number): Promise<Picture | null> {
  const key = Deno.env.get('STREETVIEW_API_KEY');
  if (!key) return null;
  const meta = await (await fetch(`https://maps.googleapis.com/maps/api/streetview/metadata?${new URLSearchParams({ location: `${lat},${lng}`, radius: '80', source: 'outdoor', key })}`)).json();
  if (meta.status !== 'OK' || !meta.location) return null;
  const heading = Math.round(bearing({ lat: meta.location.lat, lng: meta.location.lng }, { lat, lng }));
  const res = await fetch(`https://maps.googleapis.com/maps/api/streetview?${new URLSearchParams({ size: '640x640', location: `${meta.location.lat},${meta.location.lng}`, heading: String(heading), pitch: '6', fov: '90', source: 'outdoor', return_error_codes: 'true', key })}`);
  if (!res.ok) return null;
  return { bytes: new Uint8Array(await res.arrayBuffer()), mime: res.headers.get('content-type') ?? 'image/jpeg' };
}

/** The picture of a place: its freely licensed photo if it is a landmark on Wikidata, otherwise (or if there is none) the street-level view of where it stands. */
async function pictureOf(placeId: string, name: string, lat: number, lng: number): Promise<Picture | null> {
  const entity = /^(?:wd:)?(Q\d+)$/.exec(placeId)?.[1];
  if (entity) {
    try {
      const hit = await findPhotoFor({ entityId: entity, name }, UA);
      if (hit) {
        const image = await fetch(hit.imageUrl, { headers: UA });
        const mime = (image.headers.get('content-type') ?? '').split(';')[0];
        if (image.ok && /^image\/(jpeg|png)$/.test(mime)) {
          const bytes = new Uint8Array(await image.arrayBuffer());
          if (bytes.length <= 12_000_000) return { bytes, mime };
        }
      }
    } catch { /* fall through to the street */ }
  }
  return await streetPicture(lat, lng);
}

async function generate(picture: Picture, name: string, number: string): Promise<Uint8Array> {
  const key = Deno.env.get('GEMINI_API_KEY');
  if (!key) throw new Error('image generation is not set up');
  const model = Deno.env.get('GEMINI_MODEL') ?? 'gemini-3-pro-image';
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: streetPrompt('office', name, number) }, { inline_data: { mime_type: picture.mime, data: toBase64(picture.bytes) } }] }],
      generationConfig: { responseModalities: ['TEXT', 'IMAGE'] },
    }),
  });
  if (!res.ok) throw new Error(`image model said ${res.status}`);
  const body = await res.json();
  // deno-lint-ignore no-explicit-any
  const part = (body.candidates?.[0]?.content?.parts ?? []).find((p: any) => p.inlineData?.data || p.inline_data?.data);
  const b64: string | undefined = part?.inlineData?.data ?? part?.inline_data?.data;
  if (!b64) throw new Error('the image model returned no image');
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

const slug = (id: string) => id.replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 120);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) });
  if (req.method !== 'POST') return reply(req, { error: 'POST only' }, 405);
  const user = await callerId(req);
  if (!user) return reply(req, { error: 'sign_in' }, 401);
  const b = (await req.json().catch(() => ({}))) as { action?: string; placeId?: string; icon?: string };
  const db = serviceClient();
  const signed = async (path: string) => {
    const s = await db.storage.from('renders').createSignedUrl(path, 3600);
    return s.error || !s.data ? null : (s.data.signedUrl as string);
  };

  if (b.action === 'check') {
    const [{ data: rows }, { data: hv }] = await Promise.all([
      db.from('vacation_vault').select('place_id,name,icon,lat,lng').eq('user_id', user).eq('status', 'ready'),
      db.from('home_vault').select('state').eq('user_id', user).eq('vault_key', 'home').maybeSingle(),
    ]);
    const home = hv?.state ? normalize(hv.state as VaultHome) : null;
    return reply(req, { vacations: (rows ?? []).map((r: { place_id: string; name: string; icon: string; lat: number; lng: number }) => ({ placeId: r.place_id, name: r.name, icon: r.icon, lat: r.lat, lng: r.lng })), rooms: home?.rooms.length ?? 0 });
  }

  const placeId = String(b.placeId ?? '');
  if (!/^[A-Za-z0-9:_-]{3,220}$/.test(placeId)) return reply(req, { error: 'bad_place' }, 400);

  if (b.action === 'url') {
    const { data: row } = await db.from('vacation_vault').select('storage_path,status').eq('user_id', user).eq('place_id', placeId).maybeSingle();
    if (!row || row.status !== 'ready' || !row.storage_path) return reply(req, { error: 'not_yours' }, 404);
    const url = await signed(row.storage_path as string);
    return url ? reply(req, { url }) : reply(req, { error: 'server' }, 500);
  }
  if (b.action !== 'unlock') return reply(req, { error: 'bad_action' }, 400);

  const icon = String(b.icon ?? '');
  if (!/^[a-z0-9:_-]{1,60}$/i.test(icon)) return reply(req, { error: 'bad_icon' }, 400);

  // the home vault: ten rooms or more, and where home is
  const [{ data: home }, { data: hv }] = await Promise.all([
    db.from('user_home').select('place_id,vault_number,lat,lng').eq('user_id', user).maybeSingle(),
    db.from('home_vault').select('state').eq('user_id', user).eq('vault_key', 'home').maybeSingle(),
  ]);
  if (!home || home.vault_number === null || home.vault_number === undefined || !hv?.state) return reply(req, { error: 'no_home' }, 400);
  const homeVault = normalize(hv.state as VaultHome);
  if (homeVault.rooms.length < ROOMS_FOR_VACATION) return reply(req, { error: 'too_few_rooms' }, 403);

  // a place they have found (the server's own record of it: where it is and what it is called), well outside the home metro
  let { data: found } = await db.from('found_places').select('name,lat,lng').eq('user_id', user).eq('place_id', placeId).maybeSingle();
  if (!found && placeId.startsWith('me:')) {
    // an address they typed in and paid to unlock the snapshot of
    const [{ data: mine }, { data: paid }] = await Promise.all([
      db.from('personal_places').select('name,lat,lng').eq('user_id', user).eq('place_id', placeId.slice(3)).maybeSingle(),
      db.from('unlocks').select('place_id').eq('user_id', user).eq('place_id', placeId).limit(1),
    ]);
    if (mine && paid?.length) found = mine;
  }
  if (!found) return reply(req, { error: 'not_found_by_you' }, 403);
  if (home.lat !== null && home.lng !== null && km({ lat: home.lat, lng: home.lng }, { lat: found.lat, lng: found.lng }) < FAR_KM) return reply(req, { error: 'too_close' }, 403);

  const recipe = vacationRecipe(homeVault, placeId);
  // the loot is checked now (and taken at the end, once the picture exists)
  const { data: loot } = await db.from('player_loot').select('loot,qty').eq('user_id', user);
  const have: Record<string, number> = {};
  for (const r of (loot ?? []) as { loot: string; qty: number }[]) have[r.loot] = r.qty;
  if (Object.entries(recipe).some(([k, n]) => (have[k] ?? 0) < (n ?? 0))) return reply(req, { error: 'loot' }, 402);

  const { data: claim, error: claimError } = await db.rpc('vacation_claim', { p_user: user, p_place: placeId, p_name: String(found.name).slice(0, 80), p_icon: icon, p_lat: found.lat, p_lng: found.lng });
  if (claimError) return reply(req, { error: 'server' }, 500);
  if (claim === 'full') return reply(req, { error: 'full', max: MAX_VACATIONS }, 409);
  if (claim === 'have') {
    const { data: row } = await db.from('vacation_vault').select('storage_path').eq('user_id', user).eq('place_id', placeId).maybeSingle();
    const url = row?.storage_path ? await signed(row.storage_path as string) : null;
    return url ? reply(req, { status: 'ready', url, charged: false }) : reply(req, { error: 'server' }, 500);
  }
  if (claim === 'busy') return reply(req, { status: 'working' });

  const undo = () => db.from('vacation_vault').delete().eq('user_id', user).eq('place_id', placeId).eq('status', 'generating');
  try {
    const cap = dailyRenderCap();
    const since = new Date(); since.setUTCHours(0, 0, 0, 0);
    const counts = await Promise.all(['renders', 'address_renders', 'home_renders', 'vacation_vault'].map((t) => db.from(t).select('*', { count: 'exact', head: true }).gte('started_at', since.toISOString())));
    if (counts.reduce((n: number, c: { count: number | null }) => n + (c.count ?? 0), 0) > cap) { await undo(); return reply(req, { error: 'busy', resetsAt: nextRenderReset() }, 503); }
    const picture = await pictureOf(placeId, String(found.name), found.lat, found.lng);
    if (!picture) { await undo(); return reply(req, { error: 'no_picture' }, 404); }
    const png = await generate(picture, String(found.name), String(home.vault_number).padStart(4, '0'));
    const path = `vacation/${user}/${slug(placeId)}.png`;
    const up = await db.storage.from('renders').upload(path, png, { contentType: 'image/png', upsert: true });
    if (up.error) throw new Error('could not store the image');
    const { data: done, error: finishError } = await db.rpc('vacation_finish', { p_user: user, p_place: placeId, p_cost: recipe, p_path: path });
    if (finishError) throw new Error('could not finish');
    if (done === 'loot') return reply(req, { error: 'loot' }, 402);
    const url = await signed(path);
    return url ? reply(req, { status: 'ready', url, charged: true, recipe }) : reply(req, { error: 'server' }, 500);
  } catch (e) {
    await undo();
    console.error('vacation render failed', placeId, e instanceof Error ? e.message : e);
    return reply(req, { error: 'failed' }, 502);
  }
});
