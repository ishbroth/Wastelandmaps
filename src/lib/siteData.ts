// The website's data files (the pre-plotted places of every city, the radiation zones, the floods, the region names, what a clearing is worth). The phone app carries a copy of them
// built in, but it asks the live website first, so places that are added, moved or taken away on the site reach the app within minutes, with no new release of the app. If the site
// cannot be reached the built-in copy is used.
import { isNative } from './native';

const SITE = 'https://wastelandmaps.com/';

/** `path` is relative to the site root, for example `data/metros/us-ca-san-diego.json`. */
export async function fetchSite(path: string): Promise<Response> {
  const local = `${import.meta.env.BASE_URL}${path}`;
  if (!isNative()) return fetch(local);
  try {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 8000);
    const res = await fetch(SITE + path, { signal: ctl.signal });
    clearTimeout(timer);
    if (res.ok) return res;
  } catch { /* not reachable: the copy built into the app */ }
  return fetch(local);
}
