// The public atlas: every place and address that has a render, for the pages the site builds about them (see _tools/build-seo.ts). No sign-in is needed and nothing about
// the people who made the renders is in it: only the place, where it is, and where its picture is kept (the public-renders bucket).
// A person's home render (which carries their vault number) is not part of it.
//
// GET  ->  { addresses: [{ id, name, address, lat, lng, kind, metro, image, at }], places: [{ id, name, image, photo, author, license, page, at }] }
// Deploy: supabase functions deploy public-atlas --no-verify-jwt

import { serviceClient } from '../_shared/common.ts';

const HEADERS = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'public, max-age=900' };

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: HEADERS });
  const db = serviceClient();
  const base = `${Deno.env.get('SUPABASE_URL')}/storage/v1/object/public/public-renders`;
  const [a, p] = await Promise.all([
    db.from('address_renders').select('place_id,name,address,lat,lng,kind,metro_id,created_at').eq('status', 'ready').order('created_at', { ascending: false }).limit(5000),
    db.from('renders').select('place_id,place_name,photo_title,photo_author,photo_license,photo_page,created_at').eq('status', 'ready').like('place_id', 'wd:Q%').order('created_at', { ascending: false }).limit(5000),
  ]);
  const addresses = (a.data ?? []).map((r) => ({ id: r.place_id, name: r.name, address: r.address, lat: r.lat, lng: r.lng, kind: r.kind, metro: r.metro_id, image: `${base}/address/${r.place_id}.png`, at: r.created_at }));
  const places = (p.data ?? []).map((r) => ({ id: String(r.place_id).slice(3), name: r.place_name, image: `${base}/wd/${String(r.place_id).slice(3)}.png`, photo: r.photo_title, author: r.photo_author, license: r.photo_license, page: r.photo_page, at: r.created_at }));
  return new Response(JSON.stringify({ addresses, places }), { headers: HEADERS });
});
