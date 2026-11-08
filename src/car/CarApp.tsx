// The map as it appears on a car's screen (CarPlay): the very same map component as the phone's, in the Pip-Boy look, with the route trail and the plotted places, and
// nothing else. The iPhone app's native side loads this page (the site with ?car=1) into the car's window and pushes the state in through window.carUpdate; the page takes
// no touches. Opened in an ordinary browser it just shows the map waiting for a trip.

import { useEffect, useMemo, useState } from 'react';
import MapView from '../components/MapView';
import { loadGoogle } from '../lib/google';
import { LOOKS } from '../lib/looks';
import { locationFromData, type Location } from '../lib/wasteland';
import type { CategoryId } from '../lib/wasteland';
import type { CarPayload } from '../lib/carplay';

const NO_ID = new Set<string>();
const NO_CATEGORIES = new Set<CategoryId>();
const NOTHING = () => undefined;

const points = (flat: number[]): { lat: number; lng: number }[] => {
  const out: { lat: number; lng: number }[] = [];
  for (let i = 0; i + 1 < flat.length; i += 2) out.push({ lat: flat[i], lng: flat[i + 1] });
  return out;
};

export default function CarApp() {
  const [ready, setReady] = useState(false);
  const [state, setState] = useState<CarPayload | null>(null);

  useEffect(() => {
    document.documentElement.dataset.look = 'pipboy';
    document.title = 'Wasteland Maps';
    loadGoogle().then(() => setReady(true)).catch(() => undefined);
    (window as unknown as { carUpdate?: (p: CarPayload) => void }).carUpdate = (p) => setState(p);
    return () => { delete (window as unknown as { carUpdate?: unknown }).carUpdate; };
  }, []);

  const here = state && state.hereLat !== 0 ? { lat: state.hereLat, lng: state.hereLng } : null;
  const nav = useMemo(() => {
    if (!state?.active || state.path.length < 4) return null;
    return {
      path: points(state.path),
      step: state.step,
      steps: state.steps.map((s) => { const path = points(s.path); return { text: s.text, meters: s.meters, start: path[0] ?? { lat: 0, lng: 0 }, end: path[path.length - 1] ?? { lat: 0, lng: 0 }, path }; }),
    };
  }, [state]);
  const locations = useMemo<Location[]>(() => (state?.markers ?? []).map((m) => {
    const loc = locationFromData(m.id, m.name, { lat: m.lat, lng: m.lng }, m.category as CategoryId, 999);
    return { ...loc, icon: m.icon as Location['icon'] };
  }), [state]);
  const start = useMemo(() => (here ? { kind: 'view' as const, center: here, zoom: 17 } : null), [here === null]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="rm-app rm-navigating rm-car">
      <main className="rm-device">
        <div className="rm-screen">
          {ready && (
            <MapView
              onLocate={NOTHING} locateDisabled
              look={LOOKS.pipboy} region={null} wasteland={null} locations={locations} hiddenCategories={NO_CATEGORIES}
              selectedId={null} visited={NO_ID} cleared={NO_ID} player={here} travel={null} onArrive={NOTHING} nav={nav} onSelect={NOTHING} onViewport={NOTHING}
              regionLabels={[]} flood={[]} startView={start}
            />
          )}
          <div className="rm-crt" aria-hidden="true" />
        </div>
      </main>
    </div>
  );
}
