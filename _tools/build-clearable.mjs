// Which places count toward clearing a metro: the buildings and landmarks (not the neighborhoods) that have a photograph on Wikidata, so a snapshot of them can always be
// unlocked and they can always be looted. Writes public/data/clear/<metro id>.json: ["Q123", ...]. The app and the metro-clear function both read it.
//   node _tools/build-clearable.mjs        (needs _data/p18.json from build-metros, which records which places have a photo)
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const p18 = JSON.parse(fs.readFileSync(path.join(ROOT, '_data', 'p18.json'), 'utf8'));
const dir = path.join(ROOT, 'public', 'data', 'metros');
const out = path.join(ROOT, 'public', 'data', 'clear');
fs.mkdirSync(out, { recursive: true });
let metros = 0, places = 0;
for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.json'))) {
  const j = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
  const ids = j.places.filter((p) => p[6] !== 1 && p18[p[0]] === 1).map((p) => p[0]);
  fs.writeFileSync(path.join(out, f), JSON.stringify(ids));
  metros++; places += ids.length;
}
console.log(`clear lists: ${metros} metros, ${places} places`);
