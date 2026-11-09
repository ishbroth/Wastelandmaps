// A survivor types their own leaderboard callsign. The name goes through the moderator (see _shared/callsign.ts) before it is kept; nothing is stored that fails it.
//
// POST { name }  ->  { ok: true, callsign } | { error: 'bad_length' | 'bad_characters' | 'personal' | 'reserved' | 'not_allowed' | 'taken' | 'sign_in' }
// Deploy: supabase functions deploy leaderboard-name

import { callerId, corsHeaders, reply, serviceClient } from '../_shared/common.ts';
import { callsignProblem } from '../_shared/callsign.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) });
  if (req.method !== 'POST') return reply(req, { error: 'POST only' }, 405);
  const user = await callerId(req);
  if (!user) return reply(req, { error: 'sign_in' }, 401);

  const { name } = (await req.json().catch(() => ({}))) as { name?: unknown };
  const callsign = typeof name === 'string' ? name.replace(/\s+/g, ' ').trim() : '';
  const problem = callsignProblem(callsign);
  if (problem) return reply(req, { error: problem }, 400);

  const db = serviceClient();
  // one callsign per name, whatever the capital letters
  const { data: same } = await db.from('leaderboard_names').select('user_id').ilike('callsign', callsign.replace(/[%_\\]/g, (c) => '\\' + c)).neq('user_id', user).limit(1);
  if (same && same.length > 0) return reply(req, { error: 'taken' }, 409);
  const { error } = await db.from('leaderboard_names').upsert({ user_id: user, callsign }, { onConflict: 'user_id' });
  if (error) return reply(req, { error: error.code === '23505' ? 'taken' : 'server' }, error.code === '23505' ? 409 : 500);
  return reply(req, { ok: true, callsign });
});
