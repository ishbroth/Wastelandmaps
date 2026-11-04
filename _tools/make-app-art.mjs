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
 * The store icon: a whole vault-door cogwheel, glowing green on the Pip-Boy dark, with the re-centre arrow of a map app (the navigation arrow) in the middle of it.
 * The splash screen keeps the skyline picture above.
 */
function iconArt(withBackground) {
  const cx = 512, cy = 512;
  // a chunky cog: twelve broad teeth
  const teeth = 12, outer = 452, root = 384, step = (Math.PI * 2) / teeth;
  let gear = '';
  for (let i = 0; i < teeth; i++) {
    for (const [turn, r] of [[-0.34, root], [-0.2, outer], [0.2, outer], [0.34, root]]) {
      const t = i * step + turn * step - Math.PI / 2;
      gear += (gear ? 'L' : 'M') + n(cx + Math.cos(t) * r) + ' ' + n(cy + Math.sin(t) * r);
    }
  }
  gear += 'Z';
  // the arrow: tip, right wing, notch, left wing; turned a quarter-turn-and-a-bit to point up and to the right, as the map apps draw it
  const s2 = 205, tilt = (38 * Math.PI) / 180;
  const raw = [[0, -1.0], [0.66, 0.9], [0, 0.46], [-0.66, 0.9]].map(([x, y]) => [x * s2 * Math.cos(tilt) - y * s2 * Math.sin(tilt), x * s2 * Math.sin(tilt) + y * s2 * Math.cos(tilt)]);
  // centred on the cog by the middle of its outline
  const midX = (Math.min(...raw.map((q) => q[0])) + Math.max(...raw.map((q) => q[0]))) / 2, midY = (Math.min(...raw.map((q) => q[1])) + Math.max(...raw.map((q) => q[1]))) / 2;
  const pts = raw.map(([x, y]) => [n(cx + x - midX), n(cy + y - midY)]);
  const arrow = 'M' + pts.map((q) => q.join(' ')).join('L') + 'Z';
  const bolts = Array.from({ length: 12 }, (_, i) => {
    const t = i * step - Math.PI / 2 + step / 2;
    return '<circle cx="' + n(cx + Math.cos(t) * 352) + '" cy="' + n(cy + Math.sin(t) * 352) + '" r="13"/>';
  }).join('');
  return '<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">'
    + '<defs><filter id="g" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="7" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>'
    + '<radialGradient id="sky" cx="0.5" cy="0.5" r="0.75"><stop offset="0" stop-color="#06301a"/><stop offset="1" stop-color="' + DARK + '"/></radialGradient></defs>'
    + (withBackground ? '<rect width="1024" height="1024" fill="url(#sky)"/>' : '')
    + '<g filter="url(#g)" fill="none" stroke="' + GREEN + '" stroke-linecap="round" stroke-linejoin="round">'
    + '<path d="' + gear + '" fill="#04170c" stroke-width="18"/>'
    + '<circle cx="' + cx + '" cy="' + cy + '" r="318" stroke-width="10"/>'
    + '<circle cx="' + cx + '" cy="' + cy + '" r="292" fill="#031208" stroke-width="5" opacity="0.8"/>'
    + '<g fill="' + GREEN + '" stroke="none">' + bolts + '</g>'
    + '<path d="' + arrow + '" fill="' + GREEN + '" stroke="' + GREEN + '" stroke-width="12"/>'
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
