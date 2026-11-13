// The street view that is our own: the rendered pictures around a point, for walking down the street. Only for a person who bought the metro's atlas, and only
// the metros whose atlas they bought (a building in another metro is not part of the walk unless they bought that one too).
//
// POST { lat, lng, places?: [{ id, lat, lng, name }] }
//   ->  { items: [{ id, name, kind, lat, lng, url }], street: { lat, lng, bearing } | null }
// items: every finished picture near the point (about 400 feet) that is theirs to see: addresses rendered in their metros, their own home, and the places of the map
//   (the ones named in `places`) whose snapshot they unlocked. street: a point on the street in front of the nearest one and the way the street runs (a bearing), from
//   Google's free Street View coverage check, so the road can be drawn the way it lies.
// Deploy: supabase functions deploy neighborhood

import { callerId, corsHeaders, reply, serviceClient } from '../_shared/common.ts';

const RADIUS_M = 125; // 400 feet
const dist = (a: { lat: number; lng: number }, b: { lat: number; lng: number }): number => {
  const r = Math.PI / 180;
  const dx = (b.lng - a.lng) * r * Math.cos(((a.lat + b.lat) / 2) * r) * 6371000, dy = (b.lat - a.lat) * r * 6371000;
  return Math.hypot(dx, dy);
};
const bearing = (from: { lat: number; lng: number }, to: { lat: number; lng: number }): number => {
  const r = Math.PI / 180;
  const y = Math.sin((to.lng - from.lng) * r) * Math.cos(to.lat * r);
  const x = Math.cos(from.lat * r) * Math.sin(to.lat * r) - Math.sin(from.lat * r) * Math.cos(to.lat * r) * Math.cos((to.lng - from.lng) * r);
  return (Math.atan2(y, x) / r + 360) % 360;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) });
  if (req.method !== 'POST') return reply(req, { error: 'POST only' }, 405);
  const user = await callerId(req);
  if (!user) return reply(req, { error: 'sign_in' }, 401);
  const b = (await req.json().catch(() => ({}))) as { lat?: number; lng?: number; places?: { id?: string; lat?: number; lng?: number; name?: string }[] };
  if (typeof b.lat !== 'number' || typeof b.lng !== 'number' || Math.abs(b.lat) > 90 || Math.abs(b.lng) > 180) return reply(req, { error: 'bad_point' }, 400);
  const here = { lat: b.lat, lng: b.lng };
  const db = serviceClient();

  const { data: owned } = await db.from('metro_unlocks').select('metro_id').eq('user_id', user);
  const metros = (owned ?? []).map((m) => String(m.metro_id));
  if (metros.length === 0) return reply(req, { error: 'no_atlas' }, 403);

  const sign = async (path: string): Promise<string | null> => {
    const s = await db.storage.from('renders').createSignedUrl(path, 3600);
    return s.error || !s.data ? null : s.data.signedUrl;
  };
  const items: { id: string; name: string; kind: string; lat: number; lng: number; url: string }[] = [];

  // addresses other people rendered in the metros whose atlas they bought
  const dLat = 0.0013, dLng = 0.0013 / Math.max(0.2, Math.cos((here.lat * Math.PI) / 180));
  const { data: addrs } = await db.from('address_renders').select('place_id,name,address,lat,lng,kind,storage_path').in('metro_id', metros).eq('status', 'ready')
    .gte('lat', here.lat - dLat).lte('lat', here.lat + dLat).gte('lng', here.lng - dLng).lte('lng', here.lng + dLng).limit(40);
  for (const a of addrs ?? []) {
    if (!a.storage_path || dist(here, { lat: a.lat as number, lng: a.lng as number }) > RADIUS_M) continue;
    const url = await sign(a.storage_path as string);
    if (url) items.push({ id: `me:${a.place_id}`, name: String((a.address as string | null)?.split(',')[0] ?? a.name ?? 'Address'), kind: String(a.kind ?? 'house'), lat: a.lat as number, lng: a.lng as number, url });
  }
  // their own home
  const { data: home } = await db.from('user_home').select('place_id,lat,lng,address').eq('user_id', user).maybeSingle();
  if (home?.lat !== undefined && home.lat !== null && dist(here, { lat: home.lat as number, lng: home.lng as number }) <= RADIUS_M && !items.some((i) => i.id === `me:${home.place_id}`)) {
    const { data: hr } = await db.from('home_renders').select('storage_path,status').eq('user_id', user).eq('google_id', home.place_id).maybeSingle();
    const url = hr?.status === 'ready' && hr.storage_path ? await sign(hr.storage_path as string) : null;
    if (url) items.push({ id: `me:${home.place_id}`, name: String((home.address as string | null)?.split(',')[0] ?? 'Home'), kind: 'home', lat: home.lat as number, lng: home.lng as number, url });
  }
  // the places of the map whose snapshot they unlocked (the browser says which are near; what is theirs is checked here)
  const wd = (b.places ?? []).filter((p) => typeof p.id === 'string' && /^wd:Q[0-9]+$/.test(p.id) && typeof p.lat === 'number' && typeof p.lng === 'number' && dist(here, { lat: p.lat as number, lng: p.lng as number }) <= RADIUS_M).slice(0, 30);
  if (wd.length) {
    const ids = wd.map((p) => p.id as string);
    const [{ data: mine }, { data: made }] = await Promise.all([
      db.from('unlocks').select('place_id').eq('user_id', user).in('place_id', ids),
      db.from('renders').select('place_id,storage_path,status').in('place_id', ids),
    ]);
    const yours = new Set((mine ?? []).map((m) => String(m.place_id)));
    for (const r of made ?? []) {
      const p = wd.find((x) => x.id === r.place_id);
      if (!p || r.status !== 'ready' || !r.storage_path || !yours.has(String(r.place_id))) continue;
      const url = await sign(r.storage_path as string);
      if (url) items.push({ id: String(p.id), name: String(p.name ?? 'Place').slice(0, 80), kind: 'place', lat: p.lat as number, lng: p.lng as number, url });
    }
  }

  // which way the street runs: from the point on the street nearest the closest picture, the street is square to the line from there to the building
  let street: { lat: number; lng: number; bearing: number } | null = null;
  const key = Deno.env.get('STREETVIEW_API_KEY');
  const nearest = [...items].sort((x, y) => dist(here, x) - dist(here, y))[0];
  if (key && nearest) {
    try {
      const meta = await (await fetch(`https://maps.googleapis.com/maps/api/streetview/metadata?${new URLSearchParams({ location: `${nearest.lat},${nearest.lng}`, radius: '80', source: 'outdoor', key })}`)).json();
      if (meta.status === 'OK' && meta.location) {
        const p = { lat: meta.location.lat as number, lng: meta.location.lng as number };
        street = { lat: p.lat, lng: p.lng, bearing: (bearing(p, nearest) + 90) % 180 };
      }
    } catch { /* the line through the buildings is used instead */ }
  }
  return reply(req, { items, street });
});
