// Where the photo of a place comes from, shared by the browser (is there a snapshot to unlock?) and the unlock-render function (the photo the render is made
// from), so both always find the same one. Only freely licensed pictures that may be adapted and used commercially are accepted (CC BY, CC BY-SA, CC0, public
// domain); the photographer is credited. In order of trust:
//   1. the image Wikidata lists for the place (property P18: the picture Wikipedia uses),
//   2. the lead picture of the place's English Wikipedia article,
//   3. the place's category on Wikimedia Commons (every photo in it is of the place),
//   4. a Commons photo taken at the spot whose title or description names the place,
//   5. Openverse (openverse.org), a search over openly licensed pictures from Flickr, Wikimedia and others, for names it can match.
// No Google imagery is ever used. This file uses only fetch, so it runs in the browser and in Deno.

export interface PhotoHit {
  imageUrl: string;
  title: string;
  author: string;
  license: string;
  pageUrl: string;
  source: 'wikidata' | 'wikipedia' | 'commons-category' | 'commons-near' | 'openverse';
}

export interface PhotoQuery {
  /** The Wikidata id (Q123) when the place has one. */
  entityId?: string;
  name: string;
  lat?: number;
  lng?: number;
}

const ALLOWED = /^(CC BY(?!-NC)(?!-ND)|CC BY-SA(?!-NC)|CC0|Public domain|PD)/i;
const FILLER = new Set(['the', 'and', 'of', 'at', 'in', 'on', 'a', 'an', 'inc', 'llc', 'ltd', 'co', 'company', 'corp', 'file', 'jpg', 'jpeg', 'png']);

const stripHtml = (s: string) => s.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();

/** The words of a name that tell places apart, lowercased: "Hyatt Regency Boston" becomes hyatt, regency, boston. */
function words(text: string): string[] {
  return text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').split(/[^a-z0-9]+/).filter((w) => w.length >= 3 && !FILLER.has(w));
}

/** Does this photo's title (or description) say it is of this place? Most of the place's name has to appear in it. */
export function photoIsOf(placeName: string, photoText: string): boolean {
  const wanted = words(placeName);
  if (wanted.length === 0) return false;
  const have = new Set(words(photoText));
  const hits = wanted.filter((w) => have.has(w)).length;
  const hasLongHit = wanted.some((w) => w.length >= 5 && have.has(w));
  return hits / wanted.length >= 0.75 && hasLongHit;
}

type Headers = Record<string, string>;
interface CommonsPage {
  title?: string;
  imageinfo?: { thumburl?: string; descriptionurl?: string; mime?: string; thumbwidth?: number; thumbheight?: number; extmetadata?: Record<string, { value?: string }> }[];
}

const json = async (url: string, headers: Headers) => {
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
};

/** A Commons file page as a photo, if it is freely licensed and a JPEG or PNG (WebP is not offered by the thumbnails we ask for). */
function hitFromPage(page: CommonsPage, source: PhotoHit['source'], minWidth = 0): PhotoHit | null {
  const info = page.imageinfo?.[0];
  if (!info?.thumburl || !/^image\/(jpeg|png)$/.test(info.mime ?? '')) return null;
  if ((info.thumbwidth ?? 0) < minWidth) return null;
  const meta = info.extmetadata ?? {};
  const license = stripHtml(meta.LicenseShortName?.value ?? '');
  if (!ALLOWED.test(license)) return null;
  return {
    imageUrl: info.thumburl,
    title: stripHtml((page.title ?? 'Photo').replace(/^File:/, '').replace(/\.[a-z]+$/i, '')),
    author: stripHtml(meta.Artist?.value ?? 'Unknown photographer') || 'Unknown photographer',
    license,
    pageUrl: info.descriptionurl ?? 'https://commons.wikimedia.org',
    source,
  };
}

const COMMONS = 'https://commons.wikimedia.org/w/api.php?';
const imageinfo = { prop: 'imageinfo', iiprop: 'url|extmetadata|mime|size', iiurlwidth: '1200' };

async function commonsFile(file: string, source: PhotoHit['source'], headers: Headers): Promise<PhotoHit | null> {
  const data = await json(COMMONS + new URLSearchParams({ action: 'query', format: 'json', origin: '*', titles: `File:${file.replace(/^File:/, '')}`, ...imageinfo }), headers);
  const page = Object.values((data.query?.pages ?? {}) as Record<string, CommonsPage>)[0];
  return page ? hitFromPage(page, source) : null;
}

/** What Wikidata knows about a place: its Wikipedia article, its Commons category and where it is. */
async function entityFacts(entityId: string, headers: Headers): Promise<{ p18?: string; wiki?: string; category?: string; lat?: number; lng?: number }> {
  const data = await json('https://www.wikidata.org/w/api.php?' + new URLSearchParams({ action: 'wbgetentities', ids: entityId, props: 'claims|sitelinks', format: 'json', origin: '*' }), headers);
  const entity = data.entities?.[entityId];
  const claim = (p: string) => entity?.claims?.[p]?.[0]?.mainsnak?.datavalue?.value;
  const coord = claim('P625') as { latitude?: number; longitude?: number } | undefined;
  return { p18: claim('P18') as string | undefined, wiki: entity?.sitelinks?.enwiki?.title as string | undefined, category: claim('P373') as string | undefined, lat: coord?.latitude, lng: coord?.longitude };
}

/** The lead picture of the English Wikipedia article, if it lives on Commons (so it is freely licensed). */
async function wikipediaLead(title: string, headers: Headers): Promise<PhotoHit | null> {
  const summary = await json('https://en.wikipedia.org/api/rest_v1/page/summary/' + encodeURIComponent(title.replace(/ /g, '_')), headers);
  const source = (summary.originalimage?.source ?? '') as string;
  if (!/upload\.wikimedia\.org\/wikipedia\/commons\//.test(source)) return null; // images on the English Wikipedia itself are often non-free
  const file = decodeURIComponent(source.split('/').pop() ?? '');
  return file ? commonsFile(file, 'wikipedia', headers) : null;
}

/** The photos in the place's Commons category: the first freely licensed landscape-ish one of decent size. */
async function commonsCategory(category: string, headers: Headers): Promise<PhotoHit | null> {
  const data = await json(COMMONS + new URLSearchParams({
    action: 'query', format: 'json', origin: '*', generator: 'categorymembers', gcmtitle: `Category:${category.replace(/^Category:/, '')}`, gcmtype: 'file', gcmlimit: '40', ...imageinfo,
  }), headers);
  for (const page of Object.values((data.query?.pages ?? {}) as Record<string, CommonsPage>)) {
    const info = page.imageinfo?.[0];
    if ((info?.thumbwidth ?? 0) < 800 || (info?.thumbheight ?? 0) < 500) continue;
    const hit = hitFromPage(page, 'commons-category', 800);
    if (hit) return hit;
  }
  return null;
}

async function commonsNear(lat: number, lng: number, name: string, headers: Headers): Promise<PhotoHit | null> {
  const data = await json(COMMONS + new URLSearchParams({
    action: 'query', format: 'json', origin: '*', generator: 'geosearch', ggscoord: `${lat}|${lng}`, ggsradius: '300', ggslimit: '30', ggsnamespace: '6', ...imageinfo,
  }), headers);
  for (const page of Object.values((data.query?.pages ?? {}) as Record<string, CommonsPage>)) {
    const meta = page.imageinfo?.[0]?.extmetadata ?? {};
    const text = `${page.title ?? ''} ${stripHtml(meta.ImageDescription?.value ?? '')} ${stripHtml(meta.ObjectName?.value ?? '')}`;
    if (!photoIsOf(name, text) || /(view (from|of|toward|towards|across)|seen from|from (the )?(top|atop|inside|window|observation)|looking (at|from|toward))/i.test(page.title ?? "")) continue; // not a picture taken from it
    const hit = hitFromPage(page, 'commons-near', 600);
    if (hit) return hit;
  }
  return null;
}

/** Openverse: openly licensed pictures from many sources. Only licenses that allow adapting and commercial use are asked for. */
async function openverse(name: string, headers: Headers): Promise<PhotoHit | null> {
  const data = await json('https://api.openverse.org/v1/images/?' + new URLSearchParams({ q: name, license_type: 'commercial,modification', page_size: '15', mature: 'false' }), headers);
  for (const r of (data.results ?? []) as { title?: string; url?: string; creator?: string; license?: string; license_version?: string; foreign_landing_url?: string; width?: number; height?: number; tags?: { name: string }[] }[]) {
    if (!r.url || (r.width ?? 0) < 800 || (r.height ?? 0) < 500) continue;
    const text = `${r.title ?? ''} ${(r.tags ?? []).map((t) => t.name).join(' ')}`;
    if (!photoIsOf(name, r.title ?? text)) continue;
    const kind = (r.license ?? '').toLowerCase();
    const license = kind === 'cc0' ? 'CC0' : kind === 'pdm' ? 'Public domain' : kind === 'by' || kind === 'by-sa' ? `CC ${kind.toUpperCase()} ${r.license_version ?? ''}`.trim() : '';
    if (!license || !ALLOWED.test(license)) continue;
    return { imageUrl: r.url, title: r.title ?? name, author: r.creator ?? 'Unknown photographer', license, pageUrl: r.foreign_landing_url ?? r.url, source: 'openverse' };
  }
  return null;
}

/** The best freely licensed photo of a place, or null. Each source that fails or has nothing hands over to the next. */
export async function findPhotoFor(q: PhotoQuery, headers: Headers = {}): Promise<PhotoHit | null> {
  let lat = q.lat;
  let lng = q.lng;
  let facts: Awaited<ReturnType<typeof entityFacts>> = {};
  if (q.entityId && /^Q\d+$/.test(q.entityId)) {
    try { facts = await entityFacts(q.entityId, headers); } catch { /* try the rest */ }
    lat ??= facts.lat;
    lng ??= facts.lng;
    if (facts.p18) { try { const hit = await commonsFile(facts.p18, 'wikidata', headers); if (hit) return hit; } catch { /* next */ } }
    if (facts.wiki) { try { const hit = await wikipediaLead(facts.wiki, headers); if (hit) return hit; } catch { /* next */ } }
    if (facts.category) { try { const hit = await commonsCategory(facts.category, headers); if (hit) return hit; } catch { /* next */ } }
  }
  if (lat !== undefined && lng !== undefined) { try { const hit = await commonsNear(lat, lng, q.name, headers); if (hit) return hit; } catch { /* next */ } }
  try { return await openverse(q.name, headers); } catch { return null; }
}

/** A short name for where a photo page lives ("Wikimedia Commons", "Flickr"), for the credit line. */
export function sourceLabel(pageUrl: string): string {
  try {
    const host = new URL(pageUrl).hostname.replace(/^www\./, '');
    if (/wikimedia\.org|wikipedia\.org/.test(host)) return 'Wikimedia Commons';
    if (/flickr\.com/.test(host)) return 'Flickr';
    return host;
  } catch {
    return 'the original page';
  }
}
