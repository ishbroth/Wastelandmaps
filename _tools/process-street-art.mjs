// Turns _data/street/*.png into the game's pieces in public/street/: ground textures made seamless (a half-shifted copy faded in over the seams) at 512 px, and sprites with the
// magenta cut out and the empty margin trimmed.     node _tools/process-street-art.mjs
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = path.resolve(import.meta.dirname, '..');
const IN = path.join(ROOT, '_data', 'street');
const OUT = path.join(ROOT, 'public', 'street');
fs.mkdirSync(OUT, { recursive: true });
const TEXTURES = ['asphalt', 'asphalt2', 'dirt', 'dirt2', 'dirt3', 'dirt4', 'grass', 'grass2', 'debris1', 'debris2', 'debris3', 'sidewalk'];
const manifest = { textures: [], sprites: {} };

for (const name of fs.readdirSync(IN).filter((f) => f.endsWith('.png')).map((f) => f.replace('.png', ''))) {
  const src = path.join(IN, name + '.png');
  if (name.startsWith('sky-')) {
    // a sky: 2048 wide, its left and right edges blended so it wraps round without a seam (the last fifth fades into the first)
    const W = 2048;
    const meta = await sharp(src).metadata();
    const Hh = Math.round(W * (meta.height / meta.width));
    const { data } = await sharp(src).resize(W, Hh, { fit: 'fill' }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const B = Math.round(W * 0.2), Wc = W - B, out = Buffer.alloc(Wc * Hh * 3);
    for (let y = 0; y < Hh; y++) for (let x = 0; x < Wc; x++) {
      const o = (y * Wc + x) * 3, i = (y * W + x) * 3;
      if (x < B) { const w = x / B, j = (y * W + Wc + x) * 3; for (let c = 0; c < 3; c++) out[o + c] = Math.round(data[i + c] * w + data[j + c] * (1 - w)); } // the start continues from the cut-off end
      else for (let c = 0; c < 3; c++) out[o + c] = data[i + c];
    }
    await sharp(out, { raw: { width: Wc, height: Hh, channels: 3 } }).webp({ quality: 78 }).toFile(path.join(OUT, name + '.webp'));
    continue;
  }
  if (TEXTURES.includes(name)) {
    const S = 512;
    // the road is lightened and warmed to match the roads in the rendered photographs (a dusty tan grey, not near black)
    let base = sharp(src).resize(S, S, { fit: 'cover' }).removeAlpha();
    if (name.startsWith('asphalt')) base = base.modulate({ saturation: 0.55, brightness: 0.9 }); // the street's grey-brown, less yellow
    const { data } = await base.raw().toBuffer({ resolveWithObject: true });
    // seamless: blend each pixel with the pixel half a tile away, weighted so the seams (the edges) come entirely from the shifted copy
    const out = Buffer.alloc(data.length);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const i = (y * S + x) * 3, j = (((y + S / 2) % S) * S + ((x + S / 2) % S)) * 3;
      const wx = Math.min(x, S - 1 - x) / (S / 2), wy = Math.min(y, S - 1 - y) / (S / 2);
      const w = Math.min(1, Math.min(wx, wy) * 2.2); // 0 at the edge (all from the shifted copy), 1 well inside
      for (let c = 0; c < 3; c++) out[i + c] = Math.round(data[i + c] * w + data[j + c] * (1 - w));
    }
    await sharp(out, { raw: { width: S, height: S, channels: 3 } }).webp({ quality: 84 }).toFile(path.join(OUT, `tex-${name}.webp`));
    manifest.textures.push(name);
    continue;
  }
  const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let x0 = info.width, y0 = info.height, x1 = 0, y1 = 0;
  for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
    const i = (y * info.width + x) * 4;
    const r = data[i], g = data[i + 1], b = data[i + 2];
    // how magenta: red and blue well above green
    const m = Math.min(r, b) - g;
    if (m > 6 && m <= 70) { const sub = m * 0.85; data[i] = Math.max(0, data[i] - sub); data[i + 2] = Math.max(0, data[i + 2] - sub); } // no pink left on the edges
    if (m > 70) data[i + 3] = 0;
    else if (m > 35) data[i + 3] = Math.round(255 * (1 - (m - 35) / 35));
    if (m > 35 && m <= 70) { const k = 1 - (m - 35) / 35; data[i] = Math.round(r * k + g * (1 - k)); data[i + 2] = Math.round(b * k + g * (1 - k)); } // no pink fringe
    if (data[i + 3] > 40) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  const box = { left: x0, top: y0, width: Math.max(8, x1 - x0 + 1), height: Math.max(8, y1 - y0 + 1) };
  const img = sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).extract(box);
  const scale = Math.min(1, 720 / Math.max(box.width, box.height));
  const w = Math.round(box.width * scale), h = Math.round(box.height * scale);
  await img.resize(w, h).webp({ quality: 86, alphaQuality: 95 }).toFile(path.join(OUT, `${name}.webp`));
  manifest.sprites[name] = { w, h };
}
fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(manifest));
console.log('textures', manifest.textures.length, 'sprites', Object.keys(manifest.sprites).length);
