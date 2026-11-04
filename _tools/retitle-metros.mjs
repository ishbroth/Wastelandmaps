// Gives every metro its wasteland title again from src/lib/lore.ts (the word lists changed): the titles the old lists made are replaced with the new ones,
// any title that was set by hand is left alone. Needs the old lore bundled to _data/lore-old.mjs and the new to _data/lore-new.mjs (see the git log).
import fs from 'node:fs';
import { wastelandName as oldName } from '../_data/lore-old.mjs';
import { wastelandName as newName } from '../_data/lore-new.mjs';
const idxPath = 'public/data/index.json';
const idx = JSON.parse(fs.readFileSync(idxPath, 'utf8'));
let changed = 0, kept = 0;
for (const m of idx) {
  const st = m.id.split('-')[1];
  const arg = [st.toUpperCase(), st, '', undefined].find((s) => oldName(m.name, s, m.country, m.pop).name === m.title);
  if (arg === undefined && oldName(m.name, undefined, m.country, m.pop).name !== m.title) { kept++; continue; }
  const next = newName(m.name, arg, m.country, m.pop);
  if (next.name !== m.title) {
    changed++;
    const file = 'public/data/metros/' + m.id + '.json';
    const j = JSON.parse(fs.readFileSync(file, 'utf8'));
    j.title = next.name;
    fs.writeFileSync(file, JSON.stringify(j));
    m.title = next.name;
  }
  m.canon = next.canon;
}
fs.writeFileSync(idxPath, JSON.stringify(idx));
console.log('retitled', changed, '| left as set by hand', kept);
const bad = idx.filter((m) => /meltdown|bygone|cloister/i.test(m.title));
console.log('still containing the banned words:', bad.length);
const sample = [...idx].sort(() => 0.5 - Math.random()).slice(0, 30).map((m) => m.title);
console.log(sample.join(' | '));
