// The app's icon and splash screen: a green-line skyline on the Pip-Boy dark, a mushroom cloud rising on the right, and the cog of a vault door half looming over the
// horizon behind it all. Drawn as vectors here (no image model), so it is crisp at every size and the same each time.
// Writes resources/*.png; then `npm run app:assets` makes every size for Android and iOS from them.
import sharp from 'sharp';
import fs from 'node:fs';

fs.mkdirSync('resources', { recursive: true });
const GREEN = '#3dff8a';
const DIM = '#1f9a52';
const DARK = '#000a04';
const n = (v) => Math.round(v * 10) / 10;

/** The outline of a cog (a vault door): a ring of teeth. */
function cog(cx, cy, teeth, outer, root) {
  const step = (Math.PI * 2) / teeth;
  let d = '';
  for (let i = 0; i < teeth; i++) {
    for (const [turn, r] of [[-0.3, root], [-0.17, outer], [0.17, outer], [0.3, root]]) {
      const t = i * step + turn * step - Math.PI / 2;
      d += `${d ? 'L' : 'M'}${n(cx + Math.cos(t) * r)} ${n(cy + Math.sin(t) * r)}`;
    }
  }
  return d + 'Z';
}

/** The picture itself on a 1024 square, with or without its dark background. */
function art(withBackground) {
  const H = 800; // the horizon
  const gx = 400, gy = H + 20; // the cog's center: on the horizon, so only its top half shows
  const R = 420;
  // the skyline: [left, width, height, kind]; kinds add a spire, a stepped top or a flat roof
  const blocks = [
    [0, 70, 120, 'flat'], [70, 60, 190, 'spire'], [130, 80, 150, 'step'], [210, 56, 215, 'flat'], [266, 74, 165, 'spire'], [340, 66, 110, 'flat'],
    [406, 84, 195, 'step'], [490, 58, 130, 'flat'], [548, 70, 100, 'spire'], [618, 60, 80, 'flat'],
  ];
  let sky = '';
  let windows = '';
  for (const [x, w, h, kind] of blocks) {
    const top = H - h;
    let d = `M${x} ${H}V${top}`;
    if (kind === 'step') d += `H${x + w * 0.2}V${top - 26}H${x + w * 0.8}V${top}`;
    d += `H${x + w}V${H}`;
    sky += `<path d="${d}"/>`;
    if (kind === 'spire') sky += `<path d="M${x + w / 2} ${top}V${top - 46}" stroke-width="5"/>`;
    for (let wy = top + 24; wy < H - 14; wy += 30) for (let wx = x + 12; wx < x + w - 14; wx += 18) if ((wx * 7 + wy * 13) % 5 < 2) windows += `<rect x="${wx}" y="${wy}" width="7" height="10"/>`;
  }
  // the mushroom cloud: a stem, a cap of billows, and a skirt of dust at the foot
  const cx = 820;
  const cloud = `
    <path d="M${cx - 34} ${H}C${cx - 30} ${H - 120} ${cx - 62} ${H - 210} ${cx - 56} ${H - 290}M${cx + 34} ${H}C${cx + 30} ${H - 120} ${cx + 62} ${H - 210} ${cx + 56} ${H - 290}"/>
    <path d="M${cx - 56} ${H - 290}C${cx - 190} ${H - 285} ${cx - 215} ${H - 395} ${cx - 140} ${H - 430}C${cx - 135} ${H - 520} ${cx - 40} ${H - 560} ${cx} ${H - 535}C${cx + 40} ${H - 560} ${cx + 135} ${H - 520} ${cx + 140} ${H - 430}C${cx + 215} ${H - 395} ${cx + 190} ${H - 285} ${cx + 56} ${H - 290}Z"/>
    <path d="M${cx - 120} ${H - 395}C${cx - 60} ${H - 350} ${cx + 60} ${H - 350} ${cx + 120} ${H - 395}M${cx - 70} ${H - 470}C${cx - 30} ${H - 430} ${cx + 30} ${H - 430} ${cx + 70} ${H - 470}"/>
    <path d="M${cx - 150} ${H}C${cx - 110} ${H - 40} ${cx - 50} ${H - 36} ${cx} ${H - 46}C${cx + 50} ${H - 36} ${cx + 110} ${H - 40} ${cx + 150} ${H}"/>`;
  const spokes = Array.from({ length: 6 }, (_, i) => {
    const t = (i * Math.PI) / 3 - Math.PI / 2;
    return `<path d="M${n(gx + Math.cos(t) * 72)} ${n(gy + Math.sin(t) * 72)}L${n(gx + Math.cos(t) * 262)} ${n(gy + Math.sin(t) * 262)}" stroke-width="22"/>`;
  }).join('');
  const bolts = Array.from({ length: 16 }, (_, i) => {
    const t = (i * Math.PI * 2) / 16 - Math.PI / 2;
    return `<circle cx="${n(gx + Math.cos(t) * 308)}" cy="${n(gy + Math.sin(t) * 308)}" r="10"/>`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <defs>
    <filter id="g" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    <radialGradient id="sky" cx="0.45" cy="0.7" r="0.8"><stop offset="0" stop-color="#06301a"/><stop offset="1" stop-color="${DARK}"/></radialGradient>
    <clipPath id="above"><rect x="0" y="0" width="1024" height="${H}"/></clipPath>
  </defs>
  ${withBackground ? `<rect width="1024" height="1024" fill="url(#sky)"/>` : ''}
  <g clip-path="url(#above)" filter="url(#g)" fill="none" stroke="${GREEN}" stroke-linecap="round" stroke-linejoin="round" stroke-width="12">
    <path d="${cog(gx, gy, 18, R, R - 52)}" fill="#04170c"/>
    <circle cx="${gx}" cy="${gy}" r="346" stroke-width="7"/>
    <circle cx="${gx}" cy="${gy}" r="272" stroke-width="9"/>
    ${spokes}
    <circle cx="${gx}" cy="${gy}" r="72" fill="#04170c" stroke-width="12"/>
    <g fill="${GREEN}" stroke="none">${bolts}</g>
  </g>
  <g filter="url(#g)" fill="${withBackground ? '#04170c' : 'none'}" stroke="${GREEN}" stroke-linecap="round" stroke-linejoin="round" stroke-width="9">${cloud}</g>
  <g filter="url(#g)" fill="${DARK}" stroke="${GREEN}" stroke-linecap="round" stroke-linejoin="round" stroke-width="9">${sky}</g>
  <g fill="${DIM}" stroke="none">${windows}</g>
  <path d="M0 ${H}H1024" stroke="${GREEN}" stroke-width="10" stroke-linecap="round" filter="url(#g)"/>
  <g stroke="${GREEN}" stroke-linecap="round" fill="none"><path d="M60 856H964" stroke-width="5" opacity="0.5"/><path d="M160 910H864" stroke-width="4" opacity="0.32"/><path d="M290 960H734" stroke-width="3" opacity="0.2"/></g>
</svg>`;
}

/**
 * The store icon: a vault-door cogwheel (eight tapered teeth, a thick ring and one round window, like the number-less vault gear) in solid Pip-Boy green, and
 * in the window the map apps' navigation arrow (half outlined, half solid), pointing straight up and centred.
 */
function iconArt(withBackground) {
  const cx = 512, cy = 512;
  const teeth = 8, tip = 452, body = 368, windowR = 268;
  const polar = (r, deg) => [n(cx + Math.cos(((deg - 90) * Math.PI) / 180) * r), n(cy + Math.sin(((deg - 90) * Math.PI) / 180) * r)];
  let gear = '';
  for (let i = 0; i < teeth; i++) {
    const mid = (i * 360) / teeth;
    const [bx1, by1] = polar(body, mid - 13), [tx1, ty1] = polar(tip, mid - 5.2), [tx2, ty2] = polar(tip, mid + 5.2), [bx2, by2] = polar(body, mid + 13);
    gear += (gear ? 'L' : 'M') + bx1 + ' ' + by1 + 'L' + tx1 + ' ' + ty1 + 'L' + tx2 + ' ' + ty2 + 'L' + bx2 + ' ' + by2;
    const [nx, ny] = polar(body, mid + 360 / teeth - 13);
    gear += 'A' + body + ' ' + body + ' 0 0 1 ' + nx + ' ' + ny;
  }
  gear += 'Z';
  // the arrow (the lower left one of the navigation set): tip, left wing, notch, right wing; turned to point straight up and centred on its outline
  const src = { T: [422, 590], L: [158, 687], N: [280, 730], B: [322, 855] };
  const rot = (-45 * Math.PI) / 180, k = 1.4;
  const turned = {};
  for (const [name, [x, y]] of Object.entries(src)) {
    turned[name] = [x * Math.cos(rot) - y * Math.sin(rot), x * Math.sin(rot) + y * Math.cos(rot)];
  }
  const xs = Object.values(turned).map((q) => q[0]), ys = Object.values(turned).map((q) => q[1]);
  const mx = (Math.min(...xs) + Math.max(...xs)) / 2, my = (Math.min(...ys) + Math.max(...ys)) / 2;
  const at = (q) => [n(cx + (q[0] - mx) * k), n(cy + (q[1] - my) * k)].join(' ');
  const outline = 'M' + at(turned.T) + 'L' + at(turned.L) + 'L' + at(turned.N) + 'L' + at(turned.B) + 'Z';
  const solid = 'M' + at(turned.T) + 'L' + at(turned.N) + 'L' + at(turned.B) + 'Z';
  return '<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">'
    + '<defs><filter id="g" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="8" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>'
    + '<radialGradient id="sky" cx="0.5" cy="0.5" r="0.75"><stop offset="0" stop-color="#06301a"/><stop offset="1" stop-color="' + DARK + '"/></radialGradient></defs>'
    + (withBackground ? '<rect width="1024" height="1024" fill="url(#sky)"/>' : '')
    + '<g filter="url(#g)">'
    + '<path d="' + gear + '" fill="' + GREEN + '" stroke="' + GREEN + '" stroke-width="10" stroke-linejoin="round"/>'
    + '<circle cx="' + cx + '" cy="' + cy + '" r="' + windowR + '" fill="#04170c"/>'
    + '<path d="' + outline + '" fill="none" stroke="' + GREEN + '" stroke-width="18" stroke-linejoin="round" stroke-linecap="round"/>'
    + '<path d="' + solid + '" fill="' + GREEN + '" stroke="' + GREEN + '" stroke-width="18" stroke-linejoin="round"/>'
    + '</g></svg>';
}

const png = (svg, size) => sharp(Buffer.from(svg)).resize(size, size).png();

// the store icon: the whole picture, full square (the stores round the corners themselves)
await png(iconArt(true), 1024).toFile('resources/icon-only.png');
// the adaptive Android icon: the picture inside the central safe zone on a transparent layer, over a plain dark layer
const small = await png(iconArt(false), 676).toBuffer();
await sharp({ create: { width: 1024, height: 1024, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).composite([{ input: small, gravity: 'center' }]).png().toFile('resources/icon-foreground.png');
await sharp({ create: { width: 1024, height: 1024, channels: 4, background: DARK } }).png().toFile('resources/icon-background.png');
// the splash: the picture in the middle of a big dark square (the tools crop it to every screen)
const splashArt = await png(art(true), 1100).toBuffer();
await sharp({ create: { width: 2732, height: 2732, channels: 4, background: DARK } }).composite([{ input: splashArt, gravity: 'center' }]).png().toFile('resources/splash.png');
await sharp('resources/splash.png').toFile('resources/splash-dark.png');
console.log('resources written');

// the website's icons, the same picture: the browser tab, the home-screen shortcut and the web manifest
const flat = iconArt(false).replace(' filter="url(#g)"', '').replace('<g filter="url(#g)">', '<g>');
fs.writeFileSync('public/favicon.svg', flat);
await png(iconArt(true), 180).toFile('public/apple-touch-icon.png');
await png(iconArt(true), 192).toFile('public/icon-192.png');
await png(iconArt(true), 512).toFile('public/icon-512.png');
await sharp(Buffer.from(flat)).resize(32, 32).png().toFile('public/favicon-32.png');
console.log('web icons written');
