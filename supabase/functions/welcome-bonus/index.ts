// The welcome gift: 500 caps (5 credits), once per person, the first time they are signed in from the phone app. Signing up on the website gets nothing until they open the app.
// The request must come from the app itself (its pages are served from capacitor://localhost on iPhone and https://localhost on Android; a web page cannot send those origins).
//
// POST { action: 'status' }  ->  { claimed }          (works from anywhere: the website uses it to say "download the app")
// POST { action: 'claim' }   ->  { granted, caps }    (only from the app)
// Deploy: supabase functions deploy welcome-bonus

import { callerId, corsHeaders, reply, serviceClient } from '../_shared/common.ts';

const BONUS_CREDITS = 5;
const APP_ORIGINS = ['capacitor://localhost', 'ionic://localhost', 'https://localhost'];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) });
  if (req.method !== 'POST') return reply(req, { error: 'POST only' }, 405);
  const user = await callerId(req);
  if (!user) return reply(req, { error: 'sign_in' }, 401);
  const body = (await req.json().catch(() => ({}))) as { action?: string };
  const db = serviceClient();
  if (body.action === 'status') {
    const { data } = await db.from('welcome_bonus').select('user_id').eq('user_id', user).maybeSingle();
    return reply(req, { claimed: !!data });
  }
  if (body.action !== 'claim') return reply(req, { error: 'bad_action' }, 400);
  if (!APP_ORIGINS.includes(req.headers.get('origin') ?? '')) return reply(req, { granted: false, reason: 'not_app' });
  const { data, error } = await db.rpc('grant_welcome_bonus', { p_user: user, p_amount: BONUS_CREDITS });
  if (error) return reply(req, { error: 'server' }, 500);
  return reply(req, { granted: data === true, caps: BONUS_CREDITS * 100 });
});
