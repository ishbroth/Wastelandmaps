// Which of the second-tier famous landmarks (src/lib/famous.ts) have a free photo a snapshot could be made from? Runs the same photo search the app and the
// render function use (supabase/functions/_shared/photoSources.ts) for every one of them and writes _data/famous-photo-audit.json.
//   node _tools/audit-famous-photos.mjs
import fs from 'node:fs';

const { findPhotoFor } = await import('../supabase/functions/_shared/photoSources.ts');
const src = fs.readFileSync('src/lib/famous.ts', 'utf8');
const entries = [];
for (const line of src.split(/\r?\n/)) {
  const m = line.match(/name: (['"])(.+?)\1, lat: ([-\d.]+), lng: ([-\d.]+), icon: '(\w+)'(?:, qid: '(Q\d+)')?/);
  if (m) entries.push({ name: m[2], lat: +m[3], lng: +m[4], icon: m[5], qid: m[6] ?? null });
}
console.log(entries.length, 'landmarks');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
let next = 0;
async function worker() {
  while (next < entries.length) {
    const e = entries[next++];
    let hit = null, failed = false;
    for (let attempt = 0; attempt < 3 && !hit; attempt++) {
      try { hit = await findPhotoFor({ entityId: e.qid ?? undefined, name: e.name, lat: e.lat, lng: e.lng }, { 'User-Agent': 'WastelandMaps/1.0 (https://wastelandmaps.com; fan project; audit)' }); failed = false; break; } catch { failed = true; await sleep(2000 * (attempt + 1)); }
    }
    results.push({ ...e, photo: hit ? { source: hit.source, title: hit.title, license: hit.license } : null, failed });
    await sleep(700);
  }
}
await Promise.all([worker(), worker()]);
results.sort((a, b) => a.name.localeCompare(b.name));
fs.writeFileSync('_data/famous-photo-audit.json', JSON.stringify(results, null, 1));
const none = results.filter((r) => !r.photo);
console.log('with a photo:', results.length - none.length, ' without:', none.length);
for (const r of none) console.log('-', r.name, r.qid ?? '(no Wikidata id)', r.failed ? '(search failed)' : '');
