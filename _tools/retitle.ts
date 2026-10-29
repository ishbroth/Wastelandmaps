// Gives every metro a fresh region name from the current naming rules in src/lib/lore.ts, without asking Wikidata anything:
//   npx tsx _tools/retitle.ts
import fs from 'node:fs';
import path from 'node:path';
import { wastelandName } from '../src/lib/lore.ts';

const ROOT = path.resolve(import.meta.dirname, '..');
const admin1 = new Map<string, string>();
for (const line of fs.readFileSync(path.join(ROOT, '_data', 'cities15000.txt'), 'utf8').split('\n').filter(Boolean)) {
  const f = line.split('\t');
  admin1.set(`${f[1]}|${f[8]}|${Number(f[4])}`, f[10]);
}
const indexPath = path.join(ROOT, 'public', 'data', 'index.json');
const index = JSON.parse(fs.readFileSync(indexPath, 'utf8')) as { id: string; name: string; country: string; lat: number; pop: number; title: string; canon: boolean }[];
let changed = 0;
for (const m of index) {
  const title = wastelandName(m.name, admin1.get(`${m.name}|${m.country}|${m.lat}`) ?? '', m.country, m.pop);
  if (title.name !== m.title) changed++;
  m.title = title.name;
  m.canon = title.canon;
  const file = path.join(ROOT, 'public', 'data', 'metros', `${m.id}.json`);
  const body = JSON.parse(fs.readFileSync(file, 'utf8')) as { title: string };
  body.title = title.name;
  fs.writeFileSync(file, JSON.stringify(body));
}
fs.writeFileSync(indexPath, JSON.stringify(index));
console.log(`${index.length} metros, ${changed} renamed`);
