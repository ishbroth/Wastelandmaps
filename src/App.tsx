import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import LocationCard from './components/LocationCard';
import MapView from './components/MapView';
import AccountModal from './components/AccountModal';
import SceneModal from './components/SceneModal';
import { accountsEnabled, atlasList, claimLoot, claimMetroClear, loadClearable, completeSignInFromUrl, loadAutoDiscover, loadFoundPlaces, loadMapPosition, renamePersonalPlace, reportDiscovery, saveAutoDiscover, saveFoundPlaces, saveHome, savePersonalPlace, setVaultPassword, saveMapPosition, useAccount, type AtlasPlace, type FoundPlace } from './lib/account';
import HomePrompt from './components/HomePrompt';
import { getFix, locationState, watchFixes, type GeoError } from './lib/geo';
import { isNative, onAppUrl, onResume, openExternal } from './lib/native';
import { resolveSuggestion, type PickedPlace, type Suggestion } from './lib/addressSearch';
import { iconHtmlFor } from './lib/landmarkIcons';
import { placeIcon } from './lib/placeIcons';
import { personalId, personalLocation, type PersonalPlace } from './lib/personal';
import { enableNotifications, pushNotice } from './lib/notify';
import { levelInfo, pointsFor } from './lib/points';
import { enemiesLine, homePlan, raidFor } from './lib/raid/raid';
import { freeRenderFor } from './lib/renders';
import { GLOBAL_LANDMARKS } from './lib/globalLandmarks';
import { photoIsOf } from './lib/snapshot';
import SearchBar from './components/SearchBar';
import SetupNotice from './components/SetupNotice';
import { AccountPanel, LocationsPanel, SharePanel } from './components/Panels';
import { geocodeLatLng, geocodeQuery, loadGoogle, type Region } from './lib/google';
import { loadIndex, loadMetro, metroAt } from './lib/metros';
import { wastelandName } from './lib/lore';
import { loadFlood, type FloodPatch } from './lib/flood';
import { loadZones, zoneFromEntry } from './lib/zones';
import { allLabels, countryBounds, deviceCountry, loadRegions, nameForZoom, NORTH_AMERICA, type RegionLabel } from './lib/regions';
import { LOOKS, type LookId } from './lib/looks';
import { readShareState } from './lib/share';
import { beep, type BeepKind } from './lib/sound';
import { buzz } from './lib/haptics';
import { START_MINUTES, type TravelRun } from './lib/travel';
import NavBanner from './components/NavBanner';
import { setVoiceEnabled, speak, spokenDistance, stopSpeaking, voiceEnabled } from './lib/voice';
import { currentFix, flightsUrl, isOverseas, progressAlong, requestRoute, type NavRoute } from './lib/navigation';
import {
  VAULT_ID, distanceMeters, generateWasteland, spotFromLocation, vaultSpot,
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
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [soundOn, setSoundOn] = useState(() => isNative()); // on in the app, off on the website until switched on

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
  const [nav, setNav] = useState<{ spot: Spot; route: NavRoute | null; step: number; toTurn: number | null; remaining: number | null; busy: string } | null>(null);
  const navRef = useRef(nav);
  const lastReroute = useRef(0);
  const [flash, setFlash] = useState(false);
  // the "+50 XP" that flashes on the map when a place is discovered
  const [xpFlash, setXpFlash] = useState<{ text: string; id: number } | null>(null);
  const xpTimer = useRef<number | undefined>(undefined);
  const [flightLink, setFlightLink] = useState<{ url: string; place: string } | null>(null);
  // everything this survivor has found (kept on the account when signed in)
  const [found, setFound] = useState<FoundPlace[]>([]);
  const foundRef = useRef<FoundPlace[]>([]);
  const pendingOpen = useRef<{ id: string; scene: boolean } | null>(null);
  const [liveName, setLiveName] = useState('');
  // while zoomed out the top of the map names the continent, country or state instead of the city
  const [zoomName, setZoomName] = useState<string | null>(null);
  const [regionLabels, setRegionLabels] = useState<RegionLabel[]>([]);
  const [flood, setFlood] = useState<FloodPatch[]>([]);
  const [startView, setStartView] = useState<React.ComponentProps<typeof MapView>['startView']>(null);
  const started = useRef(false);
  const lastSaved = useRef(0);
  const accountRef = useRef<ReturnType<typeof useAccount> | null>(null);
  const scanId = useRef(0);
  const metroSeen = useRef<{ current: string; loaded: Set<string> }>({ current: '', loaded: new Set() });
  const viewTimer = useRef<number | undefined>(undefined);
  const busyRef = useRef(false);
  const wastelandRef = useRef<Wasteland | null>(null);
  const autoStarted = useRef(false);
  const travelRef = useRef(false);
  const [travel, setTravel] = useState<TravelRun | null>(null);
  const [sceneId, setSceneId] = useState<string | null>(null);
  // a place opens on its info (the scene); only the Data tab's snapshot button opens it on the snapshot
  const [sceneStart, setSceneStart] = useState<'scene' | 'snapshot'>('scene');
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
  const personalLocs = useMemo(() => {
    const here = region?.center;
    const mine = account.personal.filter((q) => !here || distanceMeters(here, { lat: q.lat, lng: q.lng }) < 150_000 || account.home?.placeId === q.placeId).map((q) => personalLocation(q, true, account.home?.vaultNumber !== undefined && account.home.placeId === q.placeId ? account.home.vaultNumber : undefined));
    if (target && !account.personal.some((q) => q.placeId === target.placeId)) mine.push(personalLocation(target, false));
    return mine;
  }, [account.personal, account.home, target, region]);
  // the metro on the map (its address atlas), the addresses other survivors rendered there when this person has unlocked the metro, and the home prompt
  const [metroInfo, setMetroInfo] = useState<{ id: string; name: string } | null>(null);
  const [atlas, setAtlas] = useState<AtlasPlace[]>([]);
  const [homeOpen, setHomeOpen] = useState(false);
  const [homeSkipped, setHomeSkipped] = useState(false);
  // in the app: the sign-in email opens the app with a link, and coming back from a purchase should show the new balance
  useEffect(() => onAppUrl((url) => { void completeSignInFromUrl(url).then((ok) => { if (ok) void account.refresh(); }); }), [account]);
  useEffect(() => onResume(() => { if (accountRef.current?.session) void accountRef.current.refresh(); }), []);
  const atlasLocs = useMemo(() => atlas
    .filter((a) => !account.personal.some((q) => q.placeId === a.placeId))
    .map((a) => {
      const loc = personalLocation({ placeId: a.placeId, name: a.name, address: a.address, lat: a.lat, lng: a.lng, kind: a.kind }, true);
      return { ...loc, personal: { ...(loc.personal as NonNullable<Location['personal']>), atlas: true } };
    }), [atlas, account.personal]);
  const allLocations = useMemo(() => [...locations, ...personalLocs, ...atlasLocs], [locations, personalLocs, atlasLocs]);
  // what the map draws and what can be opened: the loaded city's places plus the permanent landmarks of the rest of the world
  const mapLocations = useMemo(() => {
    const have = new Set(allLocations.map((l) => l.id));
    return [...allLocations, ...GLOBAL_LANDMARKS.filter((g) => !have.has(g.id))];
  }, [allLocations]);
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
      if (!shown.every((id) => account.cleared.has(id))) return;
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
  }, [account.session, account.cleared, account.metrosCleared, metroInfo, locations]);
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
        if (metroInfo?.id === id) for (const l of locations) if (base.has(l.id) && account.cleared.has(l.id)) done.add(l.id);
        return { id, name: index.find((m) => m.id === id)?.title ?? id, done: done.size, total: base.size, cleared: account.metrosCleared.has(id) };
      }));
      if (!cancelled) setMetroRows(rows.filter((r) => r.total > 0 && (r.done > 0 || r.cleared)).sort((a, b) => Number(b.cleared) - Number(a.cleared) || b.done / b.total - a.done / a.total));
    })();
    return () => { cancelled = true; };
  }, [account.session, account.clearedByMetro, account.metrosCleared, account.cleared, metroInfo, locations]);
  const atlasOwned = !!metroInfo && account.metros.has(metroInfo.id);
  useEffect(() => {
    if (!account.session || !metroInfo || !atlasOwned) { setAtlas([]); return; }
    let cancelled = false;
    void atlasList(metroInfo.id).then((list) => { if (!cancelled) setAtlas(list); });
    return () => { cancelled = true; };
  }, [account.session, metroInfo, atlasOwned]);

  const [accountOpen, setAccountOpen] = useState(false);
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
    const all = new Set(visited);
    if (homeId) all.add(homeId);
    // an address whose snapshot they paid for counts as discovered
    for (const q of account.personal) if (account.unlocked.has(personalId(q.placeId))) all.add(personalId(q.placeId));
    return all;
  }, [visited, homeId, account.personal, account.unlocked]);
  const visitedRef = useRef(visited);
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
        lat: p.position.lat, lng: p.position.lng, foundAt: new Date().toISOString(),
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
  const markFound = useCallback((all: Location[], onFoot?: LatLng) => {
    // an address they travelled to goes on their own map (when signed in) and nowhere else
    for (const mine of all.filter((p) => p.personal)) {
      const who = accountRef.current?.session;
      const kept = accountRef.current?.personal.some((q) => personalId(q.placeId) === mine.id);
      if (kept) continue;
      if (!who) {
        setToast('SIGN IN TO KEEP THIS PLACE ON YOUR PERSONAL MAP');
      } else {
        void savePersonalPlace(who.user.id, { placeId: mine.id.slice(3), name: mine.name, address: mine.personal?.address ?? '', lat: mine.position.lat, lng: mine.position.lng, kind: mine.personal?.kind ?? 'house' })
          .then(() => accountRef.current?.refresh())
          .then(() => setToast(`DISCOVERED: ${mine.name}`));
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
      for (const p of fresh.filter((q) => freeRenderFor(q.id))) {
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
        for (const p of fresh) {
          if (!/^(wd:Q\d+|vault:\d+|famous:[a-z0-9-]+|lore:[a-z0-9-]+)$/.test(p.id)) continue;
          const result = await reportDiscovery(p.id, p.position, onFoot, pointsFor(p));
          added += result?.added ?? 0;
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
        void pushNotice(credits > 0 ? 'Level up' : 'Discovered', [...said, added > 0 ? `+${added} XP` : '', credits > 0 ? `Level up: ${credits * 100} free caps` : ''].filter(Boolean).join('\n'));
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
      setMetroInfo(home ? { id: home.id, name: home.name } : null);
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
      setVisited(new Set([...saved, ...foundRef.current.map((f) => f.id)]));
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
    if (near && near.id !== seen.current) {
      seen.current = near.id;
      setMetroInfo({ id: near.id, name: near.name });
      setLiveName(near.title);
      setToast(`ENTERING ${near.title.toUpperCase()}`);
      window.clearTimeout(toastTimer.current);
      toastTimer.current = window.setTimeout(() => setToast(''), 3200);
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
          return [...prev, ...fresh.filter((l) => !ids.has(l.id))];
        });
        setMessage(`${fresh.length} NEW LOCATIONS PICKED UP ON THE RADIO`);
      }
    }
  }, [show]);

  const onViewport = useCallback((center: LatLng, zoom: number) => {
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

  const search = useCallback((q: string) => show(() => geocodeQuery(q), q), [show]);

  /** A suggestion picked from the scan field: a city opens its map; an address opens the map around it with the address as the destination. */
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
    await show(() => geocodeQuery(place.address).catch(() => geocodeLatLng(place.position)), place.name);
    setTarget({ placeId: place.placeId, name: place.name, address: place.address, lat: place.position.lat, lng: place.position.lng, kind: place.kind });
    setSelectedId(personalId(place.placeId));
  }, [show, search]);
  /** Home chosen (here or typed): remembered, shown as a place of their own named Home, and the map goes there. */
  const chooseHome = useCallback(async (place: PickedPlace, vaultNumber: number): Promise<string | null> => {
    const who = accountRef.current?.session;
    if (!who) return 'Sign in first.';
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
  // navigation takes over the whole phone screen when it is turned sideways: let the map notice its new size
  useEffect(() => {
    const t = window.setTimeout(() => window.dispatchEvent(new Event('resize')), 60);
    return () => window.clearTimeout(t);
  }, [!!nav]);
  // the voice: the first instruction of a route, every new turn, and the turn again when it is close
  const spoken = useRef<{ route: unknown; step: number; near: boolean; rerouting: boolean } | null>(null);
  useEffect(() => {
    if (!nav) { spoken.current = null; stopSpeaking(); return; }
    const said = spoken.current;
    if (nav.busy === 'REROUTING') {
      if (!said?.rerouting) speak('Recalculating route.');
      if (said) said.rerouting = true;
      return;
    }
    if (!nav.route || nav.busy) return;
    const next = nav.route.steps[nav.step + 1]?.text ?? 'Continue to your destination';
    const plain = next.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    const lower = plain.charAt(0).toLowerCase() + plain.slice(1);
    if (!said || said.route !== nav.route) {
      speak(`${said ? 'Route updated.' : `Navigation online. Destination: ${nav.spot.name}.`} ${nav.toTurn !== null ? `In ${spokenDistance(nav.toTurn)}, ` : ''}${lower}.`);
      spoken.current = { route: nav.route, step: nav.step, near: false, rerouting: false };
      return;
    }
    if (said.step !== nav.step) {
      speak(`${nav.toTurn !== null && nav.toTurn > 120 ? `In ${spokenDistance(nav.toTurn)}, ` : ''}${lower}.`);
      spoken.current = { ...said, step: nav.step, near: false };
      return;
    }
    if (!said.near && nav.toTurn !== null && nav.toTurn < 130) {
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
        void show(() => geocodeLatLng({ lat: pos.lat, lng: pos.lng }), 'your position');
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
        if (initial.query) {
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
    if (!p || busy || !locations.some((l) => l.id === p.id)) return;
    pendingOpen.current = null;
    setSelectedId(p.id);
    if (p.scene) { setSceneStart('snapshot'); setSceneId(p.id); }
  }, [locations, busy]);
  const openFound = useCallback(async (place: FoundPlace, scene: boolean) => {
    // on a phone the map is above the tabs: bring it into view
    document.querySelector('.rm-screen')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (locationsRef.current.some((l) => l.id === place.id)) {
      setSelectedId(place.id);
      if (scene) { setSceneStart('snapshot'); setSceneId(place.id); }
      return;
    }
    pendingOpen.current = { id: place.id, scene };
    await show(() => geocodeLatLng({ lat: place.lat, lng: place.lng }), place.city ?? place.name);
  }, [show]);

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

  const [voiceOn, setVoiceOn] = useState(voiceEnabled());
  const toggleVoice = useCallback(() => {
    setVoiceOn((on) => { setVoiceEnabled(!on); return !on; });
  }, []);
  const endNavigation = useCallback(() => {
    if (navRef.current) speak('Navigation terminated.');
    setNav(null);
    navRef.current = null;
  }, []);

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
    setNav({ spot, route: null, step: 0, toTurn: null, remaining: null, busy: 'ROUTING' });
    const answer = await requestRoute(here, spot.position);
    if (answer.kind === 'no_route') {
      setNav(null);
      void openFlights(spot); // no road from here: it is across the water
      return;
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
  }, [tracking, say, sound, openFlights]);

  /** Every new position while navigating: the next turn, the distance left, rerouting if you left the road, and arriving. */
  const onNavFix = useCallback(async (here: LatLng) => {
    const n = navRef.current;
    if (!n?.route) return;
    const p = progressAlong(n.route, here);
    const toDestination = distanceMeters(here, n.spot.position);
    if (toDestination < 60 || p.remaining < 40) {
      const spot = n.spot;
      setNav(null);
      navRef.current = null;
      const place = locationsRef.current.find((l) => l.id === spot.id);
      if (place) markFound([place], here);
      say(`ARRIVED: ${spot.name}`);
      speak(`Destination reached: ${spot.name}.`);
      buzz('arrive');
      if (soundRef.current) beep('arrive');
      setSceneStart('scene');
      setSceneId(spot.id);
      return;
    }
    setNav({ ...n, step: p.step, toTurn: p.toTurn, remaining: p.remaining, busy: '' });
    if (p.off > 90 && Date.now() - lastReroute.current > 15_000) {
      lastReroute.current = Date.now();
      setNav((cur) => (cur ? { ...cur, busy: 'REROUTING' } : cur));
      const answer = await requestRoute(here, n.spot.position);
      setNav((cur) => (cur && answer.kind === 'route' ? { ...cur, route: answer.route, step: 0, toTurn: answer.route.steps[0]?.meters ?? null, remaining: answer.route.meters, busy: '' } : cur ? { ...cur, busy: '' } : cur));
    }
  }, [markFound, say]);
  const onNavFixRef = useRef(onNavFix);
  useEffect(() => { onNavFixRef.current = onNavFix; }, [onNavFix]);

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

  // auto-discover: while it is on, walking within about 120 m of a place fills it in on the map
  useEffect(() => {
    if (!tracking) return;
    let stop: (() => void) | null = null;
    let cancelled = false;
    void watchFixes(
      (pos) => {
        const here = { lat: pos.lat, lng: pos.lng };
        const moved = !fixRef.current || distanceMeters(fixRef.current, here) > 12;
        fixRef.current = here;
        if (moved) {
          setFix(here);
          setPlayer(here);
          setHereId(null);
        }
        void onNavFixRef.current(here);
        const reach = Math.max(120, Math.min(pos.accuracy, 250));
        const near = locationsRef.current.filter((l) => !visitedRef.current.has(l.id) && distanceMeters(here, l.position) <= reach);
        markFound(near, here);
      },
      // only a refusal turns it off: a moment without a signal (a tunnel, a bad fix) must not end the navigation
      (code) => { if (code === 1) { setTracking(false); setMessage('ERROR: LOCATION PERMISSION DENIED'); } },
      { background: { title: 'WastelandMaps is exploring', message: 'Discovering places as you move. Turn AUTO-DISCOVER off to stop.' } },
    ).then((off) => { if (cancelled) off(); else stop = off; });
    return () => { cancelled = true; stop?.(); };
  }, [tracking, markFound]);

  const toggleTracking = () => {
    const next = !tracking;
    if (next) void enableNotifications();
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

  const navView = useMemo(() => (nav?.route ? { path: nav.route.path, steps: nav.route.steps, step: nav.step } : null), [nav?.route, nav?.step]);

  return (
    <div className={`rm-app${nav ? ' rm-navigating' : ''}`}>
      <header className="rm-head">
        <div className="rm-title">
          <span className="rm-title-mark" aria-hidden="true" />
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
          {(wasteland || zoomName) && <div className="rm-poster-title" key={zoomName ?? (liveName || wasteland?.regionName)} aria-hidden="true">{zoomName ?? (liveName || wasteland?.regionName)}{!zoomName && account.session && metroInfo && account.metrosCleared.has(metroInfo.id) && <small className="rm-poster-cleared">[CLEARED]</small>}</div>}
          {status === 'ready' ? (
            <MapView
              onLocate={locateMe} locateDisabled={status !== 'ready' || !!travel}
              look={LOOKS[look]} region={region} wasteland={wasteland} locations={mapLocations} hiddenCategories={hidden}
              selectedId={selectedId} visited={shownVisited} cleared={account.cleared} player={player} travel={travel} onArrive={arrive} nav={navView} onSelect={setSelectedId} onViewport={onViewport} regionLabels={regionLabels} flood={flood} startView={startView}
            />
          ) : status === 'problem' ? (
            <SetupNotice problem={problem} />
          ) : (
            <div className="rm-setup"><h2>BOOTING…</h2></div>
          )}
          <div className="rm-crt" aria-hidden="true" />

          {xpFlash && <div className="rm-xp" key={xpFlash.id} role="status">{xpFlash.text}</div>}
          {toast && <div className={`rm-toast${flash ? ' rm-toast-flash' : ''}`} role="status">{toast}</div>}
          {flightLink && (
            <div className="rm-flights" role="status">
              <span>OVERSEAS</span>
              <a className="rm-btn" href={flightLink.url} target="_blank" rel="noopener noreferrer" onClick={() => setFlightLink(null)}>FLIGHTS TO {flightLink.place.toUpperCase()}</a>
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
            />
          )}
          {travel && (
            <div className="rm-traveling" role="status">
              <span>FAST TRAVEL</span>
              <div className="rm-progress"><div style={{ animationDuration: `${travel.durationMs}ms` }} key={travel.id} /></div>
            </div>
          )}
          {selectedSpot && wasteland && !sceneSpot && !nav && (
            <LocationCard
              spot={selectedSpot} from={tracking ? fix : null} wasteland={wasteland} here={selectedSpot.id === hereId} visited={shownVisited.has(selectedSpot.id)} cleared={account.cleared.has(selectedSpot.id)} unlocked={account.unlocked.has(selectedSpot.id) || !!freeRenderFor(selectedSpot.id)} enemies={selectedSpot.kind === 'vault' ? undefined : (() => { const place = allLocations.find((l) => l.id === selectedSpot.id); return place ? enemiesLine(place) : undefined; })()} onRename={selectedSpot.personal?.saved && !selectedSpot.personal.atlas && !selectedSpot.personal.home ? (name) => void renameSpot(selectedSpot, name) : undefined}
              traveling={!!travel || !!nav} onTravel={() => void startNavigation(selectedSpot)} onScene={() => { setSceneStart('scene'); setSceneId(selectedSpot.id); }} onClose={() => setSelectedId(null)}
            />
          )}
          {sceneSpot && wasteland && (
            <SceneModal
              zones={wasteland?.zones}
              startOn={sceneStart}
              metroId={metroInfo?.id}
              spot={sceneSpot} regionName={liveName || wasteland.regionName} look={look} visited={shownVisited.has(sceneSpot.id)}
              account={account} plan={(() => { const place = mapLocations.find((l) => l.id === sceneSpot.id); return place ? raidFor(place) : undefined; })()} raid={(() => { const place = mapLocations.find((l) => l.id === sceneSpot.id); return place && !place.lore && !place.vault && (place.id.startsWith('wd:') || place.id.startsWith('famous:') || place.personal) ? (place.personal?.home ? homePlan() : raidFor(place)) : undefined; })()} level={levelInfo(account.points).level} sound={soundOn} onAccount={openAccount} onClose={() => setSceneId(null)} onNeedDiscover={() => say('YOU MUST DISCOVER THIS LOCATION FIRST', true)}
            />
          )}
          {accountOpen && !account.session && <AccountModal onClose={() => setAccountOpen(false)} />}
          {((account.session && account.homeLoaded && (!account.home || (!!account.home.address && account.home.vaultNumber === undefined)) && !homeSkipped) || homeOpen) && (
            <HomePrompt
              key={homeOpen ? 'change' : 'first'}
              onChosen={chooseHome} onSkip={() => void skipHome()} number={account.home?.vaultNumber}
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
          <SearchBar busy={busy} disabled={status !== 'ready' || !!travel} initial={query} onSearch={search} onPick={(s) => void pickSuggestion(s)} onSignIn={accountsEnabled && !account.session ? () => setAccountOpen(true) : undefined} tracking={tracking} onToggleTracking={toggleTracking} />
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
                region={region} locations={locations} hidden={hidden} onToggleCategory={toggleCategory} selectedId={selectedId} visited={shownVisited} cleared={account.cleared}
                onSelect={(id) => { setSelectedId(id); sound('select'); }}
              />
            )}
            {tab === 'data' && <AccountPanel account={account} found={found} iconOf={iconOfFound} metroRows={metroRows} metro={metroInfo ?? undefined} onChangeHome={() => setHomeOpen(true)} onAccount={() => setAccountOpen(true)} onGoTo={(p) => void openFound(p, false)} onSnapshot={(p) => void openFound(p, true)} />}
            {tab === 'share' && <SharePanel query={region?.address ?? ''} look={look} soundOn={soundOn} onToggleSound={() => setSoundOn((s) => !s)} />}
          </section>
        </aside>
      </main>

      <footer className="rm-foot">
        WastelandMaps is an unofficial fan project. Fallout is a trademark of Bethesda Softworks LLC; this site is not affiliated with or endorsed by Bethesda or Microsoft.
        Map © Google. Places from Wikidata (CC0); city sizes from GeoNames (CC BY 4.0). Snapshots are free-licensed photos from Wikimedia Commons, adapted with credit.
      </footer>
    </div>
  );
}
