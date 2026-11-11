// Re-colors the deathclaw picture (resources/icon-road-deathclaw-high.png) toward Fallout 4 gameplay coloration (richer, more saturated, more varied color) while
// keeping the composition exactly the same, so the cogwheel still sits where it did. Writes resources/icon-road-deathclaw-color.png. REDO=1 makes another.
//   node _tools/gen-icon-deathclaw-color.mjs
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = path.resolve(import.meta.dirname, '..');
const env = fs.existsSync(path.join(ROOT, '.env.local')) ? Object.fromEntries(fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split(/\r?\n/).filter((l) => l.includes('=') && !l.startsWith('#')).map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()])) : {};
const KEY = process.env.GEMINI_API_KEY || env.GEMINI_API_KEY;
if (!KEY) { console.log('No GEMINI_API_KEY in .env.local'); process.exit(1); }
const model = process.env.GEMINI_MODEL || 'gemini-3-pro-image';
const file = path.join(ROOT, 'resources', process.env.OUT || 'icon-road-deathclaw-color.png');
if (fs.existsSync(file) && !process.env.REDO) { console.log('done already (REDO=1 to make another)'); process.exit(0); }

const src = await sharp(path.join(ROOT, 'resources', 'icon-road-deathclaw-high.png')).resize(1024, 1024).png().toBuffer();
const prompt = `Re-color this picture so it looks like the vivid, colorful Fallout 4 gameplay look instead of the muddy brown-green Fallout 3 look. KEEP THE COMPOSITION, POSES, SHAPES AND DETAILS EXACTLY THE SAME (same deathclaw in the same pose, same ruined buildings, same rubble, same car, same road, same framing) - only change the colors and lighting.
Fallout 4 palette: a bright saturated sky with warm orange, golden and pink glow near the horizon fading to clear teal-blue and soft green higher up, with luminous clouds; red-orange brick on the ruined buildings, faded blue, teal and yellow painted walls, rusty orange metal, a rusty red-orange car; weathered warm-gray concrete and asphalt with a yellow road line and white line clearly visible; lush green weeds and moss growing in the rubble; sunlit warm highlights and cool blue shadows. The deathclaw gets rich color too: warm sandy tan and ochre hide with reddish-brown and olive-green variation, lighter pale belly and chest, dark bone-brown horns, orange rim light from the sunset, glowing amber eyes, pinkish mouth. Higher contrast and saturation, much less brown and gray, but still a post-apocalyptic mood. Keep the dark vignette at the bottom corners. No text, no logos, no watermark.`;
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
