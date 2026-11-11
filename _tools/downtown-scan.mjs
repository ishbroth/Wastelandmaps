// How many metros under 2 million have a candidate downtown building (skyscraper, office tower, hotel, clock tower, square...) in the raw Wikidata caches already on disk?
import fs from 'node:fs';
import path from 'node:path';
const ROOT = path.resolve(import.meta.dirname, '..');
const RAW = path.join(ROOT, '_data', 'raw');
const idx = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/data/index.json'), 'utf8')).filter((m) => m.pop < 2e6);
const files = fs.readdirSync(RAW);
const byId = new Map();
for (const f of files) { const id = f.split('.')[0]; if (!byId.has(id)) byId.set(id, []); byId.get(id).push(f); }
const KIND = /skyscraper|high-?rise|tower|office building|hotel|apartment|condominium|clock|town square|public square|plaza|city square|market square|main square|civic|campanile|bell tower|tall building|multi-?stor|commercial building|office|headquarters|residential building|square/i;
const dist = (a, b) => { const R = 6371000, r = Math.PI / 180; const dx = (b.lng - a.lng) * r * Math.cos(a.lat * r), dy = (b.lat - a.lat) * r; return R * Math.hypot(dx, dy); };
let have = 0, none = 0, noCache = 0; const missing = [];
for (const m of idx) {
  const fl = byId.get(m.id) ?? [];
  if (!fl.length) { noCache++; missing.push(m.id); continue; }
  const rows = [];
  for (const f of fl) { try { const j = JSON.parse(fs.readFileSync(path.join(RAW, f), 'utf8')); if (Array.isArray(j)) rows.push(...j); } catch { /* */ } }
  const near = new Map();
  for (const r of rows) if (r.lat !== undefined && dist(m, r) <= 3000 && KIND.test(r.klass) && !/^Q\d+$/.test(r.label)) near.set(r.item, r);
  if (near.size) have++; else { none++; missing.push(m.id); }
}
console.log({ metros: idx.length, withCandidates: have, withoutCandidates: none, noCacheAtAll: noCache });
fs.writeFileSync(path.join(ROOT, '_data', 'downtown-missing.json'), JSON.stringify(missing));
