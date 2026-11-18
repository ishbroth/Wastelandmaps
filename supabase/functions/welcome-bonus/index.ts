// The welcome gift: 500 caps (5 credits), once per person, the first time they are signed in from the phone app. Signing up on the website gets nothing until they open the app.
// The request must come from the app itself: its pages are served from capacitor://localhost (iPhone) or https://localhost (Android), and it also says so in the x-client-info header
// (the app's native networking sends no Origin at all, and the sign-in library puts its own text in the same header, so it is looked for inside it). Neither is a secret, so the real limit is once per EMAIL (see the welcome_bonus_emails table): deleting an account and
// registering again with the same email gets nothing. It is also once per DEVICE: the app sends a device id that survives deleting and reinstalling it (kept in the iPhone's keychain, or
// Android's own id), and a device that has had the gift once gets no second one, whatever the email. A request with no device id gets no gift.
//
// POST { action: 'status' }  ->  { claimed }          (works from anywhere: the website uses it to say "download the app")
// POST { action: 'claim' }   ->  { granted, caps }    (only from the app)
// Deploy: supabase functions deploy welcome-bonus

import { callerId, corsHeaders, reply, serviceClient } from '../_shared/common.ts';

const BONUS_CREDITS = 5;
const APP_ORIGINS = ['capacitor://localhost', 'ionic://localhost', 'https://localhost'];
const fromApp = (req: Request): boolean => APP_ORIGINS.includes(req.headers.get('origin') ?? '') || /wastelandmaps-app-(ios|android)/.test(req.headers.get('x-client-info') ?? '');

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) });
  if (req.method !== 'POST') return reply(req, { error: 'POST only' }, 405);
  const user = await callerId(req);
  if (!user) return reply(req, { error: 'sign_in' }, 401);
  const body = (await req.json().catch(() => ({}))) as { action?: string; device?: string };
  const db = serviceClient();
  if (body.action === 'status') {
    const { data } = await db.rpc('welcome_bonus_taken', { p_user: user });
    return reply(req, { claimed: data === true });
  }
  if (body.action !== 'claim') return reply(req, { error: 'bad_action' }, 400);
  if (!fromApp(req)) return reply(req, { granted: false, reason: 'not_app' });
  const { data, error } = await db.rpc('grant_welcome_bonus', { p_user: user, p_amount: BONUS_CREDITS, p_device: typeof body.device === 'string' && /^[A-Za-z0-9-]{16,80}$/.test(body.device) ? body.device : null });
  if (error) return reply(req, { error: 'server' }, 500);
  return reply(req, { granted: data === true, caps: BONUS_CREDITS * 100 });
});
