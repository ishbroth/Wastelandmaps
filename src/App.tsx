import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import LocationCard from './components/LocationCard';
import MapView from './components/MapView';
import AccountModal from './components/AccountModal';
import SceneModal from './components/SceneModal';
import { accountsEnabled, loadAutoDiscover, loadFoundPlaces, loadMapPosition, reportDiscovery, saveAutoDiscover, saveFoundPlaces, saveMapPosition, useAccount, type FoundPlace } from './lib/account';
import { enableNotifications, pushNotice } from './lib/notify';
import { pointsFor } from './lib/points';
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
import { beep } from './lib/sound';
import { START_MINUTES, formatClock, type TravelRun } from './lib/travel';
import NavBanner from './components/NavBanner';
import { currentFix, flightsUrl, googleMapsUrl, isOverseas, progressAlong, requestRoute, type NavRoute } from './lib/navigation';
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
  const [soundOn, setSoundOn] = useState(false);

  // the survivor: where they stand, what time it is, how irradiated they are, what they have seen
  const [player, setPlayer] = useState<LatLng | null>(null);
  const [hereId, setHereId] = useState<string | null>(null);
  const [clock, setClock] = useState(START_MINUTES);
  const [rads, setRads] = useState(0);
  const [visited, setVisited] = useState<Set<string>>(new Set());
  const [tracking, setTracking] = useState(false);
  // where the device is now (while AUTO-DISCOVER is on), and the driving navigation to a place
  const [fix, setFix] = useState<LatLng | null>(null);
  const fixRef = useRef<LatLng | null>(null);
  const [nav, setNav] = useState<{ spot: Spot; route: NavRoute | null; step: number; toTurn: number | null; remaining: number | null; busy: string } | null>(null);
  const navRef = useRef(nav);
  const lastReroute = useRef(0);
  const [flash, setFlash] = useState(false);
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
  const [toast, setToast] = useState('');
  const account = useAccount();
  const [accountOpen, setAccountOpen] = useState(false);
  const trip = useRef<Trip | null>(null);
  const visitedRef = useRef(visited);
  const toastTimer = useRef<number | undefined>(undefined);

  const soundRef = useRef(false);
  const lookRef = useRef(look);
  const locationsRef = useRef(locations);
  const foundKey = useRef('');
  useEffect(() => {
    soundRef.current = soundOn;
    lookRef.current = look;
    visitedRef.current = visited;
    locationsRef.current = locations;
    busyRef.current = busy;
    wastelandRef.current = wasteland;
    travelRef.current = !!travel;
    navRef.current = nav;
  }, [soundOn, look, visited, locations, busy, travel, wasteland, nav]);

  const sound = useCallback((kind: 'tick' | 'select' | 'error') => {
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
    setToast(result === 'success' ? 'PAYMENT RECEIVED: YOUR CREDITS ARE ON THE WAY' : 'CHECKOUT CANCELLED');
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
    if (who) void saveFoundPlaces(who.user.id, fresh);
  }, []);

  /** Marks places as discovered (filled in on the map) and remembers them in this browser, per city. */
  const markFound = useCallback((places: Location[], onFoot?: LatLng) => {
    const fresh = places.filter((p) => !visitedRef.current.has(p.id));
    if (fresh.length === 0) return;
    const next = new Set(visitedRef.current);
    fresh.forEach((p) => next.add(p.id));
    visitedRef.current = next;
    setVisited(next);
    try { localStorage.setItem(foundKey.current, JSON.stringify([...next])); } catch { /* storage unavailable */ }
    void recordFound(fresh);
    // "Discovered: <new name>, formerly <old name>", in the page and, if allowed, as a notification
    const said = fresh.map((p) => (p.oldName && p.oldName !== p.name ? `${p.name}, formerly ${p.oldName}` : p.name));
    setToast(`DISCOVERED: ${said.join(' | ')}`);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(''), 4200);
    void pushNotice('Discovered', said.join('\n'));
    if (soundRef.current) beep('select');
    // reaching places on foot earns points; every level reached gives a free snapshot credit
    const who = accountRef.current?.session;
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
        if (credits > 0) {
          setToast(`LEVEL UP${level ? ` (LEVEL ${level})` : ''}: ${credits} FREE SNAPSHOT CREDIT${credits > 1 ? 'S' : ''} EARNED`);
          window.clearTimeout(toastTimer.current);
          toastTimer.current = window.setTimeout(() => setToast(''), 5200);
          void pushNotice('Level up', 'You earned a free snapshot credit.');
        } else if (added > 0) {
          setToast(`+${added} POINTS`);
          window.clearTimeout(toastTimer.current);
          toastTimer.current = window.setTimeout(() => setToast(''), 3200);
        }
        void accountRef.current?.refresh();
      })();
    }
  }, [recordFound]);

  const spotFor = useCallback((id: string | null): Spot | null => {
    if (!id) return null;
    if (id === VAULT_ID) return wasteland ? vaultSpot(wasteland) : null;
    const loc = locations.find((l) => l.id === id);
    return loc ? spotFromLocation(loc) : null;
  }, [wasteland, locations]);
  const selectedSpot = useMemo(() => spotFor(selectedId), [spotFor, selectedId]);
  const sceneSpot = useMemo(() => spotFor(sceneId), [spotFor, sceneId]);

  const show = useCallback(async (resolveRegion: () => Promise<Region>, label: string) => {
    setBusy(true);
    setSelectedId(null);
    setSceneId(null);
    setTravel(null);
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
      setLiveName(title);
      setWasteland(w);
      setQuery(r.address);
      setHidden(new Set());
      setLocations([]);
      // you start where everyone starts: at the vault door
      setPlayer(w.vault.position);
      setHereId(VAULT_ID);
      setClock(START_MINUTES);
      setRads(0);
      foundKey.current = `wastelandmaps:found:v1:${r.address}`;
      let saved: string[] = [];
      try { saved = JSON.parse(localStorage.getItem(foundKey.current) ?? '[]') as string[]; } catch { /* nothing saved */ }
      setVisited(new Set([VAULT_ID, ...saved, ...foundRef.current.map((f) => f.id)]));
      setMessage(`VAULT ${w.vault.number}: YOU EMERGE INTO ${w.regionName.toUpperCase()}`);
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
    if (started.current || status !== 'ready' || !account.loaded) return;
    started.current = true;
    void (async () => {
      const regions = await loadRegions();
      if (account.session) {
        const saved = await loadMapPosition(account.session.user.id);
        if (saved) {
          const center = { lat: saved.lat, lng: saved.lng };
          setStartView({ kind: 'view', center, zoom: saved.zoom });
          // close in: set up the wasteland around that spot too, without moving the map
          if (saved.zoom >= 9) void show(async () => ({ ...(await geocodeLatLng(center)), keepView: true }), 'your last position');
          return;
        }
      }
      setStartView({ kind: 'bounds', bounds: (regions && countryBounds(regions, deviceCountry())) || NORTH_AMERICA });
    })();
  }, [status, account, show]);

  const search = useCallback((q: string) => show(() => geocodeQuery(q), q), [show]);

  const locateMe = useCallback(() => {
    if (!navigator.geolocation) {
      setMessage('ERROR: THIS DEVICE CANNOT FIND ITSELF');
      return;
    }
    // ask for the position first, straight from the click: a second permission question (notifications) used to open in front of it and swallow it
    setMessage('LOOKING FOR YOU… (ANSWER THE LOCATION QUESTION AT THE TOP OF THE BROWSER)');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setMessage('');
        void show(() => geocodeLatLng({ lat: pos.coords.latitude, lng: pos.coords.longitude }), 'your position');
        setTracking(true);
        void enableNotifications();
      },
      (err) =>
        setMessage(
          err.code === 1
            ? 'ERROR: LOCATION IS BLOCKED FOR THIS SITE. CLICK THE LOCK BESIDE THE ADDRESS, ALLOW LOCATION, AND TRY AGAIN'
            : err.code === 2
              ? 'ERROR: THIS DEVICE CANNOT WORK OUT WHERE IT IS. CHECK THAT LOCATION IS TURNED ON IN ITS SETTINGS'
              : 'ERROR: LOCATION TOOK TOO LONG. TRY AGAIN',
        ),
      { timeout: 20_000, maximumAge: 60_000 },
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
    if (p.scene) setSceneId(p.id);
  }, [locations, busy]);
  const openFound = useCallback(async (place: FoundPlace, scene: boolean) => {
    // on a phone the map is above the tabs: bring it into view
    document.querySelector('.rm-screen')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (locationsRef.current.some((l) => l.id === place.id)) {
      setSelectedId(place.id);
      if (scene) setSceneId(place.id);
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
    const opened = window.open(url, '_blank', 'noopener');
    if (!opened) setFlightLink({ url, place });
    say(`OVERSEAS: FLIGHTS TO ${place.toUpperCase()}`);
  }, [say]);

  const endNavigation = useCallback(() => {
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
      // Google's directions cannot be used from here (the service is not switched on for this key): hand over to Google Maps itself
      setNav(null);
      window.open(googleMapsUrl(spot.position), '_blank', 'noopener');
      say('NAVIGATION OPENED IN GOOGLE MAPS');
      return;
    }
    lastReroute.current = Date.now();
    const first = answer.route.steps[0];
    setNav({ spot, route: answer.route, step: 0, toTurn: first?.meters ?? null, remaining: answer.route.meters, busy: '' });
    setMessage(`NAVIGATING TO ${spot.name.toUpperCase()}`);
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
    setSceneId(t.spot.id);
    sound('select');
  }, [sound, recordFound]);

  // auto-discover: while it is on, walking within about 120 m of a place fills it in on the map
  useEffect(() => {
    if (!tracking || !navigator.geolocation) return;
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        const here = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        const moved = !fixRef.current || distanceMeters(fixRef.current, here) > 12;
        fixRef.current = here;
        if (moved) {
          setFix(here);
          setPlayer(here);
          setHereId(null);
        }
        void onNavFixRef.current(here);
        const reach = Math.max(120, Math.min(pos.coords.accuracy, 250));
        const near = locationsRef.current.filter((l) => !visitedRef.current.has(l.id) && distanceMeters(here, l.position) <= reach);
        markFound(near, here);
      },
      // only a refusal turns it off: a moment without a signal (a tunnel, a bad fix) must not end the navigation
      (err) => { if (err.code === 1) { setTracking(false); setMessage('ERROR: LOCATION PERMISSION DENIED'); } },
      { enableHighAccuracy: true, maximumAge: 10_000 },
    );
    return () => navigator.geolocation.clearWatch(id);
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

  const total = locations.length + (wasteland ? 1 : 0);

  return (
    <div className="rm-app">
      <header className="rm-head">
        <div className="rm-title">
          <span className="rm-title-mark" aria-hidden="true" />
          <h1>WASTELAND<span>MAPS</span></h1>
          <p>See where you live after the bombs fell</p>
        </div>
        {accountsEnabled && (
          <button type="button" className="rm-account-btn" onClick={() => setAccountOpen(true)}>
            {account.session ? `${account.credits ?? '…'} CREDITS` : 'SIGN IN'}
          </button>
        )}
        <div className="rm-looks" role="group" aria-label="Map look">
          {(Object.keys(LOOKS) as LookId[]).map((id) => (
            <button key={id} type="button" className={look === id ? 'on' : ''} aria-pressed={look === id} onClick={() => chooseLook(id)}>{LOOKS[id].label}</button>
          ))}
        </div>
      </header>

      <main className="rm-device">
        <div className="rm-screen">
          {(wasteland || zoomName) && <div className="rm-poster-title" key={zoomName ?? (liveName || wasteland?.regionName)} aria-hidden="true">{zoomName ?? (liveName || wasteland?.regionName)}</div>}
          {status === 'ready' ? (
            <MapView
              look={LOOKS[look]} region={region} wasteland={wasteland} locations={locations} hiddenCategories={hidden}
              selectedId={selectedId} visited={visited} player={player} travel={travel} onArrive={arrive} nav={nav?.route ? { path: nav.route.path } : null} onSelect={setSelectedId} onViewport={onViewport} regionLabels={regionLabels} flood={flood} startView={startView}
            />
          ) : status === 'problem' ? (
            <SetupNotice problem={problem} />
          ) : (
            <div className="rm-setup"><h2>BOOTING…</h2></div>
          )}
          <div className="rm-crt" aria-hidden="true" />

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
              spot={selectedSpot} points={(() => { const place = locations.find((l) => l.id === selectedSpot.id); return place ? pointsFor(place) : 0; })()} from={tracking ? fix : null} wasteland={wasteland} here={selectedSpot.id === hereId} visited={visited.has(selectedSpot.id)}
              traveling={!!travel || !!nav} onTravel={() => void startNavigation(selectedSpot)} onDiscover={() => { const place = locations.find((l) => l.id === selectedSpot.id); if (place) markFound([place]); }} onScene={() => setSceneId(selectedSpot.id)} onClose={() => setSelectedId(null)}
            />
          )}
          {sceneSpot && wasteland && (
            <SceneModal
              spot={sceneSpot} regionName={liveName || wasteland.regionName} look={look} visited={visited.has(sceneSpot.id)}
              account={account} onAccount={() => setAccountOpen(true)} onClose={() => setSceneId(null)}
            />
          )}
          {accountOpen && <AccountModal account={account} onClose={() => setAccountOpen(false)} />}

          <div className="rm-status" role="status">
            <span className={busy || travel ? 'rm-blink' : ''}>{message}</span>
            {wasteland && (
              <span className="rm-stats">
                <b>{formatClock(clock)}</b>
                <b className={rads >= 300 ? 'rm-hot' : ''}>RADS {rads}</b>
                <b>{visited.size}/{total} FOUND</b>
              </span>
            )}
          </div>
        </div>

        <aside className="rm-side">
          <SearchBar busy={busy} disabled={status !== 'ready' || !!travel} initial={query} onSearch={search} onLocate={locateMe} tracking={tracking} onToggleTracking={toggleTracking} />
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
                region={region} locations={locations} hidden={hidden} onToggleCategory={toggleCategory} selectedId={selectedId} visited={visited}
                onSelect={(id) => { setSelectedId(id); sound('select'); }}
              />
            )}
            {tab === 'data' && <AccountPanel account={account} found={found} onAccount={() => setAccountOpen(true)} onGoTo={(p) => void openFound(p, false)} onSnapshot={(p) => void openFound(p, true)} />}
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
