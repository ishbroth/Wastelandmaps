// Re-frames the deathclaw picture (resources/icon-road-deathclaw.png) so the creature looms around where the cogwheel will sit: a guide picture marks the cog's footprint
// (a red circle), the head must be above it and the shoulders and outstretched arms around it, so they show over and beside the cog.
// Writes resources/icon-road-deathclaw-tall.png. REDO=1 makes another.   node _tools/gen-icon-deathclaw-taller.mjs
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = path.resolve(import.meta.dirname, '..');
const env = fs.existsSync(path.join(ROOT, '.env.local')) ? Object.fromEntries(fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split(/\r?\n/).filter((l) => l.includes('=') && !l.startsWith('#')).map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()])) : {};
const KEY = process.env.GEMINI_API_KEY || env.GEMINI_API_KEY;
if (!KEY) { console.log('No GEMINI_API_KEY in .env.local'); process.exit(1); }
const model = process.env.GEMINI_MODEL || 'gemini-3-pro-image';
const file = path.join(ROOT, 'resources', 'icon-road-deathclaw-tall.png');
if (fs.existsSync(file) && !process.env.REDO) { console.log('done already (REDO=1 to make another)'); process.exit(0); }

const R = 346; // the cogwheel's outer radius in the 1024 picture (76.5% size)
const circle = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024"><circle cx="512" cy="512" r="${R}" fill="rgba(255,0,0,0.55)" stroke="#ff0000" stroke-width="6"/></svg>`);
const guide = await sharp(path.join(ROOT, 'resources', 'icon-road-urban-crop.png')).resize(1024, 1024).composite([{ input: circle }]).png().toBuffer();
const claw = await sharp(path.join(ROOT, 'public', 'raid', 'enemies', 'deathclaw-2.webp')).resize(512, 512, { fit: 'contain', background: '#101010' }).png().toBuffer();
const part = (b) => ({ inlineData: { mimeType: 'image/png', data: b.toString('base64') } });

const prompt = `Two pictures follow. The FIRST is a destroyed city street (full color, realistic Fallout 4 gameplay style) with a big RED CIRCLE drawn on it: the circle is only a guide that marks where a round logo will be placed over the final picture, and it will hide whatever is inside it. The SECOND is a Fallout deathclaw to use as the look of the creature.
Make ONE new square picture of that same street (same ruined buildings on both sides, same road to the horizon at the middle, same orange and sickly-green hazy dusk, same lighting) WITHOUT the red circle drawn in it, with a gigantic deathclaw LOOMING right behind where the circle is. Compose the creature around the circle so that nothing important is hidden by it: the deathclaw's WHOLE horned head, with its face and open snarling mouth, is entirely ABOVE the top of the circle, in the top 16% of the picture, its horns reaching near the top edge; its broad shoulders are at the top left and top right of the circle; and its two long muscular arms are stretched OUT WIDE, passing around the sides of the circle, with the elbows bent and the long curved claws spread open and raised at the far left and far right of the picture at about 35% to 55% of the height, as if about to claw at someone, looking straight at the viewer. Its body is hidden behind the circle's area (the middle of the picture can be dark, dusty and in shadow), and its feet or legs may show below the circle on the road. It is huge, towering over the cars and the buildings. Cinematic, moody, backlit by the haze, slightly desaturated, dark vignette. No text, no writing, no logos, no UI, no watermark, no cogwheel, no red circle, no people.`;
const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
  method: 'POST', headers: { 'x-goog-api-key': KEY, 'Content-Type': 'application/json' },
  body: JSON.stringify({ contents: [{ parts: [{ text: prompt }, part(guide), part(claw)] }], generationConfig: { responseModalities: ['TEXT', 'IMAGE'], imageConfig: { aspectRatio: '1:1' } } }),
});
if (!res.ok) { console.log('FAILED', res.status, (await res.text()).slice(0, 300)); process.exit(1); }
const body = await res.json();
const out = (body.candidates?.[0]?.content?.parts ?? []).find((p) => p.inlineData?.data || p.inline_data?.data);
if (!out) { console.log('no image returned', JSON.stringify(body).slice(0, 300)); process.exit(1); }
fs.writeFileSync(file, Buffer.from(out.inlineData?.data ?? out.inline_data.data, 'base64'));
console.log('wrote', file);
