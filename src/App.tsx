import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import LocationCard from './components/LocationCard';
import VaultHome from './components/VaultHome';
import MapView from './components/MapView';
import AccountModal from './components/AccountModal';
import FaceIdOffer from './components/FaceIdOffer';
import { loadNavHistory, pushNavHistory } from './lib/navHistory';
import { savedFaceIds } from './lib/faceid';
import SceneModal from './components/SceneModal';
import StreetWalk from './components/StreetWalk';
import BinocButton from './components/BinocButton';
import { accountsEnabled, welcomeBonus, atlasList, vacationUnlock, claimLoot, claimMetroClear, loadClearable, completeSignInFromUrl, loadAutoDiscover, loadFoundPlaces, loadMapPosition, renamePersonalPlace, reportDiscovery, saveAutoDiscover, saveFoundPlaces, saveHome, savePersonalPlace, setVaultPassword, saveMapPosition, useAccount, type AtlasPlace, type FoundPlace } from './lib/account';
import HomePrompt from './components/HomePrompt';
import { startPurchases } from './lib/iap';
import { keepScreenOn } from './lib/awake';
import { askForLocation, getFix, locationState, openLocationSettings, watchFixes, type GeoError } from './lib/geo';
import { isNative, onAppUrl, onResume, openExternal } from './lib/native';
import { addressAt, resolveSuggestion, type PickedPlace, type Suggestion } from './lib/addressSearch';
import { iconHtmlFor, landmarkIcon } from './lib/landmarkIcons';
import type { MapPosterInput } from './lib/poster';
import { placeIcon } from './lib/placeIcons';
import { personalId, personalLocation, type PersonalPlace } from './lib/personal';
import { enableNotifications, onNoticeTapped, pushNotice } from './lib/notify';
import { levelInfo, pointsFor } from './lib/points';
import { enemiesLine, homePlan, raidFor } from './lib/raid/raid';
import { freeRenderFor } from './lib/renders';
import { GLOBAL_LANDMARKS } from './lib/globalLandmarks';
import { VAULT_ZERO, VAULT_ZERO_ID } from './lib/vaultZero';
import { inAntarctica } from '../supabase/functions/_shared/antarctica';
import { photoIsOf } from './lib/snapshot';
import SearchBar from './components/SearchBar';
import SetupNotice from './components/SetupNotice';
import { AccountPanel, LocationsPanel, SharePanel } from './components/Panels';
import { geocodeLatLng, geocodeQuery, loadGoogle, type Region } from './lib/google';
import { dedupePlaces, loadIndex, loadMetro, metroAt, titleAt } from './lib/metros';
import { wastelandName } from './lib/lore';
import { loadFlood, type FloodPatch } from './lib/flood';
import { isIrradiated, loadZones, zoneFromEntry } from './lib/zones';
import { allLabels, countryBounds, deviceCountry, loadRegions, nameForZoom, NORTH_AMERICA, type RegionLabel } from './lib/regions';
import { LOOKS, type LookId } from './lib/looks';
import { readShareState, shareMapView } from './lib/share';
import { beep, type BeepKind } from './lib/sound';
import { buzz } from './lib/haptics';
import { START_MINUTES, type TravelRun } from './lib/travel';
import NavBanner from './components/NavBanner';
import { setVoiceEnabled, speak, spokenDistance, stopSpeaking, voiceEnabled } from './lib/voice';
import type { VacationChoice, VacationOffer } from './components/VaultHome';
import VacationAsk from './components/VacationAsk';
import CogSpinner from './components/CogSpinner';
import { carEnd, carUpdate, onCarEndRequested, type CarPayload } from './lib/carplay';
import { waitingLine } from './lib/waitingLoot';
import { ROOMS_FOR_VACATION } from './lib/vaultHome';
import { ferryUrl, isFerryByName, loadFerryIds, ROAD_STOPS_SHORT_M } from './lib/ferry';
import { currentFix, flightsUrl, isOverseas, progressAlong, requestRoute, spokenInstruction, type NavRoute } from './lib/navigation';
import {
  VAULT_ID, distanceMeters, generateWasteland, locationFromData, spotFromLocation, vaultSpot,
  type CategoryId, type LatLng, type Location, type Spot, type Wasteland,
} from './lib/wasteland';

type Tab = 'locations' | 'data' | 'share';
type Status = 'loading' | 'ready' | 'problem';

interface Trip { spot: Spot; minutes: number; rads: number; note: string }

export default function App() {
  const [initial] = useState(() => readShareState());
  const [status, setStatus] = useState<Status>('loading');
  const [problem, setProblem] = useState('');
  const [look, setLook] = useState<LookId>(initial.look ?? 'pipboy');
  const [tab, setTab] = useState<Tab>('locations');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('AWAITING COORDINATES');
  const [query, setQuery] = useState(initial.query ?? '');
  const [region, setRegion] = useState<Region | null>(null);
  const [wasteland, setWasteland] = useState<Wasteland | null>(null);
  const [locations, setLocations] = useState<Location[]>([]);
  const [hidden, setHidden] = useState<Set<CategoryId>>(new Set());
  // the person's own unlocked places (addresses): shown or hidden as a whole, on the map and in the list
  const [personalOn, setPersonalOn] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [soundOn, setSoundOn] = useState(true); // on, in the app and on the website (it can be switched off)

  // the survivor: where they stand, what time it is, how irradiated they are, what they have seen
  const [player, setPlayer] = useState<LatLng | null>(null);
  const [hereId, setHereId] = useState<string | null>(null);
  const [, setClock] = useState(START_MINUTES);
  const [, setRads] = useState(0);
  const [visited, setVisited] = useState<Set<string>>(new Set());
  const [tracking, setTracking] = useState(false);
  // where the device is now (while AUTO-DISCOVER is on), and the driving navigation to a place
  const [fix, setFix] = useState<LatLng | null>(null);
  const fixRef = useRef<LatLng | null>(null);
  const [nav, setNav] = useState<{ spot: Spot; route: NavRoute | null; step: number; toTurn: number | null; remaining: number | null; busy: string; /** Walking directions (the person tapped the walking man); driving ones otherwise. */ walking?: boolean } | null>(null);
  const navRef = useRef(nav);
  const offStreak = useRef(0);
  const shownFix = useRef<LatLng | null>(null);
  // when the YOU marker has been taken away (a new scan with no position, say), the next reading puts it back, however near it is to where it last was
  const playerNow = useRef<LatLng | null>(null);
  useEffect(() => { playerNow.current = player; }, [player]);
  const speedTrail = useRef<{ t: number; p: LatLng }[]>([]);
  const lastReroute = useRef(0);
  const [flash, setFlash] = useState(false);
  // the "+50 XP" that flashes on the map when a place is discovered
  const [xpFlash, setXpFlash] = useState<{ text: string; id: number } | null>(null);
  const xpTimer = useRef<number | undefined>(undefined);
  const [flightLink, setFlightLink] = useState<{ url: string; place: string; ferry?: boolean } | null>(null);
  // everything this survivor has found (kept on the account when signed in)
  const [found, setFound] = useState<FoundPlace[]>([]);
  const foundRef = useRef<FoundPlace[]>([]);
  const pendingOpen = useRef<{ id: string; scene: boolean } | null>(null);
  const [liveName, setLiveName] = useState('');
  // while zoomed out the top of the map names the continent, country or state instead of the city
  const [zoomName, setZoomName] = useState<string | null>(null);
  /** The home vault, opened straight from its card on the map (the title is its name). Null when it is not open. */
  const [vaultOpen, setVaultOpen] = useState<{ title: string; key?: string } | null>(null);
  // the title at the top of the screen never spills out of its box: a long name takes smaller letters, down to a floor
  const titleRef = useRef<HTMLDivElement | null>(null);
  const [regionLabels, setRegionLabels] = useState<RegionLabel[]>([]);
  const [flood, setFlood] = useState<FloodPatch[]>([]);
  const [startView, setStartView] = useState<React.ComponentProps<typeof MapView>['startView']>(null);
  const started = useRef(false);
  const lastSaved = useRef(0);
  const accountRef = useRef<ReturnType<typeof useAccount> | null>(null);
  const scanId = useRef(0);
  const metroSeen = useRef<{ current: string; loaded: Set<string>; title?: string }>({ current: '', loaded: new Set() });
  const viewTimer = useRef<number | undefined>(undefined);
  const busyRef = useRef(false);
  const wastelandRef = useRef<Wasteland | null>(null);
  const autoStarted = useRef(false);
  const travelRef = useRef(false);
  const [travel, setTravel] = useState<TravelRun | null>(null);
  const [sceneId, setSceneId] = useState<string | null>(null);
  // a place opens on its info (the scene); only the Data tab's snapshot button opens it on the snapshot
  const [sceneStart, setSceneStart] = useState<'scene' | 'snapshot'>('scene');
  /** Set when they said yes to "clear the area now": the place's scene opens straight into the fight. */
  const [sceneRaid, setSceneRaid] = useState(false);
  /** The question after discovering a place whose snapshot they have but whose enemies they have not cleared. */
  const [clearAsk, setClearAsk] = useState<{ id: string; name: string; lat?: number; lng?: number; radiusKm?: number } | null>(null);
  const [toast, setToast] = useState('');
  const account = useAccount();
  // an address picked from the search that has not been reached yet (only a destination), and the person's own places near this map
  const [target, setTarget] = useState<PersonalPlace | null>(null);
  useEffect(() => {
    if (!target) return;
    const here = { lat: target.lat, lng: target.lng };
    const landmark = locations.find((l) => !l.personal && (l.famous || freeRenderFor(l.id)) && (distanceMeters(l.position, here) < 40 || (distanceMeters(l.position, here) < 250 && photoIsOf(l.oldName || l.name, target.name))));
    if (!landmark) return;
    setTarget(null);
    setSelectedId(landmark.id);
  }, [target, locations]);
  // an address held on the map (not one of the pre-plotted places) is only a visitor: when its card is closed and the scene is not open, its pin and name tag go, unless the address is theirs
  // (rendered and saved, so it is in their list) or on the map from the Project: Atlas (those have their own pins); one just unlocked and not yet saved stays until it is saved
  useEffect(() => {
    if (selectedId !== null || sceneId !== null || !target) return;
    if (account.unlocked.has(personalId(target.placeId)) && !account.personal.some((q) => q.placeId === target.placeId)) return;
    setTarget(null);
  }, [selectedId, sceneId, target, account.unlocked, account.personal]);
  const personalLocs = useMemo(() => {
    const here = region?.center;
    const mine = account.personal.filter((q) => !here || distanceMeters(here, { lat: q.lat, lng: q.lng }) < 150_000 || account.home?.placeId === q.placeId).map((q) => personalLocation(q, true, account.home?.vaultNumber !== undefined && account.home.placeId === q.placeId ? account.home.vaultNumber : undefined));
    if (target && !account.personal.some((q) => q.placeId === target.placeId)) mine.push(personalLocation(target, false));
    return mine;
  }, [account.personal, account.home, target, region]);
  // the metro on the map (its Project: Atlas), the addresses other survivors rendered there when this person has unlocked the metro, and the home prompt
  const [metroInfo, setMetroInfo] = useState<{ id: string; name: string; lat?: number; lng?: number; radiusKm?: number } | null>(null);
  const [atlas, setAtlas] = useState<AtlasPlace[]>([]);
  const [homeOpen, setHomeOpen] = useState(false);
  const [homeSkipped, setHomeSkipped] = useState(false);
  // in the app: the sign-in email opens the app with a link, and coming back from a purchase should show the new balance
  useEffect(() => onAppUrl((url) => { void completeSignInFromUrl(url).then((ok) => { if (ok) void account.refresh(); }); }), [account]);
  useEffect(() => onResume(() => { if (accountRef.current?.session) void accountRef.current.refresh(); }), []);
  // in the iPhone app: a purchase that was paid for but never reached the server (a dropped connection, the app closed mid-purchase) is picked up again here
  const signedInUser = account.session?.user.id;
  useEffect(() => (signedInUser ? startPurchases(() => void accountRef.current?.refresh()) : undefined), [signedInUser]);
  const atlasLocs = useMemo(() => atlas
    .filter((a) => !account.personal.some((q) => q.placeId === a.placeId))
    .map((a) => {
      const loc = personalLocation({ placeId: a.placeId, name: a.name, address: a.address, lat: a.lat, lng: a.lng, kind: a.kind }, true);
      return { ...loc, personal: { ...(loc.personal as NonNullable<Location['personal']>), atlas: true } };
    }), [atlas, account.personal]);
  const personalLocsRef = useRef(personalLocs);
  personalLocsRef.current = personalLocs;
  const allLocations = useMemo(() => [...locations, ...personalLocs, ...atlasLocs], [locations, personalLocs, atlasLocs]);
  // what the map draws and what can be opened: the loaded city's places plus the permanent landmarks of the rest of the world
  const mapLocations = useMemo(() => {
    const have = new Set(allLocations.map((l) => l.id));
    const base = [...allLocations, ...GLOBAL_LANDMARKS.filter((g) => !have.has(g.id))];
    if (account.vacations.length === 0) return base;
    // a vacation vault is drawn as a vault cog with the place's old icon inside, wherever it is (even when its own metro is not the one loaded)
    const byId = new Map(account.vacations.map((v) => [v.placeId, v]));
    const out = base.map((l) => { const v = byId.get(l.id); return v ? { ...l, icon: `vacation:${v.icon}` as Location['icon'], famous: true } : l; });
    const present = new Set(out.map((l) => l.id));
    for (const v of account.vacations) {
      if (present.has(v.placeId)) continue;
      out.push({ ...locationFromData(v.placeId, v.name, { lat: v.lat, lng: v.lng }, 'other', 999), icon: `vacation:${v.icon}` as Location['icon'], famous: true });
    }
    return out;
  }, [allLocations, account.vacations]);
  /** The place whose vacation-vault question is open (tapped on the map, in the list of places, or on the Data tab). */
  const [vacationAsk, setVacationAsk] = useState<VacationChoice | null>(null);
  const vacationIds = useMemo(() => new Set(account.vacations.map((v) => v.placeId)), [account.vacations]);
  /** Vacation vaults: the places they have discovered more than 80 km from home (outside the home metro area), and the way to turn one into a vault. */
  const vacationOffer = useMemo<VacationOffer | undefined>(() => {
    const h = account.home;
    if (!account.session || h?.lat === undefined || h?.lng === undefined) return undefined;
    const home = { lat: h.lat, lng: h.lng };
    const have = new Set(account.vacations.map((v) => v.placeId));
    const choices: VacationOffer['choices'] = [];
    const seen = new Set<string>();
    const add = (placeId: string, name: string, lat: number, lng: number, icon: string) => {
      if (have.has(placeId) || seen.has(placeId) || !account.cleared.has(placeId)) return;
      const km = distanceMeters(home, { lat, lng }) / 1000;
      if (km < 80) return;
      seen.add(placeId);
      choices.push({ placeId, name, icon, km });
    };
    for (const f of found) add(f.id, f.name, f.lat, f.lng, mapLocations.find((l) => l.id === f.id)?.icon ?? 'monument');
    // an address typed in whose snapshot has been unlocked
    for (const p of account.personal) if (account.unlocked.has(`me:${p.placeId}`)) add(`me:${p.placeId}`, p.name, p.lat, p.lng, mapLocations.find((l) => l.id === `me:${p.placeId}`)?.icon ?? 'house');
    choices.sort((a, b) => a.km - b.km);
    return {
      choices,
      count: account.vacations.length,
      ready: account.homeRooms >= ROOMS_FOR_VACATION,
      mine: account.vacations.map((v) => ({ placeId: v.placeId, name: v.name })),
      unlock: async (placeId, icon, replace) => {
        const r = await vacationUnlock(placeId, icon, replace);
        if (r.ok) { await account.refresh(); return null; }
        const says: Record<string, string> = {
          loot: 'NOT ENOUGH LOOT', not_cleared: 'CLEAR THAT PLACE FIRST', not_yours: 'THAT VACATION VAULT IS NOT YOURS TO REPLACE', full: 'YOU ALREADY HAVE ALL FOUR VACATION VAULTS', too_close: 'THAT PLACE IS INSIDE YOUR HOME METRO AREA', too_few_rooms: 'BUILD TWELVE ROOMS FIRST',
          no_picture: 'NO PICTURE OF THAT PLACE COULD BE FOUND: PICK ANOTHER. NOTHING WAS TAKEN', failed: 'THE PICTURE COULD NOT BE MADE. NOTHING WAS TAKEN: TRY AGAIN',
          working: 'IT IS BEING MADE: TRY AGAIN IN A MINUTE', busy: 'THE VAULT PROJECTOR IS DOWN FOR NOW. NOTHING WAS TAKEN',
        };
        return says[r.error] ?? 'COULD NOT DO THAT RIGHT NOW';
      },
    };
  }, [account, found, mapLocations]);
  /** The icon of a found place, for the Data tab's list: the place's own when it is on the loaded map, the landmark's when it is a permanent one. */
  const iconOfFound = useCallback((id: string): string => {
    const loc = mapLocations.find((l) => l.id === id);
    return iconHtmlFor(id, placeIcon(loc?.icon ?? 'monument'));
  }, [mapLocations]);
  // every place of this metro that counts (buildings and landmarks with a photograph) looted: the metro is cleared, and 400 caps are paid, once
  const claimingClear = useRef<string | null>(null);
  useEffect(() => {
    if (!account.session || !metroInfo || account.metrosCleared.has(metroInfo.id) || claimingClear.current === metroInfo.id) return;
    const metro = metroInfo.id;
    let cancelled = false;
    void loadClearable(metro).then(async (list) => {
      if (cancelled || list.length === 0) return;
      const base = new Set(list.map((q) => `wd:${q}`));
      // the ones on the map that can be looted (the vault entrances and story sites cannot)
      const shown = locations.filter((l) => base.has(l.id) && !l.vault && !l.lore).map((l) => l.id);
      if (shown.length === 0 || base.size - shown.length > Math.max(2, Math.floor(base.size * 0.15))) return;
      if (!shown.every((id) => account.clearedPaid.has(id))) return;
      claimingClear.current = metro;
      const result = await claimMetroClear(metro, shown);
      if (result.awarded) {
        setToast(`${(metroInfo.name || 'METRO').toUpperCase()} CLEARED: +${result.caps} CAPS`);
        window.clearTimeout(toastTimer.current);
        toastTimer.current = window.setTimeout(() => setToast(''), 6000);
        buzz('levelup');
        void pushNotice('Metro cleared', `You cleared every place in ${metroInfo.name}: +${result.caps} caps`);
      }
      if (result.awarded || !result.reason) void account.refresh();
      else claimingClear.current = null; // not confirmed yet: try again when something changes
    });
    return () => { cancelled = true; };
  }, [account.session, account.clearedPaid, account.metrosCleared, metroInfo, locations]);
  // how far along each metro is (the ones started or cleared), for the Data tab: its places that count, and how many of them are looted
  const [metroRows, setMetroRows] = useState<{ id: string; name: string; done: number; total: number; cleared: boolean }[]>([]);
  useEffect(() => {
    if (!account.session) { setMetroRows([]); return; }
    let cancelled = false;
    void (async () => {
      const ids = new Set<string>([...account.clearedByMetro.keys(), ...account.metrosCleared]);
      // the metro on the map counts too, even for places looted before progress was kept by metro
      if (metroInfo) ids.add(metroInfo.id);
      const index = await loadIndex();
      const rows = await Promise.all([...ids].map(async (id) => {
        const list = await loadClearable(id);
        const base = new Set(list.map((q) => `wd:${q}`));
        const done = new Set<string>([...(account.clearedByMetro.get(id) ?? [])].filter((p) => base.has(p)));
        if (metroInfo?.id === id) for (const l of locations) if (base.has(l.id) && account.clearedPaid.has(l.id)) done.add(l.id);
        return { id, name: index.find((m) => m.id === id)?.title ?? id, done: done.size, total: base.size, cleared: account.metrosCleared.has(id) };
      }));
      if (!cancelled) setMetroRows(rows.filter((r) => r.total > 0 && (r.done > 0 || r.cleared)).sort((a, b) => Number(b.cleared) - Number(a.cleared) || b.done / b.total - a.done / a.total));
    })();
    return () => { cancelled = true; };
  }, [account.session, account.clearedByMetro, account.metrosCleared, account.clearedPaid, metroInfo, locations]);
  const atlasOwned = !!metroInfo && account.metros.has(metroInfo.id);
  useEffect(() => {
    if (!account.session || !metroInfo || !atlasOwned) { setAtlas([]); return; }
    let cancelled = false;
    void atlasList(metroInfo.id).then((list) => { if (!cancelled) setAtlas(list); });
    return () => { cancelled = true; };
  }, [account.session, metroInfo, atlasOwned]);

  const [accountOpen, setAccountOpen] = useState(false);
  // in the app, opening signed out with an account saved behind Face ID: the sign-in opens by itself and starts the check
  const [accountAuto, setAccountAuto] = useState(false);
  const autoFaceTried = useRef(false);
  useEffect(() => {
    if (autoFaceTried.current || !isNative() || !accountsEnabled || !account.loaded || account.session) return;
    autoFaceTried.current = true;
    if (savedFaceIds().length > 0) { setAccountAuto(true); setAccountOpen(true); }
  }, [account.loaded, account.session]);
  /** Anything about the account: signed out, the sign-in; signed in, the Data tab (credits, packs, home, sign out and delete are all there). */
  const openAccount = useCallback(() => {
    if (accountRef.current?.session) {
      setSceneId(null);
      setTab('data');
      document.querySelector('.rm-tabs')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      setAccountOpen(true);
    }
  }, []);
  const trip = useRef<Trip | null>(null);
  const homeId = account.home?.placeId ? personalId(account.home.placeId) : null;
  const shownVisited = useMemo(() => {
    const foundIds = new Set(found.map((f) => f.id));
    const all = new Set([...visited].filter((id) => !id.startsWith('me:') || foundIds.has(id)));
    if (homeId) all.add(homeId);
    return all;
  }, [visited, homeId, found]);
  const visitedRef = useRef(visited);
  /** The places they have found in metros other than the one on the map (loaded for the Data tab, so each row can say what is there). */
  const [foundLocs, setFoundLocs] = useState<Map<string, Location>>(new Map());
  useEffect(() => {
    if (tab !== 'data' || found.length === 0) return;
    let off = false;
    const wanted = new Set(found.map((f) => f.id));
    const metroIds = new Set(found.map((f) => f.metroId).filter((m): m is string => !!m));
    void loadIndex().then(async (index) => {
      const next = new Map<string, Location>();
      for (const id of metroIds) {
        const entry = index.find((m) => m.id === id);
        if (!entry) continue;
        for (const l of await loadMetro(entry)) if (wanted.has(l.id)) next.set(l.id, l);
        if (off) return;
      }
      if (!off) setFoundLocs(next);
    });
    return () => { off = true; };
  }, [tab, found]);
  const locationOf = useCallback((id: string): Location | undefined => mapLocations.find((l) => l.id === id) ?? foundLocs.get(id), [mapLocations, foundLocs]);
  // an address typed in whose snapshot has been paid for becomes one of their own places at once (on the map with its icon, and in the Data tab's waiting list until they have been there)
  const savedUnlocked = useRef(new Set<string>());
  useEffect(() => {
    const who = account.session;
    if (!who || !target) return;
    if (!account.unlocked.has(personalId(target.placeId)) || account.personal.some((q) => q.placeId === target.placeId) || savedUnlocked.current.has(target.placeId)) return;
    savedUnlocked.current.add(target.placeId);
    void savePersonalPlace(who.user.id, target).then(() => account.refresh());
  }, [account, target]);
  const toastTimer = useRef<number | undefined>(undefined);

  const soundRef = useRef(false);
  const lookRef = useRef(look);
  const locationsRef = useRef(allLocations);
  const foundKey = useRef('');
  useEffect(() => {
    soundRef.current = soundOn;
    lookRef.current = look;
    visitedRef.current = visited;
    locationsRef.current = allLocations;
    busyRef.current = busy;
    wastelandRef.current = wasteland;
    travelRef.current = !!travel;
    navRef.current = nav;
  }, [soundOn, look, visited, allLocations, busy, travel, wasteland, nav]);

  /** A sound and a buzz for a moment of the game (the buzz has its own switch; the sound follows SOUND). */
  const sound = useCallback((kind: BeepKind) => {
    buzz(kind);
    if (soundRef.current) beep(kind);
  }, []);

  // the welcome gift: in the app, 500 caps the first time they are signed in (right away for someone who registered in the app, or the next time for someone who registered on the website);
  // on the website, a flashing reminder to download the app while the gift is still waiting
  const giftAsked = useRef<string | null>(null);
  useEffect(() => {
    const id = account.session?.user.id;
    if (!id || giftAsked.current === id) return;
    giftAsked.current = id;
    void welcomeBonus().then(async (r) => {
      if (r.granted) { await account.refresh(); setToast(`WELCOME, SURVIVOR: +${r.caps ?? 500} CAPS`); window.clearTimeout(toastTimer.current); toastTimer.current = window.setTimeout(() => setToast(''), 4200); sound('discover'); }
      else if (r.waiting) { setToast('DOWNLOAD THE APP AND GET 500 FREE CAPS'); window.clearTimeout(toastTimer.current); toastTimer.current = window.setTimeout(() => setToast(''), 6000); }
    });
  }, [account.session]); // eslint-disable-line react-hooks/exhaustive-deps
  // the Pip-Boy powers up when a sign-in finishes (Face ID, vault number or the emailed link, whichever it was): the chime and the buzz, played here so every way of signing in has them
  const signInSeen = useRef<string | null | undefined>(undefined);
  const signInOpened = useRef(false);
  useEffect(() => {
    if (accountOpen) signInOpened.current = true;
    const id = account.session?.user.id ?? null;
    if (signInSeen.current === null && id && signInOpened.current) sound('arrive');
    if (id) signInOpened.current = false;
    signInSeen.current = id;
  }, [account.session, accountOpen, sound]);

  // the names of the continents, countries and states
  useEffect(() => {
    void loadRegions().then((data) => data && setRegionLabels(allLabels(data)));
  }, []);

  // coming back from Stripe: say so, refresh the balance, and tidy the address bar
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const result = params.get('purchase');
    if (!result) return;
    window.history.replaceState(null, '', window.location.pathname);
    setToast(result === 'success' ? 'PAYMENT RECEIVED: YOUR CAPS ARE ON THE WAY' : 'CHECKOUT CANCELLED');
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(''), 4500);
    if (result === 'success') {
      // the payment confirmation reaches us a moment after the redirect: check a few times
      [1500, 4000, 8000].forEach((ms) => window.setTimeout(() => void account.refresh(), ms));
    }
    // only on arrival
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // the page's colors follow the look
  useEffect(() => {
    document.documentElement.dataset.look = look;
  }, [look]);

  /** Keeps places on the survivor's record with their city, state and country, and on the account when signed in. */
  const recordFound = useCallback(async (places: Location[]) => {
    const real = places.filter((p) => p.id !== VAULT_ID);
    if (real.length === 0) return;
    const metros = await loadIndex();
    const rows: FoundPlace[] = real.map((p) => {
      const m = metroAt(metros, p.position, 40);
      const code = m ? m.id.split('-')[1] : '';
      return {
        id: p.id, name: p.name, oldName: p.oldName && p.oldName !== p.name ? p.oldName : null, metroId: m?.id ?? null, city: m?.name ?? null,
        state: m && ['US', 'AU'].includes(m.country) && /^[a-z]{2,3}$/.test(code) ? code.toUpperCase() : null, country: m?.country ?? null,
        lat: p.position.lat, lng: p.position.lng, foundAt: new Date().toISOString(), worth: pointsFor(p),
      };
    });
    const have = new Set(foundRef.current.map((f) => f.id));
    const fresh = rows.filter((r) => !have.has(r.id));
    if (fresh.length === 0) return;
    foundRef.current = [...fresh, ...foundRef.current];
    setFound(foundRef.current);
    const who = accountRef.current?.session;
    return who ? saveFoundPlaces(who.user.id, fresh) : undefined;
  }, []);

  /** Marks places as discovered (filled in on the map) and remembers them in this browser, per city. */
  /** The addresses of their own being discovered right now (so one visit is not counted twice while the answer is on its way). */
  const discovering = useRef(new Set<string>());
  const markFound = useCallback((all: Location[], onFoot?: LatLng) => {
    // an address they travelled to goes on their own map (when signed in) and nowhere else
    for (const mine of all.filter((p) => p.personal)) {
      const who = accountRef.current?.session;
      const kept = accountRef.current?.personal.some((q) => personalId(q.placeId) === mine.id);
      // the home is theirs from the start; any other saved place (one whose snapshot was unlocked) still has to be reached once
      if (mine.personal?.home || (kept && foundRef.current.some((f) => f.id === mine.id)) || discovering.current.has(mine.id)) continue;
      if (!who) {
        setToast('SIGN IN TO KEEP THIS PLACE ON YOUR PERSONAL MAP');
      } else {
        discovering.current.add(mine.id);
        void (kept ? Promise.resolve() : savePersonalPlace(who.user.id, { placeId: mine.id.slice(3), name: mine.name, address: mine.personal?.address ?? '', lat: mine.position.lat, lng: mine.position.lng, kind: mine.personal?.kind ?? 'house' }))
          .then(() => accountRef.current?.refresh())
          .then(() => setToast(`DISCOVERED: ${mine.name}`))
          .then(async () => {
            await recordFound([mine]);
            const seen = new Set(visitedRef.current);
            seen.add(mine.id);
            visitedRef.current = seen;
            setVisited(seen);
            // an address from a city atlas they bought is worth exactly 1 XP (the server checks they own that atlas); one they typed in and unlocked, 10: both only now that they have been there
            if (onFoot) {
              const result = await reportDiscovery(mine.id, mine.position, onFoot, mine.personal?.atlas ? 1 : 10);
              if (result && (result.added ?? 0) > 0) {
                setXpFlash({ text: `+${result.added ?? 1} XP`, id: Date.now() });
                buzz('xp');
                window.clearTimeout(xpTimer.current);
                xpTimer.current = window.setTimeout(() => setXpFlash(null), 2600);
              }
            }
            // what they cleared from afar and has been waiting for them
            const paid = await claimLoot(mine.id);
            if (paid.claimed > 0) {
              const list = Object.entries(paid.loot).filter(([, n]) => (n ?? 0) > 0).map(([id, n]) => `+${n} ${id.toUpperCase()}`).join(' ');
              setToast(`LOOT AWARDED FROM ${mine.name.toUpperCase()}: ${list || 'PACK FULL'}`);
              window.clearTimeout(toastTimer.current);
              toastTimer.current = window.setTimeout(() => setToast(''), 6000);
            }
            void accountRef.current?.refresh();
          });
      }
      window.clearTimeout(toastTimer.current);
      toastTimer.current = window.setTimeout(() => setToast(''), 4200);
    }
    const places = all.filter((p) => !p.personal);
    const fresh = places.filter((p) => !visitedRef.current.has(p.id));
    if (fresh.length === 0) return;
    const next = new Set(visitedRef.current);
    fresh.forEach((p) => next.add(p.id));
    visitedRef.current = next;
    setVisited(next);
    try { localStorage.setItem(foundKey.current, JSON.stringify([...next])); } catch { /* storage unavailable */ }
    // a permanent landmark fought from afar pays its waiting loot now that it has been discovered
    void Promise.resolve(recordFound(fresh)).then(async () => {
      if (!accountRef.current?.session) return;
      const acc = accountRef.current;
      // a place whose snapshot they hold (or a permanent landmark) that they have not cleared: ask whether to clear the area now
      const ask = fresh.find((q) => (freeRenderFor(q.id) || acc.unlocked.has(q.id)) && !acc.cleared.has(q.id) && !q.lore && !q.vault);
      if (ask) {
        setClearAsk({ id: ask.id, name: ask.name });
        void pushNotice(`Discovered ${ask.name}`, 'Clear the area now? Tap to open the fight.', ask.id);
      }
      for (const p of fresh.filter((q) => freeRenderFor(q.id) || acc.waiting.has(q.id))) {
        const paid = await claimLoot(p.id);
        if (paid.claimed > 0) {
          const list = Object.entries(paid.loot).filter(([, n]) => (n ?? 0) > 0).map(([id, n]) => `+${n} ${id.toUpperCase()}`).join(' ');
          setToast(`LOOT AWARDED FROM ${p.name.toUpperCase()}: ${list || 'PACK FULL'}`);
          window.clearTimeout(toastTimer.current);
          toastTimer.current = window.setTimeout(() => setToast(''), 6000);
          void pushNotice('Loot awarded', `You discovered ${p.name}: ${list || 'your pack was full'}`);
          void accountRef.current?.refresh();
        }
      }
    });
    // "Discovered: <new name>, formerly <old name>", in the page and, if allowed, as a notification
    const said = fresh.map((p) => (p.oldName && p.oldName !== p.name ? `${p.name}, formerly ${p.oldName}` : p.name));
    setToast(`DISCOVERED: ${said.join(' | ')}`);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(''), 4200);
    buzz('discover');
    if (soundRef.current) beep('discover');
    // reaching places on foot earns XP; every level reached gives a free snapshot credit
    const who = accountRef.current?.session;
    // signed in and on foot: the notification waits for the XP, so it can say "+50 XP" too
    if (!(onFoot && who)) void pushNotice('Discovered', said.join('\n'));
    if (onFoot && who) {
      void (async () => {
        let added = 0;
        let credits = 0;
        let level = 0;
        let vaultFound: { added: number; loot: Partial<Record<string, number>> } | null = null;
        for (const p of fresh) {
          if (!/^(wd:Q\d+|vault:\d+|famous:[a-z0-9-]+|lore:[a-z0-9-]+)$/.test(p.id)) continue;
          const result = await reportDiscovery(p.id, p.position, onFoot, pointsFor(p));
          added += result?.added ?? 0;
          if (p.id === VAULT_ZERO_ID && (result?.added ?? 0) > 0) vaultFound = { added: result?.added ?? 0, loot: result?.loot ?? {} };
          if (result?.bonus) { credits += result.given; level = result.level ?? level; }
        }
        if (added > 0) {
          // on the map if it is in front of them, as a notification if the page is in the background
          setXpFlash({ text: `+${added} XP`, id: Date.now() });
          buzz('xp');
          if (soundRef.current) beep('xp');
          window.clearTimeout(xpTimer.current);
          xpTimer.current = window.setTimeout(() => setXpFlash(null), 2600);
        }
        if (credits > 0) {
          window.setTimeout(() => {
            buzz('levelup');
            if (soundRef.current) beep('levelup');
            setToast(`LEVEL UP${level ? `: LEVEL ${level}` : ''}. ${credits * 100} FREE CAPS EARNED`);
            window.clearTimeout(toastTimer.current);
            toastTimer.current = window.setTimeout(() => setToast(''), 5200);
          }, 1400);
        }
        if (vaultFound) {
          // the one most people will never see: they are standing in Antarctica, and Vault Tech Headquarters is theirs
          const found: { added: number; loot: Partial<Record<string, number>> } = vaultFound;
          const list = Object.entries(found.loot).filter(([, n]) => (n ?? 0) > 0).map(([id, n]) => `+${n} ${id.toUpperCase()}`).join(' ');
          window.setTimeout(() => {
            setToast(`YOU FOUND VAULT TECH HEADQUARTERS! +${found.added} XP${list ? ` · ${list}` : ''}`);
            window.clearTimeout(toastTimer.current);
            toastTimer.current = window.setTimeout(() => setToast(''), 9000);
          }, 600);
          void pushNotice('You found Vault Tech Headquarters!', `Congratulations, survivor: Vault 0 is yours. +${found.added} XP${list ? ` and ${list}` : ''}.`);
        } else void pushNotice(credits > 0 ? 'Level up' : 'Discovered', [...said, added > 0 ? `+${added} XP` : '', credits > 0 ? `Level up: ${credits * 100} free caps` : ''].filter(Boolean).join('\n'));
        void accountRef.current?.refresh();
      })();
    }
  }, [recordFound]);

  const spotFor = useCallback((id: string | null): Spot | null => {
    if (!id) return null;
    if (id === VAULT_ID) return wasteland ? vaultSpot(wasteland) : null;
    const loc = mapLocations.find((l) => l.id === id);
    return loc ? spotFromLocation(loc) : null;
  }, [wasteland, mapLocations]);
  // a link to one place opens its card once the map has it
  const sharedPlaceDone = useRef(false);
  useEffect(() => {
    if (sharedPlaceDone.current || !initial.place) return;
    if (mapLocations.some((l) => l.id === initial.place)) { sharedPlaceDone.current = true; setSelectedId(initial.place); }
  }, [mapLocations, initial.place]);
  const selectedSpot = useMemo(() => spotFor(selectedId), [spotFor, selectedId]);
  const sceneSpot = useMemo(() => spotFor(sceneId), [spotFor, sceneId]);
  // the page's title and description follow what is on the screen (search engines that run the page, and anyone sharing or bookmarking it, see where they are)
  useEffect(() => {
    const where = liveName || wasteland?.regionName || '';
    const spot = sceneSpot ?? selectedSpot;
    const title = spot && !spot.personal ? `${spot.name}${where ? ` in ${where}` : ''} | WastelandMaps` : where ? `${where}: the city after the bombs | WastelandMaps` : 'WastelandMaps: the Fallout map of the real world, your city after the bombs';
    document.title = title;
    document.querySelector('meta[property="og:title"]')?.setAttribute('content', title);
    const description = where ? `${where} as a Fallout-style wasteland on WastelandMaps: vaults, destroyed landmarks, irradiated zones, bosses and loot. An unofficial fan project.` : '';
    if (description) {
      document.querySelector('meta[name="description"]')?.setAttribute('content', description);
      document.querySelector('meta[property="og:description"]')?.setAttribute('content', description);
    }
  }, [liveName, wasteland, sceneSpot, selectedSpot]);

  const show = useCallback(async (resolveRegion: () => Promise<Region>, label: string) => {
    setBusy(true);
    setSelectedId(null);
    setSceneId(null);
    setTravel(null);
    setTarget(null);
    setMessage(`SCANNING ${label.toUpperCase()}…`);
    try {
      const r = await resolveRegion();
      setRegion(r);
      const home = metroAt(await loadIndex(), r.center, 40);
      const title = home?.title ?? wastelandName(r.city, r.state).name;
      const w = generateWasteland(r.city, r.center, r.radiusMeters * 0.8, title);
      // the radiation zones come from the sparse parts of the city (made ahead of time); the random ones are only for places with none
      const madeZones = home ? (await loadZones())[home.id] : undefined;
      if (madeZones) w.zones = madeZones.map(zoneFromEntry);
      scanId.current += 1;
      metroSeen.current = { current: home?.id ?? '', loaded: new Set(home ? [home.id] : []) };
      setMetroInfo(home ? { id: home.id, name: home.name, lat: home.lat, lng: home.lng, radiusKm: home.radiusKm } : null);
      setLiveName(title);
      setWasteland(w);
      setQuery(r.address);
      setHidden(new Set());
      setLocations([]);
      // you are where the device is (when location is on), not at a vault door: the only vault that is yours is your home
      setPlayer(fixRef.current);
      setHereId(null);
      setClock(START_MINUTES);
      setRads(0);
      foundKey.current = `wastelandmaps:found:v1:${r.address}`;
      let saved: string[] = [];
      try { saved = JSON.parse(localStorage.getItem(foundKey.current) ?? '[]') as string[]; } catch { /* nothing saved */ }
      // signed in, the account's own list is the truth (what this browser remembered is only for the signed-out)
      setVisited(new Set([...(accountRef.current?.session ? [] : saved), ...foundRef.current.map((f) => f.id)]));
      setMessage(`YOU EMERGE INTO ${w.regionName.toUpperCase()}`);
      sound('select');
      setFlood([]);
      if (home) void loadFlood().then((all) => setFlood(all[home.id] ?? []));
      const found = home ? await loadMetro(home) : [];
      setLocations(found);
      setMessage(found.length > 0
        ? `${w.regionName.toUpperCase()}: ${found.length} LOCATIONS MARKED. PICK ONE TO FAST TRAVEL`
        : `${w.regionName.toUpperCase()}: NO SURVIVORS ON RECORD HERE. TRY A BIGGER CITY NEARBY`);
    } catch (e) {
      setMessage(`ERROR: ${e instanceof Error ? e.message : 'SCAN FAILED'}`);
      sound('error');
    } finally {
      setBusy(false);
    }
  }, [sound]);

  // ---- the map follows you: moving it into another metro renames the region and brings in that metro's places (pre-built, no Google) ----
  const followMap = useCallback(async (center: LatLng, zoom: number) => {
    const scan = scanId.current;
    const regions = await loadRegions();
    if (regions) setZoomName(nameForZoom(regions, center, zoom));
    if (zoom < 8) return; // far out, the cities are not what is being looked at
    if (scan !== scanId.current) return;
    const seen = metroSeen.current;
    const metros = await loadIndex();
    if (scan !== scanId.current) return;

    // the metro under the middle of the map; between metros, the nearest one within reach keeps the title
    const under = metroAt(metros, center, 0);

    // arrived in a metro by moving the map, with no city searched: set up the wasteland here (the vault, the zones, you at the vault door), so
    // the places can be opened and travelled to just as after a search. The map stays where it is.
    if (under && !wastelandRef.current && !autoStarted.current) {
      autoStarted.current = true;
      const dLat = under.radiusKm / 111.32;
      const dLng = under.radiusKm / (111.32 * Math.max(0.2, Math.cos((under.lat * Math.PI) / 180)));
      const here: Region = {
        city: under.name, state: '', address: under.name, center: { lat: under.lat, lng: under.lng }, radiusMeters: under.radiusKm * 1000, keepView: true,
        bounds: { north: under.lat + dLat, south: under.lat - dLat, east: under.lng + dLng, west: under.lng - dLng },
      };
      await show(async () => here, under.name);
      return;
    }
    const near = under ?? metroAt(metros, center, 120);
    if (near) {
      // the title follows the map over the named parts of a metro too (San Blam, then Smokeland across the bay), though it is the same metro
      const title = titleAt(near, center);
      const entered = near.id !== seen.current;
      if (entered) {
        seen.current = near.id;
        setMetroInfo({ id: near.id, name: near.name, lat: near.lat, lng: near.lng, radiusKm: near.radiusKm });
      }
      if (entered || title !== seen.title) {
        seen.title = title;
        setLiveName(title);
        setToast(`ENTERING ${title.toUpperCase()}`);
        window.clearTimeout(toastTimer.current);
        toastTimer.current = window.setTimeout(() => setToast(''), 3200);
      }
    }
    if (under && !seen.loaded.has(under.id)) {
      seen.loaded.add(under.id);
      void loadFlood().then((all) => {
        const patches = all[under.id];
        if (patches) setFlood((prev) => [...prev, ...patches]);
      });
      const found = await loadMetro(under);
      if (scan !== scanId.current) return;
      const madeZones = (await loadZones())[under.id];
      const extra = madeZones ? madeZones.map(zoneFromEntry) : generateWasteland(under.name, { lat: under.lat, lng: under.lng }, Math.min(under.radiusKm, 25) * 400, under.title).zones;
      setWasteland((w) => (w ? { ...w, zones: [...w.zones, ...extra] } : w));
      const known = new Set(locationsRef.current.map((l) => l.id));
      const fresh = found.filter((l) => !known.has(l.id));
      if (fresh.length > 0) {
        setLocations((prev) => {
          const ids = new Set(prev.map((l) => l.id));
          return dedupePlaces([...prev, ...fresh.filter((l) => !ids.has(l.id))]);
        });
        setMessage(`${fresh.length} NEW LOCATIONS PICKED UP ON THE RADIO`);
      }
    }
  }, [show]);

  const viewNow = useRef<{ lat: number; lng: number; zoom: number } | null>(null);
  // where the map is (as state, for the street view button)
  const [mapAt, setMapAt] = useState<{ lat: number; lng: number; zoom: number } | null>(null);
  // our own street view is in testing: only this account can see the binoculars or open it
  const streetViewAllowed = account.email?.toLowerCase() === 'iw@sdcarealty.com';
  const [walking, setWalking] = useState<{ lat: number; lng: number } | null>(null);
  const mapPosterRef = useRef<() => MapPosterInput | null>(() => null);
  const mapPoster = useCallback(() => mapPosterRef.current(), []);
  mapPosterRef.current = () => {
    const v = viewNow.current;
    const el = document.querySelector('.rm-screen');
    if (!v || !el) return null;
    const box = el.getBoundingClientRect();
    const lngPerPx = 360 / (256 * 2 ** v.zoom);
    const latPerPx = lngPerPx * Math.cos((v.lat * Math.PI) / 180);
    const dLng = (box.width / 2) * lngPerPx * 1.15, dLat = (box.height / 2) * latPerPx * 1.15;
    const pins = mapLocations
      .filter((l) => Math.abs(l.position.lat - v.lat) <= dLat && Math.abs(l.position.lng - v.lng) <= dLng)
      .slice(0, 400)
      .map((l) => ({ lat: l.position.lat, lng: l.position.lng, svg: (freeRenderFor(l.id) && landmarkIcon(l.id.slice(3))) || placeIcon(l.icon), found: shownVisited.has(l.id) }));
    return { look: LOOKS[look], lat: v.lat, lng: v.lng, zoom: v.zoom, width: box.width, height: box.height, title: zoomName ?? (liveName || wasteland?.regionName) ?? '', pins };
  };
  const onViewport = useCallback((center: LatLng, zoom: number) => {
    viewNow.current = { lat: center.lat, lng: center.lng, zoom };
    setMapAt((p) => (p && Math.abs(p.lat - center.lat) < 1e-5 && Math.abs(p.lng - center.lng) < 1e-5 && p.zoom === zoom ? p : { lat: center.lat, lng: center.lng, zoom }));
    window.clearTimeout(viewTimer.current);
    viewTimer.current = window.setTimeout(() => {
      if (travelRef.current || busyRef.current) return;
      void followMap(center, zoom);
    }, 900);
    // signed in: remember where the map is, at most every few seconds
    const who = accountRef.current?.session;
    if (who && started.current && Date.now() - lastSaved.current > 4000) {
      lastSaved.current = Date.now();
      void saveMapPosition(who.user.id, center.lat, center.lng, zoom);
    }
  }, [followMap]);

  // signed in: the places found on the account fill in on the map, and AUTO-DISCOVER comes back as it was left
  const userId = account.session?.user.id ?? null;
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    void (async () => {
      const [list, auto] = await Promise.all([loadFoundPlaces(userId), loadAutoDiscover(userId)]);
      if (cancelled) return;
      const have = new Set(list.map((f) => f.id));
      const local = foundRef.current.filter((f) => !have.has(f.id));
      if (local.length > 0) void saveFoundPlaces(userId, local); // found before signing in
      foundRef.current = [...local, ...list];
      setFound(foundRef.current);
      const next = new Set(visitedRef.current);
      list.forEach((f) => next.add(f.id));
      visitedRef.current = next;
      setVisited(next);
      if (auto) setTracking(true);
    })();
    return () => { cancelled = true; };
  }, [userId]);
  useEffect(() => {
    if (!userId) { foundRef.current = []; setFound([]); }
  }, [userId]);

  // opening the page: the country this device is in (North America if unknown), or, signed in, exactly where the map was left
  useEffect(() => {
    accountRef.current = account;
  }, [account]);
  useEffect(() => {
    // wait until we know who this is, and (signed in) whether they have set a home
    if (started.current || status !== 'ready' || !account.loaded || (account.session && !account.homeLoaded)) return;
    started.current = true;
    void (async () => {
      const regions = await loadRegions();
      // where the map opens: where the map was left, if that was in the last twelve hours; otherwise where the device is (when location is on);
      // otherwise (signed in with a home) the home vault; otherwise the country the device is in (North America if unknown)
      if (account.session) {
        const saved = await loadMapPosition(account.session.user.id);
        if (saved && Date.now() - saved.updatedAt < 12 * 3600 * 1000) {
          const center = { lat: saved.lat, lng: saved.lng };
          setStartView({ kind: 'view', center, zoom: saved.zoom });
          // close in: set up the wasteland around that spot too, without moving the map
          if (saved.zoom >= 9) void show(async () => ({ ...(await geocodeLatLng(center)), keepView: true }), 'your last position');
          return;
        }
      }
      const here = (await locationState()) === 'granted' ? await currentFix(8000) : null;
      const home = account.session && account.home?.lat !== undefined && account.home.lng !== undefined ? { lat: account.home.lat, lng: account.home.lng } : null;
      const spot = here ?? home;
      if (spot) {
        if (here) { fixRef.current = here; setFix(here); }
        setStartView({ kind: 'view', center: spot, zoom: 15 });
        void show(async () => ({ ...(await geocodeLatLng(spot)), keepView: true }), here ? 'your position' : 'home');
        return;
      }
      setStartView({ kind: 'bounds', bounds: (regions && countryBounds(regions, deviceCountry())) || NORTH_AMERICA });
    })();
  }, [status, account, show]);

  const shareMap = useCallback(async () => {
    const view = viewNow.current ?? undefined;
    const result = await shareMapView({ query: view && view.zoom >= 9 ? '' : query, look, view });
    if (result === 'failed') return;
    if (result === 'copied') { setToast('LINK COPIED'); window.clearTimeout(toastTimer.current); toastTimer.current = window.setTimeout(() => setToast(''), 3000); }
  }, [query, look]);

  const search = useCallback((q: string) => show(() => geocodeQuery(q), q), [show]);

  /** A suggestion picked from the scan field: a city opens its map; an address opens the map around it with the address as the destination. */
  /** Opens a place the person chose (a suggestion, their vault, or an address they went to before) with its card ready. */
  const openPlace = useCallback(async (place: PickedPlace) => {
    await show(() => geocodeQuery(place.address).catch(() => geocodeLatLng(place.position)), place.name);
    setTarget({ placeId: place.placeId, name: place.name, address: place.address, lat: place.position.lat, lng: place.position.lng, kind: place.kind });
    setSelectedId(personalId(place.placeId));
  }, [show]);
  const pickSuggestion = useCallback(async (suggestion: Suggestion) => {
    if (suggestion.area) {
      void search(suggestion.text);
      return;
    }
    let place;
    try {
      place = await resolveSuggestion(suggestion);
    } catch {
      setMessage('NO SUCH PLACE ON ANY MAP');
      return;
    }
    await openPlace(place);
  }, [openPlace, search]);
  // the dropdown under the scan field (signed in): the home vault always first, then the addresses navigated to before
  const [navHist, setNavHist] = useState<PersonalPlace[]>([]);
  useEffect(() => { setNavHist(account.session ? loadNavHistory(account.session.user.id) : []); }, [account.session]);
  const recents = useMemo(() => {
    if (!account.session) return undefined;
    const home = account.home;
    const list: { id: string; main: string; secondary: string; home?: boolean; place: PickedPlace }[] = [];
    if (home?.address && home.lat !== undefined && home.lng !== undefined) list.push({ id: 'home', main: `VAULT ${home.vaultNumber !== undefined ? String(home.vaultNumber).padStart(4, '0') : ''}`.trim(), secondary: home.address, home: true, place: { placeId: home.placeId ?? 'home', name: 'Home', address: home.address, position: { lat: home.lat, lng: home.lng }, kind: 'house' } });
    for (const p of navHist) if (p.placeId !== home?.placeId) list.push({ id: p.placeId, main: p.name || p.address.split(',')[0], secondary: p.address, place: { placeId: p.placeId, name: p.name, address: p.address, position: { lat: p.lat, lng: p.lng }, kind: p.kind } });
    return list;
  }, [account.session, account.home, navHist]);
  /** A tap and hold on a building's outline, close in: its address, as a destination with the card (FAST TRAVEL and VIEW) ready, as if it had been typed in. */
  const onMapHold = useCallback(async (position: { lat: number; lng: number }) => {
    if (navRef.current) return;
    sound('select');
    const place = await addressAt(position);
    if (!place) { say('NO ADDRESS THERE', true); return; }
    setTarget({ placeId: place.placeId, name: place.name, address: place.address, lat: place.position.lat, lng: place.position.lng, kind: place.kind });
    setSelectedId(personalId(place.placeId));
  }, [sound]); // eslint-disable-line react-hooks/exhaustive-deps
  /** Home chosen (here or typed): remembered, shown as a place of their own named Home, and the map goes there. */
  const [moving, setMoving] = useState(false);
  const chooseHome = useCallback(async (place: PickedPlace, vaultNumber: number): Promise<string | null> => {
    const who = accountRef.current?.session;
    if (!who) return 'Sign in first.';
    // changing an existing home: the vault (all its rooms and furniture) goes with them, which takes a moment
    const before = accountRef.current?.home?.placeId;
    if (before && before !== place.placeId) {
      setMoving(true);
      await new Promise((r) => window.setTimeout(r, 2000));
      setMoving(false);
    }
    const saved = await saveHome(who.user.id, { placeId: place.placeId, name: 'Home', address: place.address, lat: place.position.lat, lng: place.position.lng, skipped: false, vaultNumber });
    if (saved === 'taken') return `Vault ${String(vaultNumber).padStart(4, '0')} already belongs to another survivor. Pick a different number.`;
    if (saved === 'error') return 'That could not be saved. Try again in a moment.';
    await savePersonalPlace(who.user.id, { placeId: place.placeId, name: 'Home', address: place.address, lat: place.position.lat, lng: place.position.lng, kind: 'house' });
    // the vault number is also the password they sign in with from now on
    localStorage.setItem(`rm-pw-${who.user.id}`, String(vaultNumber));
    if (!(await setVaultPassword(who.user.email, vaultNumber))) localStorage.removeItem(`rm-pw-${who.user.id}`);
    await accountRef.current?.refresh();
    setHomeOpen(false);
    await show(() => geocodeQuery(place.address).catch(() => geocodeLatLng(place.position)), `VAULT ${String(vaultNumber).padStart(4, '0')}`);
    return null;
  }, [show]);
  // people who chose their number before passwords existed get theirs set once
  useEffect(() => {
    const who = account.session?.user.id;
    const number = account.home?.vaultNumber;
    if (!who || number === undefined || localStorage.getItem(`rm-pw-${who}`) === String(number)) return;
    localStorage.setItem(`rm-pw-${who}`, String(number));
    void setVaultPassword(account.session?.user.email, number).then((ok) => { if (!ok) localStorage.removeItem(`rm-pw-${who}`); });
  }, [account.session, account.home?.vaultNumber]);
  // turning the phone: the page and the map are refitted, and the view is put back to the top-left of what it was (no stale enlarged layout)
  useEffect(() => {
    let t: number | undefined;
    const refit = () => {
      window.clearTimeout(t);
      t = window.setTimeout(() => { window.dispatchEvent(new Event('resize')); if (window.scrollX) window.scrollTo(0, window.scrollY); }, 250);
    };
    const sideways = window.matchMedia('(orientation: landscape)');
    sideways.addEventListener?.('change', refit);
    window.addEventListener('orientationchange', refit);
    screen.orientation?.addEventListener?.('change', refit);
    return () => { window.clearTimeout(t); sideways.removeEventListener?.('change', refit); window.removeEventListener('orientationchange', refit); screen.orientation?.removeEventListener?.('change', refit); };
  }, []);
  // navigation takes over the whole phone screen when it is turned sideways: let the map notice its new size
  useEffect(() => {
    const t = window.setTimeout(() => window.dispatchEvent(new Event('resize')), 60);
    return () => window.clearTimeout(t);
  }, [!!nav]);
  // the voice: the first instruction of a route, every new turn, and the turn again when it is close
  const spoken = useRef<{ route: unknown; step: number; near: boolean; rerouting: boolean } | null>(null);
  const arriving = useRef(false);
  useEffect(() => {
    // (arriving ends the navigation too: the arrival announcement is let finish, not cut off by this)
    if (!nav) { spoken.current = null; if (!arriving.current) stopSpeaking(); return; }
    const said = spoken.current;
    if (nav.busy === 'REROUTING') {
      if (!said?.rerouting) speak('Recalculating route.');
      if (said) said.rerouting = true;
      return;
    }
    if (!nav.route || nav.busy) return;
    const next = nav.route.steps[nav.step + 1]?.text ?? 'Continue to your destination';
    const plain = spokenInstruction(next);
    const lower = plain.charAt(0).toLowerCase() + plain.slice(1);
    if (!said || said.route !== nav.route) {
      speak(`${said ? (nav.walking ? 'Walking directions.' : 'Route updated.') : `Navigation online. Destination: ${nav.spot.name}.`} ${nav.toTurn !== null ? `In ${spokenDistance(nav.toTurn, nav.walking)}, ` : ''}${lower}.`);
      spoken.current = { route: nav.route, step: nav.step, near: false, rerouting: false };
      return;
    }
    if (said.step !== nav.step) {
      speak(`${nav.toTurn !== null && nav.toTurn > (nav.walking ? 50 : 120) ? `In ${spokenDistance(nav.toTurn, nav.walking)}, ` : ''}${lower}.`);
      spoken.current = { ...said, step: nav.step, near: false };
      return;
    }
    if (!said.near && nav.toTurn !== null && nav.toTurn < (nav.walking ? 40 : 130)) {
      speak(`${plain}. Now.`);
      spoken.current = { ...said, near: true };
    }
  }, [nav]);
  const skipHome = useCallback(async () => {
    setHomeSkipped(true);
    if (homeOpen) { setHomeOpen(false); return; }
    const who = accountRef.current?.session;
    if (who) { await saveHome(who.user.id, { skipped: true }); await accountRef.current?.refresh(); }
  }, [homeOpen]);
  const renameSpot = useCallback(async (spot: Spot, name: string) => {
    const who = accountRef.current?.session;
    if (!who || !spot.personal) return;
    await renamePersonalPlace(who.user.id, spot.id.slice(3), name);
    await accountRef.current?.refresh();
  }, []);

  const locateMe = useCallback(() => {
    // ask for the position first, straight from the click: a second permission question (notifications) used to open in front of it and swallow it
    setMessage(isNative() ? 'LOOKING FOR YOU…' : 'LOOKING FOR YOU… (ANSWER THE LOCATION QUESTION AT THE TOP OF THE BROWSER)');
    getFix({ timeout: 20_000, maximumAge: 60_000 }).then(
      (pos) => {
        setMessage('');
        // the position found is where the person is: kept, and the YOU marker drawn there now (not left to the next reading of the location watch, which may be a long way off)
        const me = { lat: pos.lat, lng: pos.lng };
        fixRef.current = me; shownFix.current = me; setFix(me); setPlayer(me); setHereId(null);
        void show(() => geocodeLatLng(me), 'your position');
        setTracking(true);
        void enableNotifications();
      },
      (err: GeoError) =>
        setMessage(
          err.code === 1
            ? (isNative() ? 'ERROR: LOCATION IS OFF FOR THIS APP. TURN IT ON IN THE PHONE SETTINGS, THEN TRY AGAIN' : 'ERROR: LOCATION IS BLOCKED FOR THIS SITE. CLICK THE LOCK BESIDE THE ADDRESS, ALLOW LOCATION, AND TRY AGAIN')
            : err.code === 2
              ? 'ERROR: THIS DEVICE CANNOT WORK OUT WHERE IT IS. CHECK THAT LOCATION IS TURNED ON IN ITS SETTINGS'
              : 'ERROR: LOCATION TOOK TOO LONG. TRY AGAIN',
        ),
    );
  }, [show]);

  // load Google, then open the shared place if the link had one
  useEffect(() => {
    let cancelled = false;
    loadGoogle()
      .then(() => {
        if (cancelled) return;
        setStatus('ready');
        if (initial.view && !initial.query) {
          // a link shared from the map opens at exactly that view
          started.current = true;
          const center = { lat: initial.view.lat, lng: initial.view.lng };
          window.history.replaceState(null, '', window.location.pathname);
          setStartView({ kind: 'view', center, zoom: initial.view.zoom });
          if (initial.view.zoom >= 9) void show(async () => ({ ...(await geocodeLatLng(center)), keepView: true }), 'the shared view');
        } else if (initial.query) {
          started.current = true;
          // a shared link opens its place once; the address bar goes back to plain so a reload does not snap back to it
          window.history.replaceState(null, '', window.location.pathname);
          void search(initial.query);
        }
      })
      .catch((e: Error) => {
        if (cancelled) return;
        setProblem(e.message);
        setStatus('problem');
      });
    return () => {
      cancelled = true;
    };
  }, [search, initial]);


  // ---- from the Data tab: go to a found place, or open its snapshot ----
  useEffect(() => {
    const p = pendingOpen.current;
    if (!p || busy || !(locations.some((l) => l.id === p.id) || (p.id.startsWith('me:') && personalLocs.some((l) => l.id === p.id)))) return;
    pendingOpen.current = null;
    setSelectedId(p.id);
    if (p.scene) { setSceneStart('snapshot'); setSceneId(p.id); }
  }, [locations, busy, personalLocs]);
  const openFound = useCallback(async (place: FoundPlace, scene: boolean) => {
    // on a phone the map is above the tabs: bring it into view
    document.querySelector('.rm-screen')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (locationsRef.current.some((l) => l.id === place.id) || (place.id.startsWith('me:') && personalLocsRef.current.some((l) => l.id === place.id))) {
      setSelectedId(place.id);
      if (scene) { setSceneStart('snapshot'); setSceneId(place.id); }
      return;
    }
    pendingOpen.current = { id: place.id, scene };
    setSelectedId(null); // the card of the place they were looking at goes now, not after the map has moved
    await show(() => geocodeLatLng({ lat: place.lat, lng: place.lng }), place.city ?? place.name);
  }, [show]);

  /** "Clear the area now": opens the place and goes straight into the shooting gallery. */
  const clearNow = useCallback((id: string) => {
    setClearAsk(null);
    setSelectedId(id);
    setSceneStart('scene');
    setSceneRaid(true);
    setSceneId(id);
  }, []);
  // tapping the notification in the app does the same
  useEffect(() => onNoticeTapped(clearNow), [clearNow]);

  // ---- fast travel: driving navigation (AUTO-DISCOVER must be on), or a flight search for a place overseas ----
  const say = useCallback((text: string, flashing = false) => {
    setToast(text);
    setFlash(flashing);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => { setToast(''); setFlash(false); }, flashing ? 3600 : 4200);
  }, []);

  /** The flight search for the place's city (opened in a new tab; if the browser blocks that, a button appears on the map). */
  const openFlights = useCallback(async (spot: Spot) => {
    const metros = await loadIndex();
    const m = metroAt(metros, spot.position, 60);
    let country = '';
    try { country = m ? (new Intl.DisplayNames(['en'], { type: 'region' }).of(m.country) ?? '') : ''; } catch { /* no names */ }
    const place = m ? [m.name, country].filter(Boolean).join(', ') : (spot.oldName ?? spot.name);
    const url = flightsUrl(place);
    const opened = await openExternal(url);
    if (!opened) setFlightLink({ url, place });
    say(`OVERSEAS: FLIGHTS TO ${place.toUpperCase()}`);
  }, [say]);

  /** The search for ferries to an island, a lighthouse, a fort on a rock: a place with no road to it. */
  const openFerries = useCallback(async (spot: Spot) => {
    const place = spot.oldName ?? spot.name;
    const url = ferryUrl(place);
    const opened = await openExternal(url);
    if (!opened) setFlightLink({ url, place, ferry: true });
    say(`NO ROAD: FERRIES TO ${place.toUpperCase()}`);
  }, [say]);

  const [voiceOn, setVoiceOn] = useState(voiceEnabled());
  const toggleVoice = useCallback(() => {
    setVoiceOn((on) => { setVoiceEnabled(!on); return !on; });
  }, []);
  // Driving: from the moment a route starts until it ends, the navigation owns the screen. Everything else is shut: any open place, snapshot, loot run, vault or sign-in
  // closes, and the map's pins, the lists and the Pip-Boy's tabs cannot be opened (see also the rm-navigating rules in index.css). Discoveries along the way still
  // show as notices. The screen is kept awake for the route.
  const driving = !!nav;
  useEffect(() => {
    void keepScreenOn(driving);
    if (!driving) return;
    setSceneId(null);
    setSceneRaid(false);
    setVaultOpen(null);
    setAccountOpen(false);
    setHomeOpen(false);
    setSelectedId(null);
  }, [driving]);

  // The car's screen (CarPlay), when a car is connected: the same map, the route and the places plotted near it, sent about once a second. With no car these calls do nothing.
  const carSent = useRef(0);
  useEffect(() => {
    if (!nav?.route || !fix) { carEnd(); return; }
    const route = nav.route;
    const send = () => {
      carSent.current = Date.now();
      const flat = (pts: { lat: number; lng: number }[]) => pts.flatMap((p) => [Math.round(p.lat * 1e5) / 1e5, Math.round(p.lng * 1e5) / 1e5]);
      const near = mapLocations
        .map((l) => ({ l, d: distanceMeters(fix, l.position) }))
        .filter((x) => x.d < 30_000)
        .sort((a, b) => a.d - b.d)
        .slice(0, 80)
        .map(({ l }) => ({ id: l.id, name: l.name, category: l.category, icon: String(l.icon), lat: l.position.lat, lng: l.position.lng }));
      const payload: CarPayload = {
        active: true, destination: nav.spot.name, destLat: nav.spot.position.lat, destLng: nav.spot.position.lng, hereLat: fix.lat, hereLng: fix.lng,
        path: flat(route.path), steps: route.steps.map((s) => ({ text: s.text, meters: s.meters, path: flat(s.path.length ? s.path : [s.start, s.end]) })), step: nav.step,
        instruction: route.steps[nav.step]?.text ?? '', distanceToTurn: nav.toTurn ?? 0, remainingMeters: nav.remaining ?? route.meters, remainingSeconds: route.seconds, markers: near,
      };
      carUpdate(payload);
    };
    const id = window.setTimeout(send, Math.max(0, 1200 - (Date.now() - carSent.current)));
    return () => window.clearTimeout(id);
  }, [nav?.route, nav?.step, nav?.toTurn, nav?.remaining, nav?.spot, fix, mapLocations]);

  // the line under the map: what an action says (NAVIGATING TO..., ARRIVED AT..., an error) goes back to the normal line once it is over
  const restLine = useMemo(() => {
    if (!wasteland) return 'AWAITING COORDINATES';
    const name = (liveName || wasteland.regionName).toUpperCase();
    return locations.length > 0 ? `${name}: ${locations.length} LOCATIONS MARKED. PICK ONE TO FAST TRAVEL` : `${name}: NO SURVIVORS ON RECORD HERE. TRY A BIGGER CITY NEARBY`;
  }, [wasteland, liveName, locations.length]);
  useEffect(() => {
    if (/^NAVIGATING TO /.test(message)) { if (!nav) setMessage(restLine); return; }
    if (!/^(ARRIVED AT |YOU EMERGE INTO |\d+ NEW LOCATIONS|NO SUCH PLACE|ERROR: |LOOKING FOR YOU)/.test(message)) return;
    const t = window.setTimeout(() => setMessage(restLine), /^ERROR: /.test(message) ? 9000 : 6500);
    return () => window.clearTimeout(t);
  }, [message, nav, restLine]);
  const endNavigation = useCallback(() => {
    if (navRef.current) { speak('Navigation terminated.'); buzz('hurt'); } // the voice and a heavy-then-lighter thump together
    setNav(null);
    navRef.current = null;
  }, []);
  // the trip was ended on the car's own screen
  useEffect(() => onCarEndRequested(endNavigation), [endNavigation]);

  const startNavigation = useCallback(async (spot: Spot) => {
    if (navRef.current) return;
    // fast travel needs the device's real position, which is what AUTO-DISCOVER is for
    if (!tracking) {
      say('AUTO-DISCOVER MUST BE ON TO FAST TRAVEL', true);
      sound('error');
      return;
    }
    setSelectedId(null);
    setFlightLink(null);
    setNav({ spot, route: null, step: 0, toTurn: null, remaining: null, busy: 'LOCATING YOU' });
    const here = fixRef.current ?? (await currentFix());
    if (!here) {
      setNav(null);
      say('COULD NOT FIND YOUR POSITION. TRY AGAIN IN A MOMENT');
      return;
    }
    fixRef.current = here;
    setFix(here);
    if (isOverseas(here, spot.position)) {
      setNav(null);
      void openFlights(spot);
      return;
    }
    // a place on an island or a rock: no road reaches it, so it is a ferry (the famous ones by name; the rest from the list the metro tools make)
    const byBoat = isFerryByName(spot.oldName ?? spot.name) || isFerryByName(spot.name) || (await loadFerryIds()).has(spot.id.replace(/^wd:/, ''));
    if (byBoat && isFerryByName(spot.oldName ?? spot.name)) {
      setNav(null);
      void openFerries(spot);
      return;
    }
    setNav({ spot, route: null, step: 0, toTurn: null, remaining: null, busy: 'ROUTING' });
    const answer = await requestRoute(here, spot.position);
    if (answer.kind === 'no_route') {
      setNav(null);
      void (byBoat ? openFerries(spot) : openFlights(spot)); // no road from here: it is across the water (a ferry if it is an island, else a flight)
      return;
    }
    if (answer.kind === 'route' && byBoat) {
      // the road may only get as close as the shore: a ferry place whose road stops short is reached by boat
      const end = answer.route.path[answer.route.path.length - 1];
      if (end && distanceMeters(end, spot.position) > ROAD_STOPS_SHORT_M) {
        setNav(null);
        void openFerries(spot);
        return;
      }
    }
    if (answer.kind === 'unavailable') {
      // no route service could be reached: say so, and stay on the Pip-Boy map (the navigation is ours; it never hands over to another app)
      setNav(null);
      say('COULD NOT GET DIRECTIONS RIGHT NOW. TRY AGAIN IN A MOMENT', true);
      sound('error');
      return;
    }
    lastReroute.current = Date.now();
    const first = answer.route.steps[0];
    setNav({ spot, route: answer.route, step: 0, toTurn: first?.meters ?? null, remaining: answer.route.meters, busy: '' });
    setMessage(`NAVIGATING TO ${spot.name.toUpperCase()}`);
    sound('travel');
    // an address navigated to goes on the list under the scan field
    const who = accountRef.current?.session;
    if (who && spot.personal && !spot.personal.home) setNavHist(pushNavHistory(who.user.id, { placeId: spot.id.slice(3), name: spot.name, address: spot.personal.address, lat: spot.position.lat, lng: spot.position.lng, kind: spot.personal.kind }));
  }, [tracking, say, sound, openFlights, openFerries]);

  /** Every new position while navigating: the next turn, the distance left, rerouting if you left the road, and arriving. */
  const onNavFix = useCallback(async (here: LatLng) => {
    const n = navRef.current;
    if (!n?.route) return;
    const p = progressAlong(n.route, here);
    const toDestination = distanceMeters(here, n.spot.position);
    const foot = !!n.walking;
    if (toDestination < (foot ? 22 : 60) || p.remaining < (foot ? 14 : 40)) {
      const spot = n.spot;
      setNav(null);
      navRef.current = null;
      const place = locationsRef.current.find((l) => l.id === spot.id);
      if (place) markFound([place], here);
      say(`ARRIVED: ${spot.name}`);
      arriving.current = true;
      window.setTimeout(() => { arriving.current = false; }, 6000);
      speak('Arrived.');
      buzz('arrive');
      if (soundRef.current) beep('arrive');
      setSceneStart('scene');
      setSceneId(spot.id);
      return;
    }
    setNav({ ...n, step: p.step, toTurn: p.toTurn, remaining: p.remaining, busy: '' });
    // walking directions on, but the phone is plainly not being walked (over 4.5 m/s, 10 mph, as an average over eight seconds or more): back to driving directions
    const trail = speedTrail.current;
    trail.push({ t: Date.now(), p: here });
    while (trail.length && Date.now() - trail[0].t > 14_000) trail.shift();
    if (foot && trail.length >= 4 && (Date.now() - trail[0].t) / 1000 >= 8 && distanceMeters(trail[0].p, here) / ((Date.now() - trail[0].t) / 1000) > 4.5) {
      speedTrail.current = [];
      say('MOVING TOO FAST TO WALK: BACK TO DRIVING', true);
      buzz('select');
      setNav((cur) => (cur ? { ...cur, walking: false, busy: 'ROUTING' } : cur));
      const drive = await requestRoute(here, n.spot.position, false);
      setNav((cur) => (cur ? (drive.kind === 'route' ? { ...cur, walking: false, route: drive.route, step: 0, toTurn: drive.route.steps[0]?.meters ?? null, remaining: drive.route.meters, busy: '' } : { ...cur, walking: false, busy: '' }) : cur));
      return;
    }
    // off the road for three position readings in a row (a single stray reading is not a wrong turn), and not more than once every 25 seconds
    offStreak.current = p.off > (foot ? 30 : 90) ? offStreak.current + 1 : 0;
    if (offStreak.current >= 3 && Date.now() - lastReroute.current > 25_000) {
      offStreak.current = 0;
      lastReroute.current = Date.now();
      setNav((cur) => (cur ? { ...cur, busy: 'REROUTING' } : cur));
      const answer = await requestRoute(here, n.spot.position, foot);
      setNav((cur) => (cur && answer.kind === 'route' ? { ...cur, route: answer.route, step: 0, toTurn: answer.route.steps[0]?.meters ?? null, remaining: answer.route.meters, busy: '' } : cur ? { ...cur, busy: '' } : cur));
    }
  }, [markFound, say]);
  const onNavFixRef = useRef(onNavFix);
  useEffect(() => { onNavFixRef.current = onNavFix; }, [onNavFix]);

  /** The walking man: on foot instead of in a car (and back). The route is asked for again, the other way of travelling, from where the person is. */
  const toggleWalking = useCallback(async () => {
    const n = navRef.current;
    if (!n) return;
    const walking = !n.walking;
    speedTrail.current = [];
    sound('select');
    setNav((cur) => (cur ? { ...cur, walking, busy: 'ROUTING' } : cur));
    const here = fixRef.current ?? (await currentFix(8000));
    if (!here) { setNav((cur) => (cur ? { ...cur, walking: !walking, busy: '' } : cur)); say('COULD NOT FIND YOU TO CHANGE THE ROUTE', true); return; }
    const answer = await requestRoute(here, n.spot.position, walking);
    setNav((cur) => (cur && answer.kind === 'route'
      ? { ...cur, walking, route: answer.route, step: 0, toTurn: answer.route.steps[0]?.meters ?? null, remaining: answer.route.meters, busy: '' }
      : cur ? { ...cur, walking: !walking, busy: '' } : cur));
    if (answer.kind !== 'route') say('NO ' + (walking ? 'WALKING' : 'DRIVING') + ' ROUTE FROM HERE', true);
  }, [sound, say]);

  // turning AUTO-DISCOVER off ends any navigation
  useEffect(() => {
    if (!tracking && navRef.current) endNavigation();
  }, [tracking, endNavigation]);

  const arrive = useCallback(() => {
    const t = trip.current;
    if (!t) return;
    trip.current = null;
    const first = !visitedRef.current.has(t.spot.id);
    setClock((c) => c + t.minutes);
    setRads((r) => r + t.rads);
    setPlayer(t.spot.position);
    setHereId(t.spot.id);
    if (first) {
      const next = new Set(visitedRef.current).add(t.spot.id);
      visitedRef.current = next;
      setVisited(next);
      try { localStorage.setItem(foundKey.current, JSON.stringify([...next])); } catch { /* storage unavailable */ }
      const place = locationsRef.current.find((l) => l.id === t.spot.id);
      if (place) void recordFound([place]);
    }
    setTravel(null);
    setMessage(`ARRIVED AT ${t.spot.name.toUpperCase()}. ${t.note}${t.rads > 0 ? ` +${t.rads} RADS.` : ''}`);
    setToast(first ? `LOCATION DISCOVERED: ${t.spot.name}` : `ARRIVED: ${t.spot.name}`);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(''), 3200);
    setSceneStart('scene');
    setSceneId(t.spot.id);
    sound('arrive');
  }, [sound, recordFound]);

  // auto-discover: while it is on, walking within about 120 m of a place fills it in on the map. It listens gently (a block's accuracy, now and then, which saves
  // the battery) except while navigating, which needs a position every second.
  const navigating = !!nav;
  useEffect(() => {
    if (!tracking) return;
    let stop: (() => void) | null = null;
    let cancelled = false;
    let lastWork = 0;
    void watchFixes(
      (pos) => {
        const here = { lat: pos.lat, lng: pos.lng };
        // with the screen off, the map and the list of nearby places are looked at every ten seconds at most
        if (document.hidden && !navRef.current && Date.now() - lastWork < 10_000) { fixRef.current = here; return; }
        lastWork = Date.now();
        // the person's mark on the map moves when they have moved from where it was last drawn (a few metres while navigating, so walking is followed step by step; not from the last reading,
        // which is only a step away, so a slow walk would never add up to the distance)
        const shown = shownFix.current;
        const moved = !shown || !playerNow.current || distanceMeters(shown, here) > (navRef.current ? (navRef.current.walking ? 2 : 4) : 12);
        fixRef.current = here;
        if (moved) {
          shownFix.current = here;
          setFix(here);
          setPlayer(here);
          setHereId(null);
        }
        void onNavFixRef.current(here);
        const reach = Math.max(245, Math.min(pos.accuracy, 400)); // about 800 ft, or the phone's own accuracy when that is worse
        const near = locationsRef.current.filter((l) => (l.personal ? !foundRef.current.some((f) => f.id === l.id) : !visitedRef.current.has(l.id)) && distanceMeters(here, l.position) <= reach);
        // Vault Tech Headquarters is found by being anywhere in Antarctica (the server checks the position the same way)
        if (inAntarctica(here.lat, here.lng) && !visitedRef.current.has(VAULT_ZERO_ID) && !foundRef.current.some((f) => f.id === VAULT_ZERO_ID)) near.push(VAULT_ZERO);
        markFound(near, here);
      },
      // only a refusal turns it off: a moment without a signal (a tunnel, a bad fix) must not end the navigation
      (code) => { if (code === 1) { setTracking(false); setMessage('ERROR: LOCATION PERMISSION DENIED'); } },
      { lowPower: !navigating, background: { title: 'WastelandMaps is exploring', message: 'Discovering places as you move. Turn AUTO-DISCOVER off to stop.' } },
    ).then((off) => { if (cancelled) off(); else stop = off; });
    return () => { cancelled = true; stop?.(); };
  }, [tracking, markFound, navigating]);

  const toggleTracking = async () => {
    const next = !tracking;
    sound('select');
    if (next) {
      void enableNotifications();
      // every time it is switched on in the app, the phone is asked for location again: that brings back its Allow question when it is willing to ask
      // (after "Allow Once", say), so "Always" can be chosen this time. Once the phone has been told No it does not ask again: Settings is the only place left.
      if (isNative() && (await askForLocation()) === 'denied') {
        if (window.confirm('Location is turned off for WastelandMaps. AUTO-DISCOVER works best, even with the phone in your pocket, when Location is set to "Always" in Settings. Open Settings now?')) void openLocationSettings();
        return;
      }
    }
    setTracking(next);
    const who = accountRef.current?.session;
    if (who) void saveAutoDiscover(who.user.id, next);
  };

  const toggleCategory =(id: CategoryId) =>
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const chooseLook = (id: LookId) => {
    setLook(id);
    sound('tick');
  };

  // refit the title whenever its words change or the screen does
  const titleWords = zoomName ?? (liveName || wasteland?.regionName) ?? '';
  const titleCleared = !zoomName && !!account.session && !!metroInfo && account.metrosCleared.has(metroInfo.id);
  useLayoutEffect(() => {
    const el = titleRef.current;
    if (!el) return;
    const fit = () => {
      // the title fades in with its letters spreading (an animation of its letter spacing, which overrides what is set here): measure when that is over
      if (el.getAnimations().some((an) => an.playState === 'running')) { el.addEventListener('animationend', fit, { once: true }); return; }
      el.style.fontSize = '';
      el.style.letterSpacing = '';
      if (el.scrollWidth <= el.clientWidth + 1) return;
      const css = getComputedStyle(el);
      const size = parseFloat(css.fontSize);
      const spacing = parseFloat(css.letterSpacing) || 0;
      // the largest size that fits: the letters shrink, and the space between them shrinks faster (never below 9px; past that only the spacing goes)
      const apply = (k: number) => { el.style.fontSize = `${Math.max(9, size * k)}px`; el.style.letterSpacing = `${spacing * k * k}px`; };
      const fits = () => el.scrollWidth <= el.clientWidth + 1;
      let [lo, hi] = [0.2, 1];
      for (let i = 0; i < 12; i++) {
        const mid = (lo + hi) / 2;
        apply(mid);
        if (fits()) lo = mid; else hi = mid;
      }
      apply(lo);
      if (!fits()) el.style.letterSpacing = '0px';
    };
    fit();
    const watch = el.parentElement ? new ResizeObserver(fit) : null;
    if (el.parentElement) watch?.observe(el.parentElement);
    if (document.fonts?.ready) void document.fonts.ready.then(fit);
    return () => { watch?.disconnect(); el.removeEventListener('animationend', fit); };
  }, [titleWords, titleCleared]);

  const navView = useMemo(() => (nav?.route ? { path: nav.route.path, steps: nav.route.steps, step: nav.step, walking: !!nav.walking } : null), [nav?.route, nav?.step, nav?.walking]);

  return (
    <div className={`rm-app${nav ? ' rm-navigating' : ''}`}>
      <header className="rm-head">
        <div className="rm-title">
          <img className="rm-title-mark" src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" aria-hidden="true" />
          <h1>WASTELAND<span>MAPS</span></h1>
          <p>See where you live after the bombs fell</p>
        </div>
        <div className="rm-looks" role="group" aria-label="Map look">
          {(Object.keys(LOOKS) as LookId[]).map((id) => (
            <button key={id} type="button" className={look === id ? 'on' : ''} aria-pressed={look === id} onClick={() => chooseLook(id)}>{LOOKS[id].label}</button>
          ))}
        </div>
      </header>

      <main className="rm-device">
        <div className="rm-screen">
          {(wasteland || zoomName) && <div className="rm-poster-title" ref={titleRef} key={zoomName ?? (liveName || wasteland?.regionName)}><span aria-hidden="true">{zoomName ?? (liveName || wasteland?.regionName)}{!zoomName && account.session && metroInfo && account.metrosCleared.has(metroInfo.id) && <small className="rm-poster-cleared">[CLEARED]</small>}</span><button type="button" className="rm-poster-share" onClick={() => void shareMap()} aria-label="Share this view of the map" title="Share this view of the map"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12M7 8l5-5 5 5M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg></button></div>}
          {status === 'ready' ? (
            <MapView
              onLocate={locateMe} locateDisabled={status !== 'ready' || !!travel}
              look={LOOKS[look]} region={region} wasteland={wasteland} locations={personalOn ? mapLocations : mapLocations.filter((l) => !l.personal || l.personal.home)} hiddenCategories={hidden}
              selectedId={selectedId} visited={shownVisited} cleared={account.cleared} waiting={account.waiting} player={player} travel={travel} onArrive={arrive} nav={navView} onSelect={(id) => { if (navRef.current) return; setSelectedId(id); if (id) sound('tick'); }} onViewport={onViewport} onLongPress={onMapHold} regionLabels={regionLabels} flood={flood} startView={startView}
            />
          ) : status === 'problem' ? (
            <SetupNotice problem={problem} />
          ) : (
            <div className="rm-setup"><h2>BOOTING…</h2></div>
          )}
          {(() => {
            // our own street view: for a person who bought this metro's atlas. With no place open it is at the bottom left of the map (lit when a place with a picture is close to the middle of
            // the map); with a place open it moves to that place's card
            const owned = streetViewAllowed && !!account.session && !!metroInfo && account.metros.has(metroInfo.id);
            if (!owned || !mapAt || mapAt.zoom < 16 || nav || (selectedSpot && wasteland && !sceneSpot)) return null;
            const here = { lat: mapAt.lat, lng: mapAt.lng };
            const plotted = [
              ...atlas.map((a) => ({ lat: a.lat, lng: a.lng })),
              ...locations.filter((l) => l.id.startsWith('wd:') && account.unlocked.has(l.id)).map((l) => ({ lat: l.position.lat, lng: l.position.lng })),
              ...(account.home?.lat !== undefined && account.home.lng !== undefined ? [{ lat: account.home.lat, lng: account.home.lng }] : []),
            ];
            const near = plotted.some((p) => distanceMeters(here, p) <= 60);
            return <BinocButton className="rm-binoc-map" on={near} onClick={() => { sound('select'); setWalking(here); }} />;
          })()}
          <div className="rm-crt" aria-hidden="true" />

          {xpFlash && <div className="rm-xp" key={xpFlash.id} role="status">{xpFlash.text}</div>}
          {clearAsk && (
            <div className="rm-clear-ask" role="alertdialog" aria-label={`Clear the area at ${clearAsk.name}`}>
              <b>DISCOVERED: {clearAsk.name}</b>
              <span>Clear the area now?</span>
              <div>
                <button type="button" className="rm-btn" onClick={() => clearNow(clearAsk.id)}>CLEAR IT</button>
                <button type="button" className="rm-btn rm-btn-ghost" onClick={() => setClearAsk(null)}>LATER</button>
              </div>
            </div>
          )}
          {toast && <div className={`rm-toast${flash ? ' rm-toast-flash' : ''}`} role="status">{toast}</div>}
          {flightLink && (
            <div className="rm-flights" role="status">
              <span>{flightLink.ferry ? 'NO ROAD' : 'OVERSEAS'}</span>
              <a className="rm-btn" href={flightLink.url} target="_blank" rel="noopener noreferrer" onClick={() => setFlightLink(null)}>{flightLink.ferry ? 'FERRIES TO' : 'FLIGHTS TO'} {flightLink.place.toUpperCase()}</a>
              <button type="button" className="rm-btn rm-btn-ghost" onClick={() => setFlightLink(null)}>×</button>
            </div>
          )}
          {nav && (
            <NavBanner
              destination={nav.spot.name}
              instruction={nav.route?.steps[nav.step + 1]?.text ?? (nav.route ? 'Continue to your destination' : '')}
              toTurn={nav.toTurn}
              remaining={nav.remaining}
              seconds={nav.route && nav.remaining !== null && nav.route.meters > 0 ? (nav.remaining / nav.route.meters) * nav.route.seconds : null}
              busy={nav.busy}
              onEnd={endNavigation}
              voiceOn={voiceOn}
              onVoice={toggleVoice}
              walking={!!nav.walking}
              onWalking={() => void toggleWalking()}
            />
          )}
          {travel && (
            <div className="rm-traveling" role="status">
              <span>FAST TRAVEL</span>
              <div className="rm-progress"><div style={{ animationDuration: `${travel.durationMs}ms` }} key={travel.id} /></div>
            </div>
          )}
          {selectedSpot && wasteland && !sceneSpot && !nav && (
            <LocationCard waiting={waitingLine(account.waiting.get(selectedSpot.id))}
              spot={selectedSpot} from={tracking ? fix : null} wasteland={wasteland} here={selectedSpot.id === hereId} visited={shownVisited.has(selectedSpot.id)} cleared={account.cleared.has(selectedSpot.id)} unlocked={account.unlocked.has(selectedSpot.id) || account.cleared.has(selectedSpot.id) || !!freeRenderFor(selectedSpot.id)} enemies={selectedSpot.kind === 'vault' ? undefined : (() => { const place = mapLocations.find((l) => l.id === selectedSpot.id); return place ? enemiesLine(place) : undefined; })()} onRename={selectedSpot.personal?.saved && !selectedSpot.personal.atlas && !selectedSpot.personal.home ? (name) => void renameSpot(selectedSpot, name) : undefined}
              traveling={!!travel || !!nav} onTravel={() => void startNavigation(selectedSpot)} onScene={() => { sound('tick'); setSceneStart('scene'); setSceneId(selectedSpot.id); }} onEnter={selectedSpot.personal?.home && account.cleared.has(selectedSpot.id) ? () => { sound('select'); setVaultOpen({ title: selectedSpot.name }); } : vacationIds.has(selectedSpot.id) ? () => { sound('select'); setVaultOpen({ title: selectedSpot.name, key: selectedSpot.id }); } : undefined} onClear={(() => { const place = mapLocations.find((l) => l.id === selectedSpot.id); const canRaid = !!place && !place.lore && (place.id.startsWith('wd:') || place.id.startsWith('famous:') || !!place.personal) && !place.personal?.home; return canRaid && !account.cleared.has(selectedSpot.id) && (account.unlocked.has(selectedSpot.id) || !!freeRenderFor(selectedSpot.id)) ? () => { sound('select'); clearNow(selectedSpot.id); } : undefined; })()} onWalk={streetViewAllowed && account.session && metroInfo && account.metros.has(metroInfo.id) ? () => { sound('select'); setWalking({ lat: selectedSpot.position.lat, lng: selectedSpot.position.lng }); } : undefined} walkOn={account.unlocked.has(selectedSpot.id) || account.cleared.has(selectedSpot.id) || selectedSpot.personal?.home === true || selectedSpot.personal?.atlas === true} onClose={() => setSelectedId(null)}
            />
          )}
          {sceneSpot && wasteland && (
            <SceneModal vacation={vacationOffer} onVacation={setVacationAsk}
              zones={wasteland?.zones}
              startOn={sceneStart}
              startRaid={sceneRaid}
              metroId={metroInfo?.id}
              spot={sceneSpot} regionName={liveName || wasteland.regionName} look={look} visited={shownVisited.has(sceneSpot.id)}
              account={account} plan={(() => { const place = mapLocations.find((l) => l.id === sceneSpot.id); return place ? raidFor(place) : undefined; })()} raid={(() => { const place = mapLocations.find((l) => l.id === sceneSpot.id); return place && !place.lore && (place.id.startsWith('wd:') || place.id.startsWith('famous:') || place.personal) ? (place.personal?.home ? homePlan() : raidFor(place)) : undefined; })()} level={levelInfo(account.points).level} sound={soundOn} onAccount={openAccount} onClose={() => { setSceneId(null); setSceneRaid(false); }} onNeedDiscover={() => say('YOU MUST DISCOVER THIS LOCATION FIRST', true)}
            />
          )}
          {walking && <StreetWalk center={walking} radiated={!!wasteland && isIrradiated(walking, wasteland.zones)} places={locations.filter((l) => l.id.startsWith('wd:') && (account.unlocked.has(l.id) || !!freeRenderFor(l.id))).map((l) => ({ id: l.id, lat: l.position.lat, lng: l.position.lng, name: l.name }))} onClose={() => setWalking(null)} />}
          {moving && <div className="rm-moving" role="status"><CogSpinner big /><span>MOVING VAULT FURNITURE…</span></div>}
          {vacationAsk && vacationOffer && <VacationAsk choice={vacationAsk} offer={vacationOffer} account={account} onClose={() => setVacationAsk(null)} onDone={() => setVacationAsk(null)} />}
          {vaultOpen !== null && <VaultHome key={vaultOpen.key ?? 'home'} title={vaultOpen.title} vaultKey={vaultOpen.key} account={account} onExit={() => setVaultOpen(null)} vacation={vaultOpen.key ? undefined : vacationOffer} />}
          {accountOpen && !account.session && <AccountModal auto={accountAuto} onClose={() => { setAccountOpen(false); setAccountAuto(false); }} />}
          <FaceIdOffer />
          {((account.session && account.homeLoaded && (!account.home || (!!account.home.address && account.home.vaultNumber === undefined)) && !homeSkipped) || homeOpen) && (
            <HomePrompt
              key={homeOpen ? 'change' : 'first'}
              onChosen={chooseHome} onSkip={() => void skipHome()} canSkip={account.home?.vaultNumber !== undefined} number={account.home?.vaultNumber}
              startWith={!homeOpen && account.home?.address && account.home.vaultNumber === undefined && account.home.lat !== undefined && account.home.lng !== undefined
                ? { placeId: account.home.placeId ?? '', name: 'Home', address: account.home.address, position: { lat: account.home.lat, lng: account.home.lng }, kind: 'house' } : undefined}
            />
          )}

          {message && !nav && (
            <div className="rm-status" role="status">
              <span className={busy || travel ? 'rm-blink' : ''}>{message}</span>
            </div>
          )}
        </div>

        <aside className="rm-side">
          <SearchBar busy={busy} disabled={status !== 'ready' || !!travel} initial={query} onSearch={search} onPick={(s) => void pickSuggestion(s)} recents={recents?.map(({ id, main, secondary, home }) => ({ id, main, secondary, home }))} onPickRecent={(id) => { const r = recents?.find((x) => x.id === id); if (r) void openPlace(r.place); }} onSignIn={accountsEnabled && !account.session ? () => setAccountOpen(true) : undefined} tracking={tracking} onToggleTracking={() => void toggleTracking()} soundOn={soundOn} onToggleSound={() => { const next = !soundOn; setSoundOn(next); buzz('tick'); if (next) beep('tick'); }} />
          <nav className="rm-tabs" role="tablist" aria-label="Pip-Boy menu">
            {(['locations', 'data', 'share'] as Tab[]).map((t) => (
              <button key={t} type="button" role="tab" aria-selected={tab === t} className={tab === t ? 'on' : ''} onClick={() => { setTab(t); sound('tick'); }}>
                {t.toUpperCase()}
              </button>
            ))}
          </nav>
          <section className="rm-panel" role="tabpanel">
            {tab === 'locations' && (
              <LocationsPanel
                vacation={vacationOffer} onVacation={setVacationAsk}
                metro={metroInfo} account={account}
                region={region} locations={[...locations, ...personalLocs.filter((p) => !p.personal?.home)]} hidden={hidden} onToggleCategory={toggleCategory} personalOn={personalOn} onTogglePersonal={() => setPersonalOn((v) => !v)} selectedId={selectedId} visited={shownVisited} cleared={account.cleared}
                onSelect={(id) => { if (navRef.current) return; setSelectedId(id); sound('select'); }}
              />
            )}
            {tab === 'data' && <AccountPanel locationOf={locationOf} vacation={vacationOffer} onVacation={setVacationAsk} account={account} found={found} iconOf={iconOfFound} metroRows={metroRows} onChangeHome={() => setHomeOpen(true)} onAccount={() => setAccountOpen(true)} onGoTo={(p) => void openFound(p, false)} onSnapshot={(p) => void openFound(p, true)} />}
            {tab === 'share' && <SharePanel query={region?.address ?? ''} look={look} account={account} mapPoster={mapPoster} />}
          </section>
        </aside>
      </main>

      <footer className="rm-foot">
        WastelandMaps is an unofficial fan project, not affiliated with, endorsed or sponsored by any game publisher or developer.
        Map © Google. Places from Wikidata (CC0); city sizes from GeoNames (CC BY 4.0); the roads running into flooded areas © OpenStreetMap contributors (ODbL). Snapshots are free-licensed photos from Wikimedia Commons, adapted with credit.
      </footer>
    </div>
  );
}

