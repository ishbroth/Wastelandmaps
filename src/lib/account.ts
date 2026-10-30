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
  /** How many places this person has reached on foot. */
  discoveries: number;
  /** Points earned by reaching places on foot (see points.ts): they fill the level bar, and every level gives a free snapshot. */
  points: number;
  refresh: () => Promise<void>;
}

/** The signed-in person, their balance and what they have unlocked, kept up to date. */
export function useAccount(): Account {
  const [session, setSession] = useState<Session | null>(null);
  const [credits, setCredits] = useState<number | null>(null);
  const [loaded, setLoaded] = useState(!accountsEnabled);
  const [unlocked, setUnlocked] = useState<Set<string>>(new Set());
  const [discoveries, setDiscoveries] = useState(0);
  const [points, setPoints] = useState(0);

  const load = async (s: Session | null) => {
    if (!accountsEnabled || !s) {
      setCredits(null);
      setUnlocked(new Set());
      setDiscoveries(0);
      setPoints(0);
      return;
    }
    const [bal, owned, found] = await Promise.all([
      db().from('credits').select('balance').eq('user_id', s.user.id).maybeSingle(),
      db().from('unlocks').select('place_id').eq('user_id', s.user.id),
      db().from('discoveries').select('points').eq('user_id', s.user.id),
    ]);
    if (found.error) {
      // the points column is not there yet: count the places, ten points each
      const count = await db().from('discoveries').select('place_id', { count: 'exact', head: true }).eq('user_id', s.user.id);
      setDiscoveries(count.count ?? 0);
      setPoints((count.count ?? 0) * 10);
    } else {
      const rows = (found.data ?? []) as { points: number }[];
      setDiscoveries(rows.length);
      setPoints(rows.reduce((sum, r) => sum + (r.points ?? 10), 0));
    }
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
  return { session, email: session?.user.email ?? null, credits, unlocked, discoveries, points, refresh, loaded };
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
  return data && data.lat != null && data.lng != null && data.zoom != null ? { lat: data.lat as number, lng: data.lng as number, zoom: data.zoom as number } : null;
}

/** Remembers where the map is. */
export async function saveMapPosition(userId: string, lat: number, lng: number, zoom: number): Promise<void> {
  await db().from('map_positions').upsert({ user_id: userId, lat, lng, zoom, updated_at: new Date().toISOString() });
}

export interface DiscoveryResult { total: number; bonus: boolean; given: number; /** Points added by this place (0 if it was already on the record). */ added?: number; points?: number; level?: number }

/** Tells the server a place was reached on foot, worth `points`. Each new level reached gives a free snapshot credit. Null if it could not be recorded. */
export async function reportDiscovery(placeId: string, place: { lat: number; lng: number }, here: { lat: number; lng: number }, points = 10): Promise<DiscoveryResult | null> {
  const { data, error } = await db().functions.invoke('report-discovery', { body: { placeId, lat: place.lat, lng: place.lng, userLat: here.lat, userLng: here.lng, points } });
  return error || !data ? null : (data as DiscoveryResult);
}

// ---- what a signed-in person has found, and their settings ----

/** A place the person has discovered: kept on their account so it follows them to any device. */
export interface FoundPlace {
  id: string;
  name: string;
  oldName: string | null;
  metroId: string | null;
  /** The real city, state and country, for grouping the list. */
  city: string | null;
  state: string | null;
  country: string | null;
  lat: number;
  lng: number;
  foundAt: string;
}

interface FoundRow { place_id: string; name: string; old_name: string | null; metro_id: string | null; city: string | null; state: string | null; country: string | null; lat: number; lng: number; found_at: string }

/** Everything this person has found, newest first. Empty if the table is not there yet. */
export async function loadFoundPlaces(userId: string): Promise<FoundPlace[]> {
  const { data, error } = await db().from('found_places').select('place_id,name,old_name,metro_id,city,state,country,lat,lng,found_at').eq('user_id', userId).order('found_at', { ascending: false }).limit(5000);
  if (error || !data) return [];
  return (data as FoundRow[]).map((r) => ({ id: r.place_id, name: r.name, oldName: r.old_name, metroId: r.metro_id, city: r.city, state: r.state, country: r.country, lat: r.lat, lng: r.lng, foundAt: r.found_at }));
}

/** Remembers places on the account (a place already there is left as it is). */
export async function saveFoundPlaces(userId: string, places: FoundPlace[]): Promise<void> {
  if (places.length === 0) return;
  const rows = places.map((p) => ({ user_id: userId, place_id: p.id, name: p.name, old_name: p.oldName, metro_id: p.metroId, city: p.city, state: p.state, country: p.country, lat: p.lat, lng: p.lng }));
  await db().from('found_places').upsert(rows, { onConflict: 'user_id,place_id', ignoreDuplicates: true });
}

/** Whether AUTO-DISCOVER was left on. */
export async function loadAutoDiscover(userId: string): Promise<boolean> {
  const { data, error } = await db().from('map_positions').select('auto_discover').eq('user_id', userId).maybeSingle();
  return !error && !!data && (data as { auto_discover?: boolean }).auto_discover === true;
}

export async function saveAutoDiscover(userId: string, on: boolean): Promise<void> {
  await db().from('map_positions').upsert({ user_id: userId, auto_discover: on, updated_at: new Date().toISOString() });
}
