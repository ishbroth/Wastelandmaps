// The gallery: what a person has unlocked, with a name and a place for each, whether or not they have ever been there. Only the list: each picture itself is
// fetched the usual way (unlock-render or unlock-streetview answer free for what is already theirs), one at a time as it is flipped to.
//
// POST { action: 'url', id }  ->  { url }   (a link, good for an hour, to the finished picture of one they have unlocked: it only reads, it never makes anything or charges anything)
// POST {}  ->  { items: [{ id, name, city, lat, lng, at, kind }] }
//   id: the place id the app uses ("wd:Q5317", or "me:<google place id>" for an address and for the home)
//   name: the building's name, or the house address; city: the city when it is known here (else the app works it out from the coordinates); at: when it was unlocked
//   kind: 'place' | 'address' | 'home'
// Deploy: supabase functions deploy gallery

import { callerId, corsHeaders, reply, serviceClient } from '../_shared/common.ts';

const UA = { 'User-Agent': 'WastelandMaps/1.0 (https://wastelandmaps.com; fan project)' };

/** "3822 Polaris Dr, La Mesa, CA 91941, USA" -> street "3822 Polaris Dr", city "La Mesa". */
function splitAddress(address: string | null | undefined): { street: string; city: string | null } {
  const parts = (address ?? '').split(',').map((p) => p.trim()).filter(Boolean);
  return { street: parts[0] ?? '', city: parts.length >= 3 ? parts[1] : null };
}

/** The coordinates of Wikidata items (their P625), for the places the person has not found (so the app has no position for them yet). */
async function wikidataPositions(ids: string[]): Promise<Map<string, { lat: number; lng: number }>> {
  const out = new Map<string, { lat: number; lng: number }>();
  for (let i = 0; i < ids.length; i += 40) {
    const batch = ids.slice(i, i + 40);
    try {
      const res = await fetch(`https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${batch.join('|')}&props=claims&format=json`, { headers: UA });
      if (!res.ok) continue;
      const body = (await res.json()) as { entities?: Record<string, { claims?: { P625?: { mainsnak?: { datavalue?: { value?: { latitude?: number; longitude?: number } } } }[] } }> };
      for (const [id, e] of Object.entries(body.entities ?? {})) {
        const v = e.claims?.P625?.[0]?.mainsnak?.datavalue?.value;
        if (v && typeof v.latitude === 'number' && typeof v.longitude === 'number') out.set(id, { lat: v.latitude, lng: v.longitude });
      }
    } catch { /* the position stays unknown: the picture is still in the gallery */ }
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) });
  if (req.method !== 'POST') return reply(req, { error: 'POST only' }, 405);
  const user = await callerId(req);
  if (!user) return reply(req, { error: 'sign_in' }, 401);
  const db = serviceClient();
  const body = (await req.json().catch(() => ({}))) as { action?: string; id?: string };

  if (body.action === 'url') {
    const id = String(body.id ?? '');
    const sign = async (path: string | null | undefined) => {
      if (!path) return reply(req, { error: 'not_ready' }, 404);
      const s = await db.storage.from('renders').createSignedUrl(path, 3600);
      return s.error || !s.data ? reply(req, { error: 'server' }, 500) : reply(req, { url: s.data.signedUrl });
    };
    if (/^wd:Q[0-9]+$/.test(id)) {
      const { data: mine } = await db.from('unlocks').select('place_id').eq('user_id', user).eq('place_id', id).maybeSingle();
      if (!mine) return reply(req, { error: 'locked' }, 403);
      const { data: r } = await db.from('renders').select('storage_path,status').eq('place_id', id).maybeSingle();
      return sign(r?.status === 'ready' ? (r.storage_path as string) : null);
    }
    if (/^me:[A-Za-z0-9_-]{10,200}$/.test(id)) {
      const g = id.slice(3);
      const { data: home } = await db.from('user_home').select('place_id').eq('user_id', user).maybeSingle();
      if (home?.place_id === g) {
        const { data: h } = await db.from('home_renders').select('storage_path,status').eq('user_id', user).eq('google_id', g).maybeSingle();
        return sign(h?.status === 'ready' ? (h.storage_path as string) : null);
      }
      const { data: mine } = await db.from('unlocks').select('place_id').eq('user_id', user).eq('place_id', id).maybeSingle();
      if (!mine) return reply(req, { error: 'locked' }, 403);
      const { data: a } = await db.from('address_renders').select('storage_path,status').eq('place_id', g).maybeSingle();
      return sign(a?.status === 'ready' ? (a.storage_path as string) : null);
    }
    return reply(req, { error: 'bad_place' }, 400);
  }

  const { data: rows } = await db.from('unlocks').select('place_id,created_at').eq('user_id', user).order('created_at', { ascending: false }).limit(500);
  const unlocks = (rows ?? []) as { place_id: string; created_at: string }[];

  const wd = unlocks.filter((u) => /^wd:Q\d+$/.test(u.place_id));
  const wdIds = wd.map((u) => u.place_id);
  const [{ data: renders }, { data: found }, { data: home }, { data: addrs }] = await Promise.all([
    wdIds.length ? db.from('renders').select('place_id,place_name,status').in('place_id', wdIds) : Promise.resolve({ data: [] as { place_id: string; place_name: string | null; status: string }[] }),
    wdIds.length ? db.from('found_places').select('place_id,name,city,lat,lng').eq('user_id', user).in('place_id', wdIds) : Promise.resolve({ data: [] as { place_id: string; name: string; city: string | null; lat: number; lng: number }[] }),
    db.from('user_home').select('place_id,name,address,lat,lng').eq('user_id', user).maybeSingle(),
    (async () => {
      const meIds = unlocks.filter((u) => u.place_id.startsWith('me:')).map((u) => u.place_id.slice(3));
      return meIds.length ? db.from('address_renders').select('place_id,name,address,lat,lng,status,kind').in('place_id', meIds) : { data: [] as { place_id: string; name: string | null; address: string | null; lat: number; lng: number; status: string; kind: string | null }[] };
    })(),
  ]);

  const ready = new Map((renders ?? []).filter((r) => r.status === 'ready').map((r) => [r.place_id, r.place_name as string | null]));
  const foundBy = new Map((found ?? []).map((f) => [f.place_id, f]));
  const missing = wdIds.filter((id) => ready.has(id) && !foundBy.has(id)).map((id) => id.slice(3));
  const positions = missing.length ? await wikidataPositions(missing) : new Map<string, { lat: number; lng: number }>();

  const items: { id: string; name: string; city: string | null; lat: number | null; lng: number | null; at: string; kind: 'place' | 'address' | 'home'; pkind?: string }[] = [];
  for (const u of unlocks) {
    if (u.place_id.startsWith('wd:')) {
      if (!ready.has(u.place_id)) continue;
      const f = foundBy.get(u.place_id);
      const pos = f ? { lat: f.lat, lng: f.lng } : positions.get(u.place_id.slice(3));
      items.push({ id: u.place_id, name: f?.name ?? ready.get(u.place_id) ?? 'Unknown place', city: f?.city ?? null, lat: pos?.lat ?? null, lng: pos?.lng ?? null, at: u.created_at, kind: 'place' });
    } else if (u.place_id.startsWith('vault:')) {
      // the home's own picture is unlocked under its vault key
      if (!home) continue;
      const a = splitAddress(home.address);
      items.push({ id: `me:${home.place_id}`, name: a.street || home.name || 'Home', city: a.city, lat: home.lat ?? null, lng: home.lng ?? null, at: u.created_at, kind: 'home', pkind: 'house' });
    } else if (u.place_id.startsWith('me:')) {
      const r = (addrs ?? []).find((x) => x.place_id === u.place_id.slice(3));
      if (!r || r.status !== 'ready') continue;
      const a = splitAddress(r.address);
      items.push({ id: u.place_id, name: a.street || r.name || 'Address', city: a.city, lat: r.lat ?? null, lng: r.lng ?? null, at: u.created_at, kind: 'address', pkind: r.kind ?? 'house' });
    }
  }
  return reply(req, { items });
});
