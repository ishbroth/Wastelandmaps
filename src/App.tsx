import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import LocationCard from './components/LocationCard';
import MapView from './components/MapView';
import SceneModal from './components/SceneModal';
import SearchBar from './components/SearchBar';
import SetupNotice from './components/SetupNotice';
import { DataPanel, LocationsPanel, SharePanel } from './components/Panels';
import { findLocations, geocodeLatLng, geocodeQuery, loadGoogle, type Region } from './lib/google';
import { LOOKS, type LookId } from './lib/looks';
import { readShareState, writeShareState } from './lib/share';
import { beep } from './lib/sound';
import { START_MINUTES, encounterFor, formatClock, radsAlongRoute, travelMinutes, type TravelRun } from './lib/travel';
import {
  VAULT_ID, generateWasteland, spotFromLocation, vaultSpot,
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
  const [travel, setTravel] = useState<TravelRun | null>(null);
  const [sceneId, setSceneId] = useState<string | null>(null);
  const [toast, setToast] = useState('');
  const trip = useRef<Trip | null>(null);
  const tripCount = useRef(0);
  const visitedRef = useRef(visited);
  const toastTimer = useRef<number | undefined>(undefined);

  const soundRef = useRef(false);
  const lookRef = useRef(look);
  useEffect(() => {
    soundRef.current = soundOn;
    lookRef.current = look;
    visitedRef.current = visited;
  }, [soundOn, look, visited]);

  const sound = useCallback((kind: 'tick' | 'select' | 'error') => {
    if (soundRef.current) beep(kind);
  }, []);

  // the page's colors follow the look
  useEffect(() => {
    document.documentElement.dataset.look = look;
  }, [look]);

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
      const w = generateWasteland(r.city, r.center, r.radiusMeters * 0.8);
      setWasteland(w);
      setQuery(r.address);
      setHidden(new Set());
      setLocations([]);
      // you start where everyone starts: at the vault door
      setPlayer(w.vault.position);
      setHereId(VAULT_ID);
      setClock(START_MINUTES);
      setRads(0);
      setVisited(new Set([VAULT_ID]));
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

  const search = useCallback((q: string) => show(() => geocodeQuery(q), q), [show]);

  const locateMe = useCallback(() => {
    if (!navigator.geolocation) {
      setMessage('ERROR: THIS DEVICE CANNOT FIND ITSELF');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => void show(() => geocodeLatLng({ lat: pos.coords.latitude, lng: pos.coords.longitude }), 'your position'),
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
    setVisited((prev) => new Set(prev).add(t.spot.id));
    setTravel(null);
    setMessage(`ARRIVED AT ${t.spot.name.toUpperCase()}. ${t.note}${t.rads > 0 ? ` +${t.rads} RADS.` : ''}`);
    setToast(first ? `LOCATION DISCOVERED: ${t.spot.name}` : `ARRIVED: ${t.spot.name}`);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(''), 3200);
    setSceneId(t.spot.id);
    sound('select');
  }, [sound]);

  const toggleCategory = (id: CategoryId) =>
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
          <h1>RAD<span>MAPS</span></h1>
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
          {wasteland && <div className="rm-poster-title" aria-hidden="true">{wasteland.regionName}</div>}
          {status === 'ready' ? (
            <MapView
              look={LOOKS[look]} region={region} wasteland={wasteland} locations={locations} hiddenCategories={hidden}
              selectedId={selectedId} visited={visited} player={player} travel={travel} onArrive={arrive} onSelect={setSelectedId}
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
              traveling={!!travel} onTravel={() => startTravel(selectedSpot)} onScene={() => setSceneId(selectedSpot.id)} onClose={() => setSelectedId(null)}
            />
          )}
          {sceneSpot && wasteland && (
            <SceneModal spot={sceneSpot} regionName={wasteland.regionName} look={look} visited={visited.has(sceneSpot.id)} onClose={() => setSceneId(null)} />
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
          <SearchBar busy={busy} disabled={status !== 'ready' || !!travel} initial={query} onSearch={search} onLocate={locateMe} />
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
