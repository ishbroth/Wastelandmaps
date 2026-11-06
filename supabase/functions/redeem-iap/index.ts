// Adds caps for a purchase made in the iPhone app with the App Store's In-App Purchase. The app only says "this transaction number"; the server asks Apple
// itself (the App Store Server API, signed with our own key) what that transaction really is, and adds the caps only if it is a real purchase of one of our
// packs, made by this very account (the account's id travelled with the purchase as Apple's appAccountToken), and not refunded. add_credits records each
// transaction once, so asking twice (a retry, a second device) cannot add the caps twice.
//
// POST { transactionId }  ->  { ok: true, credits } or { ok: false, reason }
//
// Secrets (see docs/in-app-purchases.md): APPLE_IAP_KEY_ID, APPLE_IAP_ISSUER_ID, APPLE_IAP_PRIVATE_KEY (the .p8 file's text), APPLE_BUNDLE_ID (optional,
// defaults to com.wasteland.app).   Deploy: supabase functions deploy redeem-iap

import { callerId, corsHeaders, IAP_PRODUCTS, reply, serviceClient } from '../_shared/common.ts';

const BUNDLE_ID = Deno.env.get('APPLE_BUNDLE_ID') ?? 'com.wasteland.app';
const enc = new TextEncoder();

const b64url = (bytes: Uint8Array): string => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromB64url = (s: string): Uint8Array => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));

/** The signed token Apple's server wants with every request: ES256, made from the key made in App Store Connect. */
async function appleToken(keyId: string, issuer: string, pem: string): Promise<string> {
  const der = Uint8Array.from(atob(pem.replace(/\\n/g, '\n').replace(/-----[^-]+-----/g, '').replace(/\s+/g, '')), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey('pkcs8', der, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const now = Math.floor(Date.now() / 1000);
  const head = b64url(enc.encode(JSON.stringify({ alg: 'ES256', kid: keyId, typ: 'JWT' })));
  const body = b64url(enc.encode(JSON.stringify({ iss: issuer, iat: now, exp: now + 600, aud: 'appstoreconnect-v1', bid: BUNDLE_ID })));
  const sig = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, enc.encode(`${head}.${body}`)));
  return `${head}.${body}.${b64url(sig)}`;
}

interface AppleTransaction { transactionId?: string; bundleId?: string; productId?: string; appAccountToken?: string; revocationDate?: number; quantity?: number; type?: string }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) });
  if (req.method !== 'POST') return reply(req, { error: 'POST only' }, 405);
  const user = await callerId(req);
  if (!user) return reply(req, { error: 'sign_in' }, 401);

  const keyId = Deno.env.get('APPLE_IAP_KEY_ID');
  const issuer = Deno.env.get('APPLE_IAP_ISSUER_ID');
  const pem = Deno.env.get('APPLE_IAP_PRIVATE_KEY');
  if (!keyId || !issuer || !pem) return reply(req, { ok: false, reason: 'not_set_up' }, 503);

  const { transactionId } = (await req.json().catch(() => ({}))) as { transactionId?: string };
  if (!transactionId || !/^\d{5,20}$/.test(transactionId)) return reply(req, { ok: false, reason: 'bad_transaction' }, 400);

  // Ask Apple: the real store first, and the sandbox (TestFlight and App Review purchases are made there) if the real one has never heard of it
  let tx: AppleTransaction | null = null;
  try {
    const token = await appleToken(keyId, issuer, pem);
    for (const host of ['api.storekit.itunes.apple.com', 'api.storekit-sandbox.itunes.apple.com']) {
      const res = await fetch(`https://${host}/inApps/v1/transactions/${transactionId}`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.status === 404) continue;
      if (!res.ok) return reply(req, { ok: false, reason: 'apple_error' }, 502);
      const { signedTransactionInfo } = (await res.json()) as { signedTransactionInfo?: string };
      // this answer came straight from Apple over a connection authenticated with our own key, so its contents are read as they are
      if (signedTransactionInfo) tx = JSON.parse(new TextDecoder().decode(fromB64url(signedTransactionInfo.split('.')[1]))) as AppleTransaction;
      break;
    }
  } catch {
    return reply(req, { ok: false, reason: 'apple_error' }, 502);
  }
  if (!tx) return reply(req, { ok: false, reason: 'unknown_transaction' }, 404);

  const credits = IAP_PRODUCTS[tx.productId ?? ''];
  if (tx.bundleId !== BUNDLE_ID || !credits) return reply(req, { ok: false, reason: 'not_ours' }, 400);
  if (tx.revocationDate) return reply(req, { ok: false, reason: 'refunded' }, 400);
  if (String(tx.transactionId) !== transactionId) return reply(req, { ok: false, reason: 'mismatch' }, 400);
  // it must be this account's own purchase: Apple's record carries the id the app gave it when the purchase was made
  if ((tx.appAccountToken ?? '').toLowerCase() !== user.toLowerCase()) return reply(req, { ok: false, reason: 'not_yours' }, 403);

  const amount = credits * Math.max(1, Math.min(10, Number(tx.quantity) || 1));
  const { error } = await serviceClient().rpc('add_credits', { p_user: user, p_amount: amount, p_session: `apple:${transactionId}` });
  if (error) return reply(req, { ok: false, reason: 'server' }, 500);
  // (false from add_credits means these caps were added before: that is fine, it is the same purchase being reported twice)
  return reply(req, { ok: true, credits: amount });
});
