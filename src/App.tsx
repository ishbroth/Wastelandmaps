import { useCallback, useEffect, useRef, useState } from 'react';
import MapView from './components/MapView';
import SearchBar from './components/SearchBar';
import SetupNotice from './components/SetupNotice';
import { DataPanel, LocationsPanel, SharePanel } from './components/Panels';
import { findLocations, geocodeLatLng, geocodeQuery, loadGoogle, type Region } from './lib/google';
import { LOOKS, type LookId } from './lib/looks';
import { readShareState, writeShareState } from './lib/share';
import { beep } from './lib/sound';
import { generateWasteland, type CategoryId, type Location, type Wasteland } from './lib/wasteland';

type Tab = 'locations' | 'data' | 'share';
type Status = 'loading' | 'ready' | 'problem';

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
  const soundRef = useRef(false);
  useEffect(() => {
    soundRef.current = soundOn;
  }, [soundOn]);
  const lookRef = useRef(look);
  useEffect(() => {
    lookRef.current = look;
  }, [look]);

  const sound = useCallback((kind: 'tick' | 'select' | 'error') => {
    if (soundRef.current) beep(kind);
  }, []);

  // the page's colors follow the look
  useEffect(() => {
    document.documentElement.dataset.look = look;
  }, [look]);

  const show = useCallback(async (resolveRegion: () => Promise<Region>, label: string) => {
    setBusy(true);
    setSelectedId(null);
    setMessage(`SCANNING ${label.toUpperCase()}…`);
    try {
      const r = await resolveRegion();
      setRegion(r);
      const w = generateWasteland(r.city, r.center, r.radiusMeters * 0.8);
      setWasteland(w);
      setQuery(r.address);
      setHidden(new Set());
      setLocations([]);
      setMessage(`${w.regionName.toUpperCase()}: SCAN COMPLETE`);
      writeShareState({ query: r.address, look: lookRef.current });
      sound('select');
      const found = await findLocations(r.center, r.radiusMeters);
      setLocations(found);
      setMessage(`${w.regionName.toUpperCase()}: ${found.length} LOCATIONS DISCOVERED`);
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
  }, [search]);

  // the address bar follows the look once there is a place
  useEffect(() => {
    if (region) writeShareState({ query: region.address, look });
  }, [look, region]);

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
            <MapView look={LOOKS[look]} region={region} wasteland={wasteland} locations={locations} hiddenCategories={hidden} selectedId={selectedId} onSelect={setSelectedId} />
          ) : status === 'problem' ? (
            <SetupNotice problem={problem} />
          ) : (
            <div className="rm-setup"><h2>BOOTING…</h2></div>
          )}
          <div className="rm-crt" aria-hidden="true" />
          <div className="rm-status" role="status">
            <span className={busy ? 'rm-blink' : ''}>{message}</span>
          </div>
        </div>

        <aside className="rm-side">
          <SearchBar busy={busy} disabled={status !== 'ready'} initial={query} onSearch={search} onLocate={locateMe} />
          <nav className="rm-tabs" role="tablist" aria-label="Pip-Boy menu">
            {(['locations', 'data', 'share'] as Tab[]).map((t) => (
              <button key={t} type="button" role="tab" aria-selected={tab === t} className={tab === t ? 'on' : ''} onClick={() => { setTab(t); sound('tick'); }}>
                {t.toUpperCase()}
              </button>
            ))}
          </nav>
          <section className="rm-panel" role="tabpanel">
            {tab === 'locations' && <LocationsPanel region={region} locations={locations} hidden={hidden} onToggleCategory={toggleCategory} selectedId={selectedId} onSelect={(id) => { setSelectedId(id); sound('select'); }} />}
            {tab === 'data' && <DataPanel region={region} wasteland={wasteland} locations={locations} />}
            {tab === 'share' && <SharePanel query={region?.address ?? ''} look={look} soundOn={soundOn} onToggleSound={() => setSoundOn((s) => !s)} />}
          </section>
        </aside>
      </main>

      <footer className="rm-foot">
        RadMaps is an unofficial fan project. Fallout is a trademark of Bethesda Softworks LLC; this site is not affiliated with or endorsed by Bethesda or Microsoft.
        Map data © Google.
      </footer>
    </div>
  );
}
