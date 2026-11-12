// Searching for a real address from the scan field: Google's place suggestions as you type, and the place a suggestion stands for.

import { kindFromTypes, type PersonalKind } from './personal';
import type { LatLng } from './wasteland';

export interface Suggestion {
  id: string;
  text: string;
  main: string;
  secondary: string;
  /** A city, state or country rather than an address or a place: these open that area's map like a normal search. */
  area: boolean;
  types: string[];
  prediction: google.maps.places.PlacePrediction;
}

const AREA_TYPES = ['locality', 'administrative_area_level_1', 'administrative_area_level_2', 'administrative_area_level_3', 'country', 'postal_code', 'sublocality', 'colloquial_area', 'continent'];
const PLACE_TYPES = ['street_address', 'premise', 'establishment', 'point_of_interest'];

let token: google.maps.places.AutocompleteSessionToken | null = null;

/** Suggestions for what has been typed so far (a few, best first). Empty if Google cannot be asked. */
export async function suggest(input: string): Promise<Suggestion[]> {
  try {
    const { AutocompleteSuggestion, AutocompleteSessionToken } = (await google.maps.importLibrary('places')) as google.maps.PlacesLibrary;
    token ??= new AutocompleteSessionToken();
    const { suggestions } = await AutocompleteSuggestion.fetchAutocompleteSuggestions({ input, sessionToken: token });
    return suggestions
      .map((s) => s.placePrediction)
      .filter((p): p is google.maps.places.PlacePrediction => !!p)
      .slice(0, 6)
      .map((p) => {
        const types = p.types ?? [];
        return {
          id: p.placeId, text: p.text.text, main: p.mainText?.text ?? p.text.text, secondary: p.secondaryText?.text ?? '',
          area: types.some((t) => AREA_TYPES.includes(t)) && !types.some((t) => PLACE_TYPES.includes(t)),
          types, prediction: p,
        };
      });
  } catch {
    return [];
  }
}

export interface PickedPlace {
  placeId: string;
  name: string;
  address: string;
  position: LatLng;
  kind: PersonalKind;
}

/** Where a suggestion is, what it is called and what kind of place it is. Ends the typing session (Google counts one lookup for the whole of it). */
export async function resolveSuggestion(s: Suggestion): Promise<PickedPlace> {
  const place = s.prediction.toPlace();
  await place.fetchFields({ fields: ['id', 'displayName', 'formattedAddress', 'location', 'types'] });
  token = null;
  if (!place.location) throw new Error('NO SUCH PLACE ON ANY MAP');
  const address = place.formattedAddress ?? s.text;
  const types = place.types ?? s.types;
  // an address with a number is named by its street line; a business or landmark keeps its own name
  const streetLine = address.split(',')[0];
  const named = place.displayName && place.displayName !== streetLine ? place.displayName : streetLine;
  return { placeId: place.id, name: named || s.main, address, position: { lat: place.location.lat(), lng: place.location.lng() }, kind: kindFromTypes(types, named || s.main) };
}

/** Is there a Street View picture within a short walk of this spot? (Asking is free; nothing is made until the credits are paid.) */
export async function streetViewAvailable(position: LatLng): Promise<boolean> {
  try {
    const { StreetViewService, StreetViewSource } = (await google.maps.importLibrary('streetView')) as google.maps.StreetViewLibrary;
    const result = await new StreetViewService().getPanorama({ location: position, radius: 60, source: StreetViewSource.OUTDOOR });
    return !!result.data?.location;
  } catch {
    return false;
  }
}

/** The compass heading from one point to another. */
function headingTo(from: LatLng, to: LatLng): number {
  const r = Math.PI / 180;
  const y = Math.sin((to.lng - from.lng) * r) * Math.cos(to.lat * r);
  const x = Math.cos(from.lat * r) * Math.sin(to.lat * r) - Math.sin(from.lat * r) * Math.cos(to.lat * r) * Math.cos((to.lng - from.lng) * r);
  return Math.round((Math.atan2(y, x) / r + 360) % 360);
}

/**
 * The Street View picture of a place (Google's own image, fetched fresh each time it is shown and never kept by us): what the snapshot shows before the blast.
 * Looks at the place from where the street picture was taken. Null when there is none.
 */
export async function streetViewPictureUrl(position: LatLng): Promise<string | null> {
  const key = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;
  if (!key) return null;
  try {
    const { StreetViewService, StreetViewSource } = (await google.maps.importLibrary('streetView')) as google.maps.StreetViewLibrary;
    const result = await new StreetViewService().getPanorama({ location: position, radius: 60, source: StreetViewSource.OUTDOOR });
    const at = result.data?.location?.latLng;
    if (!at) return null;
    const params = new URLSearchParams({ size: '640x640', location: `${at.lat()},${at.lng()}`, heading: String(headingTo({ lat: at.lat(), lng: at.lng() }, position)), pitch: '6', fov: '90', source: 'outdoor', key });
    return `https://maps.googleapis.com/maps/api/streetview?${params}`;
  } catch {
    return null;
  }
}

/** The address where someone is standing (for setting it as home). */
export async function reverseGeocode(position: LatLng): Promise<PickedPlace | null> {
  try {
    const { Geocoder } = (await google.maps.importLibrary('geocoding')) as google.maps.GeocodingLibrary;
    const { results } = await new Geocoder().geocode({ location: position });
    const hit = results?.find((r) => r.types.includes('street_address') || r.types.includes('premise')) ?? results?.[0];
    if (!hit) return null;
    return { placeId: hit.place_id, name: 'Home', address: hit.formatted_address, position, kind: 'house' };
  } catch {
    return null;
  }
}

/** The address of the building at a point of the map (a tap and hold on its outline): the street line names it. Null if there is no building or address there. */
export async function addressAt(position: LatLng): Promise<PickedPlace | null> {
  try {
    const { Geocoder } = (await google.maps.importLibrary('geocoding')) as google.maps.GeocodingLibrary;
    const { results } = await new Geocoder().geocode({ location: position });
    const hit = results?.find((r) => r.types.some((t) => ['street_address', 'premise', 'subpremise', 'establishment', 'point_of_interest'].includes(t)));
    if (!hit) return null;
    const address = hit.formatted_address;
    const streetLine = address.split(',')[0];
    const loc = hit.geometry.location;
    return { placeId: hit.place_id, name: streetLine, address, position: { lat: loc.lat(), lng: loc.lng() }, kind: kindFromTypes(hit.types, streetLine) };
  } catch {
    return null;
  }
}
