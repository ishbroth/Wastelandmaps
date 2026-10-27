// Loading Google Maps once, and the two things we ask it for: where a place is (geocoding) and what is around it (Places).

import { SEARCH_GROUPS, toLocation, type LatLng, type Location } from './wasteland';

const KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;

export const hasMapsKey = (): boolean => !!KEY && KEY.trim().length > 10;

let loading: Promise<void> | null = null;

/** Loads the Maps script and the libraries we use. Rejects with a readable message if the key is missing or Google refuses it. */
export function loadGoogle(): Promise<void> {
  if (loading) return loading;
  loading = new Promise<void>((resolve, reject) => {
    if (!hasMapsKey()) {
      reject(new Error('NO KEY'));
      return;
    }
    const w = window as unknown as Record<string, unknown>;
    // Google calls this when the key is rejected (wrong key, API not enabled, address not allowed)
    w.gm_authFailure = () => reject(new Error('KEY REJECTED'));
    w.__radmapsReady = () => {
      Promise.all([google.maps.importLibrary('maps'), google.maps.importLibrary('places'), google.maps.importLibrary('geocoding')])
        .then(() => resolve())
        .catch(() => reject(new Error('GOOGLE LIBRARIES FAILED TO LOAD')));
    };
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(KEY as string)}&v=weekly&loading=async&callback=__radmapsReady`;
    script.async = true;
    script.onerror = () => reject(new Error('COULD NOT REACH GOOGLE'));
    document.head.appendChild(script);
  });
  loading.catch(() => { loading = null; });
  return loading;
}

export interface Region {
  /** The city as the player typed or Google names it: "Seattle". */
  city: string;
  /** Full address: "Seattle, WA, USA". */
  address: string;
  center: LatLng;
  bounds: google.maps.LatLngBoundsLiteral;
  /** Roughly how far the city reaches from its center, in meters. */
  radiusMeters: number;
}

function cityName(result: google.maps.GeocoderResult): string {
  const pick = (type: string) => result.address_components.find((c) => c.types.includes(type))?.long_name;
  return pick('locality') ?? pick('postal_town') ?? pick('sublocality') ?? pick('administrative_area_level_2') ?? pick('administrative_area_level_1') ?? result.formatted_address.split(',')[0];
}

function toRegion(result: google.maps.GeocoderResult): Region {
  const loc = result.geometry.location;
  const center = { lat: loc.lat(), lng: loc.lng() };
  const vp = result.geometry.viewport;
  const bounds = vp ? vp.toJSON() : { north: center.lat + 0.05, south: center.lat - 0.05, east: center.lng + 0.07, west: center.lng - 0.07 };
  const diag = Math.hypot(
    (bounds.north - bounds.south) * 111_320,
    (bounds.east - bounds.west) * 111_320 * Math.cos((center.lat * Math.PI) / 180),
  );
  return { city: cityName(result), address: result.formatted_address, center, bounds, radiusMeters: Math.min(25_000, Math.max(3_000, diag / 2)) };
}

/** A typed city or address to a place on the map. */
export async function geocodeQuery(query: string): Promise<Region> {
  const { Geocoder } = (await google.maps.importLibrary('geocoding')) as google.maps.GeocodingLibrary;
  const { results } = await new Geocoder().geocode({ address: query });
  if (!results || results.length === 0) throw new Error('NO SUCH PLACE ON ANY MAP');
  return toRegion(results[0]);
}

/** The city around a GPS position. */
export async function geocodeLatLng(position: LatLng): Promise<Region> {
  const { Geocoder } = (await google.maps.importLibrary('geocoding')) as google.maps.GeocodingLibrary;
  const { results } = await new Geocoder().geocode({ location: position });
  const locality = results?.find((r) => r.types.includes('locality')) ?? results?.[0];
  if (!locality) throw new Error('COULD NOT PLACE YOU');
  return toRegion(locality);
}

// ---- what is around a city ----

const CACHE_PREFIX = 'radmaps:places:v1:';

/** Real places around a point, as wasteland locations. A few Places lookups per city, remembered for this browser session. */
export async function findLocations(center: LatLng, radiusMeters: number): Promise<Location[]> {
  const cacheKey = `${CACHE_PREFIX}${center.lat.toFixed(3)},${center.lng.toFixed(3)},${Math.round(radiusMeters / 500)}`;
  try {
    const cached = sessionStorage.getItem(cacheKey);
    if (cached) return JSON.parse(cached) as Location[];
  } catch { /* storage unavailable */ }

  const { Place, SearchNearbyRankPreference } = (await google.maps.importLibrary('places')) as google.maps.PlacesLibrary;
  const lists = await Promise.all(
    SEARCH_GROUPS.map((types) =>
      Place.searchNearby({
        fields: ['id', 'displayName', 'location', 'types', 'primaryType'],
        locationRestriction: { center, radius: radiusMeters },
        includedPrimaryTypes: types,
        maxResultCount: 20,
        rankPreference: SearchNearbyRankPreference.POPULARITY,
      }).then((r) => r.places).catch(() => [] as google.maps.places.Place[]),
    ),
  );

  const seen = new Set<string>();
  const out: Location[] = [];
  for (const list of lists) {
    for (const p of list) {
      if (!p.id || !p.location || seen.has(p.id)) continue;
      seen.add(p.id);
      out.push(toLocation({ id: p.id, name: p.displayName ?? 'Unknown', position: p.location.toJSON(), primaryType: p.primaryType, types: p.types }));
    }
  }
  try {
    sessionStorage.setItem(cacheKey, JSON.stringify(out));
  } catch { /* storage full */ }
  return out;
}
