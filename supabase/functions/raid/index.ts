// A raid on a place whose snapshot the survivor has unlocked (or that has a permanent snapshot). The server starts every raid, decides now what it will pay,
// and pays only if the raid is finished as a win after a believable amount of time. Loot is never named by the browser.
//
// POST { action: 'start', placeId, worth, enemies, lootTypes }  ->  { runId }
// POST { action: 'finish', runId, won }                          ->  { ok, loot? }
// Deploy: supabase functions deploy raid

import { callerId, corsHeaders, reply, serviceClient } from '../_shared/common.ts';

const LOOT = ['steel', 'wood', 'springs', 'adhesive', 'screws', 'fiberoptics', 'glass', 'circuitry', 'oil', 'gears', 'plastic'];
const WORTHS = [10, 15, 20, 30, 50, 75];
/** The landmarks with a permanent snapshot: free for everyone, so no unlock is needed to raid them. */
const FREE = new Set([
  'Q243', 'Q9202', 'Q5317', 'Q41225', 'Q45178', 'Q79961', 'Q133274', 'Q2636724', 'Q12495', 'Q134883', 'Q1107297', 'Q4176', 'Q1542408', 'Q9188', 'Q1052042',
  'Q5853834', 'Q2027162', 'Q44440', 'Q1563940', 'Q180376', 'Q390028', 'Q6506496', 'Q831389', 'Q3177225', 'Q223207', 'Q83063', 'Q39054', 'Q179191', 'Q756452',
  'Q9141', 'Q183536', 'Q178114', 'Q29294',
]);
const MAX_RAIDS_PER_HOUR = 30;

/** The loot a win pays: 3 pieces at least, up to 4 + worth / 12.5 (at most 10), at least one of every kind the place has. */
function roll(worth: number, types: string[]): Record<string, number> {
  const max = Math.min(10, 4 + Math.floor(worth / 12.5));
  const pieces = 3 + Math.floor(Math.random() * (max - 3 + 1));
  const out: Record<string, number> = {};
  types.forEach((t) => { out[t] = 1; });
  for (let i = types.length; i < pieces; i++) {
    const t = types[Math.floor(Math.random() * types.length)];
    out[t] += 1;
  }
  return out;
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
    if (!/^wd:Q\d+$/.test(placeId)) return reply(req, { error: 'bad_place' }, 400);
    const worth = Number(b.worth);
    const enemies = Math.round(Number(b.enemies));
    const types = Array.isArray(b.lootTypes) ? [...new Set(b.lootTypes.map(String))] : [];
    if (!WORTHS.includes(worth) || !(enemies >= 1 && enemies <= 80) || types.length < 1 || types.length > 3 || types.some((t) => !LOOT.includes(t))) return reply(req, { error: 'bad_raid' }, 400);

    // the snapshot has to be theirs: a permanent one, or unlocked with a credit
    if (!FREE.has(placeId.slice(3))) {
      const { data: owned } = await db.from('unlocks').select('place_id').eq('user_id', user).eq('place_id', placeId).maybeSingle();
      if (!owned) return reply(req, { error: 'locked' }, 403);
    }
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
    const { error } = await db.rpc('grant_loot', { p_user: user, p_loot: run.loot });
    if (error) return reply(req, { error: 'server' }, 500);
    return reply(req, { ok: true, won: true, loot: run.loot });
  }

  return reply(req, { error: 'bad_action' }, 400);
});
