// Makes the one picture for Vault 0 (Vault Tech Headquarters, Antarctica): a pristine vault door in the snow, no destruction. One call to the image model.
//   npx tsx _tools/gen-vault0.mjs        (needs GEMINI_API_KEY in .env.local, like gen-test.mjs; REDO=1 makes a new one)
// Result: public/renders/famous-vault-0.png (and the same file as -source.jpg, which the app does not show for this place).
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = path.resolve(import.meta.dirname, '..');
const OUT = path.join(ROOT, 'public', 'renders', 'famous-vault-0.png');
if (fs.existsSync(OUT) && !process.env.REDO) { console.log('already there:', OUT); process.exit(0); }
const envFile = path.join(ROOT, '.env.local');
const env = fs.existsSync(envFile) ? Object.fromEntries(fs.readFileSync(envFile, 'utf8').split(/\r?\n/).filter((l) => l.includes('=') && !l.startsWith('#')).map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()])) : {};
const KEY = process.env.GEMINI_API_KEY || env.GEMINI_API_KEY;
if (!KEY) { console.log('No GEMINI_API_KEY in .env.local'); process.exit(1); }
const api = (p) => `https://generativelanguage.googleapis.com/v1beta/${p}`;
const headers = { 'x-goog-api-key': KEY, 'Content-Type': 'application/json' };

const list = await fetch(api('models?pageSize=200'), { headers });
if (!list.ok) { console.log('model list failed', list.status); process.exit(1); }
const image = ((await list.json()).models ?? []).filter((m) => /image/i.test(m.name) && (m.supportedGenerationMethods ?? []).includes('generateContent') && !/imagen/i.test(m.name));
image.sort((a, b) => (/preview/i.test(a.name) ? 1 : 0) - (/preview/i.test(b.name) ? 1 : 0) || b.name.localeCompare(a.name));
const model = process.env.GEMINI_MODEL || image[0]?.name.replace('models/', '');
if (!model) { console.log('no image model for this key'); process.exit(1); }
console.log('using', model);

const prompt = [
  'A photorealistic video-game concept render in the style of Fallout 4, widescreen 16:9 landscape.',
  'A single huge Vault-Tec vault door: a massive round steel gear-toothed door, 20 feet across, set into a rock face on an Antarctic snowfield, with the large painted number 0 on it and the blue-and-yellow Vault-Tec colors.',
  'It is in PRISTINE, perfect condition: clean polished steel, fresh paint, no rust, no cracks, no damage, no rubble. The surrounding snow is smooth and untouched, drifts piled softly against the rock. Cold clear blue-white light, a pale sky, a few wisps of blowing snow.',
  'No people, no creatures, no vehicles, no ruins, no explosion, no fire, no text other than the number 0.',
].join(' ');
const started = Date.now();
const res = await fetch(api(`models/${model}:generateContent`), {
  method: 'POST', headers,
  body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseModalities: ['TEXT', 'IMAGE'], imageConfig: { aspectRatio: '16:9' } } }),
});
if (!res.ok) { console.log('FAILED', res.status, (await res.text()).slice(0, 300)); process.exit(1); }
const parts = (await res.json()).candidates?.[0]?.content?.parts ?? [];
const img = parts.find((p) => p.inlineData?.data || p.inline_data?.data);
if (!img) { console.log('no image returned:', parts.map((p) => p.text).filter(Boolean).join(' ').slice(0, 200)); process.exit(1); }
const buf = Buffer.from(img.inlineData?.data ?? img.inline_data.data, 'base64');
const png = await sharp(buf).resize({ width: 1600, withoutEnlargement: true }).png().toBuffer();
fs.writeFileSync(OUT, png);
fs.writeFileSync(OUT.replace('.png', '-source.jpg'), await sharp(png).jpeg({ quality: 88 }).toBuffer());
const meta = await sharp(png).metadata();
console.log(`done in ${((Date.now() - started) / 1000).toFixed(0)}s: ${meta.width}x${meta.height}, ${(png.length / 1024).toFixed(0)} KB`);
