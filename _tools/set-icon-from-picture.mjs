// Makes a finished square picture the app's icon everywhere: the source art Capacitor builds every iOS and Android size from (resources/icon-only.png, icon-foreground.png,
// icon-background.png) and the website's icons (favicon, tab icon, home-screen icon, the manifest's 192 and 512). Then run `npm run app:assets` for the native sizes.
//   node _tools/set-icon-from-picture.mjs <picture.png>
//
// iOS wants one full-bleed 1024 picture with no transparency and no rounded corners (the system rounds it): icon-only.png.
// Android's adaptive icon is a foreground layer and a background layer, masked by the phone to a circle, a squircle or a rounded square, with only the middle two thirds
// always shown: the picture goes in the foreground at that size, and the background is the same picture blown up and blurred so the edges of the mask never show bare color.
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const [,, input] = process.argv;
if (!input) { console.log('usage: node _tools/set-icon-from-picture.mjs <picture.png>'); process.exit(1); }
const ROOT = path.resolve(import.meta.dirname, '..');
const res = (f) => path.join(ROOT, 'resources', f);
const pub = (f) => path.join(ROOT, 'public', f);

const full = await sharp(input).resize(1024, 1024, { fit: 'cover' }).flatten({ background: '#000000' }).removeAlpha().png().toBuffer();
// iOS and the "any" icon: the picture itself, opaque
await sharp(full).toFile(res('icon-only.png'));
// Android adaptive: the picture at the safe size in the middle...
const SAFE = 520;
const small = await sharp(full).resize(SAFE, SAFE).png().toBuffer();
await sharp({ create: { width: 1024, height: 1024, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).composite([{ input: small, gravity: 'center' }]).png().toFile(res('icon-foreground.png'));
// ...and behind it the picture's own edges carried on past the border (mirrored) and softened, so the mask's margin is sky, brick and road, not a flat color
const PAD = Math.round((1024 / (SAFE / 1024) - 1024) / 2);
const back = await sharp(full).extend({ top: PAD, bottom: PAD, left: PAD, right: PAD, extendWith: 'mirror' }).resize(1024, 1024).blur(14).modulate({ brightness: 0.85 }).removeAlpha().png().toBuffer();
await sharp(back).toFile(res('icon-background.png'));

// the website
await sharp(full).resize(192, 192).png().toFile(pub('icon-192.png'));
await sharp(full).resize(512, 512).png().toFile(pub('icon-512.png'));
await sharp(full).resize(180, 180).png().toFile(pub('apple-touch-icon.png'));
console.log('icon art written: resources/icon-only.png, icon-foreground.png, icon-background.png, and the website icons in public/');

// Android's adaptive layers at their real size: the layer canvas is 108 dp, so 108 / 162 / 216 / 324 / 432 px (the generator makes them 48 to 192 px and insets them, which is soft and small),
// and the two xml files that use them with no inset. Run after `npm run app:assets` (which writes the older, smaller ones): node _tools/set-icon-from-picture.mjs <picture.png> --android
if (process.argv.includes('--android')) {
  const RES = path.join(ROOT, 'android', 'app', 'src', 'main', 'res');
  const sizes = { ldpi: 81, mdpi: 108, hdpi: 162, xhdpi: 216, xxhdpi: 324, xxxhdpi: 432 };
  for (const [density, px] of Object.entries(sizes)) {
    const dir = path.join(RES, 'mipmap-' + density);
    if (!fs.existsSync(dir)) continue;
    await sharp(res('icon-foreground.png')).resize(px, px).png().toFile(path.join(dir, 'ic_launcher_foreground.png'));
    await sharp(res('icon-background.png')).resize(px, px).png().toFile(path.join(dir, 'ic_launcher_background.png'));
  }
  const xml = ['<?xml version="1.0" encoding="utf-8"?>', '<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">', '    <background android:drawable="@mipmap/ic_launcher_background" />', '    <foreground android:drawable="@mipmap/ic_launcher_foreground" />', '</adaptive-icon>', ''].join(String.fromCharCode(10));
  for (const f of ['ic_launcher.xml', 'ic_launcher_round.xml']) fs.writeFileSync(path.join(RES, 'mipmap-anydpi-v26', f), xml);
  console.log('android adaptive layers rewritten at full size, no inset');
}
