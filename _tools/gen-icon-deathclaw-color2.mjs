// Pushes the colour of the deathclaw picture (resources/icon-road-deathclaw-color.png) further: redder brick, a bluer sky, a little more colour everywhere, with the composition
// exactly the same so the cogwheel still sits where it did. Writes resources/icon-road-deathclaw-color2.png. REDO=1 makes another.   node _tools/gen-icon-deathclaw-color2.mjs
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = path.resolve(import.meta.dirname, '..');
const env = fs.existsSync(path.join(ROOT, '.env.local')) ? Object.fromEntries(fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split(/\r?\n/).filter((l) => l.includes('=') && !l.startsWith('#')).map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()])) : {};
const KEY = process.env.GEMINI_API_KEY || env.GEMINI_API_KEY;
if (!KEY) { console.log('No GEMINI_API_KEY in .env.local'); process.exit(1); }
const model = process.env.GEMINI_MODEL || 'gemini-3-pro-image';
const file = path.join(ROOT, 'resources', process.env.OUT || 'icon-road-deathclaw-color2.png');
if (fs.existsSync(file) && !process.env.REDO) { console.log('done already (REDO=1 to make another)'); process.exit(0); }

const src = await sharp(path.join(ROOT, 'resources', 'icon-road-deathclaw-color.png')).resize(1024, 1024).png().toBuffer();
const prompt = `Re-color this picture with a bit MORE color, keeping the composition, poses, shapes and details EXACTLY the same (same deathclaw in the same pose, same ruined buildings, rubble, car and road, same framing): only change the colors.
Make the BRICKS a much redder, richer brick red and red-orange on every ruined building and in the rubble piles. Make the SKY clearly BLUER: a clear teal and cornflower blue with soft bright clouds, keeping only a thin warm orange and pink glow near the horizon behind the buildings. Keep the other Fallout 4 gameplay colors (rusty orange metal, blue and teal painted walls, green weeds and moss, the deathclaw's sandy tan and ochre hide with its amber eyes and warm rim light, yellow road line), but push the saturation and contrast up a little so everything looks more colorful and vivid, with warm sunlit highlights and cool blue shadows. Still a post-apocalyptic scene. Keep the dark vignette at the bottom corners. No text, no logos, no watermark.`;
const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
  method: 'POST', headers: { 'x-goog-api-key': KEY, 'Content-Type': 'application/json' },
  body: JSON.stringify({ contents: [{ parts: [{ text: prompt }, { inlineData: { mimeType: 'image/png', data: src.toString('base64') } }] }], generationConfig: { responseModalities: ['TEXT', 'IMAGE'], imageConfig: { aspectRatio: '1:1' } } }),
});
if (!res.ok) { console.log('FAILED', res.status, (await res.text()).slice(0, 300)); process.exit(1); }
const body = await res.json();
const out = (body.candidates?.[0]?.content?.parts ?? []).find((p) => p.inlineData?.data || p.inline_data?.data);
if (!out) { console.log('no image returned', JSON.stringify(body).slice(0, 300)); process.exit(1); }
fs.writeFileSync(file, Buffer.from(out.inlineData?.data ?? out.inline_data.data, 'base64'));
console.log('wrote', file);
