import { useEffect, useRef } from 'react';
import { createHtmlMarker, type HtmlMarkerHandle } from '../lib/htmlMarker';
import { iconFor } from '../lib/icons';
import type { Look } from '../lib/looks';
import type { Region } from '../lib/google';
import type { CategoryId, Location, Wasteland } from '../lib/wasteland';

interface Props {
  look: Look;
  region: Region | null;
  wasteland: Wasteland | null;
  locations: Location[];
  hiddenCategories: Set<CategoryId>;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}

const WORLD_VIEW = { center: { lat: 39.5, lng: -98.35 }, zoom: 4 };
const LABEL_ZOOM = 14;

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

/** The Google map, drawn in the chosen look, with the wasteland on top: locations, the vault and the radiation zones. */
export default function MapView({ look, region, wasteland, locations, hiddenCategories, selectedId, onSelect }: Props) {
  const holder = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const pins = useRef(new Map<string, { handle: HtmlMarkerHandle; el: HTMLElement; position: google.maps.LatLngLiteral }>());
  const extras = useRef<{ handle?: HtmlMarkerHandle; circle?: google.maps.Circle }[]>([]);
  const onSelectRef = useRef(onSelect);
  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

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
    if (!map || !wasteland) return;

    const vault = createHtmlMarker({
      position: wasteland.vault.position,
      element: pinElement('vault', `VAULT ${wasteland.vault.number}`, 'Sealed. Probably.', 'rm-pin-vault'),
      zIndex: 40,
    });
    vault.setMap(map);
    extras.current.push({ handle: vault });

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
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        onSelectRef.current(loc.id);
      });
      const handle = createHtmlMarker({ position: loc.position, element: el, zIndex: 20 });
      handle.setMap(map);
      pins.current.set(loc.id, { handle, el, position: loc.position });
    }
  }, [locations, hiddenCategories]);

  // the chosen location: highlight it and move to it
  useEffect(() => {
    pins.current.forEach((p, id) => p.el.classList.toggle('rm-pin-selected', id === selectedId));
    const map = mapRef.current;
    const chosen = selectedId ? pins.current.get(selectedId) : null;
    if (map && chosen) {
      map.panTo(chosen.position);
      if ((map.getZoom() ?? 0) < 15) map.setZoom(15);
    }
  }, [selectedId, locations, hiddenCategories]);

  return <div ref={holder} className="rm-map" role="application" aria-label="Wasteland map" />;
}
