// Makes the street's ground textures in the style and coloration of a reference render (the road and driveway of a rendered house), with the image model.
//   node _tools/gen-street-ref.mjs <reference.png>        Output: _data/street/<name>.png (the old ones are kept as <name>.old.png)
import fs from 'node:fs';
import path from 'node:path';
const ROOT = path.resolve(import.meta.dirname, '..');
const OUT = path.join(ROOT, '_data', 'street');
const env = Object.fromEntries(fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split(/\r?\n/).filter((l) => l.includes('=') && !l.startsWith('#')).map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]));
const KEY = process.env.GEMINI_API_KEY || env.GEMINI_API_KEY;
const ref = fs.readFileSync(process.argv[2]).toString('base64');
const BASE = 'The attached picture is a rendered post-apocalyptic house with its street, cracked concrete driveway and sidewalk, and dry grass at the bottom. Use it ONLY as the reference for COLOR, LIGHTING and RENDERING STYLE (warm, slightly stylized and painterly, bold readable cracks, lightly cartoony game art, not photographic). Create a seamless tileable ground texture seen from DIRECTLY ABOVE (flat orthographic, no perspective, no horizon, no objects, no shadows from tall things), filling the whole square image edge to edge, with no lane markings and no text, that tiles with no visible seam: ';
const PROMPTS = {
  asphalt: BASE + 'the cracked asphalt of the street, exactly the same grey-brown warm coloration as the street in the picture, with bold clearly visible cracks, a few missing chunks showing darker base, patches of lighter faded tan and a few weeds in the cracks.',
  asphalt2: BASE + 'the street asphalt more heavily broken: wide cracks, patched sections, crumbled edges and small potholes, the same warm grey-brown coloration as the street in the picture, with dust and a little dry grass in the cracks.',
  sidewalk: BASE + 'the cracked light warm concrete of the driveway and sidewalk, exactly the coloration of the concrete in the picture (pale warm grey-tan), with expansion joints, bold cracks, stains and tufts of dry grass in the joints.',
};
for (const name of process.argv.slice(3).length ? process.argv.slice(3) : Object.keys(PROMPTS)) {
  const file = path.join(OUT, `${name}.png`);
  if (fs.existsSync(file) && !fs.existsSync(file.replace('.png', '.old.png'))) fs.copyFileSync(file, file.replace('.png', '.old.png'));
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image:generateContent', {
      method: 'POST', headers: { 'x-goog-api-key': KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: PROMPTS[name] }, { inline_data: { mime_type: 'image/png', data: ref } }] }], generationConfig: { responseModalities: ['TEXT', 'IMAGE'], imageConfig: { aspectRatio: '1:1' } } }),
    });
    if (!res.ok) { console.log(name, res.status); continue; }
    const body = await res.json();
    const part = (body.candidates?.[0]?.content?.parts ?? []).find((p) => p.inlineData?.data || p.inline_data?.data);
    if (!part) continue;
    fs.writeFileSync(file, Buffer.from((part.inlineData ?? part.inline_data).data, 'base64'));
    console.log(name, 'made');
    break;
  }
}
