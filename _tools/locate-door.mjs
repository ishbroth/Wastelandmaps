// Asks the vision model where the four digits on the vault door are: node _tools/locate-door.mjs picture.png  (prints a pixel box)
import fs from 'node:fs';
import sharp from 'sharp';
const key = fs.readFileSync('.env.local', 'utf8').match(/GEMINI_API_KEY=(.*)/)[1].trim();
const file = process.argv[2];
const meta = await sharp(file).metadata();
const b64 = fs.readFileSync(file).toString('base64');
const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent', {
  method: 'POST', headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json' },
  body: JSON.stringify({ contents: [{ parts: [{ text: 'This picture has a round vault door with a four-digit number painted on it. Find that number. Reply with JSON only: {"box_2d":[ymin,xmin,ymax,xmax]}, coordinates normalized to 0-1000, as tight as you can around the four digits (not the whole door).' }, { inline_data: { mime_type: 'image/png', data: b64 } }] }], generationConfig: { temperature: 0, responseMimeType: 'application/json', thinkingConfig: { thinkingBudget: 0 } } }),
});
const body = await res.json();
const text = body.candidates?.[0]?.content?.parts?.[0]?.text ?? JSON.stringify(body).slice(0, 300);
console.log(text);
const box = JSON.parse(text).box_2d;
const [y0, x0, y1, x1] = box;
console.log([Math.round(x0 / 1000 * meta.width), Math.round(y0 / 1000 * meta.height), Math.round((x1 - x0) / 1000 * meta.width), Math.round((y1 - y0) / 1000 * meta.height)].join(' '));
