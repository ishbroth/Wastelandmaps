import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import LocationCard from './components/LocationCard';
import MapView from './components/MapView';
import SceneModal from './components/SceneModal';
import SearchBar from './components/SearchBar';
import SetupNotice from './components/SetupNotice';
import { DataPanel, LocationsPanel, SharePanel } from './components/Panels';
import { findLocations, geocodeLatLng, geocodeQuery, loadGoogle, townAt, type Region } from './lib/google';
import { wastelandName } from './lib/lore';
import { LOOKS, type LookId } from './lib/looks';
import { readShareState, writeShareState } from './lib/share';
import { beep } from './lib/sound';
import { START_MINUTES, encounterFor, formatClock, radsAlongRoute, travelMinutes, type TravelRun } from './lib/travel';
import {
  VAULT_ID, distanceMeters, generateWasteland, spotFromLocation, vaultSpot,
  type CategoryId, type LatLng, type Location, type Spot, type Wasteland,
} from './lib/wasteland';

type Tab = 'locations' | 'data' | 'share';
type Status = 'loading' | 'ready' | 'problem';

/** How many new patches of ground one visit may scan in. Each patch is a handful of Google lookups, so this keeps a long session from running up a bill. */
const MAX_PATCHES = 60;

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
  const scanId = useRef(0);
  const tilesDone = useRef(new Set<string>());
  const limitSaid = useRef(false);
  const townSeen = useRef<{ at: LatLng; key: string; known: Set<string> } | null>(null);
  const viewTimer = useRef<number | undefined>(undefined);
  const busyRef = useRef(false);
  const travelRef = useRef(false);
  const [travel, setTravel] = useState<TravelRun | null>(null);
  const [sceneId, setSceneId] = useState<string | null>(null);
  const [toast, setToast] = useState('');
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
    travelRef.current = !!travel;
  }, [soundOn, look, visited, locations, busy, travel]);

  const sound = useCallback((kind: 'tick' | 'select' | 'error') => {
    if (soundRef.current) beep(kind);
  }, []);

  // the page's colors follow the look
  useEffect(() => {
    document.documentElement.dataset.look = look;
  }, [look]);

  /** Marks places as discovered (filled in on the map) and remembers them in this browser, per city. */
  const markFound = useCallback((ids: string[], names: string[]) => {
    const fresh = ids.filter((id) => !visitedRef.current.has(id));
    if (fresh.length === 0) return;
    const next = new Set(visitedRef.current);
    fresh.forEach((id) => next.add(id));
    visitedRef.current = next;
    setVisited(next);
    try { localStorage.setItem(foundKey.current, JSON.stringify([...next])); } catch { /* storage unavailable */ }
    setToast(`LOCATION DISCOVERED: ${names.join(', ')}`);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(''), 3200);
    if (soundRef.current) beep('select');
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
      const title = wastelandName(r.city, r.state).name;
      const w = generateWasteland(r.city, r.center, r.radiusMeters * 0.8, title);
      scanId.current += 1;
      tilesDone.current = new Set();
      townSeen.current = { at: r.center, key: `${r.city}|${r.state}`, known: new Set([`${r.city}|${r.state}`]) };
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
      writeShareState({ query: r.address, look: lookRef.current });
      sound('select');
      const found = await findLocations(r.center, r.radiusMeters);
      setLocations(found);
      setMessage(`${w.regionName.toUpperCase()}: ${found.length} LOCATIONS MARKED. PICK ONE TO FAST TRAVEL`);
    } catch (e) {
      setMessage(`ERROR: ${e instanceof Error ? e.message : 'SCAN FAILED'}`);
      sound('error');
    } finally {
      setBusy(false);
    }
  }, [sound]);

  // ---- the map follows you: as it comes to rest somewhere new, the region is renamed and the places around it are scanned in ----
  const followMap = useCallback(async (center: LatLng, zoom: number) => {
    const scan = scanId.current;

    // a different town under the middle of the map: a new name at the top, and some fallout of its own
    const seen = townSeen.current;
    if (zoom >= 9 && seen && distanceMeters(seen.at, center) > 3000) {
      seen.at = center;
      const town = await townAt(center);
      if (town && scan === scanId.current) {
        const key = `${town.city}|${town.state}`;
        if (key !== seen.key) {
          seen.key = key;
          const title = wastelandName(town.city, town.state).name;
          setLiveName(title);
          setToast(`ENTERING ${title.toUpperCase()}`);
          window.clearTimeout(toastTimer.current);
          toastTimer.current = window.setTimeout(() => setToast(''), 3200);
          if (!seen.known.has(key)) {
            seen.known.add(key);
            const extra = generateWasteland(town.city, center, 9000, title).zones;
            setWasteland((w) => (w ? { ...w, zones: [...w.zones, ...extra] } : w));
          }
        }
      }
    }

    // places around the middle of the map, once per patch of ground. Zoomed in, the patches are smaller, so a neighborhood shows more.
    if (zoom >= 10) {
      const grid = zoom >= 14 ? 0.02 : zoom >= 12 ? 0.05 : 0.12;
      const row = Math.floor(center.lat / grid);
      const col = Math.floor(center.lng / grid);
      const key = `${grid}:${row}:${col}`;
      if (tilesDone.current.has(key)) return;
      if (tilesDone.current.size >= MAX_PATCHES) {
        if (!limitSaid.current) {
          limitSaid.current = true;
          setMessage('SCAVENGER RADIO OUT OF RANGE: RELOAD THE PAGE TO KEEP SCANNING NEW GROUND');
        }
        return;
      }
      tilesDone.current.add(key);
      const patchCenter = { lat: (row + 0.5) * grid, lng: (col + 0.5) * grid };
      const found = await findLocations(patchCenter, Math.min(12_000, grid * 111_320 * 0.75));
      if (scan !== scanId.current) return;
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
  }, []);

  const onViewport = useCallback((center: LatLng, zoom: number) => {
    window.clearTimeout(viewTimer.current);
    viewTimer.current = window.setTimeout(() => {
      if (travelRef.current || busyRef.current) return;
      void followMap(center, zoom);
    }, 900);
  }, [followMap]);

  const search = useCallback((q: string) => show(() => geocodeQuery(q), q), [show]);

  const locateMe = useCallback(() => {
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
        if (initial.query) void search(initial.query);
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

  // the address bar follows the look once there is a place
  useEffect(() => {
    if (region) writeShareState({ query: region.address, look });
  }, [look, region]);

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
        markFound(near.map((l) => l.id), near.map((l) => l.name));
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
        <div className="rm-looks" role="group" aria-label="Map look">
          {(Object.keys(LOOKS) as LookId[]).map((id) => (
            <button key={id} type="button" className={look === id ? 'on' : ''} aria-pressed={look === id} onClick={() => chooseLook(id)}>{LOOKS[id].label}</button>
          ))}
        </div>
      </header>

      <main className="rm-device">
        <div className="rm-screen">
          {wasteland && <div className="rm-poster-title" key={liveName || wasteland.regionName} aria-hidden="true">{liveName || wasteland.regionName}</div>}
          {status === 'ready' ? (
            <MapView
              look={LOOKS[look]} region={region} wasteland={wasteland} locations={locations} hiddenCategories={hidden}
              selectedId={selectedId} visited={visited} player={player} travel={travel} onArrive={arrive} onSelect={setSelectedId} onViewport={onViewport}
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
              traveling={!!travel} onTravel={() => startTravel(selectedSpot)} onDiscover={() => markFound([selectedSpot.id], [selectedSpot.name])} onScene={() => setSceneId(selectedSpot.id)} onClose={() => setSelectedId(null)}
            />
          )}
          {sceneSpot && wasteland && (
            <SceneModal spot={sceneSpot} regionName={liveName || wasteland.regionName} look={look} visited={visited.has(sceneSpot.id)} onClose={() => setSceneId(null)} />
          )}

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
          <SearchBar busy={busy} disabled={status !== 'ready' || !!travel} initial={query} onSearch={search} onLocate={locateMe} tracking={tracking} onToggleTracking={() => setTracking((t) => !t)} />
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
        Map data © Google. Snapshots are free-licensed photos from Wikimedia Commons, adapted with credit.
      </footer>
    </div>
  );
}
