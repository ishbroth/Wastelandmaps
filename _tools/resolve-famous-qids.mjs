// Finds the Wikidata item (Q-number) of every famous landmark in src/lib/famous.ts, by asking Wikidata for the items around its coordinates and picking the one
// whose name fits. With a Wikidata id a landmark gets a normal "wd:Q..." place id, so its snapshot photo can be found (Wikidata's image, Wikipedia's picture,
// Wikimedia Commons) and it can be raided. Writes _data/famous-qids.json: { icon: { qid, label, sl, image } }, and prints what could not be matched.
//   node _tools/resolve-famous-qids.mjs
import fs from 'node:fs';

const src = fs.readFileSync('src/lib/famous.ts', 'utf8');
const entries = [];
const re = /\{ match: \/(.+?)\/i, name: (['"])(.+?)\2, lat: ([-\d.]+), lng: ([-\d.]+), icon: '(\w+)'/g;
let m;
while ((m = re.exec(src))) entries.push({ match: new RegExp(m[1], 'i'), name: m[3], lat: +m[4], lng: +m[5], icon: m[6] });
console.log(entries.length, 'landmarks');

const UA = { 'User-Agent': 'WastelandMaps/1.0 (https://wastelandmaps.com; fan project)', Accept: 'application/sparql-results+json' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const words = (t) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').split(/[^a-z0-9]+/).filter((w) => w.length >= 3 && !['the', 'and', 'of', 'at', 'in'].includes(w));

async function around(e, km) {
  const query = `SELECT ?item ?itemLabel ?sl ?img WHERE {
  SERVICE wikibase:around { ?item wdt:P625 ?c . bd:serviceParam wikibase:center "Point(${e.lng} ${e.lat})"^^geo:wktLiteral . bd:serviceParam wikibase:radius "${km}" . }
  ?item wikibase:sitelinks ?sl . FILTER(?sl >= 2)
  OPTIONAL { ?item wdt:P18 ?img }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en,mul,fr,de,es". }
} ORDER BY DESC(?sl) LIMIT 60`;
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch('https://query.wikidata.org/sparql?format=json&query=' + encodeURIComponent(query), { headers: UA });
    if (res.ok) return (await res.json()).results.bindings;
    await sleep(2500 * (attempt + 1));
  }
  return [];
}

const out = {};
const missing = [];
for (const e of entries) {
  let best = null;
  for (const km of [1.2, 4]) {
    const rows = await around(e, km);
    for (const r of rows) {
      const label = r.itemLabel?.value ?? '';
      if (/^Q\d+$/.test(label)) continue;
      const want = words(e.name);
      const have = new Set(words(label));
      const fit = want.length ? want.filter((w) => have.has(w)).length / want.length : 0;
      const matches = e.match.test(label);
      if (!matches && fit < 0.5) continue;
      const sl = Number(r.sl.value);
      const score = (matches ? 1000 : 0) + fit * 100 + Math.min(sl, 200) / 10 + (r.img ? 5 : 0);
      if (!best || score > best.score) best = { score, qid: r.item.value.split('/').pop(), label, sl, image: !!r.img };
    }
    if (best) break;
    await sleep(900);
  }
  if (best) out[e.icon] = { qid: best.qid, label: best.label, sl: best.sl, image: best.image };
  else missing.push(e.name);
  console.log((best ? 'ok  ' : 'MISS') + ' ' + e.icon.padEnd(22) + (best ? `${best.qid} ${best.label} (${best.sl} wikis, image ${best.image})` : e.name));
  await sleep(900);
}
fs.mkdirSync('_data', { recursive: true });
fs.writeFileSync('_data/famous-qids.json', JSON.stringify(out, null, 1));
console.log('\nresolved', Object.keys(out).length, 'of', entries.length, '\nmissing:', missing.join('; '));
