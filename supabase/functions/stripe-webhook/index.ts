// Stripe tells us a checkout was paid; we add the credits. The database records each checkout session once, so Stripe sending the same
// event twice (it does sometimes) cannot add credits twice.
//
// Secrets: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET.   Deploy: supabase functions deploy stripe-webhook --no-verify-jwt
// Stripe dashboard > Developers > Webhooks: endpoint https://<project-ref>.supabase.co/functions/v1/stripe-webhook, event checkout.session.completed

import Stripe from 'https://esm.sh/stripe@13.10.0?target=deno';
import { serviceClient } from '../_shared/common.ts';

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  const secret = Deno.env.get('STRIPE_SECRET_KEY');
  const signingSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
  if (!secret || !signingSecret) return new Response('Not configured', { status: 503 });

  const stripe = new Stripe(secret, { apiVersion: '2023-10-16', httpClient: Stripe.createFetchHttpClient() });
  const signature = req.headers.get('stripe-signature') ?? '';
  const body = await req.text();

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, signingSecret, undefined, Stripe.createSubtleCryptoProvider());
  } catch {
    return new Response('Bad signature', { status: 400 });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const user = session.metadata?.user_id;
    const credits = Number(session.metadata?.credits);
    if (session.payment_status === 'paid' && user && Number.isInteger(credits) && credits > 0) {
      const { error } = await serviceClient().rpc('add_credits', { p_user: user, p_amount: credits, p_session: session.id });
      if (error) return new Response('Could not add credits', { status: 500 }); // Stripe will try again
    }
  }
  return new Response('ok');
});
