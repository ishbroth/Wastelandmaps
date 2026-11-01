// Deletes the signed-in person's account and everything that belongs to it. Every table that holds their data refers to the account with "on delete
// cascade" (found places, credits and their ledger, unlocks, loot, guns, raids, personal places, home), so removing the account removes it all. Addresses
// they made renders for stay in the shared atlas, without their name on them (created_by is cleared).
//
// POST { confirm: 'DELETE' }  ->  { ok: true }
// Deploy: supabase functions deploy delete-account

import { callerId, corsHeaders, reply, serviceClient } from '../_shared/common.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) });
  if (req.method !== 'POST') return reply(req, { error: 'POST only' }, 405);
  const user = await callerId(req);
  if (!user) return reply(req, { error: 'sign_in' }, 401);
  const { confirm } = (await req.json().catch(() => ({}))) as { confirm?: string };
  if (confirm !== 'DELETE') return reply(req, { error: 'not_confirmed' }, 400);

  const { error } = await serviceClient().auth.admin.deleteUser(user);
  if (error) {
    console.error('delete account failed', error.message);
    return reply(req, { error: 'server' }, 500);
  }
  return reply(req, { ok: true });
});
