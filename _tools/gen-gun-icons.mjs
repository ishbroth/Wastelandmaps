// Makes a small hand-free picture of each gun for the Data tab: the first-person picture of the gun (with the hands) goes to the image model, which draws the gun alone,
// side-on and level, on flat magenta; process-gun-icons.mjs cuts the magenta out.     node _tools/gen-gun-icons.mjs [id ...]      Output: _data/gunicons/<id>.png
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
const ROOT = path.resolve(import.meta.dirname, '..');
const OUT = path.join(ROOT, '_data', 'gunicons');
fs.mkdirSync(OUT, { recursive: true });
const env = Object.fromEntries(fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split(/\r?\n/).filter((l) => l.includes('=') && !l.startsWith('#')).map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]));
const KEY = process.env.GEMINI_API_KEY || env.GEMINI_API_KEY;
const GUNS = fs.readdirSync(path.join(ROOT, 'public', 'raid', 'guns')).filter((f) => f.endsWith('.webp')).map((f) => f.replace('.webp', ''));
const ids = process.argv.slice(2).length ? process.argv.slice(2) : GUNS;
const PROMPT = 'The attached picture is a first-person view of a gun held in gloved hands. Draw ONLY THE GUN, exactly this model with all its details, colors, wear and attachments (scope, magazine, stock and so on), as a clean side view (a profile, flat and level, the barrel pointing to the right), with NO hands, NO arms, NO gloves, NO sleeves, nothing holding it. Realistic game-asset rendering in the style of Fallout 4 weapons, soft overcast light, centered with a little space round it, on a perfectly flat solid magenta (#FF00FF) background with no shadow on the background.';
for (const id of ids) {
  const file = path.join(OUT, `${id}.png`);
  if (fs.existsSync(file) && !process.env.REDO) { console.log(id, 'done already'); continue; }
  const ref = (await sharp(path.join(ROOT, 'public', 'raid', 'guns', `${id}.webp`)).flatten({ background: '#3a3a3a' }).png().toBuffer()).toString('base64');
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image:generateContent', {
      method: 'POST', headers: { 'x-goog-api-key': KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: PROMPT }, { inline_data: { mime_type: 'image/png', data: ref } }] }], generationConfig: { responseModalities: ['TEXT', 'IMAGE'], imageConfig: { aspectRatio: '1:1' } } }),
    });
    if (!res.ok) { console.log(id, res.status); continue; }
    const body = await res.json();
    const part = (body.candidates?.[0]?.content?.parts ?? []).find((p) => p.inlineData?.data || p.inline_data?.data);
    if (!part) continue;
    fs.writeFileSync(file, Buffer.from((part.inlineData ?? part.inline_data).data, 'base64'));
    console.log(id, 'made');
    break;
  }
}
