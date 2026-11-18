// Tries the door-number swap on a picture: node _tools/test-door-swap.mjs picture.png x y w h NEWDIGITS out.png   (x y w h: a rough box around the old digits, in pixels)
import sharp from 'sharp';
import opentype from 'opentype.js';
import fs from 'node:fs';
import { swapDigits } from '../supabase/functions/_shared/doorNumber.ts';
import { digitMaker } from '../supabase/functions/_shared/doorFont.ts';

const [, , file, x, y, w, h, digits, outFile] = process.argv;
const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const font = opentype.parse(fs.readFileSync('public/fonts/vault-digits.ttf').buffer.slice(0));
const img = { width: info.width, height: info.height, data: new Uint8Array(data) };
const t = Date.now();
const r = swapDigits(img, { x: +x, y: +y, w: +w, h: +h }, digits, digitMaker(font));
console.log(info.width + 'x' + info.height, r ? JSON.stringify(r.measured) : 'NOT FOUND', Date.now() - t, 'ms');
if (r) await sharp(Buffer.from(r.out.data), { raw: { width: info.width, height: info.height, channels: 4 } }).png().toFile(outFile);
