// Deletes the signed-in person's account and everything that belongs to it. Every table that holds their data refers to the account with "on delete
// cascade" (found places, credits and their ledger, unlocks, loot, guns, raids, personal places, home), so removing the account removes it all. Addresses
// they made renders for stay in the shared atlas, without their name on them (created_by is cleared).
//
// It takes two steps, so nobody deletes by accident (or from a phone left unlocked): 'request' records the request and emails a link to the account's address; 'confirm' deletes, and
// only if the person has signed in through an emailed link AFTER the request (the sign-in token says how and when each sign-in happened). Not opening the email changes nothing.
// The App Store reviewers' account has no inbox they can open, so it is deleted at once.
//
// POST { action: 'request', redirectTo? }  ->  { ok: true, sent: true } | { ok: true, immediate: true } | { error: 'too_many' | 'server' | ... }
// POST { action: 'confirm', confirm: 'DELETE' }  ->  { ok: true } | { error: 'not_requested' | 'expired' | 'no_email_link' | 'server' }
// Deploy: supabase functions deploy delete-account

import { createClient } from 'npm:@supabase/supabase-js@2';
import { callerId, corsHeaders, reply, serviceClient } from '../_shared/common.ts';
import { REVIEW_ACCOUNT } from '../_shared/vaultPassword.ts';

const REQUEST_VALID_MS = 3_600_000; // the link must be opened within an hour
const MAX_SENDS = 3;
const WINDOW_MS = 12 * 3_600_000;

/** When (epoch seconds) the newest sign-in that was NOT by password happened, from the token's own record of how it was made. */
function lastLinkSignIn(token: string): number {
  try {
    const part = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(atob(part + '='.repeat((4 - (part.length % 4)) % 4))) as { amr?: { method?: string; timestamp?: number }[] };
    return Math.max(0, ...(payload.amr ?? []).filter((a) => a.method && a.method !== 'password' && typeof a.timestamp === 'number').map((a) => a.timestamp as number));
  } catch { return 0; }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) });
  if (req.method !== 'POST') return reply(req, { error: 'POST only' }, 405);
  const user = await callerId(req);
  if (!user) return reply(req, { error: 'sign_in' }, 401);
  const body = (await req.json().catch(() => ({}))) as { action?: string; confirm?: string; redirectTo?: string };
  const db = serviceClient();
  const { data: who } = await db.auth.admin.getUserById(user);
  const email = who?.user?.email ?? null;
  const reviewer = (email ?? '').toLowerCase() === REVIEW_ACCOUNT;

  const remove = async () => {
    // the welcome gift (500 caps) goes back with the account if it was never touched (nothing spent, bought or earned): its email and device are released so a new account can have it again.
    // A gift that was spent from or added to stays used up.
    const { data: released } = await db.rpc('release_welcome_bonus_if_untouched', { p_user: user, p_amount: 5 });
    const { error } = await db.auth.admin.deleteUser(user);
    if (error) { console.error('delete account failed', error.message); return reply(req, { error: 'server' }, 500); }
    return reply(req, { ok: true, giftReleased: released === true });
  };

  if (body.action === 'request') {
    if (reviewer) return reply(req, { ok: true, immediate: true });
    if (!email) return reply(req, { error: 'no_email' }, 400);
    const now = Date.now();
    const { data: prev } = await db.from('account_delete_requests').select('*').eq('user_id', user).maybeSingle();
    let sends = 1, windowStart = new Date(now).toISOString();
    if (prev && now - new Date(prev.window_start as string).getTime() < WINDOW_MS) {
      if ((prev.sends as number) >= MAX_SENDS) return reply(req, { error: 'too_many' }, 429);
      sends = (prev.sends as number) + 1;
      windowStart = prev.window_start as string;
    }
    await db.from('account_delete_requests').upsert({ user_id: user, requested_at: new Date(now).toISOString(), sends, window_start: windowStart }, { onConflict: 'user_id' });
    // the email is the sign-in service's own "recover" email (its text says this is about deleting the account): opening it signs the person in through an emailed link
    const anon = createClient(Deno.env.get('SUPABASE_URL') as string, Deno.env.get('SUPABASE_ANON_KEY') as string, { auth: { persistSession: false } });
    const redirectTo = typeof body.redirectTo === 'string' && body.redirectTo.length < 200 ? body.redirectTo : undefined;
    const { error } = await anon.auth.resetPasswordForEmail(email, redirectTo ? { redirectTo } : undefined);
    if (error) {
      console.error('delete email failed', error.message);
      await db.from('account_delete_requests').delete().eq('user_id', user);
      return reply(req, { error: /second|minute|rate/i.test(error.message) ? 'wait' : 'server' }, /second|minute|rate/i.test(error.message) ? 429 : 500);
    }
    return reply(req, { ok: true, sent: true });
  }

  if (body.action === 'confirm' || body.action === undefined) {
    if (body.confirm !== 'DELETE') return reply(req, { error: 'not_confirmed' }, 400);
    if (reviewer) return remove();
    const { data: pending } = await db.from('account_delete_requests').select('requested_at').eq('user_id', user).maybeSingle();
    if (!pending) return reply(req, { error: 'not_requested' }, 403);
    const asked = new Date(pending.requested_at as string).getTime();
    if (Date.now() - asked > REQUEST_VALID_MS) return reply(req, { error: 'expired' }, 403);
    const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
    if (lastLinkSignIn(token) * 1000 < asked - 5000) return reply(req, { error: 'no_email_link' }, 403);
    return remove();
  }
  return reply(req, { error: 'bad_action' }, 400);
});
