import { isLookId, type LookId } from './looks';

/** What a shared link remembers: the place typed in, and which look. Everything else is worked out again from those two. */
export interface ShareState {
  query: string;
  look: LookId;
}

export function readShareState(search: string = window.location.search): Partial<ShareState> {
  const p = new URLSearchParams(search);
  const q = (p.get('q') ?? '').trim().slice(0, 120);
  const look = p.get('look');
  return { ...(q ? { query: q } : {}), ...(isLookId(look) ? { look } : {}) };
}

export function buildShareUrl(state: ShareState): string {
  const url = new URL(window.location.href);
  url.search = '';
  url.searchParams.set('q', state.query);
  url.searchParams.set('look', state.look);
  return url.toString();
}

/** Keeps the address bar in step with the map, so the page can be copied or bookmarked as it is. */
export function writeShareState(state: ShareState): void {
  window.history.replaceState(null, '', buildShareUrl(state));
}
