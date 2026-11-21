// Accounts and render credits: signing in, the credit balance, buying a pack, and unlocking a place's game-style render.
// All of the money logic lives on the server (supabase/functions); this only asks and shows.

import { deviceId } from './device';
import { APP_SCHEME, NATIVE_AUTH_REDIRECT, goTo, isNative, platform } from './native';
import type { PersonalPlace } from './personal';
import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';
import { STARTING_ARSENAL, type Arsenal, type WeaponClass } from './raid/weapons';
import type { LootBag, LootId } from './raid/loot';
import type { VaultHome } from './vaultHome';
import { forgetFaceId, offerFaceId, readFaceId } from './faceid';
import { fetchSite } from './siteData';

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

export interface Home { placeId?: string; name?: string; address?: string; lat?: number; lng?: number; skipped: boolean; /** The four-digit number of their home vault. */ vaultNumber?: number; /** The home is one of the pre-plotted places (its id, "wd:Q..."): it is counted once, and its building's icon sits in the cog. */ preplottedId?: string; /** The metro the home is in. */ metro?: string; /** The icon inside the home cog when the home is not an ordinary house. */ icon?: string }

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
  /** Places marked cleared only because no photograph could be found to render them from (no loot there). */
  noPhoto: Set<string>;
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
  const [noPhoto, setNoPhoto] = useState<Set<string>>(new Set());
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
    void db().from('raid_runs').select('place_id,metro_id,paid,loot,enemies').eq('user_id', s.user.id).eq('won', true).then((r) => {
      const rows = (r.data ?? []) as { place_id: string; metro_id: string | null; paid: boolean | null; loot: LootBag | null; enemies?: number }[];
      // places with no photograph to make a render from are marked cleared (a raid of no enemies, no loot)
      setNoPhoto(new Set(rows.filter((x) => x.enemies === 0).map((x) => x.place_id)));
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
    const readHome = () => db().from('user_home').select('place_id,name,address,lat,lng,skipped,vault_number,preplotted_id,home_metro,home_icon').eq('user_id', s.user.id).maybeSingle();
    void readHome().then(async (first) => {
      // no home row the first moment after signing in is looked for once more before the person is asked for their address (a brand new sign-in can be answered before it is ready)
      let r = first;
      if (!r.error && !r.data) { await new Promise((res) => setTimeout(res, 1800)); r = await readHome(); }
      // if the table is not there yet, do not nag about it
      if (r.error) setHome({ skipped: true });
      else setHome(r.data ? { placeId: r.data.place_id ?? undefined, name: r.data.name ?? undefined, address: r.data.address ?? undefined, lat: r.data.lat ?? undefined, lng: r.data.lng ?? undefined, skipped: !!r.data.skipped, vaultNumber: r.data.vault_number ?? undefined, preplottedId: r.data.preplotted_id ?? undefined, metro: r.data.home_metro ?? undefined, icon: r.data.home_icon ?? undefined } : null);
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
    const arrivedByLink = /access_token=|[?&]code=/.test(window.location.href);
    const { data } = db().auth.onAuthStateChange((event, next) => {
      if (event === 'SIGNED_IN' && arrivedByLink && next) void claimSession();
      setSession(next);
      void load(next);
    });
    // other devices: a sign-in elsewhere ends this session on the server; it is looked for every minute while signed in and whenever the app comes back
    const look = () => { if (document.visibilityState === 'visible') void checkSessionAlive(); };
    const timer = window.setInterval(look, 60_000);
    document.addEventListener('visibilitychange', look);
    return () => { data.subscription.unsubscribe(); window.clearInterval(timer); document.removeEventListener('visibilitychange', look); };
  }, []);

  const refresh = async () => {
    if (!accountsEnabled) return;
    const { data } = await db().auth.getSession();
    await load(data.session);
  };
  return { session, email: session?.user.email ?? null, credits, unlocked, discoveries, points, noPhoto, loot, stimpaks, legendaryTime, vacations, homeRooms, waiting, arsenal, cleared, personal, home, homeLoaded, metros, metrosCleared, clearedByMetro, clearedPaid, refresh, loaded };
}

/** The welcome gift of 500 caps for being signed in from the phone app: in the app it is claimed (once per person, the server checks); on the website it only asks whether it is still waiting. */
export async function welcomeBonus(): Promise<{ granted: boolean; waiting: boolean; caps?: number }> {
  const action = isNative() ? 'claim' : 'status';
  const device = action === 'claim' ? await deviceId() : null;
  const { data, error } = await db().functions.invoke('welcome-bonus', { body: { action, device }, headers: isNative() ? { 'x-client-info': `wastelandmaps-app-${platform()}` } : undefined });
  if (error || !data) return { granted: false, waiting: false };
  if (action === 'claim') return { granted: data.granted === true, waiting: false, caps: data.caps as number | undefined };
  return { granted: false, waiting: data.claimed === false };
}

/** One device at a time: signing in here signs every other device of this account out (their sessions end on the server; they notice within a minute, or when they are opened). */
export async function claimSession(): Promise<void> {
  try {
    // the account the Apple reviewers use may be signed in on several devices at once
    const { data } = await db().auth.getSession();
    if (data.session?.user.email?.toLowerCase() === 'welpcustomer@yahoo.com') return;
    await db().auth.signOut({ scope: 'others' });
  } catch { /* the other devices are signed out the next time they are checked */ }
}
/** Is this device's session still alive on the server? Only a refusal from the server ends it here (no connection is not a sign-out); it says so with an 'rm-session-ended' event. */
export async function checkSessionAlive(): Promise<void> {
  const { data } = await db().auth.getSession();
  if (!data.session) return;
  const { error } = await db().auth.getUser();
  const status = (error as { status?: number } | null)?.status;
  if (error && (status === 401 || status === 403 || /session.*(not found|missing|invalid)|invalid.*(jwt|token)/i.test(error.message))) {
    await db().auth.signOut({ scope: 'local' });
    window.dispatchEvent(new CustomEvent('rm-session-ended'));
  }
}

/** True after someone opened an emailed link (the web page was opened by it, or the app was): if their vault already has a number, they are asked to choose a new one (the "forgot my number" way back in). */
const openedType = typeof window !== 'undefined' ? new URLSearchParams(window.location.hash.slice(1)).get('type') : null;
const openedByLink = typeof window !== 'undefined' && /access_token=|[?&]code=/.test(window.location.hash + window.location.search);
let linkOpened = openedByLink && openedType !== 'recovery';
export const takeLinkOpened = (): boolean => { const was = linkOpened; linkOpened = false; return was; };
/** The emailed link that confirms deleting the account was opened (its email is the sign-in service's "recover" email, which says it is about deleting the account). */
let deleteLinkOpened = openedByLink && openedType === 'recovery';
export const takeDeleteLinkOpened = (): boolean => { const was = deleteLinkOpened; deleteLinkOpened = false; return was; };

/** At most this many emailed links per address in a rolling window, so a button pressed again and again does not keep sending mail. */
export const LINK_LIMIT = 3;
const LINK_WINDOW_MS = 12 * 3_600_000;
const LINK_KEY = 'rm-link-sends';
/** The App Store reviewers' test account is never held to the limit (it is deleted and registered again over and over while testing). */
const UNLIMITED_LINKS = 'welpcustomer@yahoo.com';
const recentLinkSends = (email: string): number[] => {
  if (email.trim().toLowerCase() === UNLIMITED_LINKS) return [];
  try {
    const all = JSON.parse(localStorage.getItem(LINK_KEY) ?? '{}') as Record<string, number[]>;
    return (all[email.trim().toLowerCase()] ?? []).filter((t) => Date.now() - t < LINK_WINDOW_MS);
  } catch { return []; }
};
const noteLinkSend = (email: string) => {
  try {
    const all = JSON.parse(localStorage.getItem(LINK_KEY) ?? '{}') as Record<string, number[]>;
    for (const k of Object.keys(all)) all[k] = all[k].filter((t) => Date.now() - t < LINK_WINDOW_MS);
    const key = email.trim().toLowerCase();
    all[key] = [...(all[key] ?? []), Date.now()];
    localStorage.setItem(LINK_KEY, JSON.stringify(all));
  } catch { /* the count is not kept: the server's own limits still apply */ }
};
/** How many more links this address can be sent right now. */
export const linksLeft = (email: string): number => Math.max(0, LINK_LIMIT - recentLinkSends(email).length);

/** Emails a sign-in link (the same link does the registering of a new vault and the reset of a forgotten vault number). Three per address in 12 hours; null when it was sent. */
export async function sendSignInLink(email: string): Promise<string | null> {
  const recent = recentLinkSends(email);
  if (recent.length >= LINK_LIMIT) {
    const again = new Date(Math.min(...recent) + LINK_WINDOW_MS).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    return `THREE LINKS HAVE BEEN SENT TO THIS EMAIL IN THE LAST 12 HOURS. CHECK THE INBOX AND THE SPAM FOLDER, OR TRY AGAIN AT ${again}.`;
  }
  const { error } = await db().auth.signInWithOtp({ email, options: { emailRedirectTo: isNative() ? NATIVE_AUTH_REDIRECT : window.location.origin + window.location.pathname } });
  if (!error) noteLinkSend(email);
  return error ? error.message : null;
}

/** Asks the server to check the email and the four-digit vault number (the real password behind the number is not guessable: see the vault-sign-in function) and, if they are right, signs in. */
async function vaultServerSignIn(email: string, digits: string): Promise<{ ok: true } | { ok: false; error: 'wrong' | 'locked' | 'server'; left?: number }> {
  const { data, error } = await db().functions.invoke('vault-sign-in', { body: { email: email.trim().toLowerCase(), digits } });
  if (!error && data?.ok === true && data.access_token && data.refresh_token) {
    const { error: set } = await db().auth.setSession({ access_token: String(data.access_token), refresh_token: String(data.refresh_token) });
    return set ? { ok: false, error: 'server' } : { ok: true };
  }
  const response = (error as { context?: Response } | null)?.context;
  if (response) {
    try {
      const body = (await response.json()) as { error?: string; left?: number };
      if (body.error === 'locked') return { ok: false, error: 'locked' };
      if (body.error === 'wrong') return { ok: false, error: 'wrong', left: body.left };
    } catch { /* no body */ }
  }
  return { ok: false, error: 'server' };
}

const LOCKED_MESSAGE = 'Too many wrong tries: this vault is locked. Tap REGISTER YOUR VAULT below, enter your email, and choose a new vault number from the link we send.';

/** Signs in with the email and the four-digit vault number. Five wrong tries lock the vault until its owner resets the number by email. Null when it worked. */
export async function signInWithVault(email: string, digits: string): Promise<string | null> {
  const r = await vaultServerSignIn(email, digits);
  if (r.ok) { offerFaceId(email, `vault-${digits}`); void claimSession(); return null; } // in the app, asks whether to use Face ID next time
  if (r.error === 'locked') return LOCKED_MESSAGE;
  if (r.error === 'server') return 'Signing in did not go through. Check your connection and try again.';
  const left = r.left !== undefined && r.left > 0 ? ` ${r.left} ${r.left === 1 ? 'try' : 'tries'} left before the vault locks.` : '';
  return `That email and vault number do not match. If this is your first time, or you forgot your vault number, tap REGISTER YOUR VAULT below and enter your email.${left}`;
}

/** Signs in with what Face ID (or Touch ID) unlocks for this email. Null when it worked, 'cancelled' when they backed out or the check did not match, else a message. */
export async function signInWithFaceId(email: string): Promise<string | null> {
  const saved = await readFaceId(email);
  if (saved === 'cancelled') return 'cancelled';
  if (!saved) return 'No sign-in is saved for that account on this phone. Sign in with your vault number.';
  const digits = /^vault-(d{4})$/.exec(saved.password)?.[1];
  const r = digits ? await vaultServerSignIn(saved.email, digits) : ({ ok: false, error: 'wrong' } as const);
  if (!r.ok) {
    if (r.error === 'locked') return LOCKED_MESSAGE;
    if (r.error === 'server') return 'Signing in did not go through. Check your connection and try again.';
    await forgetFaceId(email); // what was saved no longer works (the vault number changed): do not keep offering it
    return 'That saved sign-in no longer works. Sign in with your email and vault number.';
  }
  void claimSession();
  return null;
}

/** Makes the vault number the account's password (the server reads the number from the saved home). */
export async function setVaultPassword(email?: string | null, vaultNumber?: number): Promise<boolean> {
  const { data, error } = await db().functions.invoke('set-vault-password', { body: {} });
  const ok = !error && data?.ok === true;
  // changing a password can end the sessions that were open before it: sign in again with the new one so this device keeps a working session
  if (ok && email && vaultNumber !== undefined) {
    const digits = String(vaultNumber).padStart(4, '0');
    const again = await vaultServerSignIn(email, digits);
    if (again.ok) { await forgetFaceId(email); offerFaceId(email, `vault-${digits}`); } // a changed vault number means a changed saved sign-in
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
  /** The photograph the render was made from, when it was a free one (a typed-in place that has its own photo): the 'before' of the reveal. */
  before?: string;
  /** Who paid for the first render of this place (their callsign, when they are on the leaderboard) and when. */
  discovered?: { by: string | null; at: string };
}
export type UnlockResult =
  | { kind: 'ready'; render: Unlocked }
  | { kind: 'working' }
  | { kind: 'error'; reason: 'no_credits' | 'no_photo' | 'no_photo_cleared' | 'busy' | 'failed' | 'sign_in' | 'server'; /** For 'busy': when the day's count of new renders starts again (an ISO time). */ resetsAt?: string };

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
  if (data?.status === 'ready') return { kind: 'ready', render: { url: data.url as string, ...(data.rubble === true ? { rubble: true, refunded: Number(data.refunded) || undefined } : {}), ...(typeof data.before === 'string' ? { before: data.before } : {}), ...(data.discovered && typeof data.discovered.at === 'string' ? { discovered: data.discovered as Unlocked['discovered'] } : {}), credit: (data.credit as Unlocked['credit'] | undefined) ?? { photo: 'Street View', author: 'Google', license: '', page: 'https://www.google.com/streetview/' } } };
  if (data?.status === 'working') return { kind: 'working' };
  return { kind: 'error', reason: 'server' };
}

// ---- the leaderboard (see the leaderboard migration; a survivor joins to appear, under a made-up callsign) ----

export interface BoardRow { rank: number; callsign: string; level: number; places: number; /** This row is the signed-in person's own. */ mine: boolean; /** On the leaderboard and the contributor lists (false after leaving: the callsign is kept, only the listing goes). */ listed?: boolean }

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
  return error || !r ? null : { rank: r.rank === null ? 0 : Number(r.rank), callsign: r.callsign as string, level: Number(r.level), places: Number(r.places), mine: true, listed: r.listed !== false };
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

// ---- discoveries made with no signal (airplane mode, a terminal with no data) wait on the phone and are sent when it is back online ----

interface PendingFound { rows: FoundPlace[]; reports: { placeId: string; place: { lat: number; lng: number }; here: { lat: number; lng: number }; points: number }[] }
const pendingKey = (userId: string) => `wastelandmaps:pending-found:${userId}`;
const readPending = (userId: string): PendingFound => {
  try { const p = JSON.parse(localStorage.getItem(pendingKey(userId)) ?? 'null') as PendingFound | null; if (p && Array.isArray(p.rows) && Array.isArray(p.reports)) return p; } catch { /* nothing waiting */ }
  return { rows: [], reports: [] };
};
const writePending = (userId: string, p: PendingFound) => {
  try { if (p.rows.length === 0 && p.reports.length === 0) localStorage.removeItem(pendingKey(userId)); else localStorage.setItem(pendingKey(userId), JSON.stringify(p)); } catch { /* storage unavailable */ }
};
/** An answer that never came because there was no connection (as opposed to the server saying no). */
const offlineError = (e: { message?: string; name?: string } | null | undefined): boolean =>
  !!e && ((typeof navigator !== 'undefined' && navigator.onLine === false) || e.name === 'FunctionsFetchError' || /failed to fetch|network|load failed/i.test(e.message ?? ''));
let flushing = false;

/** Sends what was found while offline. Returns the XP those discoveries added (0 if nothing was waiting or the server still cannot be reached). */
export async function flushPendingDiscoveries(userId: string): Promise<number> {
  if (flushing) return 0;
  const waiting = readPending(userId);
  if (waiting.rows.length === 0 && waiting.reports.length === 0) return 0;
  flushing = true;
  let added = 0;
  try {
    const left: PendingFound = { rows: [], reports: [] };
    if (waiting.rows.length > 0) {
      const rows = waiting.rows.map((p) => ({ user_id: userId, place_id: p.id, name: p.name, old_name: p.oldName, metro_id: p.metroId, city: p.city, state: p.state, country: p.country, lat: p.lat, lng: p.lng }));
      let { error } = await db().from('found_places').upsert(rows.map((r, i) => ({ ...r, worth: waiting.rows[i].worth ?? null })), { onConflict: 'user_id,place_id', ignoreDuplicates: true });
      if (error && !offlineError(error)) ({ error } = await db().from('found_places').upsert(rows, { onConflict: 'user_id,place_id', ignoreDuplicates: true }));
      if (error && offlineError(error)) left.rows = waiting.rows;
    }
    for (const r of waiting.reports) {
      const { data, error } = await db().functions.invoke('report-discovery', { body: { placeId: r.placeId, lat: r.place.lat, lng: r.place.lng, userLat: r.here.lat, userLng: r.here.lng, points: r.points } });
      if (error && offlineError(error)) left.reports.push(r);
      else if (!error && data) added += (data as DiscoveryResult).added ?? 0;
    }
    writePending(userId, left);
  } finally { flushing = false; }
  return added;
}

/** Tells the server a place was reached on foot, worth `points`. Each new level reached gives a free snapshot credit. Null if it could not be recorded (with no connection it is kept and sent later). */
export async function reportDiscovery(placeId: string, place: { lat: number; lng: number }, here: { lat: number; lng: number }, points = 10, userId?: string): Promise<DiscoveryResult | null> {
  const { data, error } = await db().functions.invoke('report-discovery', { body: { placeId, lat: place.lat, lng: place.lng, userLat: here.lat, userLng: here.lng, points } });
  if (error && userId && offlineError(error)) {
    const p = readPending(userId);
    if (!p.reports.some((r) => r.placeId === placeId)) { p.reports.push({ placeId, place, here, points }); writePending(userId, p); }
  }
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
  if (!error) return;
  // no connection: kept on the phone and sent later
  if (offlineError(error)) {
    const p = readPending(userId);
    const have = new Set(p.rows.map((r) => r.id));
    p.rows.push(...places.filter((r) => !have.has(r.id)));
    writePending(userId, p);
    return;
  }
  // the worth column may not be there yet
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
    skipped: home.skipped, vault_number: home.vaultNumber ?? null, preplotted_id: home.preplottedId ?? null, home_metro: home.metro ?? null, home_icon: home.icon ?? null,
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
    if (!error) { void claimSession(); if (hash.get('type') === 'recovery') deleteLinkOpened = true; else linkOpened = true; }
    return !error;
  }
  const code = query.get('code');
  if (code) {
    const { error } = await db().auth.exchangeCodeForSession(code);
    if (!error) { void claimSession(); linkOpened = true; }
    return !error;
  }
  return false;
}

/** The first step of deleting the account: the server records the request and emails a link to the account's address. 'sent' (the account goes only when the link is opened), 'immediate' (the App Store
 *  reviewers' account, which has no inbox), or a message. */
export async function requestDeleteAccount(): Promise<'sent' | 'immediate' | string> {
  const { data, error } = await db().functions.invoke('delete-account', { body: { action: 'request', redirectTo: isNative() ? NATIVE_AUTH_REDIRECT : window.location.origin + window.location.pathname } });
  if (!error && data?.immediate === true) return 'immediate';
  if (!error && data?.sent === true) return 'sent';
  let reason = 'server';
  const response = (error as { context?: Response } | null)?.context;
  if (response) { try { reason = ((await response.json()) as { error?: string }).error ?? 'server'; } catch { /* no body */ } }
  if (reason === 'too_many') return 'THREE EMAILS HAVE BEEN SENT IN THE LAST 12 HOURS: CHECK THE INBOX AND THE SPAM FOLDER, OR TRY AGAIN LATER.';
  if (reason === 'wait') return 'AN EMAIL WAS JUST SENT: WAIT A MINUTE BEFORE ASKING AGAIN.';
  return 'THE EMAIL COULD NOT BE SENT. TRY AGAIN IN A MOMENT.';
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
    const res = await fetchSite(`data/clear/${metroId}.json`);
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

// ---- our own street view: the rendered pictures around a point (only for a metro whose atlas was bought) ----

export interface NeighborItem { id: string; name: string; kind: string; lat: number; lng: number; url: string; /** the building re-rendered as a straight-on front and a side (cut out on magenta), once made */ front?: string; side?: string; q35?: string; q65?: string }

export async function loadNeighborhood(lat: number, lng: number, places: { id: string; lat: number; lng: number; name: string }[]): Promise<{ items: NeighborItem[]; street: { lat: number; lng: number; bearing: number } | null; roads?: StreetRoad[]; pending?: boolean; viewsPending?: boolean } | null> {
  const { data, error } = await db().functions.invoke('neighborhood', { body: { lat, lng, places } });
  if (error || !data || !Array.isArray((data as { items?: unknown }).items)) return null;
  return data as { items: NeighborItem[]; street: { lat: number; lng: number; bearing: number } | null; roads?: StreetRoad[]; pending?: boolean; viewsPending?: boolean };
}

export interface StreetRoad { id: number; hw: string; pts: [number, number][] }

/** Remembers which metro the home is in (older homes did not have it kept). */
export async function saveHomeMetro(userId: string, metro: string): Promise<void> {
  await db().from('user_home').update({ home_metro: metro }).eq('user_id', userId);
}

// ---- Progress: Atlas ----

/** How many pre-plotted places have a finished render, by metro. */
export async function atlasRenderedCounts(): Promise<Map<string, number>> {
  const { data, error } = await db().rpc('atlas_rendered_counts');
  const out = new Map<string, number>();
  if (!error && Array.isArray(data)) for (const r of data as { metro_id: string; n: number | string }[]) out.set(r.metro_id, Number(r.n));
  return out;
}

export interface Contributor { callsign: string; n: number }

/** The survivors who have discovered the most pre-plotted places (in one metro when given), by callsign. */
export async function atlasContributors(metro?: string | null): Promise<Contributor[]> {
  const { data, error } = await db().rpc('atlas_contributors', { p_metro: metro ?? null, p_limit: 200 });
  return error || !Array.isArray(data) ? [] : (data as { callsign: string; n: number | string }[]).map((r) => ({ callsign: r.callsign, n: Number(r.n) }));
}

// ---- editing the account: callsign, email, passcode ----

const ADJECTIVES = ['Rusty', 'Glowing', 'Feral', 'Irradiated', 'Lone', 'Dusty', 'Hollow', 'Scorched', 'Ashen', 'Wandering', 'Salvaged', 'Bitter', 'Silent', 'Mutant', 'Atomic', 'Grim', 'Patched', 'Cracked', 'Vagrant', 'Hardy'];
const NOUNS = ['Wanderer', 'Mongoose', 'Courier', 'Scavenger', 'Raider', 'Ghoul', 'Settler', 'Ranger', 'Drifter', 'Scribe', 'Hound', 'Tinker', 'Brahmin', 'Sentinel', 'Nomad', 'Prospector', 'Hauler', 'Warden'];

/** A made-up callsign to try (nothing is kept until it is saved; the server still checks that it is free). */
export function randomCallsign(): string {
  const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
  return `${pick(ADJECTIVES)} ${pick(NOUNS)} ${10 + Math.floor(Math.random() * 90)}`;
}

/** The signed-in person's callsign, or null when they have none yet. */
export async function myCallsign(): Promise<string | null> {
  return (await myStanding())?.callsign ?? null;
}

/** Asks for the email to be changed: a link goes to the new address, and the same account (with everything on it) moves there once it is confirmed. Null when it was sent. */
export async function changeEmail(email: string): Promise<string | null> {
  const { error } = await db().auth.updateUser({ email }, { emailRedirectTo: isNative() ? NATIVE_AUTH_REDIRECT : window.location.origin + window.location.pathname });
  return error ? error.message : null;
}

/** Changes the vault number (the sign-in passcode), swapping the number on the vault door in the picture of the house when there is one. */
export async function swapVaultNumber(number: number): Promise<{ ok: boolean; swapped?: boolean; hadPicture?: boolean }> {
  const { data, error } = await db().functions.invoke('swap-vault-number', { body: { number } });
  return error || !data?.ok ? { ok: false } : { ok: true, swapped: data.swapped === true, hadPicture: data.hadPicture === true };
}
