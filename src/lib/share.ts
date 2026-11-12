import { Share } from '@capacitor/share';
import { isNative } from './native';
import { isLookId, type LookId } from './looks';

/** What a shared link remembers: the place typed in, and which look. Everything else is worked out again from those two. */
export interface ShareState {
  query: string;
  look: LookId;
  /** The map's exact view, when a link is shared from the map itself. */
  view?: { lat: number; lng: number; zoom: number };
  /** A place to open (its card) once the map is there: a Wikidata place, as in a link to one picture of the gallery. */
  place?: string;
}

export function readShareState(search: string = window.location.search): Partial<ShareState> {
  const p = new URLSearchParams(search);
  const q = (p.get('q') ?? '').trim().slice(0, 120);
  const look = p.get('look');
  const [lat, lng] = (p.get('ll') ?? '').split(',').map(Number);
  const zoom = Number(p.get('z'));
  const view = Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && zoom >= 1 && zoom <= 21 && p.get('ll') ? { lat, lng, zoom } : undefined;
  const place = (p.get('place') ?? '').trim();
  return { ...(q ? { query: q } : {}), ...(isLookId(look) ? { look } : {}), ...(view ? { view } : {}), ...(/^wd:Q\d{1,12}$/.test(place) ? { place } : {}) };
}

export function buildShareUrl(state: ShareState): string {
  const url = new URL(window.location.href);
  url.search = '';
  if (state.query) url.searchParams.set('q', state.query);
  if (state.view) { url.searchParams.set('ll', `${state.view.lat.toFixed(5)},${state.view.lng.toFixed(5)}`); url.searchParams.set('z', state.view.zoom.toFixed(1)); }
  if (state.place) url.searchParams.set('place', state.place);
  url.searchParams.set('look', state.look);
  return url.toString();
}

/** Keeps the address bar in step with the map, so the page can be copied or bookmarked as it is. */
export function writeShareState(state: ShareState): void {
  window.history.replaceState(null, '', buildShareUrl(state));
}

/** Shares a link to the map exactly as it is (position and zoom): the phone's share sheet, or the link copied. Returns what happened. */
export async function shareMapView(state: ShareState): Promise<'shared' | 'copied' | 'failed'> {
  const url = new URL(buildShareUrl(state));
  // in the app the page's own address is not a web address: the site's is shared
  if (!/^https?:$/.test(url.protocol) || url.hostname === 'localhost') { const site = new URL('https://wastelandmaps.com/'); site.search = url.search; url.href = site.href; }
  const title = state.query ? `${state.query} after the bombs` : 'WastelandMaps';
  try {
    if (isNative()) { await Share.share({ title, text: title, url: url.href, dialogTitle: title }); return 'shared'; }
    if (navigator.share) { await navigator.share({ title, text: title, url: url.href }); return 'shared'; }
    await navigator.clipboard.writeText(url.href);
    return 'copied';
  } catch (e) {
    return (e as Error)?.name === 'AbortError' ? 'shared' : 'failed';
  }
}
