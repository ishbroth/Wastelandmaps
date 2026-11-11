// A picture for behind the app icon's cogwheel: a destroyed city street in full color, walled in on both sides by wreckage, the horizon at the middle.
// Writes resources/icon-road-urban.png (kept in git, so the icon is the same every time). REDO=1 makes a new one.
//   node _tools/gen-icon-road-urban.mjs
// make-app-art.mjs puts it behind the cog when the file exists (set ICON_BACKGROUND=plain there to go back to the plain dark background).
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const env = fs.existsSync(path.join(ROOT, '.env.local')) ? Object.fromEntries(fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split(/\r?\n/).filter((l) => l.includes('=') && !l.startsWith('#')).map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()])) : {};
const KEY = process.env.GEMINI_API_KEY || env.GEMINI_API_KEY;
if (!KEY) { console.log('No GEMINI_API_KEY in .env.local'); process.exit(1); }
const model = process.env.GEMINI_MODEL || 'gemini-3-pro-image';
const file = path.join(ROOT, 'resources', 'icon-road-urban.png');
if (fs.existsSync(file) && !process.env.REDO) { console.log('done already (REDO=1 to make another)'); process.exit(0); }

const prompt = `A square first-person photograph-style game render, in the visual style of Fallout 4 gameplay, in full natural color, from the eye level of someone standing in the middle of a destroyed city street, looking dead ahead at the horizon. The road runs straight away from the viewer through the exact middle of the picture to a single vanishing point in the exact horizontal center. The HORIZON LINE is a flat, level line located exactly at the vertical middle of the picture (50% of the way up from the bottom edge, so the ground and road fill the lower half and the sky the upper half). The asphalt is cracked, buckled and heaved, with potholes, dead weeds in the cracks, drifts of dust and gravel, scattered rubble, and the last faded traces of a yellow center line, a wrecked rusted car or two. This is an URBAN street: on BOTH sides it is walled in by heaps of building wreckage, collapsed brick and concrete buildings, broken facades with empty windows, twisted rebar and steel, piles of junk and debris, forming an almost continuous wall of ruins along the left and right edges of the picture (only slightly visible, mostly toward the outer edges, so the road itself stays the clear center of the picture), all shrinking toward the horizon. At the far end, a few hazy collapsed skyscraper silhouettes. The sky is a heavy dusk haze of orange, sickly green and dark smoke with a soft glow near the horizon. Realistic, photographic, moody, slightly desaturated, dark overall (the edges darker, like a vignette) so a bright logo can sit on top. Perfectly symmetrical one-point perspective, camera held level. No people, no animals, no text, no writing, no logos, no UI, no watermark, no vault door, no cogwheel.`;

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
