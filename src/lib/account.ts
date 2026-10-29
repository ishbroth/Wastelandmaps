// Accounts and render credits: signing in, the credit balance, buying a pack, and unlocking a place's game-style render.
// All of the money logic lives on the server (supabase/functions); this only asks and shows.

import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';

const URL = (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? 'https://tdwikatzogfwfssyzmlw.supabase.co';
const ANON = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** False until the project's public key is set; the paid features simply do not appear. */
export const accountsEnabled = !!ANON && ANON.length > 20;

let client: SupabaseClient | null = null;
export function db(): SupabaseClient {
  if (!client) client = createClient(URL, ANON as string, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
  return client;
}

export const PACK = { credits: 8, price: '$1.99' };

export interface Account {
  session: Session | null;
  email: string | null;
  /** Credits left, or null while it is being fetched. */
  credits: number | null;
  /** False until we know whether someone is signed in. */
  loaded: boolean;
  /** Places this person has unlocked ("wd:Q243"). */
  unlocked: Set<string>;
  /** How many places this person has reached on foot (every 10 earns a free snapshot). */
  discoveries: number;
  refresh: () => Promise<void>;
}

/** The signed-in person, their balance and what they have unlocked, kept up to date. */
export function useAccount(): Account {
  const [session, setSession] = useState<Session | null>(null);
  const [credits, setCredits] = useState<number | null>(null);
  const [loaded, setLoaded] = useState(!accountsEnabled);
  const [unlocked, setUnlocked] = useState<Set<string>>(new Set());
  const [discoveries, setDiscoveries] = useState(0);

  const load = async (s: Session | null) => {
    if (!accountsEnabled || !s) {
      setCredits(null);
      setUnlocked(new Set());
      setDiscoveries(0);
      return;
    }
    const [bal, owned, found] = await Promise.all([
      db().from('credits').select('balance').eq('user_id', s.user.id).maybeSingle(),
      db().from('unlocks').select('place_id').eq('user_id', s.user.id),
      db().from('discoveries').select('place_id', { count: 'exact', head: true }).eq('user_id', s.user.id),
    ]);
    setDiscoveries(found.count ?? 0);
    setCredits((bal.data?.balance as number | undefined) ?? 0);
    setUnlocked(new Set(((owned.data ?? []) as { place_id: string }[]).map((r) => r.place_id)));
  };

  useEffect(() => {
    if (!accountsEnabled) return;
    void db().auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoaded(true);
      void load(data.session);
    });
    const { data } = db().auth.onAuthStateChange((_event, next) => {
      setSession(next);
      void load(next);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const refresh = async () => {
    if (!accountsEnabled) return;
    const { data } = await db().auth.getSession();
    await load(data.session);
  };
  return { session, email: session?.user.email ?? null, credits, unlocked, discoveries, refresh, loaded };
}

/** Emails a sign-in link. */
export async function sendSignInLink(email: string): Promise<string | null> {
  const { error } = await db().auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin + window.location.pathname } });
  return error ? error.message : null;
}

export const signOut = () => db().auth.signOut();

/** Starts the Stripe checkout for a pack and sends the browser there. */
export async function buyPack(): Promise<string | null> {
  const { data, error } = await db().functions.invoke('create-checkout', { body: { pack: 'eight' } });
  if (error || !data?.url) return 'Could not start the checkout. Try again in a moment.';
  window.location.href = data.url as string;
  return null;
}

export interface Unlocked {
  url: string;
  credit: { photo: string; author: string; license: string; page: string };
}
export type UnlockResult =
  | { kind: 'ready'; render: Unlocked }
  | { kind: 'working' }
  | { kind: 'error'; reason: 'no_credits' | 'no_photo' | 'busy' | 'failed' | 'sign_in' | 'server' };

/** Unlocks a place (one credit, once) and returns the render. 'working' means it is still being made: ask again in a few seconds, free. */
export async function unlockRender(placeId: string, name: string): Promise<UnlockResult> {
  const { data, error } = await db().functions.invoke('unlock-render', { body: { placeId, name } });
  if (error) {
    // the function answers with an error code in the body even on a 4xx/5xx
    let reason = 'server';
    const response = (error as { context?: Response }).context;
    if (response) {
      try { reason = ((await response.json()) as { error?: string }).error ?? 'server'; } catch { /* no body */ }
    }
    return { kind: 'error', reason: reason as 'server' };
  }
  if (data?.status === 'ready') return { kind: 'ready', render: { url: data.url as string, credit: data.credit as Unlocked['credit'] } };
  if (data?.status === 'working') return { kind: 'working' };
  return { kind: 'error', reason: 'server' };
}

/** Where this person last left the map, or null. */
export async function loadMapPosition(userId: string): Promise<{ lat: number; lng: number; zoom: number } | null> {
  const { data } = await db().from('map_positions').select('lat,lng,zoom').eq('user_id', userId).maybeSingle();
  return data ? { lat: data.lat as number, lng: data.lng as number, zoom: data.zoom as number } : null;
}

/** Remembers where the map is. */
export async function saveMapPosition(userId: string, lat: number, lng: number, zoom: number): Promise<void> {
  await db().from('map_positions').upsert({ user_id: userId, lat, lng, zoom, updated_at: new Date().toISOString() });
}

export interface DiscoveryResult { total: number; bonus: boolean; given: number }

/** Tells the server a place was reached on foot. Every 10th earns a free snapshot credit. Null if it could not be recorded. */
export async function reportDiscovery(placeId: string, place: { lat: number; lng: number }, here: { lat: number; lng: number }): Promise<DiscoveryResult | null> {
  const { data, error } = await db().functions.invoke('report-discovery', { body: { placeId, lat: place.lat, lng: place.lng, userLat: here.lat, userLng: here.lng } });
  return error || !data ? null : (data as DiscoveryResult);
}
