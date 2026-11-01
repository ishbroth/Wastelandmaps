// A raid on a place whose snapshot the survivor has unlocked (or that has a permanent snapshot). The server starts every raid, decides now what it will pay,
// and pays only if the raid is finished as a win after a believable amount of time. Loot is never named by the browser.
//
// POST { action: 'start', placeId, worth, enemies, lootTypes }  ->  { runId }
// POST { action: 'finish', runId, won }                          ->  { ok, loot? } or { ok, won, pending: true } (a permanent landmark fought from afar: the loot waits for its discovery)
// POST { action: 'claim', placeId }                              ->  { ok, loot?, lost? }  (pays the loot of a landmark fought from afar, once it has been discovered)
//
// Looting needs the place to be discovered, except the permanent landmarks: those can be fought at once, but pay only once discovered. A person's own home is
// discovered from the start (no XP) and can be looted as soon as its snapshot is unlocked.
// Deploy: supabase functions deploy raid

import { callerId, corsHeaders, reply, serviceClient } from '../_shared/common.ts';

const LOOT = ['steel', 'wood', 'springs', 'adhesive', 'screws', 'fiberoptics', 'glass', 'circuitry', 'oil', 'gears', 'plastic'];
const WORTHS = [10, 15, 20, 30, 50, 75];
/** The landmarks with a permanent snapshot: free for everyone, so no unlock is needed to raid them. */
const FREE = new Set([
  'Q243', 'Q9202', 'Q5317', 'Q41225', 'Q45178', 'Q79961', 'Q133274', 'Q2636724', 'Q12495', 'Q134883', 'Q1107297', 'Q4176', 'Q1542408', 'Q9188', 'Q1052042',
  'Q5853834', 'Q2027162', 'Q44440', 'Q1563940', 'Q180376', 'Q390028', 'Q6506496', 'Q831389', 'Q3177225', 'Q223207', 'Q83063', 'Q39054', 'Q179191', 'Q756452',
  'Q9141', 'Q183536', 'Q178114', 'Q29294',
  'famous:east-county-courthouse-el-cajon-',
]);
const MAX_RAIDS_PER_HOUR = 30;

/** The least and most pieces a win pays, by the place's worth (the same table as lootRangeFor in src/lib/raid/raid.ts). */
function pieceRange(worth: number): [number, number] {
  if (worth >= 75) return [7, 10];
  if (worth >= 50) return [5, 8];
  if (worth >= 30) return [4, 5];
  if (worth >= 15) return [3, 4];
  return [2, 2];
}

/** The loot a win pays: a number of pieces within the range for the place's worth, at least one of every kind the place has. */
function roll(worth: number, types: string[]): Record<string, number> {
  const [min, max] = pieceRange(worth);
  const pieces = Math.max(types.length, min + Math.floor(Math.random() * (max - min + 1)));
  const out: Record<string, number> = {};
  types.forEach((t) => { out[t] = 1; });
  for (let i = types.length; i < pieces; i++) {
    const t = types[Math.floor(Math.random() * types.length)];
    out[t] += 1;
  }
  return out;
}

/** Has this person discovered the place (on foot, or by arriving there)? Their own home counts from the start. */
// deno-lint-ignore no-explicit-any
async function discovered(db: any, user: string, placeId: string): Promise<boolean> {
  const [a, b] = await Promise.all([
    db.from('discoveries').select('place_id').eq('user_id', user).eq('place_id', placeId).maybeSingle(),
    db.from('found_places').select('place_id').eq('user_id', user).eq('place_id', placeId).maybeSingle(),
  ]);
  return !!a.data || !!b.data;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) });
  if (req.method !== 'POST') return reply(req, { error: 'POST only' }, 405);

  const user = await callerId(req);
  if (!user) return reply(req, { error: 'sign_in' }, 401);
  const db = serviceClient();
  const b = (await req.json().catch(() => ({}))) as { action?: string; placeId?: string; worth?: number; enemies?: number; lootTypes?: string[]; runId?: string; won?: boolean };

  if (b.action === 'start') {
    const placeId = String(b.placeId ?? '');
    const personal = /^me:[A-Za-z0-9_-]{10,200}$/.test(placeId);
    if (!personal && !/^(wd:Q\d+|famous:[a-z0-9-]+)$/.test(placeId)) return reply(req, { error: 'bad_place' }, 400);
    const worth = Number(b.worth);
    const enemies = Math.round(Number(b.enemies));
    const types = Array.isArray(b.lootTypes) ? [...new Set(b.lootTypes.map(String))] : [];
    if (!WORTHS.includes(worth) || !(enemies >= 1 && enemies <= 80) || types.length < 1 || types.length > 3 || types.some((t) => !LOOT.includes(t))) return reply(req, { error: 'bad_raid' }, 400);

    // their own home: looted as soon as its snapshot is unlocked, and already discovered
    let isHome = false;
    if (personal) {
      const { data: home } = await db.from('user_home').select('place_id,vault_number').eq('user_id', user).maybeSingle();
      isHome = !!home && home.place_id === placeId.slice(3);
    }
    const permanent = !personal && FREE.has(placeId.startsWith('famous:') ? placeId : placeId.slice(3));
    // everywhere else it has to be discovered first (a permanent landmark can be fought from afar)
    if (!personal && !permanent && !(await discovered(db, user, placeId))) return reply(req, { error: 'undiscovered' }, 403);
    if (isHome) {
      if (worth > 10) return reply(req, { error: 'bad_raid' }, 400);
      const { data: mine } = await db.from('unlocks').select('place_id').eq('user_id', user).like('place_id', `vault:${placeId.slice(3)}:%`).limit(1);
      if (!mine || mine.length === 0) return reply(req, { error: 'locked' }, 403);
    }
    // the snapshot has to be theirs: a permanent one, unlocked with a credit, or (an address in the atlas) in a metro they have unlocked
    if (personal && !isHome && worth > 30) return reply(req, { error: 'bad_raid' }, 400);
    if (!isHome && !permanent) {
      const { data: owned } = await db.from('unlocks').select('place_id').eq('user_id', user).eq('place_id', placeId).maybeSingle();
      let allowed = !!owned;
      if (!allowed && personal) {
        const { data: row } = await db.from('address_renders').select('metro_id,status').eq('place_id', placeId.slice(3)).maybeSingle();
        if (row?.status === 'ready' && row.metro_id) {
          const { data: whole } = await db.from('metro_unlocks').select('metro_id').eq('user_id', user).eq('metro_id', row.metro_id as string).maybeSingle();
          allowed = !!whole;
        }
      }
      if (!allowed) return reply(req, { error: 'locked' }, 403);
    }
    // each place can be looted once: a won raid clears it for good (the snapshot can still be viewed)
    const { data: won } = await db.from('raid_runs').select('id').eq('user_id', user).eq('place_id', placeId).eq('won', true).limit(1);
    if (won && won.length) return reply(req, { error: 'cleared' }, 409);
    const since = new Date(Date.now() - 3600 * 1000).toISOString();
    const { count } = await db.from('raid_runs').select('id', { count: 'exact', head: true }).eq('user_id', user).gte('started_at', since);
    if ((count ?? 0) >= MAX_RAIDS_PER_HOUR) return reply(req, { error: 'too_many' }, 429);

    const { data, error } = await db.from('raid_runs').insert({ user_id: user, place_id: placeId, worth, enemies, loot: roll(worth, types) }).select('id').single();
    if (error || !data) return reply(req, { error: 'server' }, 500);
    return reply(req, { runId: data.id });
  }

  if (b.action === 'finish') {
    const { data: run } = await db.from('raid_runs').select('*').eq('id', String(b.runId ?? '')).eq('user_id', user).maybeSingle();
    if (!run || run.finished_at) return reply(req, { ok: false, reason: 'unknown' }, 404);
    const seconds = (Date.now() - new Date(run.started_at as string).getTime()) / 1000;
    // a raid cannot be won faster than a person could shoot that many enemies
    const believable = seconds >= Math.max(10, (run.enemies as number) * 1.4) && seconds <= 3600;
    const won = b.won === true && believable;
    await db.from('raid_runs').update({ finished_at: new Date().toISOString(), won }).eq('id', run.id);
    if (!won) return reply(req, { ok: true, won: false });
    // a permanent landmark fought from afar pays only once the person has discovered it
    const place = String(run.place_id);
    const owner = place.startsWith('me:') || (await discovered(db, user, place));
    if (!owner) {
      await db.from('raid_runs').update({ paid: false }).eq('id', run.id);
      return reply(req, { ok: true, won: true, pending: true, waiting: run.loot });
    }
    // the pack holds 99 of each kind: what does not fit is lost
    const { data: paid, error } = await db.rpc('grant_loot', { p_user: user, p_loot: run.loot });
    if (error) return reply(req, { error: 'server' }, 500);
    return reply(req, { ok: true, won: true, loot: (paid as { granted: unknown }).granted, lost: (paid as { lost: unknown }).lost });
  }

  if (b.action === 'claim') {
    const placeId = String(b.placeId ?? '');
    if (!(await discovered(db, user, placeId))) return reply(req, { ok: true, loot: {}, claimed: 0 });
    const { data: waiting } = await db.from('raid_runs').select('id,loot').eq('user_id', user).eq('place_id', placeId).eq('won', true).eq('paid', false);
    if (!waiting || waiting.length === 0) return reply(req, { ok: true, loot: {}, claimed: 0 });
    const total: Record<string, number> = {};
    for (const r of waiting) for (const [k, n] of Object.entries(r.loot as Record<string, number>)) total[k] = (total[k] ?? 0) + n;
    const { data: paid, error } = await db.rpc('grant_loot', { p_user: user, p_loot: total });
    if (error) return reply(req, { error: 'server' }, 500);
    await db.from('raid_runs').update({ paid: true }).in('id', waiting.map((r: { id: string }) => r.id));
    return reply(req, { ok: true, claimed: waiting.length, loot: (paid as { granted: unknown }).granted, lost: (paid as { lost: unknown }).lost });
  }

  return reply(req, { error: 'bad_action' }, 400);
});
