// Cuts the magenta out of the hand-free gun pictures (_data/gunicons/*.png), trims them and writes small webp files to public/raid/gunicons/.   node _tools/process-gun-icons.mjs
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
const ROOT = path.resolve(import.meta.dirname, '..');
const IN = path.join(ROOT, '_data', 'gunicons'), OUT = path.join(ROOT, 'public', 'raid', 'gunicons');
fs.mkdirSync(OUT, { recursive: true });
for (const f of fs.readdirSync(IN).filter((x) => x.endsWith('.png'))) {
  const { data, info } = await sharp(path.join(IN, f)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let x0 = info.width, y0 = info.height, x1 = 0, y1 = 0;
  for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
    const i = (y * info.width + x) * 4, r = data[i], g = data[i + 1], b = data[i + 2], m = Math.min(r, b) - g;
    if (m > 6 && m <= 70) { const sub = m * 0.85; data[i] = Math.max(0, r - sub); data[i + 2] = Math.max(0, b - sub); }
    if (m > 70) data[i + 3] = 0; else if (m > 35) data[i + 3] = Math.round(255 * (1 - (m - 35) / 35));
    if (data[i + 3] > 40) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  const box = { left: x0, top: y0, width: Math.max(8, x1 - x0 + 1), height: Math.max(8, y1 - y0 + 1) };
  const sc = Math.min(1, 220 / Math.max(box.width, box.height));
  await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).extract(box).resize(Math.round(box.width * sc), Math.round(box.height * sc)).webp({ quality: 88, alphaQuality: 95 }).toFile(path.join(OUT, f.replace('.png', '.webp')));
}
console.log('gun icons written');
