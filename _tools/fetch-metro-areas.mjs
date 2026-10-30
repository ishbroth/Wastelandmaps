// The real populations of metropolitan areas, from Wikidata (CC0): US metropolitan statistical areas, metropolitan areas, urban agglomerations and
// functional urban areas, with their coordinates. build-metros.ts uses them so a metro is sized by its metropolitan area, not just its core cities.
//   node _tools/fetch-metro-areas.mjs        ->  _data/metro-areas.json   [[name, lat, lng, population], ...]
import fs from 'node:fs';
const CLASSES = ['Q1768043', 'Q1907114', 'Q159313', 'Q3175539'];
const out = new Map();
for (const cls of CLASSES) {
  const query = `SELECT ?item ?itemLabel ?pop ?coord WHERE { ?item wdt:P31 wd:${cls} . ?item wdt:P1082 ?pop . ?item wdt:P625 ?coord . SERVICE wikibase:label { bd:serviceParam wikibase:language "en,mul". } } LIMIT 30000`;
  let data;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const res = await fetch('https://query.wikidata.org/sparql?' + new URLSearchParams({ query, format: 'json' }), { headers: { 'User-Agent': 'WastelandMaps/1.0 (fan project; metro sizes)', Accept: 'application/sparql-results+json' }, signal: AbortSignal.timeout(120_000) });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      data = await res.json();
      break;
    } catch (e) { console.log(cls, 'attempt', attempt, String(e)); await new Promise((r) => setTimeout(r, 6000 * attempt)); }
  }
  if (!data) continue;
  let n = 0;
  for (const b of data.results.bindings) {
    const m = /Point\(([-\d.e]+) ([-\d.e]+)\)/.exec(b.coord.value);
    if (!m) continue;
    const id = b.item.value.split('/').pop();
    const pop = Number(b.pop.value);
    const prev = out.get(id);
    if (!prev || pop > prev[3]) out.set(id, [b.itemLabel.value, Number(m[2]), Number(m[1]), pop]);
    n++;
  }
  console.log(cls, n, 'rows');
}
fs.writeFileSync('_data/metro-areas.json', JSON.stringify([...out.values()].filter((r) => r[3] >= 50_000 && !/^Q\d+$/.test(r[0]))));
console.log(out.size, 'areas saved');
