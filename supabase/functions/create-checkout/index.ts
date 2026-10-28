// Starts a Stripe Checkout for a pack of render credits. Apple Pay and Google Pay appear on Checkout by themselves when they are turned on in
// the Stripe dashboard (Settings > Payment methods).
//
// Secrets: STRIPE_SECRET_KEY.   Deploy: supabase functions deploy create-checkout

import Stripe from 'https://esm.sh/stripe@13.10.0?target=deno';
import { callerId, corsHeaders, PACKS, reply } from '../_shared/common.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) });
  if (req.method !== 'POST') return reply(req, { error: 'POST only' }, 405);

  const user = await callerId(req);
  if (!user) return reply(req, { error: 'sign_in' }, 401);

  const secret = Deno.env.get('STRIPE_SECRET_KEY');
  if (!secret) return reply(req, { error: 'payments_not_set_up' }, 503);

  const { pack } = (await req.json().catch(() => ({}))) as { pack?: string };
  const chosen = PACKS[pack ?? 'eight'];
  if (!chosen) return reply(req, { error: 'unknown_pack' }, 400);

  const origin = req.headers.get('origin') ?? 'https://wastelandmaps.com';
  const stripe = new Stripe(secret, { apiVersion: '2023-10-16', httpClient: Stripe.createFetchHttpClient() });
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    client_reference_id: user,
    line_items: [{
      quantity: 1,
      price_data: {
        currency: 'usd',
        unit_amount: chosen.cents,
        product_data: { name: `WastelandMaps: ${chosen.label}`, description: 'Each credit unlocks one place\'s post-apocalyptic game-style render, to view, download and share.' },
      },
    }],
    metadata: { user_id: user, credits: String(chosen.credits) },
    success_url: `${origin}/?purchase=success`,
    cancel_url: `${origin}/?purchase=cancelled`,
  });
  return reply(req, { url: session.url });
});
