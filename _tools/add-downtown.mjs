// Adds one to three downtown buildings (skyscrapers, office towers, hotels, clock towers, plazas and town squares, condo towers...) to every metro under 2 million people,
// on top of the places it already has: a real building that stands in the middle of the city (within about 2.5 km of the metro's center), taken from Wikidata.
//
//   node _tools/add-downtown.mjs plan      picks them from the Wikidata files already on disk (_data/raw) and writes _data/downtown-plan.json
//   node _tools/add-downtown.mjs fetch     asks Wikidata about the downtowns the files did not cover (a few at a time, remembered between runs), then plans again
//   node _tools/add-downtown.mjs apply     adds the planned places to public/data/metros/*.json and the counts in public/data/index.json
//
// How many: 1 for a metro under 200,000 people, 2 under 500,000, 3 above. A place is never added twice (a metro's file already holding it keeps it as it is).
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const RAW = path.join(ROOT, '_data', 'raw');
const METROS = path.join(ROOT, 'public', 'data', 'metros');
const INDEX = path.join(ROOT, 'public', 'data', 'index.json');
const PLAN = path.join(ROOT, '_data', 'downtown-plan.json');
const P18 = path.join(ROOT, '_data', 'p18.json');
const REACH_M = 2500;

// what a downtown building is, by the kinds Wikidata gives it: score (taller and more central first) and the map category it is shown as
const KINDS = [
  [/skyscraper/i, 6, 'other'],
  [/high-?rise|tower block|tall building|multi-?stor/i, 5, 'other'],
  [/office building|office tower|office block|headquarters|commercial building|business (?:centre|center)|bank building/i, 4, 'other'],
  [/hotel|resort/i, 4, 'lodging'],
  [/clock tower|campanile|bell tower|clock/i, 4, 'other'],
  [/apartment|condominium|residential (?:building|tower)|housing/i, 3, 'other'],
  [/town square|public square|city square|market square|main square|plaza|civic (?:centre|center)/i, 3, 'other'],
  [/\btower\b/i, 3, 'other'],
];
const NOT = /water tower|radio|television|transmission|observation|lighthouse|cooling|church|chapel|school|hospital|prison|castle|fort\b|stadium|mosque|temple|synagogue|cemetery|gas station|telephone|numbering|district|electoral/i;
const NAME_NOT = /^Q\d+$|congressional district|legislative district|school district|area codes?\b|zip codes?|postal code|time zone|telephone|numbering plan/i;

const readJson = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
const metros = readJson(INDEX).filter((m) => m.pop < 2e6);
const wantedFor = (pop) => (pop < 200_000 ? 1 : pop < 500_000 ? 2 : 3);
const dist = (a, b) => { const R = 6371000, r = Math.PI / 180; return R * Math.hypot((b.lng - a.lng) * r * Math.cos(a.lat * r), (b.lat - a.lat) * r); };
const hasImage = fs.existsSync(P18) ? readJson(P18) : {};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const filesById = (() => { const m = new Map(); for (const f of fs.readdirSync(RAW)) { const id = f.split('.')[0]; if (!m.has(id)) m.set(id, []); m.get(id).push(f); } return m; })();

/** Every row the files on disk hold for a metro, within reach of its center, grouped by item. */
function candidatesOf(metro) {
  const byItem = new Map();
  for (const f of filesById.get(metro.id) ?? []) {
    let rows;
    try { rows = readJson(path.join(RAW, f)); } catch { continue; }
    if (!Array.isArray(rows)) continue;
    for (const r of rows) {
      if (r.lat === undefined || NAME_NOT.test(r.label) || dist(metro, r) > REACH_M) continue;
      const hit = byItem.get(r.item);
      if (hit) hit.classes.add(r.klass); else byItem.set(r.item, { row: r, classes: new Set([r.klass]) });
    }
  }
  const out = [];
  for (const { row, classes } of byItem.values()) {
    const list = [...classes];
    if (list.some((c) => NOT.test(c))) continue;
    let best = null;
    for (const c of list) for (const [re, score, category] of KINDS) if (re.test(c) && (!best || score > best.score)) best = { score, category };
    if (!best) continue;
    out.push({ id: row.item, name: row.label, lat: row.lat, lng: row.lng, sl: row.sl, score: best.score, category: best.category, km: dist(metro, row) / 1000 });
  }
  return out;
}

// a hotel is a downtown building too, but a tower, a skyscraper or a clock tower comes first (a hotel's name gives it the bed icon on the map): hotels rank below them
const rank = (c) => (c.category === 'lodging' ? Math.min(c.score, 2.6) : c.score) * 10 + Math.min(c.sl, 15) * 2 + (hasImage[c.id] ? 8 : 0) - c.km * 2;

function plan() {
  const result = {};
  let covered = 0, empty = [];
  const meta = fs.existsSync(path.join(ROOT, '_data', 'downtown-fetched.json')) ? readJson(path.join(ROOT, '_data', 'downtown-fetched.json')) : {};
  for (const m of metros) {
    const file = path.join(METROS, m.id + '.json');
    if (!fs.existsSync(file)) continue;
    const have = new Set(readJson(file).places.map((p) => p[0]));
    const extra = meta[m.id] ?? [];
    const pool = new Map();
    for (const c of [...candidatesOf(m), ...extra]) if (!have.has(c.id) && !pool.has(c.id)) pool.set(c.id, c);
    const picked = [...pool.values()].sort((a, b) => rank(b) - rank(a)).slice(0, wantedFor(m.pop));
    if (picked.length) { result[m.id] = picked; covered++; } else empty.push(m.id);
  }
  fs.writeFileSync(PLAN, JSON.stringify({ result, empty }));
  console.log(`planned: ${covered} metros have downtown buildings, ${Object.values(result).reduce((n, l) => n + l.length, 0)} places; ${empty.length} metros have none yet`);
}

async function sparql(query) {
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      const res = await fetch('https://query.wikidata.org/sparql?' + new URLSearchParams({ query, format: 'json' }), { headers: { 'User-Agent': 'WastelandMaps/1.0 (fan project; downtown builder)', Accept: 'application/sparql-results+json' }, signal: AbortSignal.timeout(60_000) });
      if (res.status === 429 || res.status >= 500) { await sleep((Number(res.headers.get('retry-after')) || 5 * attempt) * 1000); continue; }
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return await res.json();
    } catch (e) { if (attempt === 5) throw e; await sleep(3000 * attempt); }
  }
  throw new Error('unreachable');
}

async function fetchMissing() {
  const fetchedFile = path.join(ROOT, '_data', 'downtown-fetched.json');
  const done = fs.existsSync(fetchedFile) ? readJson(fetchedFile) : {};
  const { empty } = readJson(PLAN);
  const todo = empty.filter((id) => done[id] === undefined);
  console.log(`asking Wikidata about ${todo.length} downtowns`);
  let n = 0;
  const worker = async () => {
    while (todo.length) {
      const id = todo.shift();
      const m = metros.find((x) => x.id === id);
      const query = `SELECT ?item ?itemLabel ?sl ?coord ?classLabel WHERE {
  SERVICE wikibase:around { ?item wdt:P625 ?coord . bd:serviceParam wikibase:center "Point(${m.lng} ${m.lat})"^^geo:wktLiteral . bd:serviceParam wikibase:radius "${REACH_M / 1000}" . }
  ?item wdt:P31 ?class . ?item wikibase:sitelinks ?sl .
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en,mul,fr,de,es,pt,it,nl,ru,ja,zh,ko". }
} LIMIT 1500`;
      let rows = [];
      try {
        const data = await sparql(query);
        const byItem = new Map();
        for (const b of data.results.bindings) {
          const mm = /Point\(([-\d.e]+) ([-\d.e]+)\)/.exec(b.coord.value);
          if (!mm) continue;
          const item = b.item.value.split('/').pop();
          const hit = byItem.get(item);
          if (hit) hit.classes.add(b.classLabel.value); else byItem.set(item, { row: { item, label: b.itemLabel.value, sl: Number(b.sl.value), lat: Number(mm[2]), lng: Number(mm[1]) }, classes: new Set([b.classLabel.value]) });
        }
        for (const { row, classes } of byItem.values()) {
          if (NAME_NOT.test(row.label)) continue;
          const list = [...classes];
          if (list.some((c) => NOT.test(c))) continue;
          let best = null;
          for (const c of list) for (const [re, score, category] of KINDS) if (re.test(c) && (!best || score > best.score)) best = { score, category };
          if (best) rows.push({ id: row.item, name: row.label, lat: row.lat, lng: row.lng, sl: row.sl, score: best.score, category: best.category, km: dist(m, row) / 1000 });
        }
      } catch { rows = null; }
      if (rows) done[id] = rows.sort((a, b) => rank(b) - rank(a)).slice(0, 6);
      if (++n % 20 === 0) { fs.writeFileSync(fetchedFile, JSON.stringify(done)); console.log(n, 'of', n + todo.length); }
      await sleep(1100);
    }
  };
  await Promise.all([worker(), worker(), worker()]);
  fs.writeFileSync(fetchedFile, JSON.stringify(done));
  plan();
}

async function learnImages() {
  const { result } = readJson(PLAN);
  const ids = [...new Set(Object.values(result).flat().map((c) => c.id))].filter((id) => hasImage[id] === undefined);
  for (let i = 0; i < ids.length; i += 250) {
    const batch = ids.slice(i, i + 250);
    const data = await sparql('SELECT ?item WHERE { VALUES ?item { ' + batch.map((id) => 'wd:' + id).join(' ') + ' } ?item wdt:P18 ?image . }');
    const withImage = new Set(data.results.bindings.map((b) => b.item.value.split('/').pop()));
    for (const id of batch) hasImage[id] = withImage.has(id) ? 1 : 0;
    fs.writeFileSync(P18, JSON.stringify(hasImage));
    await sleep(700);
  }
}

function apply() {
  const { result } = readJson(PLAN);
  const index = readJson(INDEX);
  let added = 0, metrosTouched = 0;
  for (const [id, list] of Object.entries(result)) {
    const file = path.join(METROS, id + '.json');
    const data = readJson(file);
    const have = new Set(data.places.map((p) => p[0]));
    const fresh = list.filter((c) => !have.has(c.id));
    if (!fresh.length) continue;
    for (const c of fresh) data.places.push([c.id, c.name, Math.round(c.lat * 1e5) / 1e5, Math.round(c.lng * 1e5) / 1e5, c.category, c.sl, 0]);
    fs.writeFileSync(file, JSON.stringify(data));
    const entry = index.find((m) => m.id === id);
    if (entry) entry.places = data.places.length;
    added += fresh.length; metrosTouched++;
  }
  fs.writeFileSync(INDEX, JSON.stringify(index));
  console.log(`added ${added} downtown places to ${metrosTouched} metros`);
}

const [,, step = 'plan'] = process.argv;
if (step === 'plan') plan();
else if (step === 'fetch') await fetchMissing();
else if (step === 'images') { plan(); await learnImages(); plan(); }
else if (step === 'apply') apply();
else console.log('plan | fetch | images | apply');
