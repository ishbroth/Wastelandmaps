// The app's icon and splash screen (placeholder branding drawn from the site's own mark: a green double ring with a mushroom cloud, on the Pip-Boy dark).
// Writes resources/*.png; then `npm run app:assets` makes every size for Android and iOS from them.
import sharp from 'sharp';
import fs from 'node:fs';

fs.mkdirSync('resources', { recursive: true });
const GREEN = '#3dff8a';
const DARK = '#000a04';

/** The mark on a square of `size`, filling `fill` of it (the adaptive icon's safe zone is about 66%). */
const mark = (size, fill, withBackground) => {
  const s = size;
  const r = (s * fill) / 2;
  const c = s / 2;
  const glow = s * 0.02;
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">
  <defs><filter id="g" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="${glow}" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
  ${withBackground ? `<rect width="${s}" height="${s}" fill="${DARK}"/>` : ''}
  <g filter="url(#g)" fill="none" stroke="${GREEN}" stroke-linecap="round">
    <circle cx="${c}" cy="${c}" r="${r}" stroke-width="${s * 0.028}"/>
    <circle cx="${c}" cy="${c}" r="${r * 0.82}" stroke-width="${s * 0.012}"/>
  </g>
  <g filter="url(#g)" fill="${GREEN}">
    <ellipse cx="${c}" cy="${c - r * 0.2}" rx="${r * 0.46}" ry="${r * 0.27}"/>
    <ellipse cx="${c - r * 0.3}" cy="${c - r * 0.06}" rx="${r * 0.2}" ry="${r * 0.14}"/>
    <ellipse cx="${c + r * 0.3}" cy="${c - r * 0.06}" rx="${r * 0.2}" ry="${r * 0.14}"/>
    <path d="M${c - r * 0.12} ${c - r * 0.05} L${c - r * 0.2} ${c + r * 0.5} L${c + r * 0.2} ${c + r * 0.5} L${c + r * 0.12} ${c - r * 0.05} Z"/>
    <rect x="${c - r * 0.55}" y="${c + r * 0.5}" width="${r * 1.1}" height="${r * 0.07}" rx="${r * 0.035}"/>
  </g>
</svg>`);
};

await sharp(mark(1024, 0.8, true)).png().toFile('resources/icon-only.png');
await sharp(mark(1024, 0.56, false)).png().toFile('resources/icon-foreground.png');
await sharp({ create: { width: 1024, height: 1024, channels: 4, background: DARK } }).png().toFile('resources/icon-background.png');
// the splash: the mark in the middle of a big dark square (the tools crop it to every screen)
await sharp({ create: { width: 2732, height: 2732, channels: 4, background: DARK } })
  .composite([{ input: await sharp(mark(1000, 0.8, false)).png().toBuffer(), gravity: 'center' }]).png().toFile('resources/splash.png');
await sharp('resources/splash.png').toFile('resources/splash-dark.png');
console.log('resources written');
