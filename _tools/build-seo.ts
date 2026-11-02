// Writes the pages that search engines read, into dist/ (run after the build; the deploy does this). The app itself is one page, so without these a search for a
// Fallout vault, a landmark or a city would never find the site. Each page is plain HTML with its own title, description, keywords, social card and structured data, and a
// button that opens the same place in the app:
//   /place/<name>/   one for every landmark with a permanent snapshot and every famous landmark
//   /vault/<number>/ one for every vault from the games' stories, with its story
//   /lore/<town>/    one for every town from the games' stories that is on the map, with its buildings
//   /city/<id>/      one for every metro on the map (its wasteland name, and the landmarks and vaults in it)
//   /address/<address>/  one for every address in the atlas, and /atlas/ lists them
//   /places/, /vaults/, /lore/, /cities/   the lists that link to all of the above
//   /sitemap.xml
//
// The atlas is public: every address and place that someone has unlocked a render of gets a page too (/address/<address>/ and /place/<name>/), built from what the
// public-atlas function lists (the address, where it is, and the render kept for everyone). Nothing about the person who made a render is in it, and a person's own
// home render (which carries their vault number) is not part of the atlas.
//   npm run seo        (SEO_OUT=path to write somewhere else)

import fs from 'node:fs';
import path from 'node:path';
import { FAMOUS } from '../src/lib/famous';
import { FREE_RENDERS } from '../src/lib/renders';
import { LORE_VAULTS } from '../src/lib/loreVaults';
import { LORE_TOWNS } from '../src/lib/loreSites';
import { GLOBAL_LANDMARKS } from '../src/lib/globalLandmarks';

const ROOT = path.resolve(import.meta.dirname, '..');
const OUT = process.env.SEO_OUT ? path.resolve(process.env.SEO_OUT) : path.join(ROOT, 'dist');
const SITE = 'https://wastelandmaps.com';
const TODAY = new Date().toISOString().slice(0, 10);

interface Metro { id: string; name: string; country: string; lat: number; lng: number; pop: number; radiusKm: number; title: string; canon: boolean; places: number }
const metros = JSON.parse(fs.readFileSync(path.join(ROOT, 'public', 'data', 'index.json'), 'utf8')) as Metro[];
const countries = new Intl.DisplayNames(['en'], { type: 'region' });
const countryName = (iso: string) => { try { return countries.of(iso) ?? iso; } catch { return iso; } };

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const slugOf = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'place';
const km = (aLat: number, aLng: number, bLat: number, bLng: number) => {
  const r = Math.PI / 180;
  const h = Math.sin(((bLat - aLat) * r) / 2) ** 2 + Math.cos(aLat * r) * Math.cos(bLat * r) * Math.sin(((bLng - aLng) * r) / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
};
/** The metro a point belongs to: the closest metro center that it is within the reach of, else just the closest. */
function metroOf(lat: number, lng: number): Metro {
  let best = metros[0], bestGap = Infinity;
  for (const m of metros) {
    const gap = km(lat, lng, m.lat, m.lng) - m.radiusKm;
    if (gap < bestGap) { best = m; bestGap = gap; }
  }
  return best;
}
const hash = (s: string) => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; };
const pick = <T,>(seed: string, options: T[]): T => options[hash(seed) % options.length];

const written: string[] = [];
function write(urlPath: string, html: string) {
  const dir = path.join(OUT, urlPath);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), html);
  written.push(urlPath.endsWith('/') ? urlPath : `${urlPath}/`);
}

const BASE_KEYWORDS = ['fallout map', 'fallout world map', 'fallout map of the real world', 'real world fallout map', 'fallout wasteland map', 'post-apocalyptic map', 'your city after the bombs', 'fallout fan project', 'fallout vault map', 'fallout vault locations', 'fallout lore map', 'wasteland maps', 'fallout pip-boy map', 'interactive fallout map'];

interface Page {
  title: string;
  description: string;
  keywords: string[];
  canonical: string;
  image?: string;
  imageAlt?: string;
  jsonLd: unknown[];
  heading: string;
  body: string;
  /** Where the "open on the map" button goes. */
  open: string;
}

const CSS = `*{box-sizing:border-box}body{margin:0;background:#031209;color:#3dff8a;font:18px/1.6 'Share Tech Mono',ui-monospace,Menlo,Consolas,monospace}a{color:#7dffb3}a:hover{color:#fff}
header,main,footer{max-width:860px;margin:0 auto;padding:14px 18px}header{display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #145c32}
header a{text-decoration:none;font-size:22px;letter-spacing:2px}h1{font-size:34px;line-height:1.15;letter-spacing:2px;margin:.4em 0 .2em;font-weight:400;text-transform:uppercase}h2{font-size:22px;letter-spacing:2px;font-weight:400;margin:1.4em 0 .3em;color:#9bd9b4}
.open{display:inline-block;margin:12px 0;padding:8px 22px;border:2px solid #3dff8a;border-radius:8px;text-decoration:none;font-size:22px;letter-spacing:2px;color:#3dff8a}.open:hover{background:#3dff8a;color:#012b0f}
img{max-width:100%;height:auto;border:2px solid #145c32;border-radius:8px}figure{margin:12px 0}figcaption,.fine{font-size:14px;color:#7aa88c}ul{padding-left:1.2em}li{margin:.2em 0}
.cols{columns:2 280px}footer{border-top:2px solid #145c32;margin-top:30px;font-size:14px;color:#7aa88c}`;

function render(p: Page): string {
  const url = `${SITE}${p.canonical}`;
  const image = p.image ?? `${SITE}/og.jpg`;
  const keywords = [...new Set([...p.keywords, ...BASE_KEYWORDS])].join(', ');
  const ld = JSON.stringify(p.jsonLd.length === 1 ? p.jsonLd[0] : p.jsonLd).replace(/</g, '\\u003c');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(p.title)}</title>
<meta name="description" content="${esc(p.description)}">
<meta name="keywords" content="${esc(keywords)}">
<meta name="robots" content="index,follow,max-image-preview:large">
<link rel="canonical" href="${esc(url)}">
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<meta name="theme-color" content="#031209">
<meta property="og:type" content="website">
<meta property="og:site_name" content="WastelandMaps">
<meta property="og:title" content="${esc(p.title)}">
<meta property="og:description" content="${esc(p.description)}">
<meta property="og:url" content="${esc(url)}">
<meta property="og:image" content="${esc(image)}">
${p.imageAlt ? `<meta property="og:image:alt" content="${esc(p.imageAlt)}">\n` : ''}<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(p.title)}">
<meta name="twitter:description" content="${esc(p.description)}">
<meta name="twitter:image" content="${esc(image)}">
<script type="application/ld+json">${ld}</script>
<style>${CSS}</style>
</head>
<body>
<header><a href="/">WASTELANDMAPS</a><nav><a href="/places/">Landmarks</a> · <a href="/vaults/">Vaults</a> · <a href="/lore/">Lore</a> · <a href="/cities/">Cities</a></nav></header>
<main>
<h1>${esc(p.heading)}</h1>
${p.body}
<p><a class="open" href="${esc(p.open)}">OPEN ON THE MAP</a></p>
</main>
<footer>WastelandMaps is an unofficial fan project and is not affiliated with or endorsed by Bethesda Softworks or the makers of Fallout. Fallout is a trademark of its owners. Map data from Wikidata (CC0) and GeoNames (CC BY 4.0). <a href="/privacy.html">Privacy</a></footer>
</body>
</html>
`;
}

const breadcrumb = (items: [string, string][]) => ({
  '@context': 'https://schema.org', '@type': 'BreadcrumbList',
  itemListElement: items.map(([name, item], i) => ({ '@type': 'ListItem', position: i + 1, name, item: `${SITE}${item}` })),
});
const li = (href: string, text: string, extra = '') => `<li><a href="${esc(href)}">${esc(text)}</a>${extra ? ` <span class="fine">${esc(extra)}</span>` : ''}</li>`;
const openQuery = (q: string) => `/?q=${encodeURIComponent(q)}`;

// ---- the landmarks (permanent snapshots first, then the famous ones)
interface Landmark { slug: string; name: string; real: string; qid?: string; lat: number; lng: number; metro: Metro; permanent: boolean; render?: { photo: string; author: string; license: string; page: string }; wastelandName?: string; /** The render someone unlocked, kept for everyone (second-tier landmarks). */ pubImage?: string }

// ---- what people have rendered: the public atlas
interface AtlasAddress { id: string; name: string; address: string; lat: number; lng: number; kind: string; metro: string | null; image: string; at: string }
interface AtlasPlace { id: string; name: string; image: string; photo: string; author: string; license: string; page: string; at: string }
async function fetchAtlas(): Promise<{ addresses: AtlasAddress[]; places: AtlasPlace[] }> {
  const base = process.env.VITE_SUPABASE_URL || 'https://tdwikatzogfwfssyzmlw.supabase.co';
  // SEO_ATLAS_FILE: read the list from a file instead (for trying the pages out)
  if (process.env.SEO_ATLAS_FILE) return JSON.parse(fs.readFileSync(process.env.SEO_ATLAS_FILE, 'utf8')) as { addresses: AtlasAddress[]; places: AtlasPlace[] };
  try {
    const res = await fetch(`${base}/functions/v1/public-atlas`);
    if (!res.ok) throw new Error(String(res.status));
    return (await res.json()) as { addresses: AtlasAddress[]; places: AtlasPlace[] };
  } catch (e) {
    console.log('seo: the public atlas could not be read, so its pages are skipped this time:', e instanceof Error ? e.message : e);
    return { addresses: [], places: [] };
  }
}
const atlas = await fetchAtlas();
const atlasPlaces = new Map(atlas.places.map((p) => [p.id, p]));
const landmarks: Landmark[] = [];
const seen = new Set<string>();
const slugs = new Set<string>();
const uniqueSlug = (base: string, qid?: string) => { let s = base; if (slugs.has(s)) s = `${base}-${(qid ?? 'x').toLowerCase()}`; slugs.add(s); return s; };

for (const g of GLOBAL_LANDMARKS) {
  const qid = g.id.slice(3);
  const r = FREE_RENDERS[qid];
  if (!r) continue;
  seen.add(qid);
  landmarks.push({ slug: uniqueSlug(slugOf(r.real ?? r.name), qid), name: r.real ?? r.name, real: r.real ?? r.name, qid, lat: g.position.lat, lng: g.position.lng, metro: metroOf(g.position.lat, g.position.lng), permanent: true, render: { photo: r.photo, author: r.author, license: r.license, page: r.page }, wastelandName: r.postName });
}
for (const f of FAMOUS) {
  if (f.qid && seen.has(f.qid)) continue;
  const pub = f.qid ? atlasPlaces.get(f.qid) : undefined;
  landmarks.push({ slug: uniqueSlug(slugOf(f.name), f.qid), name: f.name, real: f.name, qid: f.qid, lat: f.lat, lng: f.lng, metro: f.metro ? (metros.find((m) => m.id === f.metro) ?? metroOf(f.lat, f.lng)) : metroOf(f.lat, f.lng), permanent: false, pubImage: pub?.image, render: pub ? { photo: pub.photo, author: pub.author, license: pub.license, page: pub.page } : undefined });
}

const mapsLink = (l: { lat: number; lng: number }) => `https://www.openstreetmap.org/?mlat=${l.lat}&mlon=${l.lng}#map=17/${l.lat}/${l.lng}`;

for (const l of landmarks) {
  const city = l.metro.name;
  const country = countryName(l.metro.country);
  const where = `${city}, ${country}`;
  const url = `/place/${l.slug}/`;
  const image = l.qid && l.permanent ? `${SITE}/renders/${l.qid}.png` : l.pubImage;
  const title = l.permanent
    ? `${l.name} destroyed: ${where} after the bombs | Fallout-style render | WastelandMaps`
    : `${l.name}, ${where}: on the Fallout-style wasteland map | WastelandMaps`;
  const description = l.permanent
    ? `See ${l.name} in ${where} 200 years after the bombs: a free Fallout-style destroyed render of the real landmark, with the raiders, mutants and loot that live there now. Find it on the WastelandMaps wasteland map.`
    : `${l.name} in ${where} is on the WastelandMaps wasteland map, a boss-guarded landmark in ${l.metro.title}. Unlock a Fallout-style destroyed snapshot of it, fight what lives there and loot it.`;
  const nearby = landmarks.filter((o) => o !== l && o.metro.id === l.metro.id).slice(0, 8);
  const vaultsHere = LORE_VAULTS.filter((v) => v.metro === l.metro.id);
  const intro = pick(l.slug, [
    `${l.name} is one of the best-known places in ${where}. On WastelandMaps, the unofficial Fallout-style map of the real world, it stands in ${l.metro.title}.`,
    `In the wasteland, ${where} is ${l.metro.title}, and ${l.name} is one of the landmarks the survivors still talk about.`,
    `Two hundred years after the Great War, ${l.name} in ${where} is a ruin worth the trip. This is how it looks on the WastelandMaps map of the real world.`,
  ]);
  const body = `
<p>${esc(intro)}</p>
${image ? `<figure><img src="${esc(image)}" alt="${esc(`${l.name} in ${where} destroyed in a post-apocalyptic, Fallout-style render`)}" width="1200" loading="eager"><figcaption>${esc(l.name)} as it looks in the wasteland: a game-style render made from the photograph “${esc(l.render?.photo ?? '')}” by ${esc(l.render?.author ?? '')} (${esc(l.render?.license ?? '')}, <a href="${esc(l.render?.page ?? '#')}" rel="noopener">source</a>), shared under the same license.</figcaption></figure>` : ''}
<h2>${esc(l.name)} on the wasteland map</h2>
<ul>
<li>Real place: ${esc(l.real)}, ${esc(where)} (${l.lat.toFixed(4)}, ${l.lng.toFixed(4)}). <a href="${esc(mapsLink(l))}" rel="noopener">Show on OpenStreetMap</a></li>
<li>In the wasteland: ${esc(city)} is <a href="/city/${esc(l.metro.id)}/">${esc(l.metro.title)}</a>${l.wastelandName ? `, and ${esc(l.name)} is known as ${esc(l.wastelandName)}` : ''}.</li>
<li>${l.permanent ? 'Its destroyed snapshot is free for everyone.' : 'Its destroyed snapshot costs 100 caps to unlock, and then it is yours to view, download and share.'}</li>
<li>Fight the raiders, ghouls, super mutants or worse that live there, beat its boss, and loot it for steel, gears, circuitry and more to build better guns.</li>
</ul>
${vaultsHere.length ? `<h2>Fallout vaults near ${esc(city)}</h2><ul>${vaultsHere.map((v) => li(`/vault/${v.number}/`, `Vault ${v.number}`, v.game)).join('')}</ul>` : ''}
${nearby.length ? `<h2>More landmarks in ${esc(city)}</h2><ul>${nearby.map((o) => li(`/place/${o.slug}/`, o.name)).join('')}</ul>` : ''}
<p class="fine">WastelandMaps turns any real city into a Fallout-style wasteland: every landmark, a hundred thousand places, the vaults and towns from the games, with destroyed snapshots, fights, loot and fast travel. It is a fan project.</p>`;
  write(url, render({
    title, description, canonical: url, image, imageAlt: image ? `${l.name} destroyed, Fallout-style render` : undefined, open: openQuery(`${l.name}, ${where}`), heading: l.permanent ? `${l.name}, after the bombs` : `${l.name}`, body,
    keywords: [l.name, `${l.name} ${city}`, `${l.name} destroyed`, `${l.name} post-apocalyptic`, `${l.name} fallout`, `${city} fallout map`, `${city} wasteland`, `${city} after the bombs`, l.metro.title, country, `${city} ${country}`, 'destroyed landmark', 'post apocalyptic landmark render'],
    jsonLd: [
      {
        '@context': 'https://schema.org', '@type': ['TouristAttraction', 'Place'], name: l.name, description,
        geo: { '@type': 'GeoCoordinates', latitude: l.lat, longitude: l.lng },
        address: { '@type': 'PostalAddress', addressLocality: city, addressCountry: l.metro.country },
        ...(l.qid ? { sameAs: [`https://www.wikidata.org/wiki/${l.qid}`] } : {}),
        hasMap: mapsLink(l), url: `${SITE}${url}`,
        ...(image ? { image: { '@type': 'ImageObject', contentUrl: image, name: `${l.name} destroyed (Fallout-style render)`, creditText: `${l.render?.author} / ${l.render?.photo}`, license: l.render?.page, acquireLicensePage: l.render?.page, creator: { '@type': 'Person', name: l.render?.author } } } : {}),
        isPartOf: { '@type': 'WebSite', name: 'WastelandMaps', url: SITE },
      },
      breadcrumb([['WastelandMaps', '/'], ['Landmarks', '/places/'], [l.name, url]]),
    ],
  }));
}

// ---- the vaults from the games
for (const v of LORE_VAULTS) {
  const m = metros.find((x) => x.id === v.metro) ?? metroOf(v.lat, v.lng);
  const where = `${m.name}, ${countryName(m.country)}`;
  const url = `/vault/${v.number}/`;
  const title = `Vault ${v.number} (${v.game}): where it is on the real-world map | WastelandMaps`;
  const description = `Vault ${v.number} from ${v.game}: ${v.lore} See where it would stand in the real world, near ${where}, on the WastelandMaps Fallout map.`.slice(0, 300);
  const near = landmarks.filter((o) => o.metro.id === m.id).slice(0, 8);
  const body = `
<p>${esc(v.lore)}</p>
<h2>The story of Vault ${v.number}</h2>
${v.story.map((p) => `<p>${esc(p)}</p>`).join('\n')}
<h2>Where Vault ${v.number} is on the real-world map</h2>
<p>${v.approximate ? 'The game bends and compresses geography, so this is where the vault sits relative to the places around it that do have a real counterpart' : 'This is where the games place it against the real map'}: near ${esc(where)} (${v.lat.toFixed(3)}, ${v.lng.toFixed(3)}), in <a href="/city/${esc(m.id)}/">${esc(m.title)}</a>.</p>
${near.length ? `<h2>Landmarks near Vault ${v.number}</h2><ul>${near.map((o) => li(`/place/${o.slug}/`, o.name)).join('')}</ul>` : ''}
<h2>More vaults</h2>
<ul>${LORE_VAULTS.filter((o) => o.number !== v.number).slice(0, 8).map((o) => li(`/vault/${o.number}/`, `Vault ${o.number}`, o.game)).join('')}<li><a href="/vaults/">All vaults</a></li></ul>
<p class="fine">A summary in our own words of what ${esc(v.game)} and the Fallout wiki tell. WastelandMaps is an unofficial fan project.</p>`;
  write(url, render({
    title, description, canonical: url, open: openQuery(where), heading: `Vault ${v.number}`, body,
    keywords: [`Vault ${v.number}`, `Vault ${v.number} ${v.game}`, `${v.game} Vault ${v.number}`, `Vault ${v.number} location`, `Vault ${v.number} lore`, `Vault ${v.number} real world`, `${v.game} vaults`, `${v.game} map`, `${v.game} lore`, `${v.game} locations on a real map`, 'vault-tec', 'vault dweller', `${m.name} fallout`],
    jsonLd: [{ '@context': 'https://schema.org', '@type': 'Article', headline: `Vault ${v.number} (${v.game})`, description, about: { '@type': 'Thing', name: `Vault ${v.number}` }, mainEntityOfPage: `${SITE}${url}`, dateModified: TODAY, publisher: { '@type': 'Organization', name: 'WastelandMaps', url: SITE }, spatialCoverage: { '@type': 'Place', name: where, geo: { '@type': 'GeoCoordinates', latitude: v.lat, longitude: v.lng } } }, breadcrumb([['WastelandMaps', '/'], ['Vaults', '/vaults/'], [`Vault ${v.number}`, url]])],
  }));
}

write('/vaults/', render({
  title: 'Every Fallout vault on the real-world map | WastelandMaps', canonical: '/vaults/', open: '/', heading: 'Fallout vaults on the real map',
  description: 'Vault 111, Vault 101, Vault 76, Vault 13 and more: every vault from the Fallout games placed where it would stand in the real world, with its story. Plus thousands of made-up vaults under real cities.',
  keywords: ['fallout vaults', 'fallout vault list', 'fallout vault locations', 'vault-tec vaults', 'vault map', ...LORE_VAULTS.map((v) => `Vault ${v.number}`)],
  body: `<p>These vaults come from the games' stories and sit where they would stand on the real map. Every other city on WastelandMaps gets vaults of its own, each with a backstory, and you can build your own: your home is Vault 0000 to 9999, your choice.</p><ul class="cols">${LORE_VAULTS.map((v) => li(`/vault/${v.number}/`, `Vault ${v.number}`, v.game)).join('')}</ul>`,
  jsonLd: [{ '@context': 'https://schema.org', '@type': 'CollectionPage', name: 'Fallout vaults on the real-world map', url: `${SITE}/vaults/` }, breadcrumb([['WastelandMaps', '/'], ['Vaults', '/vaults/']])],
}));

// ---- the towns from the games
const townSlugs: { slug: string; label: string; metro: Metro }[] = [];
for (const t of LORE_TOWNS) {
  const label = t.town;
  const slug = slugOf(label.replace(/\(.*\)/, '').trim() || label);
  const m = metroOf(t.anchor.lat, t.anchor.lng);
  townSlugs.push({ slug, label, metro: m });
  const where = `${m.name}, ${countryName(m.country)}`;
  const url = `/lore/${slug}/`;
  const plain = label.replace(/\s*\(.*\)/, '');
  const game = /\((.*)\)/.exec(label)?.[1] ?? 'the Fallout games';
  const description = `${plain} from ${game} on the real-world map: where it would stand near ${where}, and the buildings and places the games name there. A fan map of Fallout lore.`;
  const body = `
<p>${esc(plain)} comes from ${esc(game)}. On WastelandMaps it stands near ${esc(where)} (${t.anchor.lat.toFixed(3)}, ${t.anchor.lng.toFixed(3)}), in <a href="/city/${esc(m.id)}/">${esc(m.title)}</a>, and the places the games name around it are laid out the way they sit in the game.</p>
<h2>Places in ${esc(plain)}</h2>
<ul>${t.sites.map((s) => `<li><b>${esc(s.name)}</b>: ${esc(s.text)}</li>`).join('')}</ul>
<p class="fine">These are story sites, not real places, so they have a line of lore and no snapshot. Summaries in our own words of what the games and the Fallout wiki tell.</p>`;
  write(url, render({
    title: `${plain}: Fallout lore on the real-world map | WastelandMaps`, description, canonical: url, open: openQuery(where), heading: plain, body,
    keywords: [plain, `${plain} fallout`, `${plain} map`, `${plain} location`, `${plain} real world`, 'fallout towns', 'fallout locations', 'fallout lore map', ...t.sites.slice(0, 12).map((s) => s.name)],
    jsonLd: [{ '@context': 'https://schema.org', '@type': 'Article', headline: `${plain} (${game})`, description, mainEntityOfPage: `${SITE}${url}`, dateModified: TODAY, publisher: { '@type': 'Organization', name: 'WastelandMaps', url: SITE } }, breadcrumb([['WastelandMaps', '/'], ['Fallout lore', '/lore/'], [plain, url]])],
  }));
}
write('/lore/', render({
  title: 'Fallout towns and locations on the real-world map | WastelandMaps', canonical: '/lore/', open: '/', heading: 'Fallout lore on the real map',
  description: 'Diamond City, Goodneighbor, Megaton, Shady Sands, New Vegas and more: the towns and places from the Fallout games, put where they would stand on the real map, with the buildings the games name.',
  keywords: ['fallout locations', 'fallout towns', 'fallout lore', 'fallout canon locations', ...townSlugs.map((t) => t.label)],
  body: `<p>Towns and places from the games' stories, placed on the real map.</p><ul>${townSlugs.map((t) => li(`/lore/${t.slug}/`, t.label.replace(/\s*\(.*\)/, ''), t.label.match(/\((.*)\)/)?.[1] ?? '')).join('')}</ul><h2>Vaults</h2><p><a href="/vaults/">Every vault from the games</a></p>`,
  jsonLd: [{ '@context': 'https://schema.org', '@type': 'CollectionPage', name: 'Fallout lore on the real-world map', url: `${SITE}/lore/` }, breadcrumb([['WastelandMaps', '/'], ['Fallout lore', '/lore/']])],
}));

// ---- the landmarks list
write('/places/', render({
  title: 'Famous landmarks after the bombs: destroyed Fallout-style renders | WastelandMaps', canonical: '/places/', open: '/', heading: 'Landmarks after the bombs',
  description: `The Eiffel Tower, the Statue of Liberty, the Burj Khalifa and ${landmarks.length - 5} more famous places, each with a free or unlockable Fallout-style destroyed render, a boss and loot, on the WastelandMaps wasteland map.`,
  keywords: ['destroyed landmarks', 'post apocalyptic landmarks', 'famous landmarks destroyed', 'landmarks after nuclear war', ...landmarks.slice(0, 60).map((l) => `${l.name} destroyed`)],
  body: `<h2>Free destroyed snapshots</h2><ul class="cols">${landmarks.filter((l) => l.permanent).map((l) => li(`/place/${l.slug}/`, l.name, l.metro.name)).join('')}</ul><h2>More famous landmarks</h2><ul class="cols">${landmarks.filter((l) => !l.permanent).map((l) => li(`/place/${l.slug}/`, l.name, l.metro.name)).join('')}</ul>`,
  jsonLd: [{ '@context': 'https://schema.org', '@type': 'CollectionPage', name: 'Landmarks after the bombs', url: `${SITE}/places/` }, breadcrumb([['WastelandMaps', '/'], ['Landmarks', '/places/']])],
}));

// ---- the addresses in the atlas, and the places people have rendered that are not among the landmarks
const addressSlugs = new Set<string>();
const addressPages: { slug: string; a: AtlasAddress; metro: Metro }[] = [];
const KIND: Record<string, string> = { house: 'house or home', park: 'park', office: 'office building', church: 'church', medical: 'medical building', gov: 'government building' };
for (const a of atlas.addresses) {
  const metro = (a.metro && metros.find((m) => m.id === a.metro)) || metroOf(a.lat, a.lng);
  let slug = `${slugOf(a.address || a.name)}-${a.id.slice(-5).toLowerCase()}`;
  if (addressSlugs.has(slug)) slug += '-2';
  addressSlugs.add(slug);
  addressPages.push({ slug, a, metro });
  const url = `/address/${slug}/`;
  const label = a.address || a.name;
  const title = `${label}: destroyed in the wasteland | Fallout-style render | WastelandMaps`;
  const description = `${label} as it looks 200 years after the bombs: a Fallout-style destroyed render of this ${KIND[a.kind] ?? 'place'} in ${metro.name}, ${countryName(metro.country)}, part of the WastelandMaps atlas of destroyed addresses.`;
  const near = addressPages.filter((o) => o.a !== a && o.metro.id === metro.id).slice(0, 6);
  const body = `
<p>${esc(label)} is a ${esc(KIND[a.kind] ?? 'place')} in ${esc(metro.name)}, ${esc(countryName(metro.country))}. This is how it looks in the wasteland, in <a href="/city/${esc(metro.id)}/">${esc(metro.title)}</a>: a game-style render of the street view of the address, made by a WastelandMaps survivor and kept in the atlas for everyone.</p>
<figure><img src="${esc(a.image)}" alt="${esc(`${label} destroyed in a post-apocalyptic, Fallout-style render`)}" width="1024" loading="eager"><figcaption>${esc(label)} after the bombs. Made from Google Street View imagery.</figcaption></figure>
<h2>About this address</h2>
<ul>
<li>Address: ${esc(label)} (${a.lat.toFixed(5)}, ${a.lng.toFixed(5)}). <a href="${esc(mapsLink(a))}" rel="noopener">Show on OpenStreetMap</a></li>
<li>In the wasteland: ${esc(metro.name)} is <a href="/city/${esc(metro.id)}/">${esc(metro.title)}</a>.</li>
<li>On WastelandMaps you can unlock the destroyed snapshot of any address, fight what lives there and loot it.</li>
</ul>
${near.length ? `<h2>More destroyed addresses in ${esc(metro.name)}</h2><ul>${near.map((o) => li(`/address/${o.slug}/`, o.a.address || o.a.name)).join('')}</ul>` : ''}
<p class="fine">The atlas of destroyed addresses is built by the survivors who unlock them. WastelandMaps is an unofficial fan project.</p>`;
  write(url, render({
    title, description, canonical: url, image: a.image, imageAlt: `${label} destroyed, Fallout-style render`, open: openQuery(label), heading: label, body,
    keywords: [label, `${label} destroyed`, `${label} after the bombs`, `${label} fallout`, a.name, `${metro.name} fallout map`, `${metro.name} wasteland`, metro.title, 'destroyed address', 'post apocalyptic house', 'fallout style house render', 'my house destroyed'],
    jsonLd: [{
      '@context': 'https://schema.org', '@type': ['Place', 'LocalBusiness'].slice(0, 1), name: a.name, description,
      address: { '@type': 'PostalAddress', streetAddress: label, addressLocality: metro.name, addressCountry: metro.country },
      geo: { '@type': 'GeoCoordinates', latitude: a.lat, longitude: a.lng }, hasMap: mapsLink(a), url: `${SITE}${url}`,
      image: { '@type': 'ImageObject', contentUrl: a.image, name: `${label} destroyed (Fallout-style render)`, creditText: 'WastelandMaps survivors, from Google Street View imagery', creator: { '@type': 'Organization', name: 'WastelandMaps' } },
      isPartOf: { '@type': 'WebSite', name: 'WastelandMaps', url: SITE },
    }, breadcrumb([['WastelandMaps', '/'], ['Atlas of destroyed addresses', '/atlas/'], [label, url]])],
  }));
}
// places someone has rendered that are not among the landmarks above
const known = new Set(landmarks.map((l) => l.qid).filter(Boolean));
const extraPlaces = atlas.places.filter((p) => !known.has(p.id));
const extraPages: { slug: string; p: AtlasPlace }[] = [];
for (const p of extraPlaces) {
  const slug = uniqueSlug(slugOf(p.name), p.id);
  extraPages.push({ slug, p });
  const url = `/place/${slug}/`;
  const description = `${p.name} as it looks 200 years after the bombs: a Fallout-style destroyed render made by a WastelandMaps survivor, part of the atlas of destroyed places.`;
  const body = `
<p>${esc(p.name)} after the bombs, as a game-style render made by a WastelandMaps survivor and kept in the atlas for everyone.</p>
<figure><img src="${esc(p.image)}" alt="${esc(`${p.name} destroyed in a post-apocalyptic, Fallout-style render`)}" width="1200" loading="eager"><figcaption>${esc(p.name)} after the bombs, made from the photograph “${esc(p.photo ?? '')}” by ${esc(p.author ?? '')} (${esc(p.license ?? '')}, <a href="${esc(p.page ?? '#')}" rel="noopener">source</a>), shared under the same license.</figcaption></figure>
<ul><li><a href="https://www.wikidata.org/wiki/${esc(p.id)}" rel="noopener">${esc(p.name)} on Wikidata</a></li><li>Find it on the map, fight what lives there and loot it.</li></ul>`;
  write(url, render({
    title: `${p.name} destroyed: Fallout-style render | WastelandMaps`, description, canonical: url, image: p.image, imageAlt: `${p.name} destroyed, Fallout-style render`, open: openQuery(p.name), heading: `${p.name}, after the bombs`, body,
    keywords: [p.name, `${p.name} destroyed`, `${p.name} fallout`, `${p.name} post-apocalyptic`, 'destroyed landmark'],
    jsonLd: [{ '@context': 'https://schema.org', '@type': 'Place', name: p.name, sameAs: [`https://www.wikidata.org/wiki/${p.id}`], url: `${SITE}${url}`, image: { '@type': 'ImageObject', contentUrl: p.image, name: `${p.name} destroyed (Fallout-style render)`, creditText: `${p.author} / ${p.photo}`, license: p.page } }, breadcrumb([['WastelandMaps', '/'], ['Atlas of destroyed places', '/atlas/'], [p.name, url]])],
  }));
}
write('/atlas/', render({
  title: 'The atlas of destroyed addresses and places | WastelandMaps', canonical: '/atlas/', open: '/', heading: 'The atlas of destroyed places',
  description: `${addressPages.length + extraPages.length} real addresses and places that survivors have turned into Fallout-style destroyed renders, built a render at a time by the people who play WastelandMaps.`,
  keywords: ['destroyed addresses', 'post apocalyptic house render', 'my street after the bombs', 'fallout style house', 'destroyed places atlas'],
  body: `<p>Every address and place a survivor unlocks joins the atlas, and everyone who looks it up sees the same picture.</p>${addressPages.length ? `<h2>Addresses</h2><ul class="cols">${addressPages.map((o) => li(`/address/${o.slug}/`, o.a.address || o.a.name, o.metro.name)).join('')}</ul>` : ''}${extraPages.length ? `<h2>Places</h2><ul class="cols">${extraPages.map((o) => li(`/place/${o.slug}/`, o.p.name)).join('')}</ul>` : ''}`,
  jsonLd: [{ '@context': 'https://schema.org', '@type': 'CollectionPage', name: 'The atlas of destroyed places', url: `${SITE}/atlas/` }, breadcrumb([['WastelandMaps', '/'], ['Atlas', '/atlas/']])],
}));

// ---- the cities
const landmarksByMetro = new Map<string, Landmark[]>();
for (const l of landmarks) landmarksByMetro.set(l.metro.id, [...(landmarksByMetro.get(l.metro.id) ?? []), l]);
for (const m of metros) {
  const country = countryName(m.country);
  const where = `${m.name}, ${country}`;
  const url = `/city/${m.id}/`;
  const here = landmarksByMetro.get(m.id) ?? [];
  const vaultsHere = LORE_VAULTS.filter((v) => v.metro === m.id);
  const towns = townSlugs.filter((t) => t.metro.id === m.id);
  const description = `${where} as a Fallout-style wasteland: ${m.title}. ${m.places.toLocaleString('en-US')} places with wasteland names, vaults, irradiated zones, bosses and loot${here.length ? `, including ${here.slice(0, 3).map((l) => l.name).join(', ')}` : ''}. Fast travel and unlock destroyed snapshots on WastelandMaps.`;
  const body = `
<p>${esc(where)} is <b>${esc(m.title)}</b> on WastelandMaps, the unofficial Fallout-style map of the real world${m.pop >= 1000 ? ` (about ${(m.pop / 1_000_000).toFixed(1)} million people before the bombs)` : ''}. ${m.places.toLocaleString('en-US')} of its real places are marked with wasteland names, enemies and loot, along with the vaults, irradiated zones and flooded coasts of the new world.</p>
${vaultsHere.length ? `<h2>Fallout vaults in ${esc(m.name)}</h2><ul>${vaultsHere.map((v) => li(`/vault/${v.number}/`, `Vault ${v.number}`, v.game)).join('')}</ul>` : ''}
${towns.length ? `<h2>Fallout towns in ${esc(m.name)}</h2><ul>${towns.map((t) => li(`/lore/${t.slug}/`, t.label.replace(/\s*\(.*\)/, ''))).join('')}</ul>` : ''}
${here.length ? `<h2>Landmarks in ${esc(m.name)}</h2><ul>${here.map((l) => li(`/place/${l.slug}/`, l.name)).join('')}</ul>` : ''}`;
  write(url, render({
    title: `${m.title} (${where}): the city after the bombs | Fallout-style map | WastelandMaps`, description, canonical: url, open: openQuery(where), heading: `${m.title}`, body,
    keywords: [`${m.name} fallout`, `${m.name} fallout map`, `${m.name} wasteland`, `${m.name} after the bombs`, `${m.name} post-apocalyptic map`, m.title, `${m.name} ${country}`, `${m.name} vault`, `${m.name} nuclear`, `${country} fallout map`],
    jsonLd: [{ '@context': 'https://schema.org', '@type': 'Place', name: where, alternateName: m.title, geo: { '@type': 'GeoCoordinates', latitude: m.lat, longitude: m.lng }, address: { '@type': 'PostalAddress', addressLocality: m.name, addressCountry: m.country }, url: `${SITE}${url}` }, breadcrumb([['WastelandMaps', '/'], ['Cities', '/cities/'], [m.title, url]])],
  }));
}
const byCountry = new Map<string, Metro[]>();
for (const m of metros) byCountry.set(m.country, [...(byCountry.get(m.country) ?? []), m]);
write('/cities/', render({
  title: 'Every city as a Fallout wasteland: the WastelandMaps city list', canonical: '/cities/', open: '/', heading: 'Cities after the bombs',
  description: `${metros.length.toLocaleString('en-US')} cities around the world, each turned into a Fallout-style wasteland with its own post-apocalyptic name, vaults, landmarks and loot.`,
  keywords: ['fallout city map', 'post apocalyptic city names', 'your city fallout', 'fallout wasteland names', 'city after nuclear war'],
  body: [...byCountry.entries()].sort((a, b) => countryName(a[0]).localeCompare(countryName(b[0]))).map(([c, list]) => `<h2>${esc(countryName(c))}</h2><ul class="cols">${list.sort((a, b) => b.pop - a.pop).map((m) => li(`/city/${m.id}/`, m.title, m.name)).join('')}</ul>`).join('\n'),
  jsonLd: [{ '@context': 'https://schema.org', '@type': 'CollectionPage', name: 'Cities after the bombs', url: `${SITE}/cities/` }, breadcrumb([['WastelandMaps', '/'], ['Cities', '/cities/']])],
}));

// ---- the sitemap
const urls = ['/', '/places/', '/vaults/', '/lore/', '/cities/', '/atlas/', ...written.filter((u) => !['/places/', '/vaults/', '/lore/', '/cities/', '/atlas/'].includes(u))];
const priority = (u: string) => (u === '/' ? '1.0' : /^\/(places|vaults|lore|cities|atlas)\/$/.test(u) ? '0.8' : /^\/(place|vault|lore|address)\//.test(u) ? '0.7' : '0.5');
const imageOf = new Map<string, string>([
  ...landmarks.filter((l) => l.permanent && l.qid).map((l) => [`/place/${l.slug}/`, `${SITE}/renders/${l.qid}.png`] as [string, string]),
  ...landmarks.filter((l) => !l.permanent && l.pubImage).map((l) => [`/place/${l.slug}/`, l.pubImage as string] as [string, string]),
  ...addressPages.map((o) => [`/address/${o.slug}/`, o.a.image] as [string, string]),
  ...extraPages.map((o) => [`/place/${o.slug}/`, o.p.image] as [string, string]),
]);
const entry = (u: string) => `<url><loc>${SITE}${u}</loc><lastmod>${TODAY}</lastmod><priority>${priority(u)}</priority>${imageOf.has(u) ? `<image:image><image:loc>${imageOf.get(u)}</image:loc></image:image>` : ''}</url>`;
fs.writeFileSync(path.join(OUT, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n${[...new Set(urls)].map(entry).join('\n')}\n</urlset>\n`);
console.log(`seo: ${written.length} pages (${addressPages.length} addresses, ${extraPages.length} more places, ${landmarks.length} landmarks, ${LORE_VAULTS.length} vaults, ${LORE_TOWNS.length} towns, ${metros.length} cities) + sitemap.xml in ${OUT}`);
