// A small picture of a vault door with a question mark on its face (for the App Store headers), drawn by the image model from a render that has a vault door in it.
//   node _tools/gen-question-door.mjs <a render with a vault door>      Output: _data/question-door.png (on magenta; make-app-store-headers.mjs cuts it out)
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
const ROOT = path.resolve(import.meta.dirname, '..');
const env = Object.fromEntries(fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split(/\r?\n/).filter((l) => l.includes('=') && !l.startsWith('#')).map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]));
const ref = (await sharp(process.argv[2]).flatten({ background: '#444' }).png().toBuffer()).toString('base64');
const PROMPT = 'The attached picture has a round steel vault door lying in a heap of rubble. Draw ONLY that vault door, the same design (a gear-shaped round steel door, thick bolts, heavy hinge, worn yellow and blue paint, rusty edges), seen from the front and slightly above, but with ONE large, crisp, white painted question mark (?) in the middle of its face and no numbers. Realistic Fallout 4 game-asset rendering, soft overcast light, the whole door in the picture with a little space round it, on a perfectly flat solid magenta (#FF00FF) background with no shadow on the background.';
for (let attempt = 0; attempt < 3; attempt++) {
  const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image:generateContent', {
    method: 'POST', headers: { 'x-goog-api-key': env.GEMINI_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: PROMPT }, { inline_data: { mime_type: 'image/png', data: ref } }] }], generationConfig: { responseModalities: ['TEXT', 'IMAGE'], imageConfig: { aspectRatio: '1:1' } } }),
  });
  if (!res.ok) { console.log(res.status); continue; }
  const body = await res.json();
  const part = (body.candidates?.[0]?.content?.parts ?? []).find((p) => p.inlineData?.data || p.inline_data?.data);
  if (!part) continue;
  fs.writeFileSync(path.join(ROOT, '_data', 'question-door.png'), Buffer.from((part.inlineData ?? part.inline_data).data, 'base64'));
  console.log('made');
  break;
}
