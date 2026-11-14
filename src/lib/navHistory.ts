// The addresses a person has navigated to (the ones typed in or held on the map), newest first, kept on this device for the dropdown under the scan field.
import type { PersonalPlace } from './personal';

const KEY = (userId: string) => `wastelandmaps:navhist:${userId}`;
const MAX = 8;

export function loadNavHistory(userId: string): PersonalPlace[] {
  try {
    const list = JSON.parse(localStorage.getItem(KEY(userId)) ?? '[]') as PersonalPlace[];
    return Array.isArray(list) ? list.filter((p) => p && typeof p.placeId === 'string' && typeof p.address === 'string' && typeof p.lat === 'number' && typeof p.lng === 'number').slice(0, MAX) : [];
  } catch { return []; }
}

/** Puts a destination at the front of the person's list (once: an address navigated to again moves up), and returns the list. */
export function pushNavHistory(userId: string, place: PersonalPlace): PersonalPlace[] {
  const list = [place, ...loadNavHistory(userId).filter((p) => p.placeId !== place.placeId)].slice(0, MAX);
  try { localStorage.setItem(KEY(userId), JSON.stringify(list)); } catch { /* storage unavailable */ }
  return list;
}
