// Fetches the streets of an area from OpenStreetMap (in small pieces, the map service refuses big ones) and saves them as simple JSON: { nodes: {id: [lat, lng]}, ways: [{ hw, nodes: [id...] }] }.
//   node _tools/fetch-osm-streets.mjs <south> <west> <north> <east> <out.json> [columns] [rows]
import fs from 'node:fs';
const [,, s, w, n, e, out, cols = '4', rows = '3'] = process.argv;
const [S, W, N, E, C, R] = [s, w, n, e, cols, rows].map(Number);
const nodes = {}, ways = new Map();
for (let i = 0; i < C; i++) for (let j = 0; j < R; j++) {
  const bbox = [W + ((E - W) * i) / C, S + ((N - S) * j) / R, W + ((E - W) * (i + 1)) / C, S + ((N - S) * (j + 1)) / R].map((v) => v.toFixed(5)).join(',');
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(`https://api.openstreetmap.org/api/0.6/map?bbox=${bbox}`, { headers: { 'User-Agent': 'WastelandMaps/1.0 (fan project; header art)' } });
    if (!res.ok) { console.log(bbox, res.status, (await res.text()).slice(0, 80)); await new Promise((r) => setTimeout(r, 3000)); continue; }
    const xml = await res.text();
    for (const m of xml.matchAll(/<node id="([0-9]+)"[^>]*?lat="([-0-9.]+)"[^>]*?lon="([-0-9.]+)"/g)) nodes[m[1]] = [Number(m[2]), Number(m[3])];
    for (const m of xml.matchAll(/<way id="([0-9]+)"[^>]*>([^]*?)<[/]way>/g)) {
      const hw = /<tag k="highway" v="([^"]+)"/.exec(m[2])?.[1];
      if (!hw || !/^(motorway|trunk|primary|secondary|tertiary|residential|unclassified|living_street|service|[a-z]+_link)$/.test(hw)) continue;
      ways.set(m[1], { hw, nodes: [...m[2].matchAll(/<nd ref="([0-9]+)"/g)].map((x) => x[1]) });
    }
    break;
  }
}
fs.writeFileSync(out, JSON.stringify({ nodes, ways: [...ways.values()] }));
console.log('ways', ways.size, 'nodes', Object.keys(nodes).length);
