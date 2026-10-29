import { useEffect, useRef, useState } from 'react';
import { createHtmlMarker, type HtmlMarkerHandle } from '../lib/htmlMarker';
import { iconFor } from '../lib/icons';
import { placeIcon } from '../lib/placeIcons';
import type { Look } from '../lib/looks';
import type { Region } from '../lib/google';
import type { TravelRun } from '../lib/travel';
import { patchOutline, type FloodPatch } from '../lib/flood';
import { cloudOutline } from '../lib/zones';
import { levelsAt, type RegionLabel } from '../lib/regions';
import { VAULT_ID, hashString, subtitle, type CategoryId, type LatLng, type Location, type Wasteland } from '../lib/wasteland';

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
  /** The map came to rest somewhere: where, and how far in. */
  onViewport: (center: LatLng, zoom: number) => void;
  /** Names of continents, countries and states, shown when the map is zoomed out. */
  regionLabels: RegionLabel[];
  /** Flooded patches near the coast. */
  flood: FloodPatch[];
  /** Where to put the map when the page opens: a country frame, or exactly where someone left off. Applied each time it changes. */
  startView: { kind: 'bounds'; bounds: google.maps.LatLngBoundsLiteral } | { kind: 'view'; center: LatLng; zoom: number } | null;
}

/** The most markers on the map at once. */
const MAX_PINS = 450;
const WORLD_VIEW = { center: { lat: 39.5, lng: -98.35 }, zoom: 4 };
const LABEL_ZOOM = 16;

/**
 * Makes a marker respond to a press: a click (mouse, keyboard) and also a tap (touch or pen), which is read from the finger going down and up in
 * about the same place, because a phone does not always turn a tap on a map marker into a click.
 */
let lastPressAt = 0;
function onPress(el: HTMLElement, action: () => void) {
  let down: { x: number; y: number; at: number } | null = null;
  let tappedAt = 0;
  el.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY, at: Date.now() }; });
  el.addEventListener('pointerup', (e) => {
    if (e.pointerType === 'mouse' || !down) return;
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
    if (moved < 14 && Date.now() - down.at < 700) {
      tappedAt = Date.now();
      lastPressAt = tappedAt;
      e.stopPropagation();
      action();
    }
    down = null;
  });
  el.addEventListener('click', (e) => {
    e.stopPropagation();
    if (Date.now() - tappedAt < 800) return; // the tap above already did it
    lastPressAt = Date.now();
    action();
  });
}

function pinElement(kind: string, iconHtml: string, label: string, sub: string, className: string): HTMLElement {
  const el = document.createElement('button');
  el.type = 'button';
  el.className = `rm-pin ${className}`;
  el.dataset.kind = kind;
  el.innerHTML = `<span class="rm-pin-icon">${iconHtml}</span><span class="rm-pin-label"><b></b><i></i></span>`;
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

/** A place's label first shows the real name, then scrambles letter by letter into its wasteland name. */
function morphLabel(el: HTMLElement, from: string, to: string) {
  const title = el.querySelector('b') as HTMLElement | null;
  if (!title) return;
  const glyphs = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&';
  const length = Math.max(from.length, to.length);
  const started = performance.now();
  const duration = 1100;
  title.textContent = from;
  const timer = window.setInterval(() => {
    const t = Math.min(1, (performance.now() - started) / duration);
    const settled = Math.floor(t * length);
    let out = '';
    for (let i = 0; i < length; i++) {
      if (i < settled) out += to[i] ?? '';
      else out += to[i] === ' ' ? ' ' : glyphs[Math.floor(Math.random() * glyphs.length)];
    }
    title.textContent = t >= 1 ? to : out;
    if (t >= 1) window.clearInterval(timer);
  }, 45);
}

const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

/** The Google map, drawn in the chosen look, with the wasteland on top: locations, the vault, the radiation zones, and you. */
export default function MapView({ look, region, wasteland, locations, hiddenCategories, selectedId, visited, player, travel, onArrive, onSelect, onViewport, regionLabels, flood, startView }: Props) {
  const holder = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<google.maps.LatLngBoundsLiteral | null>(null);
  const everShown = useRef(new Set<string>());
  const [zoomNow, setZoomNow] = useState(4);
  const regionMarkers = useRef(new Map<string, HtmlMarkerHandle>());
  const lastPanned = useRef<string | null>(null);
  const floodShapes = useRef(new Map<string, google.maps.Polygon>());
  const mapRef = useRef<google.maps.Map | null>(null);
  const pins = useRef(new Map<string, { handle: HtmlMarkerHandle; el: HTMLElement; position: google.maps.LatLngLiteral }>());
  const extras = useRef<{ handle?: HtmlMarkerHandle; circle?: google.maps.Circle; clouds?: google.maps.Polygon[] }[]>([]);
  const vault = useRef<{ el: HTMLElement; position: LatLng } | null>(null);
  const you = useRef<{ handle: HtmlMarkerHandle; el: HTMLElement } | null>(null);
  const onSelectRef = useRef(onSelect);
  const onArriveRef = useRef(onArrive);
  const onViewportRef = useRef(onViewport);
  const visitedRef = useRef(visited);
  useEffect(() => {
    onSelectRef.current = onSelect;
    onArriveRef.current = onArrive;
    onViewportRef.current = onViewport;
    visitedRef.current = visited;
  }, [onSelect, onArrive, onViewport, visited]);

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
    if (import.meta.env.DEV) (window as unknown as { __wlmap?: google.maps.Map }).__wlmap = map; // for the browser checks in _tools
    const markClose = () => {
      const zoom = map.getZoom() ?? 0;
      holder.current?.classList.toggle('rm-zoomed', zoom >= LABEL_ZOOM);
      // half size at city level, full size from three zoom steps closer
      holder.current?.style.setProperty('--pin-size', `${Math.round(Math.min(36, Math.max(18, 18 + (zoom - 11) * 6)))}px`);
    };
    map.addListener('zoom_changed', markClose);
    // a click on empty map clears the choice, but not the same moment a marker was pressed
    map.addListener('click', () => {
      if (Date.now() - lastPressAt > 600) onSelectRef.current(null);
    });
    map.addListener('idle', () => {
      setView(map.getBounds()?.toJSON() ?? null);
      setZoomNow(map.getZoom() ?? 4);
      const c = map.getCenter();
      if (c) onViewportRef.current({ lat: c.lat(), lng: c.lng() }, map.getZoom() ?? 0);
    });
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
    if (!map || !region || region.keepView) return;
    map.fitBounds(region.bounds, 24);
  }, [region]);

  // the page opens at a country, or where the person left off
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !startView) return;
    if (startView.kind === 'bounds') map.fitBounds(startView.bounds, 0);
    else {
      map.setCenter(startView.center);
      map.setZoom(startView.zoom);
    }
  }, [startView]);

  // the vault and the radiation zones
  useEffect(() => {
    const map = mapRef.current;
    extras.current.forEach((x) => {
      x.handle?.setMap(null);
      x.circle?.setMap(null);
      x.clouds?.forEach((c) => c.setMap(null));
    });
    extras.current = [];
    vault.current = null;
    if (!map || !wasteland) return;

    const vaultEl = pinElement('vault', iconFor('vault'), `VAULT ${wasteland.vault.number}`, 'Sealed. Probably.', 'rm-pin-vault');
    onPress(vaultEl, () => onSelectRef.current(VAULT_ID));
    const vaultMarker = createHtmlMarker({ position: wasteland.vault.position, element: vaultEl, zIndex: 40 });
    vaultMarker.setMap(map);
    extras.current.push({ handle: vaultMarker });
    vault.current = { el: vaultEl, position: wasteland.vault.position };

    for (const zone of wasteland.zones) {
      // a soft, uneven cloud: three layers, each a different shape, thickest at the middle
      const seed = zone.seed ?? hashString(`${zone.position.lat.toFixed(4)},${zone.position.lng.toFixed(4)}`);
      const clouds = [[1, 0.1], [0.72, 0.12], [0.46, 0.16]].map(([scale, opacity], layer) => new google.maps.Polygon({
        map, clickable: false, zIndex: 3 + layer, paths: cloudOutline(zone.position, zone.radiusMeters * scale, seed, layer),
        fillColor: look.zoneStroke, fillOpacity: opacity, strokeColor: look.zoneStroke, strokeOpacity: layer === 0 ? 0.28 : 0, strokeWeight: 1,
      }));
      const marker = createHtmlMarker({
        position: zone.position,
        element: pinElement('rad', iconFor('rad'), 'IRRADIATED', `${zone.rads} RADS`, 'rm-pin-rad'),
        zIndex: 10,
      });
      marker.setMap(map);
      extras.current.push({ handle: marker, clouds });
    }
  }, [wasteland, look]);

  // the locations
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    // pins are added and removed one by one, so places that turn up while you travel pop in without the rest flickering
    // only what is on (or near) the screen gets a marker, at most MAX_PINS of them, so even a huge metro stays smooth
    const padLat = view ? (view.north - view.south) * 0.3 : 0;
    const padLng = view ? (view.east - view.west) * 0.3 : 0;
    const centerLat = view ? (view.north + view.south) / 2 : 0;
    const centerLng = view ? (view.east + view.west) / 2 : 0;
    let inView = locations.filter((l) => !hiddenCategories.has(l.category) && (!view || (
      l.position.lat <= view.north + padLat && l.position.lat >= view.south - padLat &&
      l.position.lng <= view.east + padLng && l.position.lng >= view.west - padLng)));
    if (inView.length > MAX_PINS) {
      inView = inView.sort((a, b) => Math.hypot(a.position.lat - centerLat, a.position.lng - centerLng) - Math.hypot(b.position.lat - centerLat, b.position.lng - centerLng)).slice(0, MAX_PINS);
    }
    const wanted = new Set(inView.map((l) => l.id));
    pins.current.forEach((p, id) => {
      if (wanted.has(id)) return;
      p.handle.setMap(null);
      pins.current.delete(id);
    });
    const firstBatch = pins.current.size === 0;
    let morphed = 0;
    for (const loc of inView) {
      if (pins.current.has(loc.id)) continue;
      const el = pinElement(loc.category, placeIcon(loc.icon), loc.name, subtitle(loc), loc.vault ? 'rm-pin-vaultentrance' : '');
      el.classList.toggle('rm-pin-visited', visitedRef.current.has(loc.id));
      const brandNew = !everShown.current.has(loc.id);
      everShown.current.add(loc.id);
      if (!firstBatch && brandNew) {
        el.classList.add('rm-pin-new');
        if (loc.name !== loc.oldName && morphed++ < 25) {
          // the label shows for a moment while the real name turns into the wasteland one
          el.classList.add('rm-pin-announce');
          morphLabel(el.querySelector('.rm-pin-label') as HTMLElement, loc.oldName, loc.name);
          window.setTimeout(() => el.classList.remove('rm-pin-announce'), 3600);
        }
      }
      onPress(el, () => onSelectRef.current(loc.id));
      const handle = createHtmlMarker({ position: loc.position, element: el, zIndex: 20 });
      handle.setMap(map);
      pins.current.set(loc.id, { handle, el, position: loc.position });
    }
  }, [locations, hiddenCategories, view]);

  // standing water on the coast: a few flooded patches, in the look's water color
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const shapes = floodShapes.current;
    const wanted = new Set(flood.map((p) => String(p[5])));
    shapes.forEach((shape, key) => {
      if (wanted.has(key)) return;
      shape.setMap(null);
      shapes.delete(key);
    });
    for (const patch of flood) {
      const key = String(patch[5]);
      if (shapes.has(key)) continue;
      shapes.set(key, new google.maps.Polygon({
        map, paths: patchOutline(patch), clickable: false, zIndex: 2,
        fillColor: look.floodFill, fillOpacity: 0.96, strokeColor: look.floodStroke, strokeOpacity: 0.7, strokeWeight: 1,
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flood]);
  useEffect(() => {
    floodShapes.current.forEach((shape) => shape.setOptions({ fillColor: look.floodFill, strokeColor: look.floodStroke }));
  }, [look]);

  // the names of the big regions, while zoomed out: continents, then countries, then states
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const levels = levelsAt(zoomNow);
    const padLat = view ? (view.north - view.south) * 0.2 : 0;
    const padLng = view ? (view.east - view.west) * 0.2 : 0;
    const wanted = new Map<string, RegionLabel>();
    // the biggest places first; a label that would land on top of one already placed (on screen, at this zoom) is left out until you zoom in
    const world = 256 * 2 ** zoomNow;
    const toPixels = ({ lat, lng }: LatLng) => {
      const sin = Math.sin((lat * Math.PI) / 180);
      return { x: ((lng + 180) / 360) * world, y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * world };
    };
    const SIZE = { continent: { px: 30, spacing: 6 }, country: { px: 20, spacing: 4 }, state: { px: 15, spacing: 3 } } as const;
    const boxes: { x: number; y: number; w: number; h: number }[] = [];
    const ranked = [...regionLabels].sort((x, y) => y.weight - x.weight);
    for (const label of ranked) {
      if (!levels.includes(label.level)) continue;
      if (label.level === 'country' && zoomNow >= 6 && label.iso === 'US') continue; // the states take over
      const { lat, lng } = label.position;
      if (view && (lat > view.north + padLat || lat < view.south - padLat || lng > view.east + padLng || lng < view.west - padLng)) continue;
      const at = toPixels(label.position);
      const font = SIZE[label.level];
      const box = { x: at.x, y: at.y, w: label.name.length * (font.px * 0.62 + font.spacing) + 16, h: font.px * 1.5 };
      if (boxes.some((o) => Math.abs(o.x - box.x) < (o.w + box.w) / 2 && Math.abs(o.y - box.y) < (o.h + box.h) / 2)) continue;
      boxes.push(box);
      wanted.set(`${label.level}:${label.name}`, label);
    }
    regionMarkers.current.forEach((handle, key) => {
      if (wanted.has(key)) return;
      handle.setMap(null);
      regionMarkers.current.delete(key);
    });
    wanted.forEach((label, key) => {
      if (regionMarkers.current.has(key)) return;
      const el = document.createElement('div');
      el.className = `rm-region rm-region-${label.level}${label.canon ? ' rm-region-canon' : ''}`;
      el.textContent = label.name;
      const handle = createHtmlMarker({ position: label.position, element: el, zIndex: 5 });
      handle.setMap(map);
      regionMarkers.current.set(key, handle);
    });
  }, [regionLabels, zoomNow, view]);

  // places you have been to are marked
  useEffect(() => {
    pins.current.forEach((p, id) => p.el.classList.toggle('rm-pin-visited', visited.has(id)));
  }, [visited, locations, hiddenCategories]);

  // the chosen place: highlight it and move to it
  useEffect(() => {
    pins.current.forEach((p, id) => p.el.classList.toggle('rm-pin-selected', id === selectedId));
    vault.current?.el.classList.toggle('rm-pin-selected', selectedId === VAULT_ID);
    // move to the place only when the choice changes: new places arriving as you travel must not drag the map back to it
    if (selectedId === lastPanned.current) return;
    lastPanned.current = selectedId;
    const map = mapRef.current;
    const target = selectedId === VAULT_ID ? vault.current?.position : selectedId ? (pins.current.get(selectedId)?.position ?? locations.find((l) => l.id === selectedId)?.position) : null;
    if (map && target) {
      map.panTo(target);
      if ((map.getZoom() ?? 0) < LABEL_ZOOM) map.setZoom(LABEL_ZOOM);
    }
  }, [selectedId, locations, hiddenCategories, wasteland]);

  // a marker that scrolls into view while selected is highlighted too
  useEffect(() => {
    pins.current.forEach((p, id) => p.el.classList.toggle('rm-pin-selected', id === selectedId));
  }, [selectedId, view]);

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
