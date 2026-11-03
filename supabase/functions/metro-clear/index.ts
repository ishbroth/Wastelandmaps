// Clearing a metro. When a survivor has looted every place in a metro that counts, the metro is cleared for them and they are paid 400 caps (4 credits), once.
//
// The browser says which metro and which of its places it showed (the ones that can be looted); this function checks that against the metro's own list
// (public/data/clear/<metro>.json, made by _tools/build-clearable.mjs: the buildings and landmarks with a photograph) and against the survivor's won raids,
// and only then pays. A metro's places can be missing from the map for a few reasons (some became vault entrances, some were dropped to make room for famous
// landmarks), so up to 15% of the list may be absent from what the browser sends; everything it does send must be a place of that metro, and each must be a won raid.
//
// POST { metroId, ids: ["wd:Q123", ...] }  ->  { ok: true, awarded: boolean, caps?: 400 } | { ok: false, reason }
// Deploy: supabase functions deploy metro-clear

import { callerId, corsHeaders, reply, serviceClient } from '../_shared/common.ts';

const SITE = 'https://wastelandmaps.com';
const CREDITS = 4; // 400 caps
const lists = new Map<string, string[]>();

async function clearable(metroId: string): Promise<string[] | null> {
  const hit = lists.get(metroId);
  if (hit) return hit;
  const res = await fetch(`${SITE}/data/clear/${metroId}.json`);
  if (!res.ok) return null;
  const ids = (await res.json()) as string[];
  lists.set(metroId, ids);
  return ids;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) });
  if (req.method !== 'POST') return reply(req, { error: 'POST only' }, 405);
  const user = await callerId(req);
  if (!user) return reply(req, { error: 'sign_in' }, 401);

  const b = (await req.json().catch(() => ({}))) as { metroId?: string; ids?: string[] };
  const metroId = String(b.metroId ?? '');
  if (!/^[a-z0-9-]{3,80}$/.test(metroId) || !Array.isArray(b.ids) || b.ids.length > 800) return reply(req, { ok: false, reason: 'bad_request' }, 400);
  const sent = [...new Set(b.ids.map(String))];
  if (sent.some((id) => !/^wd:Q\d+$/.test(id))) return reply(req, { ok: false, reason: 'bad_request' }, 400);

  const list = await clearable(metroId);
  if (!list || list.length === 0) return reply(req, { ok: false, reason: 'no_list' });
  const base = new Set(list.map((q) => `wd:${q}`));
  if (sent.some((id) => !base.has(id))) return reply(req, { ok: false, reason: 'not_in_metro' });
  if (base.size - sent.length > Math.max(2, Math.floor(base.size * 0.15))) return reply(req, { ok: false, reason: 'not_enough' });

  const db = serviceClient();
  const { data: done } = await db.from('metro_clears').select('metro_id').eq('user_id', user).eq('metro_id', metroId).maybeSingle();
  if (done) return reply(req, { ok: true, awarded: false });

  // every one of them must be a raid the survivor really won
  const won = new Set<string>();
  for (let i = 0; i < sent.length; i += 200) {
    const { data } = await db.from('raid_runs').select('place_id').eq('user_id', user).eq('won', true).in('place_id', sent.slice(i, i + 200));
    for (const r of data ?? []) won.add(r.place_id as string);
  }
  if (sent.some((id) => !won.has(id))) return reply(req, { ok: false, reason: 'not_all_cleared' });

  const { data: result, error } = await db.rpc('award_metro_clear', { p_user: user, p_metro: metroId, p_credits: CREDITS });
  if (error) return reply(req, { error: 'server' }, 500);
  return reply(req, { ok: true, awarded: result === 'awarded', caps: result === 'awarded' ? CREDITS * 100 : 0 });
});
