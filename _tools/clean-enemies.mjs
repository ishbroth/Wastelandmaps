// Keeps only the biggest connected piece of each enemy picture (drops stray glows and specks the image model leaves beside a figure) and re-crops it.
//   node _tools/clean-enemies.mjs [--check]   (--check only reports what it would remove)
import sharp from 'sharp';
import fs from 'node:fs';

const dir = 'public/raid/enemies/';
const check = process.argv.includes('--check');
const manifestPath = 'public/raid/manifest.json';
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
let changed = 0;
for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.webp'))) {
  const { data, info } = await sharp(fs.readFileSync(dir + file)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  // the magenta of the keying background leaves a pink haze on some figures: it is made see-through
  let pink = 0;
  for (let i = 0; i < w * h; i++) { const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2]; if (data[i * 4 + 3] > 0 && r > 170 && b > 120 && r - g > 28 && b - g > 14 && b > r - 70) { data[i * 4 + 3] = 0; pink++; } }
  // a bright haze washing in from a corner (the key background's glow) is removed too: flood in from each corner over bright pixels
  for (const start of [0, w - 1, (h - 1) * w, h * w - 1]) {
    const bright = (i) => data[i * 4 + 3] > 0 && 0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2] > 150;
    if (!bright(start)) continue;
    const seen = new Uint8Array(w * h);
    const stack = [start];
    const region = [];
    seen[start] = 1;
    while (stack.length) {
      const q = stack.pop();
      region.push(q);
      const x = q % w, y = (q - x) / w;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const r = ny * w + nx;
        if (!seen[r] && bright(r)) { seen[r] = 1; stack.push(r); }
      }
    }
    if (region.length > 1500) { for (const q of region) data[q * 4 + 3] = 0; pink += region.length; }
  }
  const label = new Int32Array(w * h);
  const sizes = [0];
  let next = 0;
  for (let i = 0; i < w * h; i++) {
    if (label[i] || data[i * 4 + 3] < 40) continue;
    next++;
    let n = 0;
    const stack = [i];
    label[i] = next;
    while (stack.length) {
      const p = stack.pop();
      n++;
      const x = p % w, y = (p - x) / w;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const q = ny * w + nx;
        if (!label[q] && data[q * 4 + 3] >= 40) { label[q] = next; stack.push(q); }
      }
    }
    sizes.push(n);
  }
  let best = 1;
  for (let k = 2; k < sizes.length; k++) if (sizes[k] > sizes[best]) best = k;
  const extra = sizes.slice(1).reduce((a, b) => a + b, 0) - sizes[best];
  if (extra === 0 && pink < 30) continue;
  console.log(file, 'pieces', sizes.length - 1, 'biggest', sizes[best], 'removed', extra, 'pink', pink);
  if (check) continue;
  let minX = w, maxX = 0, minY = h, maxY = 0;
  for (let i = 0; i < w * h; i++) {
    if (label[i] !== best) { data[i * 4 + 3] = 0; continue; }
    const x = i % w, y = (i - x) / w;
    if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y;
  }
  changed++;
  fs.writeFileSync(dir + file, await sharp(data, { raw: { width: w, height: h, channels: 4 } }).webp({ quality: 90, alphaQuality: 95 }).toBuffer());
}
console.log(check ? 'check done' : `cleaned ${changed} pictures (sizes are unchanged: the frames keep their canvas so the figures stay aligned)`);
