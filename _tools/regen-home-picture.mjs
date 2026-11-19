// Draws a home picture again from a base render: the vault door with the number added, using the same prompt as the server (unlock-streetview addVault).
// node _tools/regen-home-picture.mjs base.png 0730 out.png
import fs from 'node:fs';
const [, , baseFile, number, outFile] = process.argv;
const key = fs.readFileSync('.env.local', 'utf8').match(/GEMINI_API_KEY=(.*)/)[1].trim();
const src = fs.readFileSync('supabase/functions/unlock-streetview/index.ts', 'utf8').split(/\r?\n/);
const line = src.find((l) => l.startsWith("  const prompt = 'This is a post-apocalyptic render of a ruined building."));
const prompt = new Function('number', line.trim().replace(/^const prompt = /, 'return ').replace(/;$/, ';'))(number);
const model = process.env.GEMINI_MODEL || 'gemini-3-pro-image';
const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
  method: 'POST', headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json' },
  body: JSON.stringify({ contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: 'image/png', data: fs.readFileSync(baseFile).toString('base64') } }] }], generationConfig: { responseModalities: ['TEXT', 'IMAGE'] } }),
});
if (!res.ok) { console.error('image model said', res.status, (await res.text()).slice(0, 300)); process.exit(1); }
const body = await res.json();
const part = (body.candidates?.[0]?.content?.parts ?? []).find((p) => p.inlineData?.data || p.inline_data?.data);
const b64 = part?.inlineData?.data ?? part?.inline_data?.data;
if (!b64) { console.error('no image returned'); process.exit(1); }
fs.writeFileSync(outFile, Buffer.from(b64, 'base64'));
console.log('wrote', outFile, fs.statSync(outFile).size, 'bytes');
