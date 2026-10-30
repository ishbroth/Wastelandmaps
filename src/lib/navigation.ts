// Fast travel is real now: with AUTO-DISCOVER on, the map turns into a driving navigation map from where you stand to the place you picked
// (Google's directions), and an overseas place opens a flight search instead.

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

/** A driving route from here to there, or the reason there is none ('no_route': not reachable by road, 'unavailable': Google would not say). */
export async function requestRoute(from: LatLng, to: LatLng): Promise<RouteAnswer> {
  try {
    const { DirectionsService } = (await google.maps.importLibrary('routes')) as google.maps.RoutesLibrary;
    const result = await new DirectionsService().route({ origin: from, destination: to, travelMode: google.maps.TravelMode.DRIVING });
    const leg = result.routes[0]?.legs[0];
    if (!leg) return { kind: 'no_route' };
    const toPoint = (p: google.maps.LatLng): LatLng => ({ lat: p.lat(), lng: p.lng() });
    const steps: NavStep[] = leg.steps.map((st) => ({
      text: plain(st.instructions ?? ''),
      meters: st.distance?.value ?? 0,
      start: toPoint(st.start_location),
      end: toPoint(st.end_location),
      path: (st.path ?? []).map(toPoint),
    }));
    return {
      kind: 'route',
      route: { path: result.routes[0].overview_path.map(toPoint), steps, meters: leg.distance?.value ?? 0, seconds: leg.duration?.value ?? 0 },
    };
  } catch (e) {
    const code = String((e as { code?: string }).code ?? (e as { message?: string }).message ?? '');
    if (/ZERO_RESULTS|NOT_FOUND|MAX_ROUTE_LENGTH/.test(code)) return { kind: 'no_route' };
    return { kind: 'unavailable' };
  }
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
  let best = { step: 0, point: 0, d: Infinity };
  route.steps.forEach((st, i) => {
    const pts = st.path.length > 0 ? st.path : [st.start, st.end];
    pts.forEach((p, j) => {
      const d = distanceMeters(pos, p);
      if (d < best.d) best = { step: i, point: j, d };
    });
  });
  const st = route.steps[best.step];
  const pts = st ? (st.path.length > 0 ? st.path : [st.start, st.end]) : [];
  let toTurn = 0;
  for (let j = best.point; j < pts.length - 1; j++) toTurn += distanceMeters(pts[j], pts[j + 1]);
  toTurn += pts.length > 0 ? distanceMeters(pos, pts[best.point]) : 0;
  let remaining = toTurn;
  for (let i = best.step + 1; i < route.steps.length; i++) remaining += route.steps[i].meters;
  return { step: best.step, toTurn, remaining, off: best.d };
}

/** The Google Maps address for driving directions: the fallback when Google's directions service cannot be used from here. */
export const googleMapsUrl = (to: LatLng): string => `https://www.google.com/maps/dir/?api=1&destination=${to.lat},${to.lng}&travelmode=driving`;

/** The flight search for an overseas place. */
export const flightsUrl = (placeName: string): string => `https://www.google.com/travel/flights?q=${encodeURIComponent(`Flights to ${placeName}`)}`;

/** The device's position now, or null if it will not say. */
export function currentFix(timeoutMs = 12_000): Promise<LatLng | null> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(null),
      { timeout: timeoutMs, maximumAge: 30_000, enableHighAccuracy: true },
    );
  });
}

const feet = (m: number) => Math.round(m * 3.281 / 50) * 50;
/** "400 ft", "0.8 mi", "12 mi". */
export function formatDistance(m: number): string {
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
