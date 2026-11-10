// Checks which story pool every pre-plotted place gets, by its category and name: lists the pairs, with example names, so a mismatch (a dam with an office story) shows.
//   npx esbuild _tools/audit-scenes.ts --bundle --platform=node --outfile=%TEMP%/audit.cjs && node %TEMP%/audit.cjs [family]
import fs from 'node:fs';
import path from 'node:path';
import { pickIcon } from '../src/lib/placeIcons';
import { sceneFamily } from '../src/lib/sceneLines';

const dir = path.resolve(process.cwd(), 'public', 'data', 'metros');
const only = process.argv[2];
const table = new Map<string, { n: number; names: string[] }>();
let total = 0;
for (const f of fs.readdirSync(dir)) {
  const metro = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')) as { places: [string, string, number, number, string][] };
  for (const p of metro.places) {
    const [, name, , , category] = p;
    const icon = pickIcon(category as never, name);
    const family = sceneFamily(icon, name, category);
    total++;
    const key = `${category} -> ${family}`;
    const row = table.get(key) ?? { n: 0, names: [] };
    row.n++;
    if (row.names.length < 400 && (!only || family === only || category === only) && (row.names.length < 8 || only)) row.names.push(name);
    table.set(key, row);
  }
}
console.log('places', total);
for (const [key, row] of [...table].sort((a, b) => b[1].n - a[1].n)) {
  console.log(String(row.n).padStart(7), key.padEnd(26), (only ? row.names.slice(0, 40) : row.names.slice(0, 6)).join(' | ').slice(0, only ? 3000 : 170));
}
