// The picture behind the app icon's cogwheel: a destroyed road seen from the walker's own eyes, straight toward the horizon, which sits 70% of the way up.
// Writes resources/icon-road.png (kept in git, so the icon is the same every time). REDO=1 makes a new one.
//   node _tools/gen-icon-road.mjs
// make-app-art.mjs puts it behind the cog when the file exists (set ICON_BACKGROUND=plain there to go back to the plain dark background).
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const env = fs.existsSync(path.join(ROOT, '.env.local')) ? Object.fromEntries(fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split(/\r?\n/).filter((l) => l.includes('=') && !l.startsWith('#')).map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()])) : {};
const KEY = process.env.GEMINI_API_KEY || env.GEMINI_API_KEY;
if (!KEY) { console.log('No GEMINI_API_KEY in .env.local'); process.exit(1); }
const model = process.env.GEMINI_MODEL || 'gemini-3-pro-image';
const file = path.join(ROOT, 'resources', 'icon-road.png');
if (fs.existsSync(file) && !process.env.REDO) { console.log('done already (REDO=1 to make another)'); process.exit(0); }

const prompt = `A square first-person photograph-style game render, in the visual style of Fallout 4 gameplay, from the eye level of someone walking straight down the middle of a destroyed asphalt road, looking dead ahead at the horizon. The road runs straight away from the viewer to a single vanishing point in the exact horizontal center of the picture. The HORIZON LINE is a flat, level line located exactly 70% of the way up from the bottom edge of the picture (so the ground and road fill the lower 70%, and the sky only the top 30%). The road is cracked, buckled and heaved up, with potholes, tufts of dead weeds in the cracks, drifts of dust and gravel, scattered rubble and debris, and the last faded traces of a yellow center line. Along both sides: rusted wrecked cars, leaning broken utility poles with sagging wires, dead leafless trees, and low ruined buildings and broken walls, all shrinking toward the horizon. In the far distance, at the horizon, a few hazy collapsed building silhouettes. The sky is a heavy dusk haze of orange, sickly green and dark smoke, with soft radioactive glow near the horizon. Moody, desolate, slightly desaturated, dark overall (the edges of the picture are darker, like a vignette) so a bright logo can sit on top. Perfectly symmetrical perspective, camera held level. No people, no animals, no text, no writing, no logos, no UI, no watermark, no vault door, no cogwheel.`;

const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
  method: 'POST', headers: { 'x-goog-api-key': KEY, 'Content-Type': 'application/json' },
  body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseModalities: ['TEXT', 'IMAGE'], imageConfig: { aspectRatio: '1:1' } } }),
});
if (!res.ok) { console.log('FAILED', res.status, (await res.text()).slice(0, 200)); process.exit(1); }
const body = await res.json();
const part = (body.candidates?.[0]?.content?.parts ?? []).find((p) => p.inlineData?.data || p.inline_data?.data);
if (!part) { console.log('no image returned'); process.exit(1); }
fs.writeFileSync(file, Buffer.from(part.inlineData?.data ?? part.inline_data.data, 'base64'));
console.log('wrote', file);
