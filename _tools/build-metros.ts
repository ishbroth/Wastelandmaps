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
const LANDMARK = /\b(tower|skyscraper|building|monument|memorial|statue|sculpture|arch|triumphal|gate|bridge|palace|castle|chateau|château|fortress|citadel|ruins?|archaeolog[a-z]*|landmark|attraction|avenue|boulevard|promenade|pier|lighthouse|dam|windmill|theatre|theater|opera|amphitheat[a-z]*|pyramid|obelisk|fountain|mausoleum|tomb|heritage|historic|observation|ferris|mill|prison|pavilion|villa|manor|mansion|house|complex|cross|column|wall|garden|estate|temple|tourist|viewpoint|market hall|hall|walk|bazaar|shopping street|pedestrian|district|neighbou?rhood|quarter|chinatown|little italy|amusement park|theme park|zoo|aquarium|stadium|racecourse|circus|market|shopping|restaurant|diner)\b/i;
/** How much a kind of place counts toward being picked: the famous and the visitable first, the everyday after. */
const WEIGHT: Record<string, number> = { other: 1.6, arena: 1.2, guard: 1.1, chapel: 1.0, park: 1.0, school: 0.9, medical: 0.8, cantina: 1.2, market: 1.2, lodging: 0.9, transit: 0.6, fuel: 0.6 };
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

/** Bump when the rules for choosing places change, so the next run redoes every metro. */
const SELECTION_VERSION = 3;

// ---- 4. choosing the places ----
interface Place { id: string; name: string; lat: number; lng: number; category: string; sl: number; fame: number; station: boolean; neighborhood: boolean }

/** How many places a metro gets: about 5 per 100,000 people, never fewer than 4 and never more than 600 (the biggest metros would otherwise be huge files). */
const wanted = (pop: number) => Math.min(600, Math.max(4, Math.round((pop / 100_000) * 4.95)));

/** How the places of a metro are shared out among the kinds of place: landmarks, towers and neighborhoods first, shops and restaurants next. */
const SHARE: Record<string, number> = { other: 0.28, arena: 0.09, market: 0.09, cantina: 0.08, school: 0.09, park: 0.08, chapel: 0.07, guard: 0.06, medical: 0.05, lodging: 0.04, transit: 0.05, fuel: 0.0 };
/** The most of any one kind (a share of the metro's places): the everyday kinds never crowd out the rest. */
const CAP: Record<string, number> = { school: 0.13, chapel: 0.09, transit: 0.06, park: 0.11, medical: 0.07, fuel: 0.02, cantina: 0.14, market: 0.14, lodging: 0.07, guard: 0.1, arena: 0.14 };

// which places have a photo of themselves on Wikidata (the place's snapshot is made from it), remembered between runs
const imageFile = path.join(ROOT, '_data', 'p18.json');
const hasImage: Record<string, 0 | 1> = fs.existsSync(imageFile) ? (JSON.parse(fs.readFileSync(imageFile, 'utf8')) as Record<string, 0 | 1>) : {};
async function learnImages(ids: string[]): Promise<void> {
  const todo = ids.filter((id) => hasImage[id] === undefined);
  for (let i = 0; i < todo.length; i += 250) {
    const batch = todo.slice(i, i + 250);
    const data = await sparql('SELECT ?item WHERE { VALUES ?item { ' + batch.map((id) => 'wd:' + id).join(' ') + ' } ?item wdt:P18 ?image . }');
    const withImage = new Set(data.results.bindings.map((b) => b.item.value.split('/').pop() as string));
    for (const id of batch) hasImage[id] = withImage.has(id) ? 1 : 0;
    fs.writeFileSync(imageFile, JSON.stringify(hasImage));
    await sleep(700);
  }
}

function candidatesOf(metro: Metro, rows: Row[]): Place[] {
  const byItem = new Map<string, { row: Row; classes: string[] }>();
  for (const r of rows) {
    const hit = byItem.get(r.item);
    if (hit) hit.classes.push(r.klass);
    else byItem.set(r.item, { row: r, classes: [r.klass] });
  }
  const out: Place[] = [];
  for (const { row, classes } of byItem.values()) {
    if (/^Q\d+$/.test(row.label)) continue; // no readable name
    if (distanceMeters(metro.city, row) / 1000 > metro.radiusKm) continue;
    const category = categoryOf(classes);
    if (!category) continue;
    // a station counts for much less than a bridge or an airport: every stop of a subway line is not a landmark
    const station = category === 'transit' && classes.some((l) => /station|stop|terminal|metro|subway|underground|tram|halt/i.test(l));
    const neighborhood = category === 'other' && classes.some((l) => /neighbou?rhood|quarter|district|chinatown|little italy|village|borough|suburb/i.test(l));
    const weight = (WEIGHT[category] ?? 1) * (station ? 0.5 : 1);
    out.push({ id: row.item, name: row.label, lat: row.lat, lng: row.lng, category, sl: row.sl * weight, fame: row.sl, station, neighborhood });
  }
  return out.sort((x, y) => y.sl - x.sl);
}

async function choose(metro: Metro, rows: Row[]): Promise<Place[]> {
  const n = wanted(metro.pop);
  const all = candidatesOf(metro, rows);
  // look at the best few times what is needed, and prefer the ones that have a photo to make a snapshot from
  const pool = all.slice(0, Math.min(2600, n * 4 + 20));
  await learnImages(pool.map((c) => c.id));
  for (const c of pool) if (!hasImage[c.id]) c.sl *= 0.3;
  pool.sort((x, y) => y.sl - x.sl);

  const area = Math.PI * Math.min(metro.radiusKm, 45) ** 2;
  const baseGap = 0.42 * Math.sqrt(area / n);
  const picked: Place[] = [];
  const count = (cat: string) => picked.filter((p) => p.category === cat).length;
  // stops of a line: about 3% of a metro's places, a little more only if the metro has hardly anything else to show
  let stationShare = 0.03;
  const stations = () => picked.filter((p) => p.station).length;
  const neighborhoods = () => picked.filter((p) => p.neighborhood).length;
  const room = (c: Place, gap: number) => picked.every((q) => distanceMeters(q, c) / 1000 >= gap);
  const take = (c: Place, limit: number, gap: number, strict: boolean) => {
    if (picked.length >= n || picked.includes(c)) return false;
    if (strict && count(c.category) >= Math.max(2, Math.ceil(n * (CAP[c.category] ?? 0.2)))) return false;
    if (c.station && stations() >= Math.max(2, Math.round(n * stationShare))) return false; // not every stop of a line
    if (c.neighborhood && neighborhoods() >= Math.max(2, Math.round(n * (strict ? 0.12 : 0.18)))) return false;
    if (count(c.category) >= limit) return false;
    if (!room(c, gap)) return false;
    picked.push(c);
    return true;
  };

  // 1. each kind of place gets its share, landmarks and towers first, spread out over the metro
  for (const gapFactor of [1, 0.65, 0.4]) {
    for (const cat of Object.keys(SHARE)) {
      const quota = Math.round(n * SHARE[cat]);
      for (const c of pool) if (c.category === cat) take(c, quota, baseGap * gapFactor, true);
    }
  }
  // 2. anything left over goes to the best of what remains, within the caps
  for (const gapFactor of [1, 0.65, 0.4]) {
    for (const c of pool) take(c, n, baseGap * gapFactor, true);
  }
  // 3. a small metro with little on Wikidata: relax the caps rather than leave it bare
  // (buildings, monuments and the like before more neighborhoods)
  const others = all.filter((c) => !c.neighborhood);
  for (const factor of [0.3, 0.15, 0.06]) for (const c of others) take(c, n, baseGap * factor, false);
  for (const factor of [0.3, 0.15, 0.06]) for (const c of all) take(c, n, baseGap * factor, false);
  stationShare = 0.07;
  for (const factor of [0.3, 0.15, 0.06]) for (const c of all) take(c, n, baseGap * factor, false);
  return picked;
}

// ---- 5. run ----
const only = process.argv[2]?.toLowerCase();
const metros = findMetros().filter((m) => !only || m.city.name.toLowerCase().includes(only));
console.log(`${metros.length} metros`);

interface IndexEntry { id: string; name: string; country: string; lat: number; lng: number; pop: number; radiusKm: number; title: string; canon: boolean; places: number; v?: number }
const indexPath = path.join(OUT, 'index.json');
const index = new Map<string, IndexEntry>();
if (fs.existsSync(indexPath)) for (const e of JSON.parse(fs.readFileSync(indexPath, 'utf8')) as IndexEntry[]) index.set(e.id, e);

let done = 0;
for (const metro of metros) {
  done += 1;
  const file = path.join(OUT, 'metros', `${metro.id}.json`);
  // metros already made with the current selection rules are skipped, so a stopped run can be resumed; REBUILD=1 redoes everything
  if (fs.existsSync(file) && index.get(metro.id)?.v === SELECTION_VERSION && !process.env.REBUILD) continue;
  const n = wanted(metro.pop);
  let places: Place[] = [];
  try {
    // start with the notable places; if there are not enough, let less famous ones in
    for (const minSl of metro.pop > 5_000_000 ? [12, 8, 5, 3] : metro.pop > 1_000_000 ? [8, 5, 3, 2] : [4, 3, 2, 1]) {
      const saved = fs.existsSync(path.join(RAW, `${metro.id}.${minSl}.json`));
      const rows = await fetchRows(metro, minSl);
      if (!saved) await sleep(900); // be gentle with Wikidata, but only when we actually asked it
      places = await choose(metro, rows);
      if (places.length >= n) break;
    }
  } catch (e) {
    console.log(`  ${metro.city.name}: failed (${e instanceof Error ? e.message : e}), will retry next run`);
    continue;
  }
  const title = wastelandName(metro.city.name, metro.city.admin1, metro.city.country, metro.pop);
  const body = {
    id: metro.id, name: metro.city.name, country: metro.city.country, center: [metro.city.lat, metro.city.lng], pop: metro.pop, radiusKm: Math.round(metro.radiusKm), title: title.name,
    places: places.map((p) => [p.id, p.name, Number(p.lat.toFixed(5)), Number(p.lng.toFixed(5)), p.category, Math.min(999, p.fame), p.neighborhood ? 1 : 0]),
  };
  fs.writeFileSync(file, JSON.stringify(body));
  index.set(metro.id, { id: metro.id, name: metro.city.name, country: metro.city.country, lat: metro.city.lat, lng: metro.city.lng, pop: metro.pop, radiusKm: Math.round(metro.radiusKm), title: title.name, canon: title.canon, places: places.length, v: SELECTION_VERSION });
  // written to a side file and renamed, so a page loading the index mid-build never sees half a file
  fs.writeFileSync(`${indexPath}.tmp`, JSON.stringify([...index.values()].sort((a, b) => b.pop - a.pop)));
  // Windows will not replace a file something is reading: try a few times, then write it in place
  for (let attempt = 1; ; attempt++) {
    try { fs.renameSync(`${indexPath}.tmp`, indexPath); break; } catch (e) {
      if (attempt >= 5) { fs.copyFileSync(`${indexPath}.tmp`, indexPath); break; }
      await sleep(150 * attempt);
      void e;
    }
  }
  console.log(`[${done}/${metros.length}] ${metro.city.name}, ${metro.city.country}: ${(metro.pop / 1e6).toFixed(2)}M -> ${places.length}/${n} places, "${title.name}"`);
}
console.log('done');
