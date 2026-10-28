import { useEffect, useRef } from 'react';
import { createHtmlMarker, type HtmlMarkerHandle } from '../lib/htmlMarker';
import { iconFor } from '../lib/icons';
import type { Look } from '../lib/looks';
import type { Region } from '../lib/google';
import type { TravelRun } from '../lib/travel';
import { VAULT_ID, type CategoryId, type LatLng, type Location, type Wasteland } from '../lib/wasteland';

interface Props {
  look: Look;
  region: Region | null;
  wasteland: Wasteland | null;
  locations: Location[];
  hiddenCategories: Set<CategoryId>;
  selectedId: string | null;
  visited: Set<string>;
  /** Where you are standing. */
  player: LatLng | null;
  /** A trip to animate, or null. */
  travel: TravelRun | null;
  onArrive: () => void;
  onSelect: (id: string | null) => void;
}

const WORLD_VIEW = { center: { lat: 39.5, lng: -98.35 }, zoom: 4 };
const LABEL_ZOOM = 16;

function pinElement(kind: CategoryId | 'vault' | 'rad', label: string, sub: string, className: string): HTMLElement {
  const el = document.createElement('button');
  el.type = 'button';
  el.className = `rm-pin ${className}`;
  el.dataset.kind = kind;
  el.innerHTML = `<span class="rm-pin-icon">${iconFor(kind)}</span><span class="rm-pin-label"><b></b><i></i></span>`;
  (el.querySelector('b') as HTMLElement).textContent = label;
  (el.querySelector('i') as HTMLElement).textContent = sub;
  return el;
}

function playerElement(): HTMLElement {
  const el = document.createElement('div');
  el.className = 'rm-player';
  el.innerHTML = '<span class="rm-player-ring"></span><span class="rm-player-arrow"></span><span class="rm-player-tag">YOU</span>';
  return el;
}

const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

/** The Google map, drawn in the chosen look, with the wasteland on top: locations, the vault, the radiation zones, and you. */
export default function MapView({ look, region, wasteland, locations, hiddenCategories, selectedId, visited, player, travel, onArrive, onSelect }: Props) {
  const holder = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const pins = useRef(new Map<string, { handle: HtmlMarkerHandle; el: HTMLElement; position: google.maps.LatLngLiteral }>());
  const extras = useRef<{ handle?: HtmlMarkerHandle; circle?: google.maps.Circle }[]>([]);
  const vault = useRef<{ el: HTMLElement; position: LatLng } | null>(null);
  const you = useRef<{ handle: HtmlMarkerHandle; el: HTMLElement } | null>(null);
  const onSelectRef = useRef(onSelect);
  const onArriveRef = useRef(onArrive);
  const visitedRef = useRef(visited);
  useEffect(() => {
    onSelectRef.current = onSelect;
    onArriveRef.current = onArrive;
    visitedRef.current = visited;
  }, [onSelect, onArrive, visited]);

  // the map itself, once
  useEffect(() => {
    if (!holder.current) return;
    const map = new google.maps.Map(holder.current, {
      center: WORLD_VIEW.center,
      zoom: WORLD_VIEW.zoom,
      disableDefaultUI: true,
      zoomControl: true,
      gestureHandling: 'greedy',
      clickableIcons: false,
      styles: look.mapStyles,
      backgroundColor: look.background,
      minZoom: 3,
    });
    mapRef.current = map;
    const markClose = () => holder.current?.classList.toggle('rm-zoomed', (map.getZoom() ?? 0) >= LABEL_ZOOM);
    map.addListener('zoom_changed', markClose);
    map.addListener('click', () => onSelectRef.current(null));
    markClose();
    const currentPins = pins.current;
    return () => {
      currentPins.forEach((p) => p.handle.setMap(null));
      currentPins.clear();
      you.current?.handle.setMap(null);
      you.current = null;
      mapRef.current = null;
    };
    // the look is applied by the next effect; creating the map must not depend on it
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // switching look restyles the map and recolors the overlays
  useEffect(() => {
    mapRef.current?.setOptions({ styles: look.mapStyles, backgroundColor: look.background });
  }, [look]);

  // a new city: fly there
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !region) return;
    map.fitBounds(region.bounds, 24);
  }, [region]);

  // the vault and the radiation zones
  useEffect(() => {
    const map = mapRef.current;
    extras.current.forEach((x) => {
      x.handle?.setMap(null);
      x.circle?.setMap(null);
    });
    extras.current = [];
    vault.current = null;
    if (!map || !wasteland) return;

    const vaultEl = pinElement('vault', `VAULT ${wasteland.vault.number}`, 'Sealed. Probably.', 'rm-pin-vault');
    vaultEl.addEventListener('click', (e) => {
      e.stopPropagation();
      onSelectRef.current(VAULT_ID);
    });
    const vaultMarker = createHtmlMarker({ position: wasteland.vault.position, element: vaultEl, zIndex: 40 });
    vaultMarker.setMap(map);
    extras.current.push({ handle: vaultMarker });
    vault.current = { el: vaultEl, position: wasteland.vault.position };

    for (const zone of wasteland.zones) {
      const circle = new google.maps.Circle({
        map,
        center: zone.position,
        radius: zone.radiusMeters,
        strokeColor: look.zoneStroke,
        strokeOpacity: 0.85,
        strokeWeight: 1.5,
        fillColor: look.zoneStroke,
        fillOpacity: 0.16,
        clickable: false,
      });
      const marker = createHtmlMarker({
        position: zone.position,
        element: pinElement('rad', 'IRRADIATED', `${zone.rads} RADS`, 'rm-pin-rad'),
        zIndex: 10,
      });
      marker.setMap(map);
      extras.current.push({ handle: marker, circle });
    }
  }, [wasteland, look]);

  // the locations
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    pins.current.forEach((p) => p.handle.setMap(null));
    pins.current.clear();
    for (const loc of locations) {
      if (hiddenCategories.has(loc.category)) continue;
      const el = pinElement(loc.category, loc.name, loc.oldName, '');
      el.classList.toggle('rm-pin-visited', visitedRef.current.has(loc.id));
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        onSelectRef.current(loc.id);
      });
      const handle = createHtmlMarker({ position: loc.position, element: el, zIndex: 20 });
      handle.setMap(map);
      pins.current.set(loc.id, { handle, el, position: loc.position });
    }
  }, [locations, hiddenCategories]);

  // places you have been to are marked
  useEffect(() => {
    pins.current.forEach((p, id) => p.el.classList.toggle('rm-pin-visited', visited.has(id)));
  }, [visited, locations, hiddenCategories]);

  // the chosen place: highlight it and move to it
  useEffect(() => {
    pins.current.forEach((p, id) => p.el.classList.toggle('rm-pin-selected', id === selectedId));
    vault.current?.el.classList.toggle('rm-pin-selected', selectedId === VAULT_ID);
    const map = mapRef.current;
    const target = selectedId === VAULT_ID ? vault.current?.position : selectedId ? pins.current.get(selectedId)?.position : null;
    if (map && target) {
      map.panTo(target);
      if ((map.getZoom() ?? 0) < LABEL_ZOOM) map.setZoom(LABEL_ZOOM);
    }
  }, [selectedId, locations, hiddenCategories, wasteland]);

  // you: a marker where you stand
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!player) {
      you.current?.handle.setMap(null);
      you.current = null;
      return;
    }
    if (!you.current) {
      const el = playerElement();
      const handle = createHtmlMarker({ position: player, element: el, zIndex: 60 });
      handle.setMap(map);
      you.current = { handle, el };
    } else {
      you.current.handle.setPosition(player);
    }
  }, [player, wasteland]);

  // fast travel: a dotted route, and you walking it
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !travel || !you.current) return;
    const marker = you.current;
    const { from, to, durationMs } = travel;
    marker.el.classList.add('rm-player-moving');
    holder.current?.classList.add('rm-travelling'); // labels step aside while you walk

    const route = new google.maps.Polyline({
      map,
      path: [from, to],
      strokeOpacity: 0,
      icons: [{ icon: { path: 'M 0,-1 0,1', strokeOpacity: 1, strokeColor: look.ink, scale: 3 }, offset: '0', repeat: '14px' }],
    });
    map.fitBounds({ north: Math.max(from.lat, to.lat), south: Math.min(from.lat, to.lat), east: Math.max(from.lng, to.lng), west: Math.min(from.lng, to.lng) }, 90);

    let raf = 0;
    const startedAt = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - startedAt) / durationMs);
      const k = ease(t);
      marker.handle.setPosition({ lat: from.lat + (to.lat - from.lat) * k, lng: from.lng + (to.lng - from.lng) * k });
      if (t < 1) raf = requestAnimationFrame(step);
      else onArriveRef.current();
    };
    raf = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(raf);
      route.setMap(null);
      marker.el.classList.remove('rm-player-moving');
      holder.current?.classList.remove('rm-travelling');
    };
  }, [travel, look]);

  return <div ref={holder} className="rm-map" role="application" aria-label="Wasteland map" />;
}
