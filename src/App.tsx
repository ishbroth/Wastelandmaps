import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import LocationCard from './components/LocationCard';
import MapView from './components/MapView';
import AccountModal from './components/AccountModal';
import SceneModal from './components/SceneModal';
import { accountsEnabled, loadMapPosition, reportDiscovery, saveMapPosition, useAccount } from './lib/account';
import { enableNotifications, pushNotice } from './lib/notify';
import SearchBar from './components/SearchBar';
import SetupNotice from './components/SetupNotice';
import { DataPanel, LocationsPanel, SharePanel } from './components/Panels';
import { geocodeLatLng, geocodeQuery, loadGoogle, type Region } from './lib/google';
import { loadIndex, loadMetro, metroAt } from './lib/metros';
import { wastelandName } from './lib/lore';
import { loadFlood, type FloodPatch } from './lib/flood';
import { allLabels, countryBounds, deviceCountry, loadRegions, nameForZoom, NORTH_AMERICA, type RegionLabel } from './lib/regions';
import { LOOKS, type LookId } from './lib/looks';
import { readShareState } from './lib/share';
import { beep } from './lib/sound';
import { START_MINUTES, encounterFor, formatClock, radsAlongRoute, travelMinutes, type TravelRun } from './lib/travel';
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
  const tripCount = useRef(0);
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
  }, [soundOn, look, visited, locations, busy, travel, wasteland]);

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

  /** Marks places as discovered (filled in on the map) and remembers them in this browser, per city. */
  const markFound = useCallback((places: Location[], onFoot?: LatLng) => {
    const fresh = places.filter((p) => !visitedRef.current.has(p.id));
    if (fresh.length === 0) return;
    const next = new Set(visitedRef.current);
    fresh.forEach((p) => next.add(p.id));
    visitedRef.current = next;
    setVisited(next);
    try { localStorage.setItem(foundKey.current, JSON.stringify([...next])); } catch { /* storage unavailable */ }
    // "Discovered: <new name>, formerly <old name>", in the page and, if allowed, as a notification
    const said = fresh.map((p) => (p.oldName && p.oldName !== p.name ? `${p.name}, formerly ${p.oldName}` : p.name));
    setToast(`DISCOVERED: ${said.join(' | ')}`);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(''), 4200);
    void pushNotice('Discovered', said.join('\n'));
    if (soundRef.current) beep('select');
    // reaching places on foot counts toward free snapshots: every 10 is one credit
    const who = accountRef.current?.session;
    if (onFoot && who) {
      void (async () => {
        let earned = 0;
        for (const p of fresh) {
          if (!/^(wd:Q\d+|vault:\d+)$/.test(p.id)) continue;
          const result = await reportDiscovery(p.id, p.position, onFoot);
          if (result?.bonus) earned += result.given;
        }
        if (earned > 0) {
          setToast(`10 PLACES REACHED: ${earned} FREE SNAPSHOT CREDIT${earned > 1 ? 'S' : ''} EARNED`);
          window.clearTimeout(toastTimer.current);
          toastTimer.current = window.setTimeout(() => setToast(''), 5200);
          void pushNotice('Free snapshot earned', 'Every 10 places you reach on foot unlocks a snapshot.');
        }
        void accountRef.current?.refresh();
      })();
    }
  }, []);

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
      setVisited(new Set([VAULT_ID, ...saved]));
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
      const extra = generateWasteland(under.name, { lat: under.lat, lng: under.lng }, Math.min(under.radiusKm, 25) * 400, under.title).zones;
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
    void enableNotifications();
    if (!navigator.geolocation) {
      setMessage('ERROR: THIS DEVICE CANNOT FIND ITSELF');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        void show(() => geocodeLatLng({ lat: pos.coords.latitude, lng: pos.coords.longitude }), 'your position');
        setTracking(true);
      },
      () => setMessage('ERROR: LOCATION PERMISSION DENIED'),
      { timeout: 10_000 },
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


  // ---- fast travel ----
  const startTravel = useCallback((spot: Spot) => {
    if (!player || !wasteland || travel || spot.id === hereId) return;
    const minutes = travelMinutes(player, spot.position);
    trip.current = {
      spot,
      minutes,
      rads: radsAlongRoute(player, spot.position, wasteland.zones),
      note: encounterFor(hereId ?? 'start', spot.id),
    };
    tripCount.current += 1;
    setTravel({ id: tripCount.current, from: player, to: spot.position, durationMs: Math.min(4500, Math.max(2000, 1600 + minutes * 25)) });
    setMessage(`TRAVELING TO ${spot.name.toUpperCase()}…`);
    sound('tick');
  }, [player, wasteland, travel, hereId, sound]);

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
    }
    setTravel(null);
    setMessage(`ARRIVED AT ${t.spot.name.toUpperCase()}. ${t.note}${t.rads > 0 ? ` +${t.rads} RADS.` : ''}`);
    setToast(first ? `LOCATION DISCOVERED: ${t.spot.name}` : `ARRIVED: ${t.spot.name}`);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(''), 3200);
    setSceneId(t.spot.id);
    sound('select');
  }, [sound]);

  // auto-discover: while it is on, walking within about 120 m of a place fills it in on the map
  useEffect(() => {
    if (!tracking || !navigator.geolocation) return;
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        const here = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        const reach = Math.max(120, Math.min(pos.coords.accuracy, 250));
        const near = locationsRef.current.filter((l) => !visitedRef.current.has(l.id) && distanceMeters(here, l.position) <= reach);
        markFound(near, here);
      },
      () => { setTracking(false); setMessage('ERROR: LOCATION PERMISSION DENIED'); },
      { enableHighAccuracy: true, maximumAge: 10_000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [tracking, markFound]);

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
              selectedId={selectedId} visited={visited} player={player} travel={travel} onArrive={arrive} onSelect={setSelectedId} onViewport={onViewport} regionLabels={regionLabels} flood={flood} startView={startView}
            />
          ) : status === 'problem' ? (
            <SetupNotice problem={problem} />
          ) : (
            <div className="rm-setup"><h2>BOOTING…</h2></div>
          )}
          <div className="rm-crt" aria-hidden="true" />

          {toast && <div className="rm-toast" role="status">{toast}</div>}
          {travel && (
            <div className="rm-traveling" role="status">
              <span>FAST TRAVEL</span>
              <div className="rm-progress"><div style={{ animationDuration: `${travel.durationMs}ms` }} key={travel.id} /></div>
            </div>
          )}
          {selectedSpot && wasteland && !sceneSpot && (
            <LocationCard
              spot={selectedSpot} from={player} wasteland={wasteland} here={selectedSpot.id === hereId} visited={visited.has(selectedSpot.id)}
              traveling={!!travel} onTravel={() => startTravel(selectedSpot)} onDiscover={() => { const place = locations.find((l) => l.id === selectedSpot.id); if (place) markFound([place]); }} onScene={() => setSceneId(selectedSpot.id)} onClose={() => setSelectedId(null)}
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
          <SearchBar busy={busy} disabled={status !== 'ready' || !!travel} initial={query} onSearch={search} onLocate={locateMe} tracking={tracking} onToggleTracking={() => { if (!tracking) void enableNotifications(); setTracking(!tracking); }} />
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
            {tab === 'data' && <DataPanel region={region} wasteland={wasteland} locations={locations} />}
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
