// Picks each metro's "local famous" buildings: the most prominent skyscrapers, government halls, towers and grand stations that the people of a city know,
// outside the United States and Canada (those are listed by hand in famous.ts). The count follows the size of the metro:
//   500,000 to 1 million: 1;  1 to 3 million: 2;  3 to 5 million: 3;  5 to 8 million: 4;  more: 5.
// The candidates are places already in the metro's map (so they are in the right country) whose Wikidata kind says what they are, ranked by how many
// Wikipedias have an article on them. Writes public/data/locals.json: { metroId: [[wikidataId, kind], ...] }. Run after build-metros.ts.
//   npx tsx _tools/build-locals.ts [metro name fragment]   (with a fragment it only prints what it would pick)

import fs from 'node:fs';
import path from 'node:path';
import { FAMOUS } from '../src/lib/famous.ts';
import { LANDMARK_SPAWNS } from '../src/lib/raid/spawnData.ts';

const ROOT = path.resolve(import.meta.dirname, '..');
const DATA = path.join(ROOT, 'public', 'data');
const RAW = path.join(ROOT, '_data', 'raw');

interface IndexEntry { id: string; name: string; country: string; pop: number }
const index = JSON.parse(fs.readFileSync(path.join(DATA, 'index.json'), 'utf8')) as IndexEntry[];
const only = process.argv[2]?.toLowerCase();

const quotaFor = (pop: number) => (pop >= 8_000_000 ? 5 : pop >= 5_000_000 ? 4 : pop >= 3_000_000 ? 3 : pop >= 1_000_000 ? 2 : pop >= 500_000 ? 1 : 0);

const WANTED = /skyscraper|high[- ]rise|tower block|office building|government (?:building|palace|house)|parliament|town hall|city hall|capitol|legislat|ministry|courthouse|court house|administrative|secretariat|palace|^tower$|television tower|communications? tower|observation tower|clock tower|^building$|railway station|railroad station|central station|terminus|art deco|brutalis/i;
const UNWANTED = /cottage|church|cathedral|basilica|mosque|temple|synagogue|shrine|monastery|museum|gallery|stadium|arena|airport|aerodrome|bridge|park|garden|school|universit|college|hospital|prison|castle|fortress|fort\b|market|monument|memorial|statue|zoo|square|street|road|river|island|mountain|lake|beach|district|neighbo|municipality|city\b|town\b|village|company|organi[sz]ation|hotel resort|shopping|mall|cemetery|tomb|library|theat|opera|cinema|bank\b|stock exchange|mine\b|dam\b|lighthouse|windmill|ruin|archaeolog|world heritage|tourist|event|edition/i;

const kindOf = (classes: string[], name: string): string => {
  const all = classes.join(' | ');
  if (/brutalis|soviet|house of the soviets|ministry|secretariat|administrative/i.test(all + ' ' + name)) return 'block';
  if (/parliament|town hall|city hall|capitol|legislat|government|courthouse|court house|palace/i.test(all)) return 'gov';
  if (/television tower|communications? tower|observation tower|^tower$|clock tower/i.test(all)) return 'spire';
  if (/railway station|railroad station|central station|terminus/i.test(all)) return 'hall';
  return 'sky';
};

// the raw Wikidata rows saved by build-metros.ts, by metro
const rawByMetro = new Map<string, string[]>();
for (const f of fs.readdirSync(RAW)) {
  const m = /^(.*?)\.\d+(?:\.r\d+)?\.json$/.exec(f);
  if (!m) continue;
  if (!rawByMetro.has(m[1])) rawByMetro.set(m[1], []);
  rawByMetro.get(m[1])!.push(f);
}
interface Row { item: string; label: string; sl: number; klass: string }

const free = new Set(Object.keys(LANDMARK_SPAWNS));
const out: Record<string, [string, string][]> = {};
let total = 0;
for (const metro of index) {
  if (metro.country === 'US' || metro.country === 'CA') continue;
  const quota = quotaFor(metro.pop);
  if (!quota) continue;
  if (only && !metro.name.toLowerCase().includes(only)) continue;
  const file = path.join(DATA, 'metros', `${metro.id}.json`);
  if (!fs.existsSync(file)) continue;
  const places = (JSON.parse(fs.readFileSync(file, 'utf8')).places as [string, string, number, number, string, number, number][]).filter((p) => /^Q\d+$/.test(p[0]) && p[6] !== 1);
  const byItem = new Map<string, { classes: Set<string>; sl: number }>();
  for (const f of rawByMetro.get(metro.id) ?? []) {
    for (const r of JSON.parse(fs.readFileSync(path.join(RAW, f), 'utf8')) as Row[]) {
      const e = byItem.get(r.item) ?? { classes: new Set<string>(), sl: 0 };
      e.classes.add(r.klass);
      e.sl = Math.max(e.sl, r.sl);
      byItem.set(r.item, e);
    }
  }
  const candidates: { id: string; name: string; sl: number; kind: string; lat: number; lng: number }[] = [];
  for (const [id, name, lat, lng] of places) {
    const info = byItem.get(id);
    if (!info || free.has(id)) continue;
    const classes = [...info.classes];
    if (!classes.some((c) => WANTED.test(c)) || classes.some((c) => UNWANTED.test(c))) continue;
    if (FAMOUS.some((f) => f.match.test(name) || (Math.abs(f.lat - lat) < 0.004 && Math.abs(f.lng - lng) < 0.004))) continue;
    candidates.push({ id, name, sl: info.sl, kind: kindOf(classes, name), lat, lng });
  }
  candidates.sort((a, b) => b.sl - a.sl || a.name.localeCompare(b.name));
  const picks: typeof candidates = [];
  for (const c of candidates) {
    if (picks.length >= quota) break;
    if (picks.some((p) => Math.abs(p.lat - c.lat) < 0.002 && Math.abs(p.lng - c.lng) < 0.002)) continue; // not two on the same corner
    picks.push(c);
  }
  if (!picks.length) continue;
  out[metro.id] = picks.map((p) => [p.id, p.kind]);
  total += picks.length;
  if (only) console.log(`${metro.name} (${(metro.pop / 1e6).toFixed(1)}M, ${quota}):`, picks.map((p) => `${p.name} [${p.kind}, ${p.sl}]`).join('; '));
}
if (!only) {
  fs.writeFileSync(path.join(DATA, 'locals.json'), JSON.stringify(out));
  console.log(`wrote ${Object.keys(out).length} metros, ${total} landmarks`);
}
