// The two ways the wasteland can look. Each one is a Google Maps style (colors and which features show, which is what Google's styling
// is for) plus a set of colors the page itself uses for markers, radiation zones and the frame. The glow, scanlines and paper texture
// are drawn by the page on top of the map (see index.css), never by changing Google's map images.

export type LookId = 'pipboy' | 'parchment';

export interface Look {
  id: LookId;
  label: string;
  mapStyles: google.maps.MapTypeStyle[];
  background: string;
  /** Marker, zone and line colors used by the page's own drawings. */
  ink: string;
  inkDim: string;
  zoneFill: string;
  zoneStroke: string;
  vault: string;
  /** Standing water in the flooded coastal patches. */
  floodFill: string;
  /** The colour of the land the water covers (about): the outermost layer of a patch is tinted so that, over this land, it comes out exactly the colour of the sea. */
  floodLand: string;
  /** How much of the land the outermost layer hides (the roads there are this much dimmer, then fade out gradually toward the middle). */
  floodEdge: number;
  floodStroke: string;
  /** How solid the flooded patches are: a little see-through, so the main streets show faintly under the water while the colour still matches the sea. */
  floodOpacity: number;
}

const hide: google.maps.MapTypeStyle['stylers'] = [{ visibility: 'off' }];

const pipboyStyles: google.maps.MapTypeStyle[] = [
  { elementType: 'geometry', stylers: [{ color: '#021308' }] },
  { elementType: 'labels', stylers: hide },
  { featureType: 'administrative', elementType: 'geometry.stroke', stylers: hide },
  { featureType: 'administrative.country', elementType: 'geometry.stroke', stylers: [{ visibility: 'on' }, { color: '#18c95f' }, { weight: 1 }] },
  { featureType: 'administrative.province', elementType: 'geometry.stroke', stylers: [{ visibility: 'on' }, { color: '#18c95f' }, { weight: 1 }] },
  { featureType: 'administrative.land_parcel', stylers: hide },
  { featureType: 'administrative.neighborhood', stylers: hide },
  { featureType: 'poi.park', elementType: 'geometry.stroke', stylers: hide },
  { featureType: 'poi.government', stylers: hide },
  { featureType: 'poi', stylers: hide },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ visibility: 'on' }, { color: '#04290f' }] },
  { featureType: 'landscape.man_made', elementType: 'geometry.fill', stylers: [{ color: '#06330f' }] },
  { featureType: 'landscape.man_made', elementType: 'geometry.stroke', stylers: [{ color: '#0f7a35' }, { weight: 0.6 }] },
  { featureType: 'landscape.natural', elementType: 'geometry', stylers: [{ color: '#052d12' }] },
  { featureType: 'landscape.natural.landcover', elementType: 'geometry', stylers: [{ color: '#052d12' }] },
  { featureType: 'landscape.natural.terrain', elementType: 'geometry', stylers: [{ color: '#052d12' }] },
  { featureType: 'road', elementType: 'geometry.fill', stylers: [{ color: '#0d6b2d' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#021308' }, { weight: 0.4 }] },
  { featureType: 'road.highway', elementType: 'geometry.fill', stylers: [{ color: '#1fe070' }] },
  { featureType: 'road.arterial', elementType: 'geometry.fill', stylers: [{ color: '#12983f' }] },
  // the side streets and alleys are buried in rubble: only the main roads that show when the map is zoomed out survive, however close you get
  { featureType: 'road.local', stylers: hide },
  { featureType: 'transit', stylers: hide },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#000a04' }] },
];

const parchmentStyles: google.maps.MapTypeStyle[] = [
  { elementType: 'geometry', stylers: [{ color: '#dfcb99' }] },
  { elementType: 'labels', stylers: hide },
  { featureType: 'administrative', elementType: 'geometry.stroke', stylers: hide },
  { featureType: 'administrative.country', elementType: 'geometry.stroke', stylers: [{ visibility: 'on' }, { color: '#7a5a2a' }, { weight: 1.2 }] },
  { featureType: 'administrative.province', elementType: 'geometry.stroke', stylers: [{ visibility: 'on' }, { color: '#7a5a2a' }, { weight: 1.2 }] },
  { featureType: 'administrative.land_parcel', stylers: hide },
  { featureType: 'administrative.neighborhood', stylers: hide },
  { featureType: 'poi.park', elementType: 'geometry.stroke', stylers: hide },
  { featureType: 'poi.government', stylers: hide },
  { featureType: 'poi', stylers: hide },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ visibility: 'on' }, { color: '#c3bf86' }] },
  { featureType: 'landscape.man_made', elementType: 'geometry.fill', stylers: [{ color: '#cdb780' }] },
  { featureType: 'landscape.man_made', elementType: 'geometry.stroke', stylers: [{ color: '#9b7d45' }, { weight: 0.6 }] },
  { featureType: 'landscape.natural', elementType: 'geometry', stylers: [{ color: '#e3d3a4' }] },
  { featureType: 'road', elementType: 'geometry.fill', stylers: [{ color: '#b69456' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#8a6b34' }, { weight: 0.5 }] },
  { featureType: 'road.highway', elementType: 'geometry.fill', stylers: [{ color: '#9a7330' }] },
  { featureType: 'road.local', stylers: hide },
  { featureType: 'transit', stylers: hide },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#a5b49b' }] },
];

export const LOOKS: Record<LookId, Look> = {
  pipboy: {
    id: 'pipboy', label: 'Pip-Boy', mapStyles: pipboyStyles, background: '#021308',
    ink: '#3dff8a', inkDim: '#13a550', zoneFill: 'rgba(120,255,40,0.14)', zoneStroke: '#a6ff3d', vault: '#d8ff6a', floodFill: '#000a04', floodLand: '#073310', floodEdge: 0.93, floodOpacity: 0.997, floodStroke: '#0f7a35',
  },
  parchment: {
    id: 'parchment', label: 'Parchment', mapStyles: parchmentStyles, background: '#dfcb99',
    ink: '#3b2a14', inkDim: '#7a5a2a', zoneFill: 'rgba(160,60,30,0.18)', zoneStroke: '#a3401f', vault: '#1f5f8a', floodFill: '#a5b49b', floodLand: '#dccb9a', floodEdge: 0.93, floodOpacity: 0.99, floodStroke: '#7d8f74',
  },
};

export const isLookId = (v: string | null): v is LookId => v === 'pipboy' || v === 'parchment';

/** The map styles at a zoom: the middling roads (arterials) are only drawn from city level in, so a grid of them never shows from far out. */
export function stylesAt(look: Look, zoom: number): google.maps.MapTypeStyle[] {
  return zoom < 12 ? [...look.mapStyles, { featureType: 'road.arterial', stylers: [{ visibility: 'off' }] }] : look.mapStyles;
}
