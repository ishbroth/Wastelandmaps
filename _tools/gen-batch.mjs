// Makes the always-free snapshots for more landmarks: finds each one on Wikidata (id, coordinates, free photo), then has the image model draw it destroyed.
//   node _tools/gen-batch.mjs [slug ...]       (resumable: finished ones are skipped; REDO=1 makes new renders)
// Needs GEMINI_API_KEY in .env.local. Output in _data/gen2/: <slug>-source.jpg, <slug>-fallout.png, <slug>-meta.json

import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const OUT = path.join(ROOT, '_data', 'gen2');
fs.mkdirSync(OUT, { recursive: true });
const env = Object.fromEntries(fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split(/\r?\n/).filter((l) => l.includes('=') && !l.startsWith('#')).map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]));
const KEY = process.env.GEMINI_API_KEY || env.GEMINI_API_KEY;
if (!KEY) { console.log('no GEMINI_API_KEY in .env.local'); process.exit(1); }

const UA = { 'User-Agent': 'WastelandMaps/1.0 (fan project; landmark renders)' };
const ALLOWED = /^(CC BY(?!-NC)(?!-ND)|CC BY-SA(?!-NC)|CC0|Public domain|PD)/i;
const strip = (s) => (s ?? '').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// slug, what to search for, what the matching label must contain, the name the wasteland shows if it is not the real one
const LANDMARKS = [
  ['hollywood', 'Hollywood Sign', /hollywood/i],
  ['goldengate', 'Golden Gate Bridge', /golden gate/i],
  ['superdome', 'Caesars Superdome', /superdome/i],
  ['coit', 'Coit Tower', /coit/i],
  ['rockhall', 'Rock and Roll Hall of Fame', /rock and roll hall/i],
  ['gatewayarch', 'Gateway Arch', /gateway arch/i],
  ['alamo', 'Alamo Mission in San Antonio', /alamo/i],
  ['independence', 'Independence Hall', /independence hall/i],
  ['washington', 'Washington Monument', /washington monument/i],
  ['willis', 'Willis Tower', /willis tower/i],
  ['leveque', 'LeVeque Tower', /leveque/i],
  ['peachtree', 'Westin Peachtree Plaza', /westin peachtree|peachtree plaza/i],
  ['epcot', 'Epcot', /epcot/i],
  ['empire', 'Empire State Building', /empire state/i],
  ['pisa', 'Leaning Tower of Pisa', /pisa/i],
  ['cologne', 'Cologne Cathedral', /cologne cathedral/i],
  ['taj', 'Taj Mahal', /taj mahal/i],
  ['tokyotower', 'Tokyo Tower', /tokyo tower/i],
  ['pearl', 'Oriental Pearl Tower', /oriental pearl/i],
  ['cntower', 'CN Tower', /cn tower/i],
  ['costanera', 'Gran Torre Santiago', /gran torre/i],
  ['obelisco', 'Obelisco de Buenos Aires', /obelisco/i],
  ['fandf', 'F&F Tower', /f.?&.?f|revolution/i],
  ['hillbrow', 'Hillbrow Tower', /hillbrow|telkom|joburg/i],
  ['burj', 'Burj Khalifa', /burj khalifa/i],
  ['petronas', 'Petronas Towers', /petronas/i],
];

const EXPECTED = JSON.parse(fs.readFileSync(path.join(ROOT, '_tools', 'landmark-expected.json'), 'utf8'));
const farKm = (aLat, aLng, bLat, bLng) => Math.hypot((aLat - bLat) * 111.32, (aLng - bLng) * 111.32 * Math.cos((aLat * Math.PI) / 180));

const getJson = async (url) => {
  for (let i = 1; i <= 8; i++) {
    await sleep(1500 * i);
    const res = await fetch(url, { headers: UA });
    const text = await res.text();
    try { return JSON.parse(text); } catch { /* rate limited: wait and retry */ }
  }
  throw new Error('Wikimedia kept refusing: ' + url);
};

async function find(slug, search, mustMatch) {
  const found = await getJson('https://www.wikidata.org/w/api.php?' + new URLSearchParams({ action: 'wbsearchentities', search, language: 'en', format: 'json', limit: '10' }));
  const candidates = (found.search ?? []).filter((c) => mustMatch.test(c.label ?? '') || mustMatch.test(c.description ?? ''));
  for (const hit of candidates.length ? candidates : (found.search ?? []).slice(0, 4)) {
    const ent = await getJson('https://www.wikidata.org/w/api.php?' + new URLSearchParams({ action: 'wbgetentities', ids: hit.id, props: 'claims|labels', languages: 'en', format: 'json' }));
    const e = ent.entities?.[hit.id];
    const coord = e?.claims?.P625?.[0]?.mainsnak?.datavalue?.value;
    // a different place with the same name (Independence Hall in Tel Aviv) is not the one wanted
    if (EXPECTED[slug] && coord && farKm(coord.latitude, coord.longitude, EXPECTED[slug][0], EXPECTED[slug][1]) > 60) continue;
    const files = (e?.claims?.P18 ?? []).map((c) => c.mainsnak?.datavalue?.value).filter(Boolean);
    for (const file of files) {
      const info = await getJson('https://commons.wikimedia.org/w/api.php?' + new URLSearchParams({ action: 'query', format: 'json', titles: `File:${file}`, prop: 'imageinfo', iiprop: 'url|extmetadata|mime', iiurlwidth: '1280' }));
      const ii = Object.values(info.query?.pages ?? {})[0]?.imageinfo?.[0];
      const license = strip(ii?.extmetadata?.LicenseShortName?.value);
      if (!ii?.thumburl || !/^image\/(jpeg|png)$/.test(ii.mime ?? '') || !ALLOWED.test(license)) continue;
      return { id: hit.id, label: e?.labels?.en?.value ?? hit.label, lat: coord?.latitude, lng: coord?.longitude, file, license, author: strip(ii.extmetadata?.Artist?.value), page: ii.descriptionurl, thumb: ii.thumburl };
    }
  }
  return null;
}

const { renderPrompt } = await import('../supabase/functions/_shared/renderPrompt.ts');
const model = process.env.GEMINI_MODEL || 'gemini-3-pro-image';
const wanted = process.argv.slice(2);

for (const [slug, search, must] of LANDMARKS) {
  if (wanted.length && !wanted.includes(slug)) continue;
  const metaFile = path.join(OUT, `${slug}-meta.json`);
  const outFile = path.join(OUT, `${slug}-fallout.png`);
  if (fs.existsSync(outFile) && !process.env.REDO) { console.log(slug, 'done already'); continue; }
  let meta = fs.existsSync(metaFile) ? JSON.parse(fs.readFileSync(metaFile, 'utf8')) : null;
  if (!meta) {
    meta = await find(slug, search, must);
    if (!meta) { console.log(slug, '- no free photo found for', search); continue; }
    fs.writeFileSync(path.join(OUT, `${slug}-source.jpg`), Buffer.from(await (await fetch(meta.thumb, { headers: UA })).arrayBuffer()));
    fs.writeFileSync(metaFile, JSON.stringify(meta));
  }
  const data = fs.readFileSync(path.join(OUT, `${slug}-source.jpg`)).toString('base64');
  const started = Date.now();
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST', headers: { 'x-goog-api-key': KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: renderPrompt(meta.label, meta.id) }, { inline_data: { mime_type: 'image/jpeg', data } }] }], generationConfig: { responseModalities: ['TEXT', 'IMAGE'] } }),
  });
  if (!res.ok) { console.log(slug, 'FAILED', res.status, (await res.text()).slice(0, 160)); continue; }
  const body = await res.json();
  const part = (body.candidates?.[0]?.content?.parts ?? []).find((p) => p.inlineData?.data || p.inline_data?.data);
  if (!part) { console.log(slug, 'no image returned'); continue; }
  fs.writeFileSync(outFile, Buffer.from(part.inlineData?.data ?? part.inline_data.data, 'base64'));
  console.log(`${slug}: ${meta.id} ${meta.label} (${meta.lat?.toFixed?.(3)}, ${meta.lng?.toFixed?.(3)}) ${meta.license} - made in ${((Date.now() - started) / 1000).toFixed(0)}s`);
}
