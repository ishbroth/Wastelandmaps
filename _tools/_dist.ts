import fs from 'node:fs';
import { pickIcon } from '../src/lib/placeIcons.ts';
const id = process.argv[2] || 'us-ca-los-angeles';
const m = JSON.parse(fs.readFileSync(`public/data/metros/${id}.json`, 'utf8')) as { places: [string, string, number, number, string, number, number][] };
const cats: Record<string, number> = {}; const icons: Record<string, number> = {};
for (const p of m.places) { cats[p[4]] = (cats[p[4]] ?? 0) + 1; const ic = p[6] ? 'neighborhood' : pickIcon(p[4] as never, p[1]); icons[ic] = (icons[ic] ?? 0) + 1; }
console.log(m.places.length, 'places'); console.log(JSON.stringify(cats)); console.log(Object.entries(icons).sort((a, b) => b[1] - a[1]).map(([k, v]) => k + ':' + v).join(' '));
