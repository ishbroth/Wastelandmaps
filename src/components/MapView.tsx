import { useEffect, useRef, useState } from 'react';
import { createHtmlMarker, type HtmlMarkerHandle } from '../lib/htmlMarker';
import { iconFor } from '../lib/icons';
import { placeIcon } from '../lib/placeIcons';
import { landmarkIcon } from '../lib/landmarkIcons';
import { freeRenderFor } from '../lib/renders';
import { pointsFor } from '../lib/points';
import { stylesAt, type Look } from '../lib/looks';
import type { Region } from '../lib/google';
import type { TravelRun } from '../lib/travel';
import { loadFlood, patchOutline, type FloodPatch } from '../lib/flood';
import { VAULT_ZERO_ID } from '../lib/vaultZero';
import { cloudOutline } from '../lib/zones';
import { levelsAt, type RegionLabel } from '../lib/regions';
import { VAULT_ID, distanceMeters, hashString, subtitle, type CategoryId, type LatLng, type Location, type Wasteland } from '../lib/wasteland';

/**
 * Is the point inside the visible bounds, grown by a fraction of their size? The bounds can cross the antimeridian (west is east of east), which is
 * what the map reports over the Pacific: a plain west <= lng <= east test then fails for every place at once and the names and pins all vanish.
 */
function boundsContain(b: google.maps.LatLngBoundsLiteral, lat: number, lng: number, grow: number): boolean {
  const padLat = (b.north - b.south) * grow;
  if (lat > b.north + padLat || lat < b.south - padLat) return false;
  const span = b.east >= b.west ? b.east - b.west : b.east - b.west + 360;
  if (span * (1 + 2 * grow) >= 360) return true;
  const rel = (((lng - (b.west - span * grow)) % 360) + 360) % 360;
  return rel <= span * (1 + 2 * grow);
}
/** The longitude in the middle of the visible bounds, also across the antimeridian. */
function boundsCenterLng(b: google.maps.LatLngBoundsLiteral): number {
  const span = b.east >= b.west ? b.east - b.west : b.east - b.west + 360;
  const mid = b.west + span / 2;
  return mid > 180 ? mid - 360 : mid;
}

/** Opacity of each nested layer of a flooded patch, outermost first, so the water is a thin film at the shore and nearly solid in the deepest part. */
function floodLayerAlphas(strength: number, layers: number): number[] {
  if (layers <= 1) return [strength];
  const edge = 0.16;
  const deepest = Math.min(0.97, strength + 0.15); // a little darker than before, where it is deepest
  const out: number[] = [];
  let before = 0;
  for (let k = 0; k < layers; k++) {
    const total = edge + (deepest - edge) * Math.pow(k / (layers - 1), 1.5); // how dark it should be after this layer
    out.push(Math.min(0.99, Math.max(0.02, 1 - (1 - total) / (1 - before))));
    before = total;
  }
  return out;
}

interface Props {
  look: Look;
  region: Region | null;
  wasteland: Wasteland | null;
  locations: Location[];
  hiddenCategories: Set<CategoryId>;
  /** The ME button on the map, above the zoom buttons: go to where the device is. */
  onLocate: () => void;
  locateDisabled: boolean;
  selectedId: string | null;
  visited: Set<string>;
  /** Places already looted: their label says [Cleared]. */
  cleared: Set<string>;
  /** Where you are standing. */
  player: LatLng | null;
  /** A trip to animate, or null. */
  travel: TravelRun | null;
  onArrive: () => void;
  /** Driving navigation: the route to draw, and the map follows you along it. Null when not navigating. */
  nav: { path: LatLng[]; steps: { text: string; meters: number; start: LatLng; end: LatLng; path: LatLng[] }[]; step: number } | null;
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
/** Below this zoom (zoomed out past a city) the irradiated zones are taken off the map: they only belong to the city you are looking at. */
const CITY_ZOOM = 9;

/**
 * How far in the map has to be (Google zoom level) before a place gets a marker, so a big metro does not clutter the screen or slow the map:
 * the permanent-snapshot landmarks, your home and the place you picked are always there; the famous second-tier landmarks show from state level
 * (zoom 6); then, as you come in, the places that are worth more first (city level), and the smallest ones, your own places and the atlas only at
 * neighborhood level. Zooming back out takes them away again.
 */
function minZoomFor(loc: Location, selectedId: string | null): number {
  // vaults drop off the map 14 zoom steps out from the closest view (zoom 7 and below), unless one is the place picked
  if (loc.vault && !loc.personal?.home && loc.id !== selectedId) return 8;
  if (loc.id === VAULT_ZERO_ID) return loc.id === selectedId ? 0 : 6; // out of sight until you have scrolled down to Antarctica and zoomed in
  if (loc.personal?.home || freeRenderFor(loc.id) || loc.id === selectedId || (loc.personal && !loc.personal.saved)) return 0;
  if (loc.personal) return 11;
  if (loc.famous) return 6;
  const pts = pointsFor(loc);
  return pts >= 30 ? 8 : pts >= 20 ? 9 : pts >= 15 ? 10 : 11;
}

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

/** A looted place shows [Cleared] under its name (the line it normally has is kept to put back). */
function markCleared(el: HTMLElement, cleared: boolean) {
  const line = el.querySelector('.rm-pin-label i') as HTMLElement | null;
  if (!line) return;
  if (el.dataset.sub === undefined) el.dataset.sub = line.textContent ?? '';
  el.classList.toggle('rm-pin-cleared', cleared);
  line.textContent = cleared ? '[Cleared]' : el.dataset.sub;
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
export default function MapView({ onLocate, locateDisabled, look, region, wasteland, locations, hiddenCategories, selectedId, visited, cleared, player, travel, onArrive, nav, onSelect, onViewport, regionLabels, startView }: Props) {
  const holder = useRef<HTMLDivElement>(null);
  const locateRef = useRef(onLocate);
  const meButton = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    locateRef.current = onLocate;
    if (meButton.current) meButton.current.disabled = locateDisabled;
  }, [onLocate, locateDisabled]);
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
  const farRoads = useRef(true);
  const lookRef = useRef(look);
  const you = useRef<{ handle: HtmlMarkerHandle; el: HTMLElement } | null>(null);
  const onSelectRef = useRef(onSelect);
  const onArriveRef = useRef(onArrive);
  const onViewportRef = useRef(onViewport);
  const visitedRef = useRef(visited);
  const clearedRef = useRef(cleared);
  const lastDrag = useRef(0);
  useEffect(() => {
    onSelectRef.current = onSelect;
    onArriveRef.current = onArrive;
    onViewportRef.current = onViewport;
    visitedRef.current = visited;
    clearedRef.current = cleared;
  }, [onSelect, onArrive, onViewport, visited, cleared]);

  // the map itself, once
  useEffect(() => {
    if (!holder.current) return;
    const map = new google.maps.Map(holder.current, {
      center: WORLD_VIEW.center,
      zoom: WORLD_VIEW.zoom,
      disableDefaultUI: true,
      zoomControl: true,
      zoomControlOptions: { position: google.maps.ControlPosition.RIGHT_BOTTOM },
      gestureHandling: 'greedy',
      clickableIcons: false,
      styles: stylesAt(look, WORLD_VIEW.zoom),
      backgroundColor: look.background,
      minZoom: 3,
    });
    mapRef.current = map;
    // ME: a small square the width of the zoom buttons, above them (the crosshair with ME under it)
    const me = document.createElement('button');
    me.type = 'button';
    me.className = 'rm-me';
    me.title = 'Use my current position';
    me.innerHTML = '<span>⌖</span><small>ME</small>';
    me.addEventListener('click', () => locateRef.current());
    meButton.current = me;
    map.controls[google.maps.ControlPosition.RIGHT_BOTTOM].push(me);
    if (import.meta.env.DEV) (window as unknown as { __wlmap?: google.maps.Map }).__wlmap = map; // for the browser checks in _tools
    const markClose = () => {
      const zoom = map.getZoom() ?? 0;
      const far = zoom < 12;
      if (far !== farRoads.current) { farRoads.current = far; map.setOptions({ styles: stylesAt(lookRef.current, zoom) }); }
      holder.current?.classList.toggle('rm-zoomed', zoom >= LABEL_ZOOM);
      // half size at city level, full size from three zoom steps closer
      holder.current?.style.setProperty('--pin-size', `${Math.round(Math.min(36, Math.max(18, 18 + (zoom - 11) * 6)))}px`);
    };
    map.addListener('zoom_changed', markClose);
    // moving the map by hand pauses the navigation's following for a few seconds
    map.addListener('dragstart', () => { lastDrag.current = Date.now(); });
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
    lookRef.current = look;
    mapRef.current?.setOptions({ styles: stylesAt(look, mapRef.current.getZoom() ?? 12), backgroundColor: look.background });
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


    for (const zone of wasteland.zones) {
      // a soft, uneven cloud: three layers, each a different shape, thickest at the middle
      const seed = zone.seed ?? hashString(`${zone.position.lat.toFixed(4)},${zone.position.lng.toFixed(4)}`);
      const clouds = [[1, 0.1], [0.72, 0.12], [0.46, 0.16]].map(([scale, opacity], layer) => new google.maps.Polygon({
        map, clickable: false, zIndex: 3 + layer, paths: cloudOutline(zone.position, zone.radiusMeters * scale, seed, layer),
        fillColor: look.zoneStroke, fillOpacity: opacity, strokeColor: look.zoneStroke, strokeOpacity: layer === 0 ? 0.28 : 0, strokeWeight: 1,
      }));
      const marker = createHtmlMarker({
        position: zone.position,
        element: pinElement('rad', iconFor('rad'), zone.name ? zone.name.toUpperCase() : 'IRRADIATED', zone.name ? `IRRADIATED · ${zone.rads} RADS` : `${zone.rads} RADS`, 'rm-pin-rad'),
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
    const centerLat = view ? (view.north + view.south) / 2 : 0;
    const centerLng = view ? boundsCenterLng(view) : 0;
    const zoom = zoomNow;
    let inView = locations.filter((l) => !hiddenCategories.has(l.category) && zoom >= minZoomFor(l, selectedId) && (!view || boundsContain(view, l.position.lat, l.position.lng, 0.3)));
    if (inView.length > MAX_PINS) {
      const dist = (l: Location) => Math.hypot(l.position.lat - centerLat, l.position.lng - centerLng);
      // the always-there ones first, then the nearest to the middle of the screen
      inView = inView.sort((a, b) => (minZoomFor(a, selectedId) === 0 ? 0 : 1) - (minZoomFor(b, selectedId) === 0 ? 0 : 1) || dist(a) - dist(b)).slice(0, MAX_PINS);
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
      const free = freeRenderFor(loc.id); // the always-free landmarks: drawn as themselves, and a little larger
      const el = pinElement(loc.category, (free && landmarkIcon(loc.id.slice(3))) || placeIcon(loc.icon), loc.name, subtitle(loc), [loc.vault ? 'rm-pin-vaultentrance' : '', free ? 'rm-pin-landmark' : loc.famous ? 'rm-pin-famous' : '', loc.personal?.home ? 'rm-pin-landmark' : loc.personal ? 'rm-pin-personal' : '', loc.personal && !loc.personal.saved ? 'rm-pin-target' : ''].filter(Boolean).join(' '));
      el.classList.toggle('rm-pin-visited', visitedRef.current.has(loc.id));
      markCleared(el, clearedRef.current.has(loc.id));
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
  }, [locations, hiddenCategories, view, zoomNow, selectedId]);

  // standing water on the coast, wherever you are looking and at every zoom: only the patches on screen are drawn (the nearest few hundred), and when
  // zoomed far out each is drawn larger, so the flooded coasts can still be seen from a continent away
  const [allFlood, setAllFlood] = useState<FloodPatch[]>([]);
  useEffect(() => {
    let cancelled = false;
    void loadFlood().then((byMetro) => { if (!cancelled) setAllFlood(Object.values(byMetro).flat()); });
    return () => { cancelled = true; };
  }, []);
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const shapes = floodShapes.current;
    const cLat = view ? (view.north + view.south) / 2 : 0;
    const cLng = view ? boundsCenterLng(view) : 0;
    const visible = allFlood.filter((p) => !view || boundsContain(view, p[0], p[1], 0.2));
    const near = visible.length > 500 ? visible.sort((x, y) => Math.hypot(x[0] - cLat, x[1] - cLng) - Math.hypot(y[0] - cLat, y[1] - cLng)).slice(0, 500) : visible;
    // Drawn at their true size: as the map zooms out the patches shrink with the land around them (and vanish once they are specks), so the coast never
    // looks drowned. Zoomed in, each patch is a stack of nested outlines, so the water is thin at the shore and deepest in the middle, and the main
    // streets running into it fade out gradually instead of stopping at an edge.
    const onScreen = near.filter((p) => (p[2] * Math.max(1, p[3])) / ((156543.03 * Math.cos((p[0] * Math.PI) / 180)) / 2 ** zoomNow) >= 1.2);
    const baseLayers = zoomNow >= 15 ? 18 : zoomNow >= 12 ? 10 : zoomNow >= 10 ? 4 : 1;
    const layers = Math.max(1, Math.min(baseLayers, Math.floor(600 / Math.max(1, onScreen.length))));
    const wanted = new Map<string, { patch: FloodPatch; layer: number }>();
    for (const p of onScreen) {
      for (let k = 0; k < layers; k++) wanted.set(`${p[5]}:${layers}:${k}`, { patch: [p[0], p[1], p[2] * (layers === 1 ? 1 : 1 - (k / layers) * 0.85), p[3], p[4], p[5]], layer: k });
    }
    shapes.forEach((shape, key) => {
      if (wanted.has(key)) return;
      shape.setMap(null);
      shapes.delete(key);
    });
    const alphas = floodLayerAlphas(look.floodOpacity, layers);
    wanted.forEach(({ patch, layer }, key) => {
      if (shapes.has(key)) return;
      shapes.set(key, new google.maps.Polygon({
        map, paths: patchOutline(patch), clickable: false, zIndex: 2,
        fillColor: look.floodFill, fillOpacity: alphas[layer], strokeColor: look.floodFill, strokeOpacity: 0, strokeWeight: 0, // one color, no outline: it reads as the coast itself having moved
      }));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allFlood, view, zoomNow]);
  useEffect(() => {
    floodShapes.current.forEach((shape, key) => {
      const [, n, k] = key.split(':').map(Number);
      shape.setOptions({ fillColor: look.floodFill, fillOpacity: floodLayerAlphas(look.floodOpacity, n)[k] ?? look.floodOpacity, strokeColor: look.floodFill, strokeOpacity: 0, strokeWeight: 0 });
    });
  }, [look]);

  // zoomed out past the city: its irradiated zones clear off the map, and come back as you zoom in
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const target = zoomNow >= CITY_ZOOM ? map : null;
    extras.current.forEach((x) => {
      x.handle?.setMap(target);
      x.circle?.setMap(target);
      x.clouds?.forEach((c) => c.setMap(target));
    });
  }, [zoomNow, wasteland, look]);

  // the names of the big regions, while zoomed out: continents, then countries, then states
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const levels = levelsAt(zoomNow);
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
      if (view && !boundsContain(view, lat, lng, 0.2)) continue;
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
    const byId = new Map(locations.map((l) => [l.id, l]));
    pins.current.forEach((p, id) => {
      p.el.classList.toggle('rm-pin-visited', visited.has(id));
      markCleared(p.el, cleared.has(id));
      const mine = byId.get(id);
      if (mine?.personal) {
        // their own places: the destination turns into a kept pin once reached, and a renamed place shows its new name
        p.el.classList.toggle('rm-pin-target', !mine.personal.saved);
        const title = p.el.querySelector('.rm-pin-label b');
        if (title && title.textContent !== mine.name) title.textContent = mine.name;
      }
    });
  }, [visited, cleared, locations, hiddenCategories]);

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

  // driving navigation. The streets are not drawn on this map, so the way is: the whole route as a thin line, and ahead of you a bright path that
  // pulses and runs with chevrons toward the next turns.
  const ahead = useRef<{ halo: google.maps.Polyline; line: google.maps.Polyline } | null>(null);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !nav || nav.path.length < 2) return;
    const halo = new google.maps.Polyline({ map, path: nav.path, strokeColor: '#000000', strokeOpacity: 0.5, strokeWeight: 8, zIndex: 20 });
    const thin = new google.maps.Polyline({ map, path: nav.path, strokeColor: look.ink, strokeOpacity: 0.55, strokeWeight: 3, zIndex: 21 });
    const aheadHalo = new google.maps.Polyline({ map, path: [], strokeColor: '#000000', strokeOpacity: 0.7, strokeWeight: 14, zIndex: 22 });
    const aheadLine = new google.maps.Polyline({
      map, path: [], strokeColor: look.ink, strokeOpacity: 1, strokeWeight: 7, zIndex: 23,
      icons: [{ icon: { path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW, scale: 2.6, strokeColor: '#000000', strokeWeight: 1, fillColor: '#ffffff', fillOpacity: 0.95 }, offset: '0px', repeat: '46px' }],
    });
    ahead.current = { halo: aheadHalo, line: aheadLine };
    holder.current?.classList.add('rm-navigating');
    lastDrag.current = 0;
    // the pulse and the running chevrons
    let raf = 0;
    const started = performance.now();
    const pulse = (now: number) => {
      const t = (now - started) / 1000;
      const k = 0.5 + 0.5 * Math.sin(t * 4.2);
      aheadLine.setOptions({
        strokeOpacity: 0.62 + 0.38 * k, strokeWeight: 6 + 3 * k,
        icons: [{ icon: { path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW, scale: 2.4 + 0.6 * k, strokeColor: '#000000', strokeWeight: 1, fillColor: '#ffffff', fillOpacity: 0.95 }, offset: `${Math.floor((t * 34) % 46)}px`, repeat: '46px' }],
      });
      aheadHalo.setOptions({ strokeOpacity: 0.45 + 0.3 * k });
      raf = requestAnimationFrame(pulse);
    };
    raf = requestAnimationFrame(pulse);
    return () => {
      cancelAnimationFrame(raf);
      halo.setMap(null);
      thin.setMap(null);
      aheadHalo.setMap(null);
      aheadLine.setMap(null);
      ahead.current = null;
      holder.current?.classList.remove('rm-navigating');
    };
  }, [nav?.path, look]);

  // the path ahead: from you to the turn after next, at most about a mile and a half. The only turn arrow is the one in the navigation's top bar: none on the street corners.
  useEffect(() => {
    const map = mapRef.current;
    const live = ahead.current;
    if (!map || !nav || !live) return;
    const route: LatLng[] = [];
    let meters = 0;
    const turns: { at: LatLng; text: string; meters: number }[] = [];
    if (player) route.push(player);
    for (let i = nav.step; i < nav.steps.length && meters < 2400 && turns.length < 3; i++) {
      const st = nav.steps[i];
      const pts = st.path.length ? st.path : [st.start, st.end];
      // for the step you are on, start from the point of it nearest you
      let from = 0;
      if (i === nav.step && player) {
        let best = Infinity;
        pts.forEach((q, j) => { const d = distanceMeters(player, q); if (d < best) { best = d; from = j; } });
      }
      for (let j = from; j < pts.length; j++) route.push(pts[j]);
      meters += st.meters;
      if (i < nav.steps.length - 1) turns.push({ at: st.end, text: nav.steps[i + 1].text, meters: meters });
    }
    live.line.setPath(route);
    live.halo.setPath(route);
  }, [nav?.step, nav?.steps, player]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !nav || !player) return;
    if (Date.now() - lastDrag.current < 8000) return;
    map.panTo(player);
    if ((map.getZoom() ?? 0) < 16) map.setZoom(17);
  }, [nav, player]);

  return <div ref={holder} className="rm-map" role="application" aria-label="Wasteland map" />;
}
