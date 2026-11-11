// A picture for behind the app icon's cogwheel: the destroyed city street (resources/icon-road-urban-crop.png) with a huge deathclaw looming over it, arms out, about to
// strike (the app's own deathclaw art is sent along as a look reference). Writes resources/icon-road-deathclaw.png. REDO=1 makes another.
//   node _tools/gen-icon-deathclaw.mjs
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = path.resolve(import.meta.dirname, '..');
const env = fs.existsSync(path.join(ROOT, '.env.local')) ? Object.fromEntries(fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split(/\r?\n/).filter((l) => l.includes('=') && !l.startsWith('#')).map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()])) : {};
const KEY = process.env.GEMINI_API_KEY || env.GEMINI_API_KEY;
if (!KEY) { console.log('No GEMINI_API_KEY in .env.local'); process.exit(1); }
const model = process.env.GEMINI_MODEL || 'gemini-3-pro-image';
const file = path.join(ROOT, 'resources', 'icon-road-deathclaw.png');
if (fs.existsSync(file) && !process.env.REDO) { console.log('done already (REDO=1 to make another)'); process.exit(0); }

const road = fs.readFileSync(path.join(ROOT, 'resources', 'icon-road-urban-crop.png'));
const claw = await sharp(path.join(ROOT, 'public', 'raid', 'enemies', 'deathclaw-2.webp')).resize(512, 512, { fit: 'contain', background: '#101010' }).png().toBuffer();

const prompt = `Two reference pictures follow. The FIRST is the scene to keep: a destroyed city street in full color, the road running to the horizon at the exact middle of the picture, walled in by collapsed buildings on both sides. The SECOND is the creature to add: a Fallout deathclaw (horned head, huge muscular body, long curved claws).
Make ONE new square picture in the same photographic, realistic, Fallout 4 gameplay style, with the same street, the same buildings, sky and lighting, the same road and horizon. Add a gigantic deathclaw LOOMING over the street, standing in the middle of the road, seen from the front at the viewer's eye level, towering so that its horned head reaches the top fifth of the picture and its body fills the middle of the picture. Its two arms are stretched OUT WIDE to the left and right, almost to the edges of the picture, with the long curved claws spread and raised, as if it is about to claw at someone, mouth open and snarling, looking straight at the viewer. Its head, shoulders, horns and the outstretched arms with the claws must be clearly visible; the middle of its chest and body can be darker and more shadowed, because a bright logo will cover the center. Backlit by the orange and sickly green haze, with smoke around it, dust, menacing and cinematic, slightly desaturated, dark vignette at the edges. The deathclaw is much bigger than the cars and fills the street. No text, no writing, no logos, no UI, no watermark, no cogwheel, no people.`;

const part = (data) => ({ inlineData: { mimeType: 'image/png', data: data.toString('base64') } });
const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
  method: 'POST', headers: { 'x-goog-api-key': KEY, 'Content-Type': 'application/json' },
  body: JSON.stringify({ contents: [{ parts: [{ text: prompt }, part(road), part(claw)] }], generationConfig: { responseModalities: ['TEXT', 'IMAGE'], imageConfig: { aspectRatio: '1:1' } } }),
});
if (!res.ok) { console.log('FAILED', res.status, (await res.text()).slice(0, 300)); process.exit(1); }
const body = await res.json();
const out = (body.candidates?.[0]?.content?.parts ?? []).find((p) => p.inlineData?.data || p.inline_data?.data);
if (!out) { console.log('no image returned', JSON.stringify(body).slice(0, 300)); process.exit(1); }
fs.writeFileSync(file, Buffer.from(out.inlineData?.data ?? out.inline_data.data, 'base64'));
console.log('wrote', file);
