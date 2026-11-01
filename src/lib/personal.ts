// Personal places: an address someone has travelled to. They are the person's own pins (a little smaller than the standard ones), can be renamed, and are
// kept on the account. What kind of place an address is decides its icon and its scene.

import type { IconId } from './placeIcons';
import type { CategoryId, Location } from './wasteland';

export type PersonalKind = 'house' | 'park' | 'office' | 'church' | 'medical' | 'gov';

export interface PersonalPlace {
  /** Google's id for the place; the map id is "me:" + this. */
  placeId: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  kind: PersonalKind;
}

export const personalId = (placeId: string): string => `me:${placeId}`;
export const isPersonalId = (id: string): boolean => id.startsWith('me:');

export const PERSONAL_ICON: Record<PersonalKind, IconId> = { house: 'house', park: 'leafytree', office: 'skyscraper', church: 'church', medical: 'hospital', gov: 'capitol' };
/** The kind of scene and loot to use for each. */
const PERSONAL_CATEGORY: Record<PersonalKind, CategoryId> = { house: 'lodging', park: 'park', office: 'other', church: 'chapel', medical: 'medical', gov: 'guard' };

const has = (types: string[], ...wanted: string[]) => wanted.some((w) => types.includes(w));

/** House or nondescript address, park or nature, office or commercial, church or religious, medical or veterinary, government or museum. */
export function kindFromTypes(types: string[], name: string): PersonalKind {
  if (has(types, 'place_of_worship', 'church', 'mosque', 'synagogue', 'hindu_temple', 'buddhist_temple', 'shinto_shrine', 'cemetery') || /\b(church|chapel|cathedral|mosque|synagogue|temple|parish|ministry)\b/i.test(name)) return 'church';
  if (has(types, 'hospital', 'doctor', 'dentist', 'pharmacy', 'drugstore', 'veterinary_care', 'physiotherapist', 'health', 'medical_lab', 'dental_clinic', 'medical_clinic') || /\b(hospital|clinic|medical|veterinar|animal hospital|urgent care|dental|pharmacy)\b/i.test(name)) return 'medical';
  if (has(types, 'local_government_office', 'city_hall', 'courthouse', 'embassy', 'police', 'fire_station', 'post_office', 'government_office', 'museum', 'art_gallery', 'library', 'capitol') || /\b(city hall|town hall|courthouse|museum|capitol|county building|post office|library)\b/i.test(name)) return 'gov';
  if (has(types, 'park', 'national_park', 'state_park', 'natural_feature', 'campground', 'hiking_area', 'beach', 'garden', 'playground', 'dog_park', 'nature_reserve', 'zoo') || /\b(park|forest|lake|trail|beach|reserve|garden|preserve|mountain|falls|canyon)\b/i.test(name)) return 'park';
  if (has(types, 'street_address', 'premise', 'subpremise', 'route', 'plus_code', 'street_number', 'residential', 'lodging_residential')) return 'house';
  if (has(types, 'establishment', 'point_of_interest', 'store', 'restaurant', 'finance', 'bank', 'lodging', 'shopping_mall', 'real_estate_agency', 'lawyer', 'accounting', 'school', 'university', 'gym', 'cafe', 'bar', 'food', 'car_repair', 'gas_station')) return 'office';
  return 'house';
}

/** The map pin for a personal place: `saved` once it has been reached; until then it is only the destination. */
/** A home vault's number as it is shown: always four digits, so 0730 is not Vault 730. */
export const homeNumberText = (n: number): string => String(n).padStart(4, '0');

export function personalLocation(p: PersonalPlace, saved: boolean, homeVault?: number): Location {
  return {
    id: personalId(p.placeId),
    oldName: p.name,
    name: homeVault !== undefined ? `VAULT ${homeNumberText(homeVault)}` : p.name,
    category: PERSONAL_CATEGORY[p.kind],
    position: { lat: p.lat, lng: p.lng },
    loot: 'Whatever the years left in the cupboards',
    threat: 'Quiet',
    rads: 0,
    icon: homeVault !== undefined ? 'vault' : PERSONAL_ICON[p.kind],
    personal: { address: p.address, kind: p.kind, saved, ...(homeVault !== undefined ? { home: true } : {}) },
  };
}

const FLAVOR: Record<PersonalKind, string[]> = {
  house: ['The front door hangs open on one hinge. Somebody lived here, and somebody once planted that fence.', 'Behind the sagging porch, the rooms still hold the shapes of a life: a table, a stair, a window that faced the street.'],
  park: ['Grass has come back as scrub and the paths are cracked, but the sky is wide here and the trees still stand in places.', 'The benches are rust and the swings are gone, though the wind still moves through the branches the way it always did.'],
  office: ['Desks and cubicle walls lean in the dark, and the glass lies in drifts across the lobby. The sign out front gave up long ago.', 'Filing cabinets, a dead elevator and a break room that nobody will ever clean again.'],
  church: ['The pews are splintered and the roof lets in the light. People still come here in the quiet hours.', 'The bell no longer rings, but the walls remember: whatever else was lost, this was always a place to be still.'],
  medical: ['The waiting room chairs are still in their rows. Cabinets stand open, long since emptied.', 'The red cross has faded to pink, and a stretcher rests where it was last wheeled.'],
  gov: ['Stone steps lead up to doors that no clerk will open. The records inside outlived the people who kept them.', 'Columns and a cracked flag pole: the old order left its marks in marble.'],
};

export function describePersonal(name: string, address: string, kind: PersonalKind, regionName: string): string[] {
  const options = FLAVOR[kind];
  const pick = options[(name.length + address.length) % options.length];
  return [`${name}, ${regionName}. ${address}.`, pick, 'Yours: a place you walked to yourself, and the map remembers it for you.'];
}
