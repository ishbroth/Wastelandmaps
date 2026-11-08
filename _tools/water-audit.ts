// Lists the places in the metros that are out in the water: npx tsx _tools/water-audit.ts
import fs from 'node:fs';
import path from 'node:path';
import { loadLand } from './land.ts';
const land = loadLand();
const ROOT = path.resolve(import.meta.dirname, '..');
const dir = path.join(ROOT, 'public', 'data', 'metros');
let total = 0, wet = 0;
const byCat: Record<string, number> = {};
const sample: string[] = [];
for (const f of fs.readdirSync(dir)) {
  const m = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')) as { id: string; places: [string, string, number, number, string][] };
  for (const p of m.places) {
    total++;
    if (!land.onLand(p[2], p[3], 1500)) { wet++; byCat[p[4]] = (byCat[p[4]] ?? 0) + 1; if (sample.length < 60 && Math.random() < 0.15) sample.push(`${m.id}: ${p[1]} (${p[4]})`); }
  }
}
console.log({ total, wet }, byCat);
console.log(sample.join('\n'));
