// Audits the pre-plotted places for a snapshot. Three steps per place, cheapest first:
//   1. Wikidata's own picture (P18): asked in batches of 50, fast. A place with one is done.
//   2. The app's own full photo search (supabase/functions/_shared/photoSources.ts: Wikipedia, Commons, Openverse), for the rest.
//   3. For a place that still has nothing, whether Google has Street View at that spot (a free question): such a place can keep its place on the map, and offer a
//      Street View snapshot as the last resort.
// Each place is one line of _data/snapshot-audit.jsonl: { id, name, lat, lng, cat, metro, source }, where source is a photo source, 'streetview' (no photo, but Street View
// covers it), or 'none' (neither). A place already in the file is skipped, so it can be stopped and started again. Biggest metros first.
//   npx esbuild _tools/snapshot-audit.ts --bundle --platform=node --format=esm --outfile=_data/snapshot-audit.mjs && node _data/snapshot-audit.mjs [metro-id ...] [--all] [--sample N]
import fs from 'node:fs';
import { findPhotoFor } from '../supabase/functions/_shared/photoSources';

const args = process.argv.slice(2);
const sampleAt = args.indexOf('--sample');
const SAMPLE = sampleAt >= 0 ? Number(args[sampleAt + 1]) : 0;
const ALL = args.includes('--all');
const named = args.filter((a, i) => !a.startsWith('--') && !(sampleAt >= 0 && i === sampleAt + 1));
const OUT = '_data/snapshot-audit.jsonl';
const KEY = (fs.existsSync('.env.local') ? fs.readFileSync('.env.local', 'utf8') : '').match(/AIza[A-Za-z0-9_-]+/)?.[0] ?? '';
const UA = { 'User-Agent': 'WastelandMapsAudit/1.0 (https://wastelandmaps.com; fan project)' };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const done = new Set<string>();
if (fs.existsSync(OUT)) for (const line of fs.readFileSync(OUT, 'utf8').split('\n')) { if (line.trim()) { try { done.add(JSON.parse(line).id); } catch { /* skip */ } } }
const index = JSON.parse(fs.readFileSync('public/data/index.json', 'utf8')) as { id: string; pop?: number }[];
const order = new Map(index.map((m, i) => [m.id, m.pop ?? -i]));
const files = (ALL ? fs.readdirSync('public/data/metros').map((f) => f.replace(/\.json$/, '')) : named).sort((a, b) => (order.get(b) ?? 0) - (order.get(a) ?? 0));

type Row = { id: string; name: string; lat: number; lng: number; cat: string; metro: string };
const write = (r: Row, source: string) => fs.appendFileSync(OUT, JSON.stringify({ ...r, source }) + '\n');

async function hasP18(batch: Row[]): Promise<Set<string>> {
  const out = new Set<string>();
  try {
    const res = await fetch(`https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${batch.map((r) => r.id.slice(3)).join('|')}&props=claims&format=json`, { headers: UA });
    if (!res.ok) return out;
    const body = (await res.json()) as { entities?: Record<string, { claims?: { P18?: unknown[] } }> };
    for (const [id, e] of Object.entries(body.entities ?? {})) if (e.claims?.P18?.length) out.add(`wd:${id}`);
  } catch { /* the full search will do */ }
  return out;
}

async function streetView(lat: number, lng: number): Promise<boolean | null> {
  if (!KEY) return null;
  try {
    const res = await fetch(`https://maps.googleapis.com/maps/api/streetview/metadata?location=${lat},${lng}&radius=60&source=outdoor&key=${KEY}`);
    const j = (await res.json()) as { status?: string };
    return j.status === 'OK' ? true : j.status === 'ZERO_RESULTS' ? false : null;
  } catch { return null; }
}

const t0 = Date.now();
let asked = 0;
const tally: Record<string, number> = {};
const note = (s: string) => { tally[s] = (tally[s] ?? 0) + 1; };
for (const m of files) {
  let list: Row[];
  try {
    const j = JSON.parse(fs.readFileSync(`public/data/metros/${m}.json`, 'utf8')) as { places: [string, string, number, number, string][] };
    list = j.places.map((p): Row => ({ id: `wd:${p[0]}`, name: p[1], lat: p[2], lng: p[3], cat: p[4], metro: m })).filter((r) => /^wd:Q\d+$/.test(r.id) && !done.has(r.id));
  } catch { continue; }
  if (SAMPLE > 0 && list.length > SAMPLE) list = list.sort(() => Math.random() - 0.5).slice(0, SAMPLE);
  // 1. the bulk question
  const rest: Row[] = [];
  for (let i = 0; i < list.length; i += 50) {
    const batch = list.slice(i, i + 50);
    const yes = await hasP18(batch);
    for (const r of batch) { if (yes.has(r.id)) { write(r, 'wikidata'); note('wikidata'); } else rest.push(r); }
    await sleep(250);
  }
  // 2 and 3. the full search, a few at a time, and Street View for what has nothing
  let next = 0;
  const worker = async () => {
    while (next < rest.length) {
      const r = rest[next++];
      let source = 'error';
      try {
        const hit = await findPhotoFor({ entityId: r.id.slice(3), name: r.name, lat: r.lat, lng: r.lng, throwOnFailure: true });
        source = hit ? hit.source : 'none';
      } catch { source = 'error'; }
      if (source === 'none') { const sv = await streetView(r.lat, r.lng); source = sv ? 'streetview' : sv === false ? 'none' : 'none'; }
      note(source);
      if (source !== 'error') write(r, source);
    }
  };
  await Promise.all(Array.from({ length: 5 }, worker));
  asked += list.length;
  console.log(m, list.length, 'places;', JSON.stringify(tally), ((Date.now() - t0) / 60000).toFixed(1), 'min so far');
}
console.log('done', asked, JSON.stringify(tally));
