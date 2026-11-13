// Accounts and render credits: signing in, the credit balance, buying a pack, and unlocking a place's game-style render.
// All of the money logic lives on the server (supabase/functions); this only asks and shows.

import { APP_SCHEME, NATIVE_AUTH_REDIRECT, goTo, isNative } from './native';
import type { PersonalPlace } from './personal';
import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';
import { STARTING_ARSENAL, type Arsenal, type WeaponClass } from './raid/weapons';
import type { LootBag, LootId } from './raid/loot';
import type { VaultHome } from './vaultHome';
import { forgetFaceId, offerFaceId, readFaceId } from './faceid';

const URL = (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? 'https://tdwikatzogfwfssyzmlw.supabase.co';
const ANON = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** False until the project's public key is set; the paid features simply do not appear. */
export const accountsEnabled = !!ANON && ANON.length > 20;

let client: SupabaseClient | null = null;
export function db(): SupabaseClient {
  if (!client) client = createClient(URL, ANON as string, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
  return client;
}

/** The money of the wasteland: bottle caps. The server counts whole credits (what a basic snapshot costs); one credit is 100 caps, and every price and balance is shown in caps. */
export const CAPS_PER_CREDIT = 100;
export const caps = (credits: number): number => credits * CAPS_PER_CREDIT;

export const PACKS = [
  { id: 'caps400', credits: 4, price: '$0.99' },
  { id: 'caps1800', credits: 18, price: '$3.99' },
  { id: 'caps4400', credits: 44, price: '$9.99' },
] as const;
/** The smallest pack (what is quoted when someone is short of credits). */
export const PACK = PACKS[0];
/** Unlocking every rendered address in one metro. */
export const METRO_COST = 48;

export interface Home { placeId?: string; name?: string; address?: string; lat?: number; lng?: number; skipped: boolean; /** The four-digit number of their home vault. */ vaultNumber?: number }

/** A place turned into a vacation vault: where it is, what it was called and the icon it had (it is drawn inside a vault cog now). */
export interface Vacation { placeId: string; name: string; icon: string; lat: number; lng: number }

export interface Account {
  /** Where home is (null until they have said or skipped), and whether that is known yet. */
  home: Home | null;
  homeLoaded: boolean;
  /** Metros whose rendered addresses they have all unlocked. */
  metros: Set<string>;
  /** Metros they have cleared (every place that counts looted). */
  metrosCleared: Set<string>;
  /** The places they have looted, by the metro that was on the map at the time. */
  clearedByMetro: Map<string, Set<string>>;
  /** The loot waiting at each cleared place that has not been discovered yet (released the moment it is). */
  waiting: Map<string, LootBag>;
  /** The places looted whose loot has been delivered (all of them, except a permanent landmark fought from afar and not yet discovered). */
  clearedPaid: Set<string>;
  /** Addresses they have travelled to: their own pins. */
  personal: PersonalPlace[];
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
  /** What they have looted, and the highest tier of each class of gun they have built. */
  loot: LootBag;
  /** Stimpaks in the pack. */
  stimpaks: number;
  /** Legendary Time in the pack (it slows the enemies in the shooting gallery for four seconds). */
  legendaryTime: number;
  arsenal: Arsenal;
  /** Their vacation vaults (up to four): places turned into extra vaults. */
  vacations: Vacation[];
  /** How many rooms the home vault has (ten unlock vacation vaults). */
  homeRooms: number;
  /** Places they have already looted: each can be looted once, and shows [Cleared] on the map. */
  cleared: Set<string>;
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
  const [loot, setLoot] = useState<LootBag>({});
  const [stimpaks, setStimpaks] = useState(0);
  const [legendaryTime, setLegendaryTime] = useState(0);
  const [vacations, setVacations] = useState<Vacation[]>([]);
  const [homeRooms, setHomeRooms] = useState(0);
  const [arsenal, setArsenal] = useState<Arsenal>(STARTING_ARSENAL);
  const [cleared, setCleared] = useState<Set<string>>(new Set());
  const [personal, setPersonal] = useState<PersonalPlace[]>([]);
  const [home, setHome] = useState<Home | null>(null);
  const [homeLoaded, setHomeLoaded] = useState(false);
  const [metros, setMetros] = useState<Set<string>>(new Set());
  const [metrosCleared, setMetrosCleared] = useState<Set<string>>(new Set());
  const [clearedPaid, setClearedPaid] = useState<Set<string>>(new Set());
  const [waiting, setWaiting] = useState<Map<string, LootBag>>(new Map());
  const [clearedByMetro, setClearedByMetro] = useState<Map<string, Set<string>>>(new Map());

  const load = async (s: Session | null) => {
    if (!accountsEnabled || !s) {
      setCredits(null);
      setUnlocked(new Set());
      setDiscoveries(0);
      setPoints(0);
      setLoot({});
      setStimpaks(0);
      setLegendaryTime(0);
      setVacations([]);
      setHomeRooms(0);
      setArsenal(STARTING_ARSENAL);
      setCleared(new Set());
      setPersonal([]);
      setHome(null);
      setHomeLoaded(false);
      setMetros(new Set());
      setMetrosCleared(new Set());
      setClearedByMetro(new Map());
      setClearedPaid(new Set());
      setWaiting(new Map());
      return;
    }
    // loot and guns (empty if the raids migration has not been run)
    void Promise.all([
      db().from('player_loot').select('loot,qty').eq('user_id', s.user.id),
      db().from('player_weapons').select('weapon_class,tier').eq('user_id', s.user.id),
      db().from('player_stimpaks').select('qty').eq('user_id', s.user.id).maybeSingle(),
      db().from('player_time').select('qty').eq('user_id', s.user.id).maybeSingle(),
      db().from('vacation_vault').select('place_id,name,icon,lat,lng').eq('user_id', s.user.id).eq('status', 'ready'),
      db().from('home_vault').select('state').eq('user_id', s.user.id).eq('vault_key', 'home').maybeSingle(),
    ]).then(([l, w, st, tm, vc, hv]) => {
      setHomeRooms(((hv.data?.state as { rooms?: { type?: string }[] } | undefined)?.rooms ?? []).filter((r) => r.type !== 'entry' && r.type !== 'stairs' && r.type !== 'hallway').length);
      setVacations(((vc.data ?? []) as { place_id: string; name: string; icon: string; lat: number; lng: number }[]).map((r) => ({ placeId: r.place_id, name: r.name, icon: r.icon, lat: r.lat, lng: r.lng })));
      setStimpaks((st.data?.qty as number | undefined) ?? 0);
      setLegendaryTime((tm.data?.qty as number | undefined) ?? 0);
      const bag: LootBag = {};
      for (const r of (l.data ?? []) as { loot: LootId; qty: number }[]) bag[r.loot] = r.qty;
      const guns: Arsenal = { ...STARTING_ARSENAL };
      for (const r of (w.data ?? []) as { weapon_class: WeaponClass; tier: 1 | 2 | 3 | 4 }[]) guns[r.weapon_class] = r.tier;
      setLoot(bag);
      setArsenal(guns);
    });
    void db().from('raid_runs').select('place_id,metro_id,paid,loot').eq('user_id', s.user.id).eq('won', true).then((r) => {
      const rows = (r.data ?? []) as { place_id: string; metro_id: string | null; paid: boolean | null; loot: LootBag | null }[];
      // cleared, but not yet discovered: the loot is held with the place
      const held = new Map<string, LootBag>();
      for (const x of rows) {
        if (x.paid !== false || !x.loot) continue;
        const bag = held.get(x.place_id) ?? {};
        for (const [k, n] of Object.entries(x.loot)) bag[k as LootId] = (bag[k as LootId] ?? 0) + (n ?? 0);
        held.set(x.place_id, bag);
      }
      setWaiting(held);
      setCleared(new Set(rows.map((x) => x.place_id)));
      // looted AND delivered: a permanent landmark fought from afar is only delivered once it is discovered
      const delivered = rows.filter((x) => x.paid !== false);
      setClearedPaid(new Set(delivered.map((x) => x.place_id)));
      // the places looted in each metro (for the progress list)
      const byMetro = new Map<string, Set<string>>();
      for (const x of delivered) if (x.metro_id) byMetro.set(x.metro_id, (byMetro.get(x.metro_id) ?? new Set<string>()).add(x.place_id));
      setClearedByMetro(byMetro);
    });
    void db().from('personal_places').select('place_id,name,address,lat,lng,kind').eq('user_id', s.user.id).order('created_at').then((r) => setPersonal(((r.data ?? []) as { place_id: string; name: string; address: string; lat: number; lng: number; kind: PersonalPlace['kind'] }[]).map((x) => ({ placeId: x.place_id, name: x.name, address: x.address, lat: x.lat, lng: x.lng, kind: x.kind }))));
    void db().from('user_home').select('place_id,name,address,lat,lng,skipped,vault_number').eq('user_id', s.user.id).maybeSingle().then((r) => {
      // if the table is not there yet, do not nag about it
      if (r.error) setHome({ skipped: true });
      else setHome(r.data ? { placeId: r.data.place_id ?? undefined, name: r.data.name ?? undefined, address: r.data.address ?? undefined, lat: r.data.lat ?? undefined, lng: r.data.lng ?? undefined, skipped: !!r.data.skipped, vaultNumber: r.data.vault_number ?? undefined } : null);
      setHomeLoaded(true);
    });
    void db().from('metro_clears').select('metro_id').eq('user_id', s.user.id).then((r) => setMetrosCleared(new Set(((r.data ?? []) as { metro_id: string }[]).map((x) => x.metro_id))));
    void db().from('metro_unlocks').select('metro_id').eq('user_id', s.user.id).then((r) => setMetros(new Set(((r.data ?? []) as { metro_id: string }[]).map((x) => x.metro_id))));
    const [bal, owned, found] = await Promise.all([
      db().from('credits').select('balance').eq('user_id', s.user.id).maybeSingle(),
      db().from('unlocks').select('place_id').eq('user_id', s.user.id),
      db().from('discoveries').select('place_id,points').eq('user_id', s.user.id),
    ]);
    if (found.error) {
      // the points column is not there yet: count the places, ten points each
      const count = await db().from('discoveries').select('place_id', { count: 'exact', head: true }).eq('user_id', s.user.id);
      setDiscoveries(count.count ?? 0);
      setPoints((count.count ?? 0) * 10);
    } else {
      const rows = (found.data ?? []) as { place_id: string; points: number }[];
      setDiscoveries(rows.filter((r) => !String(r.place_id).startsWith('bonus:')).length); // XP bonuses (Vault 0's raid) are not places
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
  return { session, email: session?.user.email ?? null, credits, unlocked, discoveries, points, loot, stimpaks, legendaryTime, vacations, homeRooms, waiting, arsenal, cleared, personal, home, homeLoaded, metros, metrosCleared, clearedByMetro, clearedPaid, refresh, loaded };
}

/** Emails a sign-in link. */
export async function sendSignInLink(email: string): Promise<string | null> {
  const { error } = await db().auth.signInWithOtp({ email, options: { emailRedirectTo: isNative() ? NATIVE_AUTH_REDIRECT : window.location.origin + window.location.pathname } });
  return error ? error.message : null;
}

/** Signs in with the email and the four-digit vault number (the password is "vault-" and those digits; the auth system wants six characters or more). Null when it worked. */
export async function signInWithVault(email: string, digits: string): Promise<string | null> {
  const { error } = await db().auth.signInWithPassword({ email, password: `vault-${digits}` });
  if (!error) offerFaceId(email, `vault-${digits}`); // in the app, asks whether to use Face ID next time
  return error ? 'That email and vault number do not match. If this is your first time, or you forgot the number, use the email link.' : null;
}

/** Signs in with what Face ID (or Touch ID) unlocks for this email. Null when it worked, 'cancelled' when they backed out or the check did not match, else a message. */
export async function signInWithFaceId(email: string): Promise<string | null> {
  const saved = await readFaceId(email);
  if (saved === 'cancelled') return 'cancelled';
  if (!saved) return 'No sign-in is saved for that account on this phone. Sign in with your vault number.';
  const { error } = await db().auth.signInWithPassword({ email: saved.email, password: saved.password });
  if (error) {
    await forgetFaceId(email); // what was saved no longer works (the vault number changed): do not keep offering it
    return 'That saved sign-in no longer works. Sign in with your email and vault number.';
  }
  return null;
}

/** Makes the vault number the account's password (the server reads the number from the saved home). */
export async function setVaultPassword(email?: string | null, vaultNumber?: number): Promise<boolean> {
  const { data, error } = await db().functions.invoke('set-vault-password', { body: {} });
  const ok = !error && data?.ok === true;
  // changing a password can end the sessions that were open before it: sign in again with the new one so this device keeps a working session
  if (ok && email && vaultNumber !== undefined) {
    const password = `vault-${String(vaultNumber).padStart(4, '0')}`;
    const { error: again } = await db().auth.signInWithPassword({ email, password });
    if (!again) { await forgetFaceId(email); offerFaceId(email, password); } // a changed vault number means a changed saved sign-in
  }
  return ok;
}

/** A call was refused as not signed in although the page thinks it is: the saved session is dead. Try to renew it; if that fails, sign out so signing in again is offered. */
export async function recoverSession(): Promise<void> {
  const { data, error } = await db().auth.refreshSession();
  if (error || !data.session) await db().auth.signOut();
}

export const signOut = () => db().auth.signOut();

/** Starts the Stripe checkout for a pack and sends the browser there. */
export async function buyPack(pack: string = 'caps400'): Promise<string | null> {
  const { data, error } = await db().functions.invoke('create-checkout', { body: { pack } });
  if (error || !data?.url) return 'Could not start the checkout. Try again in a moment.';
  await goTo(data.url as string);
  return null;
}

export interface Unlocked {
  url: string;
  /** No pre-war footage could be used (the property is blurred out, or there is no street picture): the picture is only the aftermath. */
  rubble?: boolean;
  /** How many credits went back for it, when it was just made. */
  refunded?: number;
  credit: { photo: string; author: string; license: string; page: string };
}
export type UnlockResult =
  | { kind: 'ready'; render: Unlocked }
  | { kind: 'working' }
  | { kind: 'error'; reason: 'no_credits' | 'no_photo' | 'busy' | 'failed' | 'sign_in' | 'server'; /** For 'busy': when the day's count of new renders starts again (an ISO time). */ resetsAt?: string };

/** Unlocks a place (one credit, once) and returns the render. 'working' means it is still being made: ask again in a few seconds, free. */
export async function unlockRender(placeId: string, name: string, extra?: { /** The last resort: make it from Google Street View at this spot (costs more). */ streetView?: boolean; lat?: number; lng?: number; /** The kind of place it is (a park has no building: its vault door lies in the ground). */ category?: string; kind?: string; metroId?: string | null; home?: boolean; flooded?: boolean; irradiated?: boolean; /** The number of the vault this place is the entrance to (its picture has the vault door in it). */ vault?: number }): Promise<UnlockResult> {
  const { data, error } = await db().functions.invoke(placeId.startsWith('me:') ? 'unlock-streetview' : 'unlock-render', { body: { placeId, name, ...extra } });
  if (error) {
    // the function answers with an error code in the body even on a 4xx/5xx
    let reason = 'server';
    let resetsAt: string | undefined;
    const response = (error as { context?: Response }).context;
    if (response) {
      try { const body = (await response.json()) as { error?: string; resetsAt?: string }; reason = body.error ?? 'server'; resetsAt = body.resetsAt; } catch { /* no body */ }
    }
    return { kind: 'error', reason: reason as 'server', resetsAt };
  }
  if (data?.status === 'ready') return { kind: 'ready', render: { url: data.url as string, ...(data.rubble === true ? { rubble: true, refunded: Number(data.refunded) || undefined } : {}), credit: (data.credit as Unlocked['credit'] | undefined) ?? { photo: 'Street View', author: 'Google', license: '', page: 'https://www.google.com/streetview/' } } };
  if (data?.status === 'working') return { kind: 'working' };
  return { kind: 'error', reason: 'server' };
}

// ---- the leaderboard (see the leaderboard migration; a survivor joins to appear, under a made-up callsign) ----

export interface BoardRow { rank: number; callsign: string; level: number; places: number; /** This row is the signed-in person's own. */ mine: boolean }

/** The top survivors, or null if the leaderboard could not be read (the migration has not been run, or no connection). */
export async function loadLeaderboard(limit = 100): Promise<BoardRow[] | null> {
  const { data, error } = await db().rpc('leaderboard_top', { p_limit: limit });
  if (error || !Array.isArray(data)) return null;
  return (data as { rank: number | string; callsign: string; level: number; places: number; mine: boolean }[]).map((r) => ({ rank: Number(r.rank), callsign: r.callsign, level: Number(r.level), places: Number(r.places), mine: !!r.mine }));
}

/** The signed-in person's own standing, or null if they have not joined. */
export async function myStanding(): Promise<BoardRow | null> {
  const { data, error } = await db().rpc('leaderboard_me');
  const r = Array.isArray(data) ? data[0] : null;
  return error || !r ? null : { rank: Number(r.rank), callsign: r.callsign as string, level: Number(r.level), places: Number(r.places), mine: true };
}

/** Joins the leaderboard (or, with reroll, takes a new callsign). Returns the callsign. */
export async function joinLeaderboard(reroll = false): Promise<string | null> {
  const { data, error } = await db().rpc('leaderboard_join', { p_reroll: reroll });
  return error || typeof data !== 'string' ? null : data;
}

/** Takes a callsign the person typed. The server's moderator may refuse it: the answer says why ('' when it was taken). */
export async function setCallsign(name: string): Promise<{ ok: true; callsign: string } | { ok: false; error: string }> {
  const { data, error } = await db().functions.invoke('leaderboard-name', { body: { name } });
  if (!error && data?.ok) return { ok: true, callsign: String(data.callsign) };
  let reason = 'server';
  const response = (error as { context?: Response } | null)?.context;
  if (response) { try { reason = ((await response.json()) as { error?: string }).error ?? 'server'; } catch { /* no body */ } }
  return { ok: false, error: reason };
}

export async function leaveLeaderboard(): Promise<boolean> {
  const { error } = await db().rpc('leaderboard_leave');
  return !error;
}

/** Where this person last left the map, or null. */
export async function loadMapPosition(userId: string): Promise<{ lat: number; lng: number; zoom: number; /** When it was saved (milliseconds). */ updatedAt: number } | null> {
  const { data } = await db().from('map_positions').select('lat,lng,zoom,updated_at').eq('user_id', userId).maybeSingle();
  return data && data.lat != null && data.lng != null && data.zoom != null ? { lat: data.lat as number, lng: data.lng as number, zoom: data.zoom as number, updatedAt: data.updated_at ? new Date(data.updated_at as string).getTime() : 0 } : null;
}

/** Remembers where the map is. */
export async function saveMapPosition(userId: string, lat: number, lng: number, zoom: number): Promise<void> {
  await db().from('map_positions').upsert({ user_id: userId, lat, lng, zoom, updated_at: new Date().toISOString() });
}

export interface DiscoveryResult { /** Loot a discovery paid (Vault 0 pays 20 pieces). */ loot?: Partial<Record<string, number>>; total: number; bonus: boolean; given: number; /** Points added by this place (0 if it was already on the record). */ added?: number; points?: number; level?: number }

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
  /** What the place is worth (its points); decides the enemies and loot. */
  worth?: number | null;
}

interface FoundRow { place_id: string; name: string; old_name: string | null; metro_id: string | null; city: string | null; state: string | null; country: string | null; lat: number; lng: number; found_at: string; worth?: number | null }

/** Everything this person has found, newest first. Empty if the table is not there yet. */
export async function loadFoundPlaces(userId: string): Promise<FoundPlace[]> {
  const { data, error } = await db().from('found_places').select('*').eq('user_id', userId).order('found_at', { ascending: false }).limit(5000);
  if (error || !data) return [];
  return (data as FoundRow[]).map((r) => ({ id: r.place_id, name: r.name, oldName: r.old_name, metroId: r.metro_id, city: r.city, state: r.state, country: r.country, lat: r.lat, lng: r.lng, foundAt: r.found_at, worth: r.worth ?? null }));
}

/** Remembers places on the account (a place already there is left as it is). */
export async function saveFoundPlaces(userId: string, places: FoundPlace[]): Promise<void> {
  if (places.length === 0) return;
  const rows = places.map((p) => ({ user_id: userId, place_id: p.id, name: p.name, old_name: p.oldName, metro_id: p.metroId, city: p.city, state: p.state, country: p.country, lat: p.lat, lng: p.lng }));
  const { error } = await db().from('found_places').upsert(rows.map((r, i) => ({ ...r, worth: places[i].worth ?? null })), { onConflict: 'user_id,place_id', ignoreDuplicates: true });
  // the worth column may not be there yet
  if (error) await db().from('found_places').upsert(rows, { onConflict: 'user_id,place_id', ignoreDuplicates: true });
}

/** Whether AUTO-DISCOVER was left on. */
export async function loadAutoDiscover(userId: string): Promise<boolean> {
  const { data, error } = await db().from('map_positions').select('auto_discover').eq('user_id', userId).maybeSingle();
  return !error && !!data && (data as { auto_discover?: boolean }).auto_discover === true;
}

export async function saveAutoDiscover(userId: string, on: boolean): Promise<void> {
  await db().from('map_positions').upsert({ user_id: userId, auto_discover: on, updated_at: new Date().toISOString() });
}

// ---- looting and guns ----

/** Builds or upgrades the next gun in a class from loot. */
export async function craftWeapon(weaponClass: WeaponClass): Promise<{ ok: boolean; tier?: number; reason?: string }> {
  const { data, error } = await db().functions.invoke('craft', { body: { class: weaponClass } });
  return error || !data ? { ok: false, reason: 'server' } : (data as { ok: boolean; tier?: number; reason?: string });
}

/** Trades spare loot for stimpaks (the trade is one of STIMPAK_TRADES, and how many: the cost is multiplied). */
export async function tradeStimpak(trade: string, qty = 1): Promise<{ ok: boolean; qty?: number; reason?: string }> {
  const { data, error } = await db().functions.invoke('stimpak', { body: { action: 'trade', item: 'stimpak', trade, qty } });
  return error || !data ? { ok: false, reason: 'server' } : (data as { ok: boolean; qty?: number; reason?: string });
}

/** Trades spare loot for Legendary Time (the trade is one of TIME_TRADES, and how many). */
export async function tradeTime(trade: string, qty = 1): Promise<{ ok: boolean; qty?: number; reason?: string }> {
  const { data, error } = await db().functions.invoke('stimpak', { body: { action: 'trade', item: 'time', trade, qty } });
  return error || !data ? { ok: false, reason: 'server' } : (data as { ok: boolean; qty?: number; reason?: string });
}

/** Uses one Legendary Time (the screen then slows the enemies for four seconds). */
export async function useTime(): Promise<{ ok: boolean; qty?: number }> {
  const { data, error } = await db().functions.invoke('stimpak', { body: { action: 'use', item: 'time' } });
  return error || !data ? { ok: false } : (data as { ok: boolean; qty?: number });
}

/** Uses a stimpak (the screen then gives the survivor their strikes back). */
export async function useStimpak(): Promise<{ ok: boolean; qty?: number }> {
  const { data, error } = await db().functions.invoke('stimpak', { body: { action: 'use' } });
  return error || !data ? { ok: false } : (data as { ok: boolean; qty?: number });
}

/** Starts a raid on a place (the server checks the snapshot is theirs and decides the loot). Returns the run to finish, or the reason it cannot start. */
export async function startRaid(placeId: string, worth: number, enemies: number, lootTypes: LootId[], metroId?: string | null): Promise<{ runId: string } | { error: string }> {
  const { data, error } = await db().functions.invoke('raid', { body: { action: 'start', placeId, worth, enemies, lootTypes, metroId } });
  if (error || !data?.runId) {
    let reason = 'server';
    const response = (error as { context?: Response } | null)?.context;
    if (response) { try { reason = ((await response.json()) as { error?: string }).error ?? 'server'; } catch { /* no body */ } }
    return { error: reason };
  }
  return { runId: data.runId as string };
}

/** Ends a raid. A win pays the loot the server decided at the start. */
export async function finishRaid(runId: string, won: boolean): Promise<{ won: boolean; /** XP a win paid (only Vault 0 pays any). */ xp?: number; loot?: LootBag; lost?: LootBag; /** A permanent landmark fought from afar: the loot waits until it is discovered. */ pending?: boolean; /** What is waiting for them. */ waiting?: LootBag }> {
  const { data, error } = await db().functions.invoke('raid', { body: { action: 'finish', runId, won } });
  return error || !data?.ok ? { won: false } : { won: data.won === true, loot: data.loot as LootBag | undefined, lost: data.lost as LootBag | undefined, pending: data.pending === true, waiting: data.waiting as LootBag | undefined, xp: typeof data.xp === 'number' ? data.xp : undefined };
}

/** A landmark fought from afar has now been discovered: pays the loot that was waiting for it (nothing if none was). */
export async function claimLoot(placeId: string): Promise<{ claimed: number; loot: LootBag }> {
  const { data, error } = await db().functions.invoke('raid', { body: { action: 'claim', placeId } });
  return error || !data?.ok ? { claimed: 0, loot: {} } : { claimed: Number(data.claimed ?? 0), loot: (data.loot ?? {}) as LootBag };
}

/** Keeps an address they reached on their own map. */
export async function savePersonalPlace(userId: string, p: PersonalPlace): Promise<void> {
  await db().from('personal_places').upsert({ user_id: userId, place_id: p.placeId, name: p.name.slice(0, 80), address: p.address, lat: p.lat, lng: p.lng, kind: p.kind }, { onConflict: 'user_id,place_id', ignoreDuplicates: true });
}

/** A new name for one of their own places. */
export async function renamePersonalPlace(userId: string, placeId: string, name: string): Promise<void> {
  const clean = name.trim().slice(0, 80);
  if (!clean) return;
  await db().from('personal_places').update({ name: clean }).eq('user_id', userId).eq('place_id', placeId);
}

/** Has anyone already rendered this address, and can this person see it without paying? (Free to ask.) */
export async function checkAddress(placeId: string, home = false): Promise<{ exists: boolean; owned: boolean }> {
  const { data, error } = await db().functions.invoke('unlock-streetview', { body: { action: 'check', placeId, home } });
  return error || !data ? { exists: false, owned: false } : { exists: data.exists === true, owned: data.owned === true };
}

export interface AtlasPlace { placeId: string; name: string; address: string; lat: number; lng: number; kind: PersonalPlace['kind'] }

/** How many addresses are rendered in a metro, and whether this person has unlocked them all. */
export async function atlasCount(metroId: string): Promise<{ count: number; unlocked: boolean } | null> {
  const { data, error } = await db().functions.invoke('address-atlas', { body: { action: 'count', metroId } });
  return error || !data ? null : { count: Number(data.count ?? 0), unlocked: data.unlocked === true };
}

/** Unlocks every rendered address in a metro (48 credits). */
export async function atlasUnlock(metroId: string): Promise<'ok' | 'no_credits' | 'error'> {
  const { data, error } = await db().functions.invoke('address-atlas', { body: { action: 'unlock', metroId } });
  if (error) {
    const response = (error as { context?: Response }).context;
    try { if (response && ((await response.json()) as { error?: string }).error === 'no_credits') return 'no_credits'; } catch { /* no body */ }
    return 'error';
  }
  return data?.ok ? 'ok' : 'error';
}

/** The rendered addresses of a metro this person has unlocked. */
export async function atlasList(metroId: string): Promise<AtlasPlace[]> {
  const { data, error } = await db().functions.invoke('address-atlas', { body: { action: 'list', metroId } });
  return error || !data?.places ? [] : (data.places as AtlasPlace[]);
}

/** Remembers where home is and its vault number, or that they chose not to say. 'taken': another survivor already has that number. */
export async function saveHome(userId: string, home: Home): Promise<'ok' | 'taken' | 'error'> {
  const { error } = await db().from('user_home').upsert({
    user_id: userId, place_id: home.placeId ?? null, name: home.name ?? null, address: home.address ?? null, lat: home.lat ?? null, lng: home.lng ?? null,
    skipped: home.skipped, vault_number: home.vaultNumber ?? null,
  }, { onConflict: 'user_id' });
  if (!error) return 'ok';
  return error.code === '23505' ? 'taken' : 'error';
}

/** The app was opened by the sign-in email's link (com.wasteland.app://auth#access_token=...): finish signing in with it. */
export async function completeSignInFromUrl(url: string): Promise<boolean> {
  if (!url.startsWith(NATIVE_AUTH_REDIRECT) && !url.startsWith(APP_SCHEME)) return false;
  const hash = new URLSearchParams(url.includes('#') ? url.slice(url.indexOf('#') + 1) : '');
  const query = new URLSearchParams(url.includes('?') ? url.slice(url.indexOf('?') + 1).split('#')[0] : '');
  const access = hash.get('access_token');
  const refresh = hash.get('refresh_token');
  if (access && refresh) {
    const { error } = await db().auth.setSession({ access_token: access, refresh_token: refresh });
    return !error;
  }
  const code = query.get('code');
  if (code) {
    const { error } = await db().auth.exchangeCodeForSession(code);
    return !error;
  }
  return false;
}

/** Deletes the account and everything tied to it (places found, credits, loot, personal places). The server does it; this signs out afterwards. */
export async function deleteAccount(): Promise<boolean> {
  const { data, error } = await db().functions.invoke('delete-account', { body: { confirm: 'DELETE' } });
  if (error || !data?.ok) return false;
  await forgetFaceId(); // the account is gone, and so is anything saved to sign in to it
  await db().auth.signOut();
  return true;
}

/** Every place in a metro that counts has been looted: asks the server to confirm and pay the bonus (400 caps, once). */
export async function claimMetroClear(metroId: string, ids: string[]): Promise<{ awarded: boolean; caps: number; reason?: string }> {
  const { data, error } = await db().functions.invoke('metro-clear', { body: { metroId, ids } });
  if (error || !data) return { awarded: false, caps: 0, reason: 'server' };
  return { awarded: data.awarded === true, caps: Number(data.caps ?? 0), reason: data.ok === false ? String(data.reason ?? 'no') : undefined };
}

/** The places of a metro that count toward clearing it (Wikidata ids without the Q prefix removed: "Q123"). */
export async function loadClearable(metroId: string): Promise<string[]> {
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}data/clear/${metroId}.json`);
    return res.ok ? ((await res.json()) as string[]) : [];
  } catch { return []; }
}

// ---- the home vault (rules in vaultHome.ts; the server keeps the vault and spends the loot) ----

export type VaultAnswer = { ok: true; vault: VaultHome; version: number; /** Loot paid back for a demolished room. */ refund?: Record<string, number>; /** Pieces of loot the settlers took (one entry each: the loot id). */ stolen?: string[]; /** Settlers who left because there were not enough rooms for them. */ left?: { kind: string; name?: string }[] } | { ok: false; reason: string };

/** Asks the vault function to do something: 'visit', 'build', 'furnish' or 'settler'. */
export async function vaultCall(body: ({ action: 'visit' } | { action: 'build'; type: string; level: number; col: number; row: number; dir?: 'up' | 'down'; shape?: 'straight' | 'u' } | { action: 'furnish'; room: number; item: string; at?: { u: number; v: number; swap?: boolean } } | { action: 'place'; room: number; item: string; at: { u: number; v: number; swap?: boolean } } | { action: 'settler'; kind: string; name?: string } | { action: 'rename'; id: number; name: string } | { action: 'demolish'; room: number } | { action: 'instrument'; room: number; choice: string }) & { vault?: string }): Promise<VaultAnswer> {
  const { data, error } = await db().functions.invoke('vault', { body });
  return error || !data ? { ok: false, reason: 'server' } : (data as VaultAnswer);
}

// ---- vacation vaults (the vacation-vault function: it makes the picture with the vault door in it and takes the loot) ----

export type VacationAnswer = { ok: true; url: string } | { ok: false; error: string; resetsAt?: string };

/** Turns a discovered place into a vacation vault: its picture is made again with a vault door in it, and 8 pieces of loot are taken once it exists. */
export async function vacationUnlock(placeId: string, icon: string, replace?: string): Promise<VacationAnswer> {
  const { data, error } = await db().functions.invoke('vacation-vault', { body: { action: 'unlock', placeId, icon, replace } });
  if (error || !data) {
    // a refusal comes back as an error with a body: read what it said
    try { const body = await (error as { context?: Response } | null)?.context?.json?.(); if (body?.error) return { ok: false, error: String(body.error), resetsAt: body.resetsAt }; } catch { /* no body */ }
    return { ok: false, error: 'server' };
  }
  const r = data as { status?: string; url?: string; error?: string };
  if (r.status === 'ready' && r.url) return { ok: true, url: r.url };
  if (r.status === 'working') return { ok: false, error: 'working' };
  return { ok: false, error: r.error ?? 'server' };
}

/** A link to the picture of one of their vacation vaults (the place with the vault door in it). */
export async function vacationPicture(placeId: string): Promise<string | null> {
  const { data } = await db().functions.invoke('vacation-vault', { body: { action: 'url', placeId } });
  return (data as { url?: string } | null)?.url ?? null;
}

// ---- the gallery: the finished pictures this person has unlocked ----

export interface GalleryItem { id: string; name: string; city: string | null; lat: number | null; lng: number | null; at: string; kind: 'place' | 'address' | 'home'; /** For a personal address: what kind of building it is. */ pkind?: string }

/** Everything this person has unlocked that has a finished picture (with a name and a position for each), or null if it could not be read. */
export async function loadGallery(): Promise<GalleryItem[] | null> {
  const { data, error } = await db().functions.invoke('gallery', { body: {} });
  if (error || !data || !Array.isArray((data as { items?: unknown }).items)) return null;
  return (data as { items: GalleryItem[] }).items;
}

/** A link (good for an hour) to the finished picture of one they have unlocked. Reading only: it never makes a picture or charges anything. */
export async function galleryUrl(id: string): Promise<string | null> {
  const { data, error } = await db().functions.invoke('gallery', { body: { action: 'url', id } });
  return error || !data || typeof (data as { url?: unknown }).url !== 'string' ? null : (data as { url: string }).url;
}

/** The trades already bought from this four-hour board ("stimpak:wood", "time:gears"). */
export async function loadTradesBought(windowNo: number): Promise<Set<string>> {
  const { data } = await db().from('trade_purchases').select('item,trade_id').eq('window_no', windowNo);
  return new Set(((data ?? []) as { item: string; trade_id: string }[]).map((r) => `${r.item}:${r.trade_id}`));
}
