// Cuts the magenta out of the raid art and writes small transparent images for the game:
//   node _tools/process-raid-art.mjs [name ...]
// Input:  _data/raid/<name>.png (enemy sprite sheets, 2x2 frames: walk, walk, attack, dead; and first-person gun views)
// Output: public/raid/enemies/<name>-<0..3>.webp, public/raid/guns/<name>.webp and public/raid/manifest.json
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = path.resolve(import.meta.dirname, '..');
const IN = path.join(ROOT, '_data', 'raid');
const OUT = path.join(ROOT, 'public', 'raid');
fs.mkdirSync(path.join(OUT, 'enemies'), { recursive: true });
fs.mkdirSync(path.join(OUT, 'guns'), { recursive: true });
const manifestFile = path.join(OUT, 'manifest.json');
const manifest = fs.existsSync(manifestFile) ? JSON.parse(fs.readFileSync(manifestFile, 'utf8')) : { enemies: {}, guns: {} };

const ENEMY = new Set(['raider', 'ghoul', 'radroach', 'molerat', 'bloatfly', 'radscorpion', 'mirelurk', 'supermutant', 'robot', 'deathclaw', 'gangrenousghoul', 'glowingbloatfly', 'mirelurkqueen', 'behemoth']);

/** Raw RGBA of an image region with the magenta background made transparent. */
async function keyed(input, region) {
  let img = sharp(input);
  if (region) img = img.extract(region);
  const { data, info } = await img.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    // how magenta a pixel is: both red and blue well above green (skin, fur and metal are not)
    const m = Math.min(r, b) - g;
    let a = 255;
    if (m > 40) a = 0;
    else if (m > 12) a = Math.round(255 * (40 - m) / 28);
    if (a < 255) {
      // the edge keeps no pink: pull red and blue down toward green
      data[i] = Math.min(r, g + 24);
      data[i + 2] = Math.min(b, g + 24);
    }
    data[i + 3] = a;
  }
  return { data, width: info.width, height: info.height };
}

/** The box around the picture: the rows and columns with real substance (a few stray pixels of glow do not count). */
function bounds({ data, width, height }) {
  const cols = new Array(width).fill(0), rows = new Array(height).fill(0);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    if (data[(y * width + x) * 4 + 3] > 100) { cols[x]++; rows[y]++; }
  }
  const first = (counts, min) => counts.findIndex((n) => n >= min);
  const last = (counts, min) => counts.length - 1 - [...counts].reverse().findIndex((n) => n >= min);
  const x0 = first(cols, 6), x1 = last(cols, 6), y0 = first(rows, 6), y1 = last(rows, 6);
  return x0 < 0 || y0 < 0 || x1 < x0 || y1 < y0 ? null : { left: x0, top: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 };
}

const names = process.argv.slice(2).length ? process.argv.slice(2) : fs.readdirSync(IN).filter((f) => f.endsWith('.png')).map((f) => f.replace('.png', ''));
for (const name of names) {
  const file = path.join(IN, `${name}.png`);
  if (!fs.existsSync(file)) { console.log(name, 'missing'); continue; }
  const meta = await sharp(file).metadata();
  const W = meta.width, H = meta.height;
  if (ENEMY.has(name)) {
    // four quadrants, with a margin so the thin dividing lines are left out
    const qw = Math.floor(W / 2), qh = Math.floor(H / 2), pad = 10;
    const frames = [];
    for (let q = 0; q < 4; q++) {
      const region = { left: (q % 2) * qw + pad, top: Math.floor(q / 2) * qh + pad, width: qw - pad * 2, height: qh - pad * 2 };
      const k = await keyed(file, region);
      const box = bounds(k);
      frames.push({ k, box });
    }
    // one scale for the whole sheet: the tallest frame (a walking pose) becomes 340 px high
    const tallest = Math.max(...frames.map((f) => f.box?.height ?? 0));
    const scale = Math.min(1, 340 / tallest);
    const list = [];
    for (let q = 0; q < 4; q++) {
      const { k, box } = frames[q];
      if (!box) continue;
      const out = path.join(OUT, 'enemies', `${name}-${q}.webp`);
      const w = Math.max(1, Math.round(box.width * scale)), h = Math.max(1, Math.round(box.height * scale));
      await sharp(k.data, { raw: { width: k.width, height: k.height, channels: 4 } }).extract(box).resize(w, h).webp({ quality: 88, alphaQuality: 95 }).toFile(out);
      list.push({ file: `enemies/${name}-${q}.webp`, w, h });
    }
    manifest.enemies[name] = { frames: list };
    console.log(name, 'frames', list.map((f) => `${f.w}x${f.h}`).join(' '));
  } else {
    const k = await keyed(file);
    // a first-person gun has no soft edge worth keeping, and the backdrop has a glow: anything faint goes
    for (let i = 3; i < k.data.length; i += 4) if (k.data[i] < 150) k.data[i] = 0;
    const box = bounds(k);
    if (!box) { console.log(name, 'nothing left'); continue; }
    const scale = Math.min(1, 640 / box.width);
    const w = Math.round(box.width * scale), h = Math.round(box.height * scale);
    await sharp(k.data, { raw: { width: k.width, height: k.height, channels: 4 } }).extract(box).resize(w, h).webp({ quality: 86, alphaQuality: 95 }).toFile(path.join(OUT, 'guns', `${name}.webp`));
    manifest.guns[name] = { file: `guns/${name}.webp`, w, h };
    console.log(name, `${w}x${h}`);
  }
}
fs.writeFileSync(manifestFile, JSON.stringify(manifest));
