// Builds the pre-made wasteland: for every metro area of a given size, a handful of notable real places with their wasteland identity.
//
//   npx tsx _tools/build-metros.ts            # all metros (resumable: raw answers are kept in _data/raw)
//   npx tsx _tools/build-metros.ts Boston     # only metros whose name matches
//
// Sources, all free to store and reuse: GeoNames city populations (CC BY 4.0) to find the metros, Wikidata (CC0) for the places.
// No Google data is used or stored. Output: public/data/metros/<id>.json and public/data/index.json.

import fs from 'node:fs';
import path from 'node:path';
import { wastelandName } from '../src/lib/lore.ts';
import { distanceMeters, hashString } from '../src/lib/wasteland.ts';

const ROOT = path.resolve(import.meta.dirname, '..');
const RAW = path.join(ROOT, '_data', 'raw');
const OUT = path.join(ROOT, 'public', 'data');
fs.mkdirSync(RAW, { recursive: true });
fs.mkdirSync(path.join(OUT, 'metros'), { recursive: true });

// ---- which countries use the lower line ----
// North America, Europe, Australia, China, Japan, South Korea, New Zealand, Argentina, Uruguay and Brazil: metros of 100,000 or more.
// Everywhere else: 500,000 or more.
const LOW_LINE = new Set([
  'US', 'CA', 'MX',
  'AL', 'AD', 'AT', 'BY', 'BE', 'BA', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IS', 'IE', 'IT', 'XK', 'LV', 'LI', 'LT', 'LU',
  'MT', 'MD', 'MC', 'ME', 'NL', 'MK', 'NO', 'PL', 'PT', 'RO', 'RU', 'SM', 'RS', 'SK', 'SI', 'ES', 'SE', 'CH', 'UA', 'GB', 'VA',
  'AU', 'CN', 'HK', 'MO', 'JP', 'KR', 'NZ', 'AR', 'UY', 'BR',
]);
const thresholdFor = (country: string) => (LOW_LINE.has(country) ? 100_000 : 500_000);

// ---- 1. metros from city populations ----
interface City { name: string; lat: number; lng: number; country: string; admin1: string; pop: number }
const cities: City[] = fs.readFileSync(path.join(ROOT, '_data', 'cities15000.txt'), 'utf8').split('\n').filter(Boolean).map((line) => {
  const f = line.split('\t');
  return { name: f[1], lat: Number(f[4]), lng: Number(f[5]), country: f[8], admin1: f[10], pop: Number(f[14]) };
}).filter((c) => c.pop > 0);

interface Metro { id: string; city: City; pop: number; radiusKm: number; members: number }
/** The big city's pull: bigger cities gather suburbs from farther away. */
const reachKm = (pop: number) => 20 + 10 * Math.log10(Math.max(pop, 100_000) / 100_000);

function findMetros(): Metro[] {
  const sorted = [...cities].sort((a, b) => b.pop - a.pop);
  const centers: Metro[] = [];
  for (const city of sorted) {
    let home: Metro | null = null;
    let best = Infinity;
    for (const m of centers) {
      if (Math.abs(m.city.lat - city.lat) > m.radiusKm / 111 + 0.01) continue; // cheap check first
      const d = distanceMeters(m.city, city) / 1000;
      if (d <= m.radiusKm && d < best) { best = d; home = m; }
    }
    if (home) { home.pop += city.pop; home.members += 1; continue; }
    centers.push({ id: '', city, pop: city.pop, radiusKm: reachKm(city.pop), members: 1 });
  }
  const used = new Set<string>();
  return centers.filter((m) => m.pop >= thresholdFor(m.city.country)).map((m) => {
    const base = `${m.city.country}-${m.city.admin1 || 'x'}-${m.city.name}`.toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || `m${hashString(m.city.name)}`;
    let id = base;
    for (let i = 2; used.has(id); i++) id = `${base}-${i}`;
    used.add(id);
    return { ...m, id };
  });
}

// ---- 2. what kind of place a Wikidata class is ----
const NOT_A_PLACE = /\b(event|battle|siege|massacre|trials?|incident|riot|protest|disaster|accident|bombings?|attacks?|terror[a-z]*|conflict|occurrence|campaign|expedition|festival|election|murder|disappearance|death|assassination|shooting|crime|scandal|hoax|tournament|games|world cup|cup|championship|competition|contest|season|chain|brand|company|corporation|business|enterprise|retailer|dynasty|empire|kingdom|treaty|language|dialect|religion|ethnic|department|republic|county|municipality|commune|province|prefecture|region|country|state|arrondissement|human settlement|census|township|constituency|supercomputer|computer|dataset|newspaper|television|radio|publication|album|film|painting|database|website|software|league|team|political|ideology|term|list)\b/i;
// what an uncategorized place has to be to count as a landmark: a structure, a monument, a famous square or street
const LANDMARK = /\b(tower|skyscraper|building|monument|memorial|statue|sculpture|arch|triumphal|gate|bridge|palace|castle|chateau|château|fortress|citadel|ruins?|archaeolog[a-z]*|landmark|attraction|avenue|boulevard|promenade|pier|lighthouse|dam|windmill|theatre|theater|opera|amphitheat[a-z]*|pyramid|obelisk|fountain|mausoleum|tomb|heritage|historic|observation|ferris|mill|prison|pavilion|villa|manor|mansion|house|complex|cross|column|wall|garden|estate|temple|tourist|viewpoint|market hall|hall|walk|bazaar|shopping street|pedestrian|district)\b/i;
/** How much a kind of place counts toward being picked: the famous and the visitable first, the everyday after. */
const WEIGHT: Record<string, number> = { other: 1.5, arena: 1.2, guard: 1.2, chapel: 1.2, park: 1.0, school: 0.8, medical: 0.7, cantina: 0.7, transit: 0.6, lodging: 0.6, market: 0.5, fuel: 0.4 };
const CATEGORY_WORDS: [string, RegExp][] = [
  ['medical', /\b(hospital|clinic|medical|pharmacy|health|sanatorium|dispensary)\b/i],
  ['school', /\b(school|university|college|library|academy|institute|campus|archive|observatory|laborator)/i],
  ['market', /\b(supermarket|shopping|mall|market|department store|store|shop|bazaar|arcade|souk)\b/i],
  ['fuel', /\b(gas station|petrol|fuel|filling station|garage|car dealer|factory|plant|refinery)\b/i],
  ['park', /\b(park|garden|nature|forest|reserve|beach|botanical|cemetery|zoo\b(?! park)|recreation|playground|square|plaza|common)\b/i],
  ['guard', /\b(police|fire station|city hall|town hall|courthouse|court|government|embassy|prison|jail|castle|fort|barracks|military|parliament|capitol|palace|legislat|ministry|consulate|customs)\b/i],
  ['cantina', /\b(restaurant|bar\b|cafe|café|pub|brewery|winery|tavern|diner|club|nightclub|distillery)\b/i],
  ['chapel', /\b(church|cathedral|mosque|synagogue|temple|shrine|monastery|basilica|abbey|chapel|pagoda|gurdwara|minaret|mission)\b/i],
  ['transit', /\b(airport|railway station|train station|metro station|subway station|bus station|terminal|station|port\b|harbou?r|ferry|bridge|heliport|pier)\b/i],
  ['arena', /\b(stadium|arena|museum|amusement|theme park|cinema|theatre|theater|aquarium|sports|racecourse|race track|speedway|opera|concert|gallery|casino|ballpark|velodrome|convention|exhibition)\b/i],
  ['lodging', /\b(hotel|motel|resort|hostel|inn\b|lodge)\b/i],
];
function categoryOf(classLabels: string[]): string | null {
  if (classLabels.some((l) => NOT_A_PLACE.test(l))) return null;
  for (const [id, re] of CATEGORY_WORDS) if (classLabels.some((l) => re.test(l))) return id;
  return classLabels.some((l) => LANDMARK.test(l)) ? 'other' : null;
}

// ---- 3. asking Wikidata ----
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
interface Row { item: string; label: string; sl: number; lat: number; lng: number; klass: string }

async function sparql(query: string, tries = 5): Promise<{ results: { bindings: Record<string, { value: string }>[] } }> {
  for (let attempt = 1; attempt <= tries; attempt++) {
    try {
      const res = await fetch('https://query.wikidata.org/sparql?' + new URLSearchParams({ query, format: 'json' }), {
        headers: { 'User-Agent': 'WastelandMaps/1.0 (fan project; metro place builder)', Accept: 'application/sparql-results+json' },
        signal: AbortSignal.timeout(70_000),
      });
      if (res.status === 429 || res.status >= 500) {
        const wait = Number(res.headers.get('retry-after')) * 1000 || 5000 * attempt;
        await sleep(wait);
        continue;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (e) {
      if (attempt === tries) throw e;
      await sleep(4000 * attempt);
    }
  }
  throw new Error('unreachable');
}

async function fetchRows(metro: Metro, minSitelinks: number): Promise<Row[]> {
  const cache = path.join(RAW, `${metro.id}.${minSitelinks}.json`);
  if (fs.existsSync(cache)) return JSON.parse(fs.readFileSync(cache, 'utf8')) as Row[];
  const radius = Math.min(metro.radiusKm, 45);
  const query = `SELECT ?item ?itemLabel ?sl ?coord ?classLabel WHERE {
  SERVICE wikibase:around { ?item wdt:P625 ?coord . bd:serviceParam wikibase:center "Point(${metro.city.lng} ${metro.city.lat})"^^geo:wktLiteral . bd:serviceParam wikibase:radius "${radius}" . }
  ?item wikibase:sitelinks ?sl . FILTER(?sl >= ${minSitelinks})
  ?item wdt:P31 ?class .
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en,mul,fr,de,es,pt,it,nl,ru,ja,zh,ko". }
} LIMIT 10000`;
  const data = await sparql(query);
  const rows: Row[] = [];
  for (const b of data.results.bindings) {
    const m = /Point\(([-\d.e]+) ([-\d.e]+)\)/.exec(b.coord.value);
    if (!m) continue;
    rows.push({ item: b.item.value.split('/').pop() as string, label: b.itemLabel.value, sl: Number(b.sl.value), lat: Number(m[2]), lng: Number(m[1]), klass: b.classLabel.value });
  }
  fs.writeFileSync(cache, JSON.stringify(rows));
  return rows;
}

// ---- 4. choosing the places ----
interface Place { id: string; name: string; lat: number; lng: number; category: string; sl: number }

/** How many places a metro gets: about 4.5 per 100,000 people, never fewer than 4 and never more than 600 (the biggest metros would otherwise be huge files). */
const wanted = (pop: number) => Math.min(600, Math.max(4, Math.round((pop / 100_000) * 4.5)));

function choose(metro: Metro, rows: Row[]): Place[] {
  const byItem = new Map<string, { row: Row; classes: string[] }>();
  for (const r of rows) {
    const hit = byItem.get(r.item);
    if (hit) hit.classes.push(r.klass);
    else byItem.set(r.item, { row: r, classes: [r.klass] });
  }
  const candidates: Place[] = [];
  for (const { row, classes } of byItem.values()) {
    if (/^Q\d+$/.test(row.label)) continue; // no readable name
    if (distanceMeters(metro.city, row) / 1000 > metro.radiusKm) continue;
    const category = categoryOf(classes);
    if (!category) continue;
    candidates.push({ id: row.item, name: row.label, lat: row.lat, lng: row.lng, category, sl: row.sl * (WEIGHT[category] ?? 1) });
  }
  candidates.sort((a, b) => b.sl - a.sl);

  const n = wanted(metro.pop);
  const area = Math.PI * Math.min(metro.radiusKm, 45) ** 2;
  let gapKm = 0.3 * Math.sqrt(area / n);
  const picked: Place[] = [];
  // most notable first, but each place keeps its distance from the others so the whole metro is covered
  const perCategory = new Map<string, number>();
  const capPerCategory = Math.max(2, Math.ceil(n * 0.22));
  for (let pass = 0; pass < 8 && picked.length < n; pass++) {
    // the first passes keep any one kind of place (universities, airports) from crowding out the rest
    const capped = pass < 4;
    for (const c of candidates) {
      if (picked.length >= n) break;
      if (picked.includes(c)) continue;
      if (capped && c.category !== 'other' && (perCategory.get(c.category) ?? 0) >= capPerCategory) continue;
      if (picked.every((p) => distanceMeters(p, c) / 1000 >= gapKm)) { picked.push(c); perCategory.set(c.category, (perCategory.get(c.category) ?? 0) + 1); }
    }
    gapKm *= pass % 2 === 1 ? 0.65 : 1;
  }
  return picked;
}

// ---- 5. run ----
const only = process.argv[2]?.toLowerCase();
const metros = findMetros().filter((m) => !only || m.city.name.toLowerCase().includes(only));
console.log(`${metros.length} metros`);

interface IndexEntry { id: string; name: string; country: string; lat: number; lng: number; pop: number; radiusKm: number; title: string; canon: boolean; places: number }
const indexPath = path.join(OUT, 'index.json');
const index = new Map<string, IndexEntry>();
if (fs.existsSync(indexPath)) for (const e of JSON.parse(fs.readFileSync(indexPath, 'utf8')) as IndexEntry[]) index.set(e.id, e);

let done = 0;
for (const metro of metros) {
  done += 1;
  const file = path.join(OUT, 'metros', `${metro.id}.json`);
  if (fs.existsSync(file) && index.has(metro.id) && !process.env.REBUILD) continue;
  const n = wanted(metro.pop);
  let places: Place[] = [];
  try {
    // start with the notable places; if there are not enough, let less famous ones in
    for (const minSl of metro.pop > 5_000_000 ? [12, 8, 5, 3] : metro.pop > 1_000_000 ? [8, 5, 3, 2] : [4, 3, 2, 1]) {
      const rows = await fetchRows(metro, minSl);
      await sleep(900);
      places = choose(metro, rows);
      if (places.length >= n) break;
    }
  } catch (e) {
    console.log(`  ${metro.city.name}: failed (${e instanceof Error ? e.message : e}), will retry next run`);
    continue;
  }
  const title = wastelandName(metro.city.name, metro.city.admin1);
  const body = {
    id: metro.id, name: metro.city.name, country: metro.city.country, center: [metro.city.lat, metro.city.lng], pop: metro.pop, radiusKm: Math.round(metro.radiusKm), title: title.name,
    places: places.map((p) => [p.id, p.name, Number(p.lat.toFixed(5)), Number(p.lng.toFixed(5)), p.category]),
  };
  fs.writeFileSync(file, JSON.stringify(body));
  index.set(metro.id, { id: metro.id, name: metro.city.name, country: metro.city.country, lat: metro.city.lat, lng: metro.city.lng, pop: metro.pop, radiusKm: Math.round(metro.radiusKm), title: title.name, canon: title.canon, places: places.length });
  // written to a side file and renamed, so a page loading the index mid-build never sees half a file
  fs.writeFileSync(`${indexPath}.tmp`, JSON.stringify([...index.values()].sort((a, b) => b.pop - a.pop)));
  fs.renameSync(`${indexPath}.tmp`, indexPath);
  console.log(`[${done}/${metros.length}] ${metro.city.name}, ${metro.city.country}: ${(metro.pop / 1e6).toFixed(2)}M -> ${places.length}/${n} places, "${title.name}"`);
}
console.log('done');
