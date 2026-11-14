// Fast travel is real now: with AUTO-DISCOVER on, the map turns into a driving navigation map from where you stand to the place you picked
// (Google's directions), and an overseas place opens a flight search instead.

import { getFix } from './geo';
import { distanceMeters, type LatLng } from './wasteland';

export interface NavStep {
  /** "Turn left onto Main St", plain text. */
  text: string;
  meters: number;
  start: LatLng;
  end: LatLng;
  path: LatLng[];
}

export interface NavRoute {
  path: LatLng[];
  steps: NavStep[];
  meters: number;
  seconds: number;
}

export type RouteAnswer = { kind: 'route'; route: NavRoute } | { kind: 'no_route' } | { kind: 'unavailable' };

/** Farther than this and nobody drives it: flights. */
export const FLIGHT_METERS = 4_000_000;

export const isOverseas = (from: LatLng, to: LatLng): boolean => distanceMeters(from, to) > FLIGHT_METERS;

const plain = (html: string): string => html.replace(/<div[^>]*>.*?<\/div>/gi, ' ').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();

const toPoint = (p: { lat: number | (() => number); lng: number | (() => number) }): LatLng => ({
  lat: typeof p.lat === 'function' ? p.lat() : p.lat,
  lng: typeof p.lng === 'function' ? p.lng() : p.lng,
});

/** Google's Routes service. Null if it cannot be asked (the service is not switched on for this key, or there is no connection); 'none' if there is no road. */
async function viaGoogle(from: LatLng, to: LatLng, walking = false): Promise<NavRoute | 'none' | null> {
  try {
    await google.maps.importLibrary('routes');
    const { routes } = await google.maps.routes.Route.computeRoutes({
      origin: from, destination: to, travelMode: (walking ? 'WALKING' : 'DRIVING') as google.maps.TravelModeString, fields: ['path', 'legs', 'distanceMeters', 'durationMillis'],
    });
    const route = routes?.[0];
    const leg = route?.legs?.[0];
    if (!route || !leg) return 'none';
    const steps: NavStep[] = leg.steps.map((st) => ({
      text: plain(st.instructions ?? ''),
      meters: st.distanceMeters ?? 0,
      start: st.startLocation ? toPoint(st.startLocation) : from,
      end: st.endLocation ? toPoint(st.endLocation) : to,
      path: (st.path ?? []).map(toPoint),
    }));
    return { path: (route.path ?? []).map(toPoint), steps, meters: route.distanceMeters ?? leg.distanceMeters ?? 0, seconds: Math.round((route.durationMillis ?? leg.durationMillis ?? 0) / 1000) };
  } catch (e) {
    return /ZERO_RESULTS|NOT_FOUND/.test(String((e as { message?: string }).message ?? e)) ? 'none' : null;
  }
}

const SIDE: Record<string, string> = { left: 'left', right: 'right', 'slight left': 'slight left', 'slight right': 'slight right', 'sharp left': 'sharp left', 'sharp right': 'sharp right', straight: 'straight' };

/** The words for one maneuver of the open road-routing service (OSRM). */
function maneuverText(type: string, modifier: string | undefined, name: string, exit?: number): string {
  const onto = name ? ` onto ${name}` : '';
  const side = modifier ? SIDE[modifier] ?? modifier : '';
  switch (type) {
    case 'depart': return name ? `Head out on ${name}` : 'Head out';
    case 'arrive': return 'Arrive at your destination';
    case 'turn':
    case 'end of road': return modifier === 'uturn' ? 'Make a U-turn' : `Turn ${side}${onto}`.replace(/\s+/g, ' ');
    case 'new name': return name ? `Continue onto ${name}` : 'Continue straight';
    case 'continue': return modifier && modifier !== 'straight' ? `Continue ${side}${onto}` : name ? `Continue on ${name}` : 'Continue straight';
    case 'merge': return `Merge${onto}`;
    case 'on ramp': return `Take the ramp${onto}`;
    case 'off ramp': return `Take the exit${side ? ` on the ${side}` : ''}${onto}`;
    case 'fork': return `Keep ${side || 'straight'} at the fork${onto}`;
    case 'roundabout':
    case 'rotary': return `Enter the roundabout and take exit ${exit ?? 1}${onto}`;
    case 'roundabout turn': return `At the roundabout turn ${side}${onto}`;
    default: return name ? `Continue on ${name}` : 'Continue';
  }
}

interface OsrmStep { distance: number; name: string; geometry: { coordinates: [number, number][] }; maneuver: { type: string; modifier?: string; exit?: number } }

/**
 * The open road-routing service (OSRM, built on OpenStreetMap) as the second choice: it needs no key, so the navigation still works on this map when Google's
 * routing is not switched on. Null if it cannot be reached; 'none' if there is no road.
 */
async function viaOsrm(from: LatLng, to: LatLng, walking = false): Promise<NavRoute | 'none' | null> {
  try {
    // on foot: the open service that routes along footpaths and sidewalks (the main one only knows roads for cars)
    const url = `${walking ? 'https://routing.openstreetmap.de/routed-foot/route/v1/foot' : 'https://router.project-osrm.org/route/v1/driving'}/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson&steps=true`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const json = (await res.json()) as { code: string; routes?: { distance: number; duration: number; geometry: { coordinates: [number, number][] }; legs: { steps: OsrmStep[] }[] }[] };
    if (json.code === 'NoRoute') return 'none';
    const route = json.routes?.[0];
    if (json.code !== 'Ok' || !route) return null;
    const point = ([lng, lat]: [number, number]): LatLng => ({ lat, lng });
    const steps: NavStep[] = route.legs.flatMap((leg) => leg.steps).map((st) => {
      const path = st.geometry.coordinates.map(point);
      return { text: maneuverText(st.maneuver.type, st.maneuver.modifier, st.name, st.maneuver.exit), meters: st.distance, start: path[0] ?? to, end: path[path.length - 1] ?? to, path };
    });
    return { path: route.geometry.coordinates.map(point), steps, meters: route.distance, seconds: Math.round(route.duration) };
  } catch {
    return null;
  }
}

/** A driving route from here to there: Google's routing if it is switched on, otherwise the open one. 'no_route': not reachable by road; 'unavailable': neither could be asked. */
export async function requestRoute(from: LatLng, to: LatLng, walking = false): Promise<RouteAnswer> {
  const first = await viaGoogle(from, to, walking);
  if (first === 'none') return { kind: 'no_route' };
  if (first) return { kind: 'route', route: first };
  const second = await viaOsrm(from, to, walking);
  if (second === 'none') return { kind: 'no_route' };
  if (second) return { kind: 'route', route: second };
  return { kind: 'unavailable' };
}

export interface Progress {
  /** The step you are on. */
  step: number;
  /** Meters to the next turn (the end of this step). */
  toTurn: number;
  /** Meters left to the destination. */
  remaining: number;
  /** How far you are from the route. */
  off: number;
}

/** Where along the route a position is: the step it is on, how far to the next turn and to the end, and how far off the route it is. */
export function progressAlong(route: NavRoute, pos: LatLng): Progress {
  // the nearest point of the route to the position, found on the lines between the route's points (not only at the points: on a long straight stretch the points are far apart, and
  // the nearest one can be hundreds of metres away while the person is exactly on the road)
  const ky = 110_540, kx = 111_320 * Math.cos((pos.lat * Math.PI) / 180);
  let best = { step: 0, seg: 0, t: 0, d: Infinity };
  route.steps.forEach((st, i) => {
    const pts = st.path.length > 0 ? st.path : [st.start, st.end];
    if (pts.length === 1) { const d = distanceMeters(pos, pts[0]); if (d < best.d) best = { step: i, seg: 0, t: 0, d }; return; }
    for (let j = 0; j + 1 < pts.length; j++) {
      const ax = (pts[j].lng - pos.lng) * kx, ay = (pts[j].lat - pos.lat) * ky, bx = (pts[j + 1].lng - pos.lng) * kx, by = (pts[j + 1].lat - pos.lat) * ky;
      const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
      const t = l2 === 0 ? 0 : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / l2));
      const d = Math.hypot(ax + dx * t, ay + dy * t);
      if (d < best.d) best = { step: i, seg: j, t, d };
    }
  });
  const st = route.steps[best.step];
  const pts = st ? (st.path.length > 0 ? st.path : [st.start, st.end]) : [];
  let toTurn = 0;
  if (pts.length >= 2) {
    toTurn = (1 - best.t) * distanceMeters(pts[best.seg], pts[best.seg + 1]);
    for (let j = best.seg + 1; j < pts.length - 1; j++) toTurn += distanceMeters(pts[j], pts[j + 1]);
  } else if (pts.length === 1) toTurn = distanceMeters(pos, pts[0]);
  let remaining = toTurn;
  for (let i = best.step + 1; i < route.steps.length; i++) remaining += route.steps[i].meters;
  return { step: best.step, toTurn, remaining, off: best.d };
}

/** The Google Maps address for driving directions: the fallback when Google's directions service cannot be used from here. */
export const googleMapsUrl = (to: LatLng): string => `https://www.google.com/maps/dir/?api=1&destination=${to.lat},${to.lng}&travelmode=driving`;

/** The flight search for an overseas place. */
export const flightsUrl = (placeName: string): string => `https://www.google.com/travel/flights?q=${encodeURIComponent(`Flights to ${placeName}`)}`;

/** The device's position now, or null if it will not say. */
export async function currentFix(timeoutMs = 12_000): Promise<LatLng | null> {
  try {
    const fix = await getFix({ timeout: timeoutMs, maximumAge: 30_000 });
    return { lat: fix.lat, lng: fix.lng };
  } catch {
    return null;
  }
}

const feet = (m: number) => Math.round(m * 3.281 / 50) * 50;
/** "400 ft", "0.8 mi", "12 mi". */
export function formatDistance(m: number, walking = false): string {
  if (walking && m < 400) return `${Math.max(10, Math.round((m * 3.281) / 10) * 10)} ft`; // on foot the steps are smaller
  if (m < 160) return `${Math.max(50, feet(m))} ft`;
  const mi = m / 1609.34;
  return mi < 10 ? `${mi.toFixed(1)} mi` : `${Math.round(mi)} mi`;
}

/** "12 min", "1 h 5 min". */
export function formatMinutes(seconds: number): string {
  const min = Math.max(1, Math.round(seconds / 60));
  return min < 60 ? `${min} min` : `${Math.floor(min / 60)} h ${min % 60} min`;
}

/** An arrow for the next turn, read from the words of the instruction. */
export function turnArrow(text: string): string {
  const t = text.toLowerCase();
  if (/u-turn/.test(t)) return '⮌';
  if (/roundabout|rotary|traffic circle/.test(t)) return '⟳';
  if (/sharp left|slight left|turn left|keep left|take the left|exit left/.test(t) || /\bleft\b/.test(t)) return '⬅';
  if (/sharp right|slight right|turn right|keep right|take the right|exit right/.test(t) || /\bright\b/.test(t)) return '➡';
  if (/merge|ramp|exit/.test(t)) return '⬈';
  if (/destination|arrive/.test(t)) return '⚑';
  return '⬆';
}

// ---- the spoken directions, trimmed ----

/** A road's number, as the start of its name: "U.S. 94", "I-5", "State Route 163", "CA-94", "Highway 101". */
const DESIGNATION = /^((?:U\.?\s?S\.?|I|Interstate|SR|State Route|State Highway|CA|Route|Rte|Highway|Hwy|County Road|CR)[\s-]?\d+[A-Z]?)\b/i;
const DIRECTIONS = /\s+(?:north|south|east|west|northeast|northwest|southeast|southwest|N|S|E|W|NE|NW|SE|SW)\.?$/i;

/** The short name of a road for the voice: a numbered highway keeps just its number ("U.S. 94 Martin Luther King Jr Parkway Southwest" is "U.S. 94"); any other name loses its compass direction. */
function shortRoad(name: string): string {
  let n = name.split(/\s+[/|]\s+|\s+-\s+/)[0].trim(); // "A / B" and "A - B" are two names for the same road: the first will do
  const number = DESIGNATION.exec(n);
  if (number) return number[1];
  n = n.replace(DIRECTIONS, '').trim();
  return n || name;
}

/** Street-name abbreviations, said in full. After a name ("Main St", "Cherry Dr") they are road types; at the start of a name ("St Marys", "Dr Martin Luther King") they are titles. */
const ROAD_TYPES: Record<string, string> = {
  dr: 'Drive', st: 'Street', ave: 'Avenue', av: 'Avenue', blvd: 'Boulevard', rd: 'Road', ln: 'Lane', ct: 'Court', pl: 'Place', pkwy: 'Parkway', pky: 'Parkway', hwy: 'Highway',
  cir: 'Circle', ter: 'Terrace', terr: 'Terrace', trl: 'Trail', expy: 'Expressway', expwy: 'Expressway', fwy: 'Freeway', sq: 'Square', aly: 'Alley', hts: 'Heights',
  xing: 'Crossing', byp: 'Bypass', cres: 'Crescent', cswy: 'Causeway', brg: 'Bridge', pt: 'Point', pk: 'Park', trce: 'Trace', hwys: 'Highways', mnr: 'Manor', jct: 'Junction',
  jr: 'Junior', sr: 'Senior', mem: 'Memorial', pkwys: 'Parkways', plz: 'Plaza', ctr: 'Center'
};
const TITLES: Record<string, string> = { st: 'Saint', dr: 'Doctor', mt: 'Mount', ft: 'Fort', ste: 'Sainte', rte: 'Route', hwy: 'Highway', pres: 'President', gen: 'General', gov: 'Governor', col: 'Colonel', sgt: 'Sergeant', capt: 'Captain' };
const COMPASS: Record<string, string> = { N: 'North', S: 'South', E: 'East', W: 'West', NE: 'Northeast', NW: 'Northwest', SE: 'Southeast', SW: 'Southwest' };
const NOT_A_NAME = new Set(['onto', 'on', 'at', 'via', 'to', 'the', 'left', 'right', 'into', 'toward', 'towards', 'exit', 'for', 'and', 'then', 'take', 'turn', 'merge', 'continue', 'head', 'slight', 'sharp', 'keep', 'in', 'from', 'of', 'a']);
/** "I-5" is said "Interstate 5", "SR-163" "State Route 163", "US-101" "U S 101", "CA-94" "California 94". */
const HIGHWAYS: [RegExp, string][] = [[/\bI-(\d+)/g, 'Interstate $1'], [/\bSR-?(\d+)/g, 'State Route $1'], [/\bCA-(\d+)/g, 'California $1'], [/\bUS-(\d+)/g, 'U.S. $1'], [/\bCR-?(\d+)/g, 'County Road $1'], [/\bFM-?(\d+)/g, 'Farm Road $1']];
function expandRoadWords(text: string): string {
  let t = text;
  for (const [re, to] of HIGHWAYS) t = t.replace(re, to);
  const words = t.split(' ');
  return words.map((w, i) => {
    const m = /^([^A-Za-z]*)([A-Za-z]+)(\.?)([,;:]?)$/.exec(w);
    if (!m) return w;
    const [, lead, core, , tail] = m;
    const key = core.toLowerCase();
    const prev = i > 0 ? words[i - 1].replace(/[^A-Za-z0-9'’-]/g, '').toLowerCase() : '';
    const afterName = prev !== '' && !NOT_A_NAME.has(prev);
    const next = words[i + 1];
    if (COMPASS[core] && (core.length > 1 || !/^[a-z]/.test(core))) return `${lead}${COMPASS[core]}${tail}`;
    if (core.length > 1 && core === core.toUpperCase() && !ROAD_TYPES[key] && !TITLES[key]) return w;
    if (afterName && ROAD_TYPES[key]) return `${lead}${ROAD_TYPES[key]}${tail}`;
    if (!afterName && TITLES[key] && next && /^[A-Za-z]/.test(next)) return `${lead}${TITLES[key]}${tail}`;
    return w;
  }).join(' ');
}

/**
 * What the voice says for an instruction: the same, but without the road's long name and without the extras. "Turn left onto U.S. 94 Martin Luther King Jr Parkway
 * Southwest toward Downtown" is spoken "Turn left onto U.S. 94". The banner on the screen keeps the whole text.
 */
export function spokenInstruction(text: string): string {
  let t = text.replace(/<[^>]+>/g, ' ').replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim();
  // "toward ...", "Pass by ...", "Continue for 2 miles", "Destination will be ..." keep only what is needed to act
  t = t.replace(/\s+toward\s+.*$/i, '').replace(/\.\s+(?:Pass by|Continue for|Then).*$/i, '');
  t = t.replace(/\b(onto|on|at|via|to stay on|to merge onto|onto the)\s+([^,]+?)(?=$|,)/i, (_m, word: string, road: string) => `${word} ${shortRoad(road)}`);
  return expandRoadWords(t.replace(/[.,]+$/, '').trim()) || text;
}
