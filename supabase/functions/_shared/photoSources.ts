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
  source: 'wikidata' | 'wikipedia' | 'commons-category' | 'commons-near' | 'openverse' | 'commons-search' | 'mapillary';
}

export interface PhotoQuery {
  /** The Wikidata id (Q123) when the place has one. */
  entityId?: string;
  name: string;
  lat?: number;
  lng?: number;
  /** A city or town: the picture wanted is its skyline or a wide view, not a street corner. */
  city?: boolean;
  /** Throw (instead of answering null) when no photo was found AND a search was refused or failed, so the caller does not remember "no photo" for a hiccup. */
  throwOnFailure?: boolean;
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
  let res = await fetch(url, { headers, signal: AbortSignal.timeout(9000) });
  // busy (rate limited): wait a little longer each time and ask again, up to three more times
  for (let wait = 1500; (res.status === 429 || res.status === 503) && wait <= 6000; wait *= 2) { await new Promise((r) => setTimeout(r, wait)); res = await fetch(url, { headers, signal: AbortSignal.timeout(9000) }); }
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
interface BigInfo { width?: number; height?: number }

async function commonsFile(file: string, source: PhotoHit['source'], headers: Headers): Promise<PhotoHit | null> {
  const data = await json(COMMONS + new URLSearchParams({ action: 'query', format: 'json', origin: '*', titles: `File:${file.replace(/^File:/, '')}`, ...imageinfo }), headers);
  const page = Object.values((data.query?.pages ?? {}) as Record<string, CommonsPage>)[0];
  return page ? hitFromPage(page, source) : null;
}

/** What Wikidata knows about a place: its Wikipedia article, its Commons category and where it is. */
async function entityFacts(entityId: string, headers: Headers): Promise<{ p18?: string; wiki?: string; wikis?: Record<string, string>; category?: string; lat?: number; lng?: number }> {
  const data = await json('https://www.wikidata.org/w/api.php?' + new URLSearchParams({ action: 'wbgetentities', ids: entityId, props: 'claims|sitelinks', format: 'json', origin: '*' }), headers);
  const entity = data.entities?.[entityId];
  const claim = (p: string) => entity?.claims?.[p]?.[0]?.mainsnak?.datavalue?.value;
  const coord = claim('P625') as { latitude?: number; longitude?: number } | undefined;
  const wikis: Record<string, string> = {};
  for (const [k, v] of Object.entries((entity?.sitelinks ?? {}) as Record<string, { title: string }>)) if (/^[a-z]{2,3}wiki$/.test(k) && k !== 'enwiki') wikis[k.replace(/wiki$/, '')] = v.title;
  return { p18: claim('P18') as string | undefined, wikis, wiki: entity?.sitelinks?.enwiki?.title as string | undefined, category: claim('P373') as string | undefined, lat: coord?.latitude, lng: coord?.longitude };
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
    if (!photoIsOf(name, text) || NOT_OUTSIDE.test(page.title ?? "") || /(view (from|of|toward|towards|across)|seen from|from (the )?(top|atop|inside|window|observation)|looking (at|from|toward))/i.test(page.title ?? "")) continue; // not a picture taken from it
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

// ---- cities: a skyline, found where Commons keeps skylines ----

/** The Wikidata item for a place by name and position (the nearest of the items that carry that name), with what it knows of its pictures. */
async function entityByName(name: string, lat: number | undefined, lng: number | undefined, headers: Headers): Promise<{ id: string; p18?: string; category?: string; wikis: Record<string, string> } | null> {
  const found = await json('https://www.wikidata.org/w/api.php?' + new URLSearchParams({ action: 'wbsearchentities', search: name, language: 'en', type: 'item', limit: '10', format: 'json', origin: '*' }), headers);
  const ids = ((found.search ?? []) as { id: string }[]).map((x) => x.id);
  if (ids.length === 0) return null;
  const data = await json('https://www.wikidata.org/w/api.php?' + new URLSearchParams({ action: 'wbgetentities', ids: ids.join('|'), props: 'claims|sitelinks', format: 'json', origin: '*' }), headers);
  let best: { id: string; p18?: string; category?: string; wikis: Record<string, string>; d: number } | null = null;
  for (const id of ids) {
    const e = data.entities?.[id];
    const c = e?.claims?.P625?.[0]?.mainsnak?.datavalue?.value as { latitude?: number; longitude?: number } | undefined;
    if (!e || !c || c.latitude === undefined || c.longitude === undefined) continue;
    const d = lat === undefined || lng === undefined ? 0 : Math.hypot((c.latitude - lat) * 111, (c.longitude - lng) * 111 * Math.cos((lat * Math.PI) / 180));
    if (d > 40) continue;
    // a city, not a street or a school that happens to share the name: it has a Wikipedia article and a population
    const hasWiki = !!e.sitelinks?.enwiki;
    const score = d - (hasWiki ? 100 : 0) - (e.claims?.P1082 ? 50 : 0);
    if (!best || score < best.d) {
      const wikis: Record<string, string> = {};
      for (const [k, v] of Object.entries((e.sitelinks ?? {}) as Record<string, { title: string }>)) if (/^[a-z]{2,3}wiki$/.test(k)) wikis[k.replace(/wiki$/, '')] = v.title;
      best = { id, p18: e.claims?.P18?.[0]?.mainsnak?.datavalue?.value as string | undefined, category: e.claims?.P373?.[0]?.mainsnak?.datavalue?.value as string | undefined, wikis, d: score };
    }
  }
  return best;
}

/** How good a Commons file is as the picture of a city: wide, large, a skyline or panorama by name, a quality or featured picture, and not a map, a flag or a collage. */
function skylineScore(page: CommonsPage & { imageinfo?: (NonNullable<CommonsPage['imageinfo']>[number] & BigInfo)[] }): number {
  const info = page.imageinfo?.[0];
  if (!info || !/^image\/(jpeg|png)$/.test(info.mime ?? '')) return -1e9;
  const w = info.width ?? 0, h = info.height ?? 1, aspect = w / h;
  if (w < 1800 || aspect < 1.25 || aspect > 3.4) return -1e9;
  const title = (page.title ?? '').replace(/^File:/, '');
  if (/\b(map|flag|coat of arms|logo|diagram|plan|collage|montage|poster|stamp|seal|banner|icon|locator|location|aerial map)\b/i.test(title)) return -1e9;
  const cats = stripHtml(info.extmetadata?.Categories?.value ?? '');
  let score = 0;
  if (/skyline|cityscape|skyscrapers/i.test(title)) score += 4;
  else if (/panorama/i.test(title)) score += 2;
  else if (/\b(view|downtown|from|overlooking|city)\b/i.test(title)) score += 1.5;
  if (!/skyline|cityscape|skyscrapers/i.test(title) && /(garden|gardens|park|museum|church|cathedral|bridge|station|street|road|square|market|temple|mosque|palace|castle|hotel|school|university|stadium|harbou?r|beach|lake)/i.test(title)) score -= 3;
  if (/featured pictures/i.test(cats)) score += 3;
  if (/quality images/i.test(cats)) score += 2;
  if (/\b(night|nightfall|dusk|twilight)\b/i.test(title)) score -= 0.5;
  if (/\b(from space|satellite|iss)\b/i.test(title)) score -= 6;
  score -= Math.abs(aspect - 1.8) * 1.2;
  score += Math.log10(w) * 1.2;
  return score;
}

/** Titles that are never a picture of a city as a whole: maps, people, animals, objects, signs, interiors, single buildings. */
const NOT_A_CITY = /(locator|location|prefecture|administrative|division|district|province|map|harita|flag|logo|lambang|wallpaper|montage|collage|statue|mural|portrait|man|men|woman|women|boy|girl|people|police|president|secretary|zoo|monkeys?|cat|bird|heron|fish|plaque|market|store|shop|restaurant|airport|aeroport|aéroport|museum|mosque|temple|church|castle|slott|arch|bridge|bus|stops?|taxi|car|show|photoshoot|trails|code|screen|formation|tours|pakora|mansion|guard|jalan|road|highway|station|railway|hotel|school|college|stadium|courthouse|capitol|palace|assembly)|.svg|^File:/i;

/** The best skyline or wide view of a city: from its skyline, panorama and cityscape categories on Commons, else its Wikidata picture, else the lead of its articles. */
async function cityPhoto(name: string, lat: number | undefined, lng: number | undefined, headers: Headers): Promise<PhotoHit | null> {
  const ent = await entityByName(name, lat, lng, headers);
  const cats = new Set<string>([`Skyline of ${name}`, `${name} skyline`, `Skylines of ${name}`, `Panoramas of ${name}`, `Panorama of ${name}`, `Cityscapes of ${name}`, `Views of ${name}`]);
  if (ent?.category) {
    cats.add(ent.category);
    // the subcategories of its own category that hold skylines and panoramas
    try {
      const sub = await json(COMMONS + new URLSearchParams({ action: 'query', format: 'json', origin: '*', list: 'categorymembers', cmtitle: `Category:${ent.category}`, cmtype: 'subcat', cmlimit: '200' }), headers);
      for (const m of (sub.query?.categorymembers ?? []) as { title: string }[]) if (/skyline|panorama|cityscape|views? of|view from/i.test(m.title)) cats.add(m.title.replace(/^Category:/, ''));
    } catch { /* the guessed names still stand */ }
  }
  let best: { page: CommonsPage; score: number } | null = null as { page: CommonsPage; score: number } | null;
  const consider = (page: CommonsPage, bonus: number) => {
    if (!hitFromPage(page, 'commons-category', 800)) return; // freely licensed, a JPEG or PNG
    if ((NOT_A_CITY.test((page.title ?? '').replace(/^File:/, '')) && !/skyline|cityscape|skyscraper|panorama/i.test(page.title ?? '')) || NOT_OUTSIDE.test(page.title ?? '') || /(nissan|gt-r|toyota|honda|bmw|airlines?|heron|bird|donation|rathaus|museum|station|division|prefecture|atlas|hand-?colou?red)/i.test(page.title ?? '')) return;
    const sc = skylineScore(page as never) + bonus;
    if (!best || sc > best.score) best = { page, score: sc };
  };
  const bestScore = () => (best ? (best as { score: number }).score : -1e9);
  // 1. Commons' own search for "<city> skyline", "<city> panorama" and "<city> cityscape": the best-known pictures come first
  for (const word of ['skyline', 'panorama', 'cityscape', 'skyscrapers', 'downtown', 'aerial']) {
    if (bestScore() >= 5) break; // a clear skyline is found: no more asking

    try {
      const data = await json(COMMONS + new URLSearchParams({ action: 'query', format: 'json', origin: '*', generator: 'search', gsrsearch: '"' + name + '" ' + word + ' filetype:bitmap', gsrnamespace: '6', gsrlimit: '30', ...imageinfo }), headers);
      const first = name.split(/[ ,-]/).sort((x, y) => y.length - x.length)[0].toLowerCase();
      for (const page of Object.values((data.query?.pages ?? {}) as Record<string, CommonsPage>)) {
        const t = (page.title ?? '').replace(/^File:/, '').toLowerCase();
        if (!t.includes(first)) continue; // its name must name the city
        consider(page, 1);
      }
    } catch { /* the categories follow */ }
  }
  // 1b. nothing yet: the plainer words a city's pictures are named with
  if (bestScore() < 1.2) for (const word of ['city', 'centre', 'view', 'town']) {
    if (bestScore() >= 1.2) break;
    try {
      const data = await json(COMMONS + new URLSearchParams({ action: 'query', format: 'json', origin: '*', generator: 'search', gsrsearch: '"' + name + '" ' + word + ' filetype:bitmap', gsrnamespace: '6', gsrlimit: '30', ...imageinfo }), headers);
      const first = name.split(/[ ,-]/).sort((x, y) => y.length - x.length)[0].toLowerCase();
      for (const page of Object.values((data.query?.pages ?? {}) as Record<string, CommonsPage>)) { if (!(page.title ?? '').toLowerCase().includes(first)) continue; consider(page, 0); }
    } catch { /* the categories follow */ }
  }
  // 2. the skyline and panorama categories
  if (bestScore() < 5) {
    for (const cat of [...cats].slice(0, 6)) {
      let data;
      try { data = await json(COMMONS + new URLSearchParams({ action: 'query', format: 'json', origin: '*', generator: 'categorymembers', gcmtitle: 'Category:' + cat, gcmtype: 'file', gcmlimit: '200', ...imageinfo }), headers); } catch { continue; }
      for (const page of Object.values((data.query?.pages ?? {}) as Record<string, CommonsPage>)) consider(page, /skyline|panorama|cityscape/i.test(cat) ? 1.5 : 0);
      if (bestScore() > 6) break;
    }
  }
  // only a picture that is a skyline or panorama by name (or a featured one) is taken at once; otherwise the city's own article pictures are tried first
  if (bestScore() >= 1.2) return hitFromPage((best as { page: CommonsPage }).page, 'commons-category', 800);
  if (ent?.p18) { const hit = await commonsFile(ent.p18, 'wikidata', headers).catch(() => null); if (hit && !NOT_A_CITY.test(hit.title)) return hit; }
  for (const [lang, title] of Object.entries(ent?.wikis ?? {}).sort((a, b) => (a[0] === 'en' ? -1 : b[0] === 'en' ? 1 : 0)).slice(0, 8)) {
    const hit = await wikiLeadIn(lang, title, headers).catch(() => null);
    if (hit && !NOT_A_CITY.test(hit.title)) return hit;
  }
  return bestScore() > 0 ? hitFromPage((best as { page: CommonsPage }).page, 'commons-category', 800) : null;
}

/** The lead picture of an article in any language's Wikipedia, if it lives on Commons. */
async function wikiLeadIn(lang: string, title: string, headers: Headers): Promise<PhotoHit | null> {
  const summary = await json(`https://${lang}.wikipedia.org/api/rest_v1/page/summary/` + encodeURIComponent(title.replace(/ /g, '_')), headers);
  const source = (summary.originalimage?.source ?? '') as string;
  if (!/upload\.wikimedia\.org\/wikipedia\/commons\//.test(source)) return null;
  const file = decodeURIComponent(source.split('/').pop() ?? '');
  return file ? commonsFile(file, 'wikipedia', headers) : null;
}

/** Titles that are not a picture of the place's outside: rooms, notices, vehicles, events. */
const NOT_OUTSIDE = new RegExp('\\b(inside|interior|interieur|room|lobby|corridor|notice|board|tank|exhibit|exhibition|meeting|awareness|award|conference|ceremony|ticket|menu|plane|airbus|boeing|aircraft|airliner|flight|bus|train|locomotive|truck|taxi|car|cars|portrait|selfie|group|map|plan|logo|flag|poster|sign|signage)\\b', 'i');

/** Commons' own text search: a file whose name carries the place's name. */
async function commonsSearch(name: string, headers: Headers): Promise<PhotoHit | null> {
  const data = await json(COMMONS + new URLSearchParams({ action: 'query', format: 'json', origin: '*', generator: 'search', gsrsearch: `${name} filetype:bitmap`, gsrnamespace: '6', gsrlimit: '20', ...imageinfo }), headers);
  const pages = Object.values((data.query?.pages ?? {}) as Record<string, CommonsPage>);
  let best: { page: CommonsPage; score: number } | null = null;
  for (const page of pages) {
    const meta = page.imageinfo?.[0]?.extmetadata ?? {};
    if (!photoIsOf(name, `${page.title ?? ''} ${stripHtml(meta.ObjectName?.value ?? '')}`)) continue;
    if (NOT_OUTSIDE.test(page.title ?? "")) continue;
    if (!hitFromPage(page, 'commons-search', 800)) continue;
    const sc = skylineScore(page as never) + 8;
    if (!best || sc > best.score) best = { page, score: sc };
  }
  return best ? hitFromPage(best.page, 'commons-search', 800) : null;
}

/** Mapillary: street-level photographs shared under CC BY-SA, taken all over the world (used only when a token is set, as a last resort before Street View). */
async function mapillary(lat: number, lng: number, headers: Headers): Promise<PhotoHit | null> {
  const token = (globalThis as { Deno?: { env: { get: (k: string) => string | undefined } } }).Deno?.env.get('MAPILLARY_TOKEN');
  if (!token) return null;
  const d = 0.0006;
  const data = await json('https://graph.mapillary.com/images?' + new URLSearchParams({ access_token: token, fields: 'id,thumb_2048_url,captured_at,creator,is_pano', bbox: `${lng - d},${lat - d},${lng + d},${lat + d}`, limit: '20' }), headers);
  const imgs = ((data.data ?? []) as { id: string; thumb_2048_url?: string; creator?: { username?: string }; is_pano?: boolean; captured_at?: number }[]).filter((i) => i.thumb_2048_url && !i.is_pano).sort((a, b) => (b.captured_at ?? 0) - (a.captured_at ?? 0));
  const pick = imgs[0];
  return pick ? { imageUrl: pick.thumb_2048_url as string, title: 'Street-level photograph', author: pick.creator?.username ?? 'A Mapillary contributor', license: 'CC BY-SA 4.0', pageUrl: `https://www.mapillary.com/app/?pKey=${pick.id}`, source: 'mapillary' } : null;
}

/** The best freely licensed photo of a place, or null. Each source that fails or has nothing hands over to the next. */
/** Cities whose automatic picture was not a good one: the photograph to use instead (a Commons file; all of them freely licensed). */
const PHOTO_PICKS: Record<string, [string, number, number]> = {
  miami: ['Miami - Skyline from Harbor.jpg', 25.8, -80.2],
  "tokyo": ['Tokio skyline from Tokyo Metropolitan Government Building.jpg', 35.7, 139.7],
  "osaka": ['Skyline view of Osaka.jpg', 34.7, 135.5],
  "moscow": ['Moscow skyline (8012910457).jpg', 55.8, 37.6],
  "mexico city": ['Mexico City Reforma skyline.jpg', 19.4, -99.1],
  "paris": ['Paris skyline from the Centre Georges-Pompidou 2010.jpg', 48.9, 2.3],
  "kyiv": ['Kyiv skyline (15688086793).jpg', 50.5, 30.5],
  "pune": ['Pune West skyline - March 2017.jpg', 18.5, 73.9],
  "seoul": ['Han River Seoul skyline Pixabay 1214950.jpg', 37.6, 127.0],
  "busan": ['Skyline of Busan Including Gwangan Bridge, Marine City and LCT Skyscrapers.jpg', 35.1, 129.0],
  "hamburg": ['Hamburg Skyline from Steinwerder (15148988569).jpg', 53.6, 10.0],
  "budapest": ['Budapest skyline from Gellért Hill (3).jpg', 47.5, 19.0],
  "barcelona": ['Barcelona Skyline as seen from Parc Güell.jpg', 41.4, 2.2],
  "berlin": ['Skyline of Berlin Germany (54181381862).jpg', 52.5, 13.4],
  "dubai": ['Dubai skyline (25901817975).jpg', 25.1, 55.3],
  "ankara": ['Ankara Skyline (6225862196).jpg', 39.9, 32.9],
  "tianjin": ['Tianjin Skyline 2009 by Nangua 1.jpg', 39.1, 117.2],
  "surat": ['Surat Skyline 01.jpg', 21.2, 72.8],
};

/** The best photo; for a city, one that is plainly not a view of a city (a station, a temple, a map, a person) is refused, so the picture falls to Street View instead of showing nonsense. */
export async function findPhotoFor(q: PhotoQuery, headers: Headers = {}): Promise<PhotoHit | null> {
  const hit = await findPhotoInner(q, headers);
  if (hit && q.city && NOT_A_CITY.test(hit.title) && !/skyline|cityscape|skyscraper|panorama/i.test(hit.title)) return null;
  return hit;
}

async function findPhotoInner(q: PhotoQuery, headers: Headers): Promise<PhotoHit | null> {
  const pick = PHOTO_PICKS[q.name.trim().toLowerCase()];
  if (pick && (q.lat === undefined || (Math.abs(q.lat - pick[1]) < 1.2 && Math.abs((q.lng ?? pick[2]) - pick[2]) < 1.5))) { try { const hit = await commonsFile(pick[0], 'wikidata', headers); if (hit) return hit; } catch { /* the ordinary search follows */ } }
  let lat = q.lat;
  let lng = q.lng;
  let failed = false;
  if (q.city) { try { const c = await cityPhoto(q.name, q.lat, q.lng, headers); if (c) return c; } catch { failed = true; } }
  const attempt = async (run: () => Promise<PhotoHit | null>): Promise<PhotoHit | null> => {
    try { return await run(); } catch { failed = true; return null; }
  };
  let facts: Awaited<ReturnType<typeof entityFacts>> = {};
  if (q.entityId && /^Q\d+$/.test(q.entityId)) {
    try { facts = await entityFacts(q.entityId, headers); } catch { failed = true; }
    lat ??= facts.lat;
    lng ??= facts.lng;
    if (facts.p18) { const hit = await attempt(() => commonsFile(facts.p18 as string, 'wikidata', headers)); if (hit) return hit; }
    if (facts.wiki) { const hit = await attempt(() => wikipediaLead(facts.wiki as string, headers)); if (hit) return hit; }
    if (facts.category) { const hit = await attempt(() => commonsCategory(facts.category as string, headers)); if (hit) return hit; }
    if (facts.wikis) for (const [lang, title] of Object.entries(facts.wikis).slice(0, 8)) { const hit = await attempt(() => wikiLeadIn(lang, title, headers)); if (hit) return hit; }
  }
  if (lat !== undefined && lng !== undefined) { const hit = await attempt(() => commonsNear(lat as number, lng as number, q.name, headers)); if (hit) return hit; }
  { const hit = await attempt(() => commonsSearch(q.name, headers)); if (hit) return hit; }
  const hit = (await attempt(() => openverse(q.name, headers))) ?? (lat !== undefined && lng !== undefined ? await attempt(() => mapillary(lat as number, lng as number, headers)) : null);
  if (!hit && failed && q.throwOnFailure) throw new Error('the photo search was refused or failed');
  return hit;
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
