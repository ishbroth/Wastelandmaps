// Step 2 of the image-generation test: send each landmark photo to Google's Gemini image model and ask for a post-apocalyptic game render.
//
//   1. Get a key: https://aistudio.google.com/apikey (sign in with Gmail, "Create API key").
//   2. Put it in .env.local (this folder, never committed) as a new line:   GEMINI_API_KEY=your-key
//   3. npx tsx _tools/gen-test.mjs [slug ...]   (REDO=1 makes new ones even where a result exists)
//      (old line follows) node _tools/gen-test.mjs [slug ...]          e.g.  node _tools/gen-test.mjs eiffel
//      GEMINI_MODEL=<model name> overrides the model that is picked automatically.
//
// Results go to _data/gen/<slug>-fallout.png and a side-by-side page: _data/gen/sheet.html

import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const DIR = path.join(ROOT, '_data', 'gen');

// read the key from .env.local without printing it
const envFile = path.join(ROOT, '.env.local');
const env = fs.existsSync(envFile) ? Object.fromEntries(fs.readFileSync(envFile, 'utf8').split(/\r?\n/).filter((l) => l.includes('=') && !l.startsWith('#')).map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()])) : {};
const KEY = process.env.GEMINI_API_KEY || env.GEMINI_API_KEY;
if (!KEY) {
  console.log('No GEMINI_API_KEY found. Add a line  GEMINI_API_KEY=...  to .env.local (see the top of this file).');
  process.exit(1);
}

import { renderPrompt } from '../supabase/functions/_shared/renderPrompt.ts';
const IDS = { eiffel: 'Q243', liberty: 'Q9202', spaceneedle: 'Q5317', bigben: 'Q41225', opera: 'Q45178', redeemer: 'Q79961', kremlin: 'Q133274' };
const NAMES = { eiffel: 'Eiffel Tower', liberty: 'Statue of Liberty', spaceneedle: 'Space Needle', bigben: 'Big Ben', opera: 'Sydney Opera House', redeemer: 'Christ the Redeemer', kremlin: 'The Kremlin, Moscow' };

const api = (p) => `https://generativelanguage.googleapis.com/v1beta/${p}`;
const headers = { 'x-goog-api-key': KEY, 'Content-Type': 'application/json' };

async function pickModel() {
  if (process.env.GEMINI_MODEL) return process.env.GEMINI_MODEL;
  const res = await fetch(api('models?pageSize=200'), { headers });
  if (!res.ok) throw new Error(`model list failed: ${res.status} ${await res.text()}`);
  const { models = [] } = await res.json();
  const image = models.filter((m) => /image/i.test(m.name) && (m.supportedGenerationMethods ?? []).includes('generateContent') && !/imagen/i.test(m.name));
  console.log('image-capable models:', image.map((m) => m.name.replace('models/', '')).join(', ') || '(none)');
  // newest-looking first: prefer names with a larger version number, "preview" last
  image.sort((a, b) => (/preview/i.test(a.name) ? 1 : 0) - (/preview/i.test(b.name) ? 1 : 0) || b.name.localeCompare(a.name));
  if (!image[0]) throw new Error('this key has no image-editing model available');
  return image[0].name.replace('models/', '');
}

const model = await pickModel();
console.log('using', model);

const all = fs.readdirSync(DIR).filter((f) => f.endsWith('-source.jpg')).map((f) => f.replace('-source.jpg', ''));
const slugs = process.argv.slice(2).length ? process.argv.slice(2) : all;

for (const slug of slugs) {
  const out = path.join(DIR, `${slug}-fallout.png`);
  if (fs.existsSync(out) && !process.env.REDO) { console.log(slug, 'already done'); continue; }
  const data = fs.readFileSync(path.join(DIR, `${slug}-source.jpg`)).toString('base64');
  const started = Date.now();
  const res = await fetch(api(`models/${model}:generateContent`), {
    method: 'POST', headers,
    body: JSON.stringify({
      contents: [{ parts: [{ text: renderPrompt(NAMES[slug] ?? slug, IDS[slug]) }, { inline_data: { mime_type: 'image/jpeg', data } }] }],
      generationConfig: { responseModalities: ['TEXT', 'IMAGE'] },
    }),
  });
  if (!res.ok) { console.log(slug, 'FAILED', res.status, (await res.text()).slice(0, 300)); continue; }
  const body = await res.json();
  const parts = body.candidates?.[0]?.content?.parts ?? [];
  const image = parts.find((p) => p.inlineData?.data || p.inline_data?.data);
  if (!image) { console.log(slug, 'no image returned:', parts.map((p) => p.text).filter(Boolean).join(' ').slice(0, 200) || JSON.stringify(body).slice(0, 200)); continue; }
  fs.writeFileSync(out, Buffer.from(image.inlineData?.data ?? image.inline_data.data, 'base64'));
  console.log(`${slug}: done in ${((Date.now() - started) / 1000).toFixed(0)}s`);
}

// a page to look at them side by side
const rows = all.map((slug) => {
  const credit = fs.existsSync(path.join(DIR, `${slug}-credit.json`)) ? JSON.parse(fs.readFileSync(path.join(DIR, `${slug}-credit.json`), 'utf8')) : {};
  const done = fs.existsSync(path.join(DIR, `${slug}-fallout.png`));
  return `<tr><td><img src="${slug}-source.jpg" width="520"><br><small>${credit.label ?? slug}: ${credit.license ?? ''}, ${credit.author ?? ''}</small></td><td>${done ? `<img src="${slug}-fallout.png" width="520">` : '(not generated)'}</td></tr>`;
}).join('\n');
fs.writeFileSync(path.join(DIR, 'sheet.html'), `<!doctype html><meta charset="utf-8"><title>Fallout render test</title><body style="background:#111;color:#ccc;font:14px sans-serif"><table cellpadding="8">${rows}</table>`);
console.log('side-by-side page: _data/gen/sheet.html');
