// A small picture of a vault door with a question mark on its face (for the App Store headers), drawn by the image model (a solid round disc partly slid out of its frame: vault doors never open on hinges).
//   node _tools/gen-question-door.mjs      Output: _data/question-door.png (on magenta; make-app-store-headers.mjs cuts it out)
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
const ROOT = path.resolve(import.meta.dirname, '..');
const env = Object.fromEntries(fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split(/\r?\n/).filter((l) => l.includes('=') && !l.startsWith('#')).map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]));
const PROMPT = 'A Fallout-style vault door lying in rubble, seen from above at an angle: a massive thick round steel gear-toothed disc whose face is ONE solid, unbroken round surface (no seam, no split down the middle, no hinges, no handles: it is NOT a hinged or barn-style door), thick bolts around its rim, worn yellow and blue paint with rust, and ONE large crisp white painted question mark (?) in the middle of the face and no numbers. It is partly open the way a manhole cover sits when it has been slid partly off: the whole solid disc has pushed out of its round concrete frame and shifted to one side and tilted a little, leaving part of a dark round opening visible beside it. Realistic Fallout 4 game-asset rendering, soft overcast light, the whole thing in the picture with a little space round it, on a perfectly flat solid magenta (#FF00FF) background with no shadow on the background.';
for (let attempt = 0; attempt < 3; attempt++) {
  const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image:generateContent', {
    method: 'POST', headers: { 'x-goog-api-key': env.GEMINI_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: PROMPT }] }], generationConfig: { responseModalities: ['TEXT', 'IMAGE'], imageConfig: { aspectRatio: '1:1' } } }),
  });
  if (!res.ok) { console.log(res.status); continue; }
  const body = await res.json();
  const part = (body.candidates?.[0]?.content?.parts ?? []).find((p) => p.inlineData?.data || p.inline_data?.data);
  if (!part) continue;
  fs.writeFileSync(path.join(ROOT, '_data', 'question-door.png'), Buffer.from((part.inlineData ?? part.inline_data).data, 'base64'));
  console.log('made');
  break;
}
