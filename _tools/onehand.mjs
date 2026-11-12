// Takes the left hand (and arm) out of the pistol and Uzi pictures, so they are held in one hand; the big guns keep both. Each picture has a polygon of what to erase.
//   node _tools/onehand.mjs      (keeps the originals in _data/guns-orig, and starts from them each time)
import fs from 'node:fs';
import sharp from 'sharp';
const CUT = {
  sw29: [[0, 0], [190, 0], [196, 45], [292, 140], [305, 158], [350, 215], [325, 270], [325, 375], [350, 599], [0, 599]],
  m1911: [[0, 0], [258, 0], [280, 110], [300, 235], [345, 320], [365, 345], [360, 473], [0, 473]],
  deagle: [[0, 425], [285, 425], [290, 500], [275, 640], [280, 836], [0, 836]],
  sw500: [[0, 330], [325, 330], [340, 400], [335, 500], [360, 540], [380, 574], [0, 574]],
  uzi: [[0, 350], [240, 340], [262, 390], [300, 440], [310, 500], [150, 589], [0, 589]],
};
for (const [id, poly] of Object.entries(CUT)) {
  const dest = `public/raid/guns/${id}.webp`, orig = `_data/guns-orig/${id}.webp`;
  if (!fs.existsSync(orig)) fs.copyFileSync(dest, orig);
  const { width, height } = await sharp(orig).metadata();
  const mask = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><polygon points="${poly.map((p) => p.join(',')).join(' ')}" fill="#fff"/></svg>`);
  const out = await sharp(orig).ensureAlpha().composite([{ input: await sharp(mask).blur(1.2).toBuffer(), blend: 'dest-out' }]).webp({ quality: 92, alphaQuality: 100 }).toBuffer();
  fs.writeFileSync(dest, out);
  await sharp(out).flatten({ background: '#667' }).png().toFile(process.env.TEMP + `/one-${id}.png`);
  console.log(id, 'done');
}
