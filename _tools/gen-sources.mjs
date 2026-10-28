// Step 1 of the image-generation test: fetch the freely licensed Wikimedia photo that Wikidata lists for each landmark.
//   node _tools/gen-sources.mjs
import fs from 'node:fs';
import path from 'node:path';

const OUT = path.resolve(import.meta.dirname, '..', '_data', 'gen');
fs.mkdirSync(OUT, { recursive: true });
const UA = { 'User-Agent': 'WastelandMaps/1.0 (fan project; image test)' };
const ALLOWED = /^(CC BY(?!-NC)(?!-ND)|CC BY-SA(?!-NC)|CC0|Public domain|PD)/i;

const LANDMARKS = [
  { slug: 'eiffel', search: 'Eiffel Tower' },
  { slug: 'liberty', search: 'Statue of Liberty' },
  { slug: 'spaceneedle', search: 'Space Needle' },
  { slug: 'bigben', search: 'Big Ben' },
  { slug: 'opera', search: 'Sydney Opera House' },
  { slug: 'redeemer', search: 'Christ the Redeemer' },
  { slug: 'kremlin', search: 'Moscow Kremlin' },
];

const json = async (url) => {
  for (let i = 1; i <= 7; i++) {
    await new Promise((r) => setTimeout(r, 2500 * i));
    const res = await fetch(url, { headers: UA });
    const text = await res.text();
    try { return JSON.parse(text); } catch { /* rate limited: wait and try again */ }
  }
  throw new Error('Wikimedia kept refusing: ' + url);
};
const strip = (s) => (s ?? '').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();

for (const lm of LANDMARKS) {
  if (fs.existsSync(path.join(OUT, `${lm.slug}-source.jpg`)) && fs.existsSync(path.join(OUT, `${lm.slug}-credit.json`))) continue;
  const found = await json('https://www.wikidata.org/w/api.php?' + new URLSearchParams({ action: 'wbsearchentities', search: lm.search, language: 'en', format: 'json', limit: '3' }));
  const hit = found.search?.[0];
  if (!hit) { console.log(lm.slug, 'NOT FOUND'); continue; }
  const claims = await json('https://www.wikidata.org/w/api.php?' + new URLSearchParams({ action: 'wbgetclaims', entity: hit.id, property: 'P18', format: 'json' }));
  const files = (claims.claims?.P18 ?? []).map((c) => c.mainsnak?.datavalue?.value).filter(Boolean);
  let saved = false;
  for (const file of files) {
    const info = await json('https://commons.wikimedia.org/w/api.php?' + new URLSearchParams({ action: 'query', format: 'json', titles: `File:${file}`, prop: 'imageinfo', iiprop: 'url|extmetadata|mime', iiurlwidth: '1280' }));
    const ii = Object.values(info.query?.pages ?? {})[0]?.imageinfo?.[0];
    const license = strip(ii?.extmetadata?.LicenseShortName?.value);
    if (!ii?.thumburl || !/^image\/(jpeg|png)$/.test(ii.mime ?? '') || !ALLOWED.test(license)) continue;
    const bytes = Buffer.from(await (await fetch(ii.thumburl, { headers: UA })).arrayBuffer());
    fs.writeFileSync(path.join(OUT, `${lm.slug}-source.jpg`), bytes);
    fs.writeFileSync(path.join(OUT, `${lm.slug}-credit.json`), JSON.stringify({ id: hit.id, label: hit.label, file, author: strip(ii.extmetadata?.Artist?.value), license, page: ii.descriptionurl }));
    console.log(`${lm.slug}: ${hit.id} ${hit.label} | ${file} | ${license} | ${(bytes.length / 1024).toFixed(0)} KB`);
    saved = true;
    break;
  }
  if (!saved) console.log(lm.slug, hit.id, 'no usable free photo');
  await new Promise((r) => setTimeout(r, 400));
}
