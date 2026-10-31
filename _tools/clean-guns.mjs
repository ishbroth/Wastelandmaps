// Keeps only the biggest connected piece of each gun picture (drops the stray muzzle-flash glow the image model paints), re-crops it,
// and records where the muzzle is (tipX) in the manifest. Run after process-raid-art.mjs.
import sharp from 'sharp';
import fs from 'node:fs';

const dir = 'public/raid/guns/';
const manifestPath = 'public/raid/manifest.json';
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.webp'))) {
  const id = file.replace('.webp', '');
  const { data, info } = await sharp(fs.readFileSync(dir + file)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  for (let i = 0; i < w * h; i++) { const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2]; if (r > 150 && b > 110 && b >= g + 6 && r - g > 20) data[i * 4 + 3] = 0; }
  if (id === "m82") for (let y = 0; y < h * 0.2; y++) for (let x = 0; x < w * 0.3; x++) { const k = (y * w + x) * 4; if (data[k] > data[k + 1] + 10 && data[k + 2] >= data[k + 1] - 5) data[k + 3] = 0; if (x < w * 0.15) data[k + 3] = 0; }
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
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
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
  let minX = w, maxX = 0, minY = h, maxY = 0;
  for (let i = 0; i < w * h; i++) {
    if (label[i] !== best) { data[i * 4 + 3] = 0; continue; }
    const x = i % w, y = (i - x) / w;
    if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y;
  }
  // the muzzle: the middle of the opaque pixels along the top few rows
  let sx = 0, sn = 0;
  for (let y = minY; y < Math.min(maxY, minY + 6); y++) for (let x = minX; x <= maxX; x++) if (label[y * w + x] === best) { sx += x; sn++; }
  const tip = sn ? sx / sn : (minX + maxX) / 2;
  const cw = maxX - minX + 1, ch = maxY - minY + 1;
  await sharp(data, { raw: { width: w, height: h, channels: 4 } })
    .extract({ left: minX, top: minY, width: cw, height: ch })
    .webp({ quality: 88, alphaQuality: 95 })
    .toBuffer().then((b) => fs.writeFileSync(dir + file, b));
  manifest.guns[id] = { ...manifest.guns[id], w: cw, h: ch, tipX: +((tip - minX) / cw).toFixed(3) };
  console.log(id, `${cw}x${ch}`, 'tipX', manifest.guns[id].tipX);
}
manifest.guns.m82.tipX = 0.19; // the top rows are the scope, the muzzle is the far left tip
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 1));
