// Audits the pre-plotted places for a snapshot: asks the app's own photo search (supabase/functions/_shared/photoSources.ts, all five sources in order) about each one and
// records which source answered, or that none did.
//   npx esbuild _tools/snapshot-audit.ts --bundle --platform=node --format=esm --outfile=_data/snapshot-audit.mjs && node _data/snapshot-audit.mjs <metro-id ...> [--sample N] [--all]
// With metro ids it audits those metros (every place, or --sample N random ones); with --all, every metro. Results are appended to _data/snapshot-audit.jsonl (one place per line)
// and places already in that file are skipped, so it can be stopped and run again.
import fs from 'node:fs';
import { findPhotoFor } from '../supabase/functions/_shared/photoSources';

const args = process.argv.slice(2);
const sampleAt = args.indexOf('--sample');
const SAMPLE = sampleAt >= 0 ? Number(args[sampleAt + 1]) : 0;
const ALL = args.includes('--all');
const metros = args.filter((a, i) => !a.startsWith('--') && !(sampleAt >= 0 && i === sampleAt + 1));
const OUT = '_data/snapshot-audit.jsonl';
const done = new Set<string>();
if (fs.existsSync(OUT)) for (const line of fs.readFileSync(OUT, 'utf8').split('\n')) { if (line.trim()) { try { done.add(JSON.parse(line).id); } catch { /* skip */ } } }
const files = ALL ? fs.readdirSync('public/data/metros').map((f) => f.replace(/\.json$/, '')) : metros;

type Row = { id: string; name: string; lat: number; lng: number; cat: string; metro: string };
const rows: Row[] = [];
for (const m of files) {
  const j = JSON.parse(fs.readFileSync(`public/data/metros/${m}.json`, 'utf8')) as { places: [string, string, number, number, string][] };
  let list = j.places.map((p): Row => ({ id: `wd:${p[0]}`, name: p[1], lat: p[2], lng: p[3], cat: p[4], metro: m })).filter((r) => /^wd:Q\d+$/.test(r.id) && !done.has(r.id));
  if (SAMPLE > 0 && list.length > SAMPLE) list = list.sort(() => Math.random() - 0.5).slice(0, SAMPLE);
  rows.push(...list);
}
console.log(rows.length, 'places to ask about');

const t0 = Date.now();
let n = 0;
const tally: Record<string, number> = {};
const CONC = 4;
let next = 0;
async function worker() {
  while (next < rows.length) {
    const r = rows[next++];
    let source = 'error';
    try {
      const hit = await findPhotoFor({ entityId: r.id.slice(3), name: r.name, lat: r.lat, lng: r.lng, throwOnFailure: true });
      source = hit ? hit.source : 'none';
    } catch { source = 'error'; }
    tally[source] = (tally[source] ?? 0) + 1;
    if (source !== 'error') fs.appendFileSync(OUT, JSON.stringify({ id: r.id, name: r.name, lat: r.lat, lng: r.lng, cat: r.cat, metro: r.metro, source }) + '\n');
    if (++n % 25 === 0) console.log(n, 'of', rows.length, JSON.stringify(tally), ((Date.now() - t0) / n / 1000).toFixed(2), 's each (all workers)');
  }
}
await Promise.all(Array.from({ length: CONC }, worker));
console.log('done', n, JSON.stringify(tally), 'in', ((Date.now() - t0) / 1000).toFixed(0), 's');
