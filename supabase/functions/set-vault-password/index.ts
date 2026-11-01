// Gives a person's account the simple password they sign in with afterwards: their home vault number (the four digits they chose).
//
// The number comes from their saved home on the server, never from the request, and the password is "vault-" plus the four digits (the auth system wants
// at least six characters; the person only ever types the four digits). Called after a home is saved or its number changes.
//
// POST {}  ->  { ok: true } | { error }
// Deploy: supabase functions deploy set-vault-password

import { callerId, corsHeaders, reply, serviceClient } from '../_shared/common.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) });
  if (req.method !== 'POST') return reply(req, { error: 'POST only' }, 405);
  const user = await callerId(req);
  if (!user) return reply(req, { error: 'sign_in' }, 401);
  const db = serviceClient();
  const { data: home } = await db.from('user_home').select('vault_number').eq('user_id', user).maybeSingle();
  if (!home || home.vault_number === null || home.vault_number === undefined) return reply(req, { error: 'no_number' }, 400);
  const { error } = await db.auth.admin.updateUserById(user, { password: `vault-${String(home.vault_number).padStart(4, '0')}` });
  if (error) { console.error('set password failed', error.message); return reply(req, { error: 'server' }, 500); }
  return reply(req, { ok: true });
});
