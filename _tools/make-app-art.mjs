// The app's icon and splash screen: a green-line skyline on the Pip-Boy dark, a mushroom cloud rising on the right, and the cog of a vault door half looming over the
// horizon behind it all. Drawn as vectors here (no image model), so it is crisp at every size and the same each time.
// Writes resources/*.png; then `npm run app:assets` makes every size for Android and iOS from them.
import sharp from 'sharp';
import fs from 'node:fs';

fs.mkdirSync('resources', { recursive: true });
const GREEN = '#3dff8a';
const DIM = '#1f9a52';
const DARK = '#000a04';
/** On the full icon the cogwheel is drawn at this size (1 is full size; the rendered-road background used 0.6). */
const COG_SCALE = Number(process.env.ICON_COG_SCALE ?? 1);
/** How far the cogwheel is moved down from the middle, in icon units (ICON_COG_DY), to show what is behind its top. */
const COG_DY = Number(process.env.ICON_COG_DY ?? 0);
const n = (v) => Math.round(v * 10) / 10;

// The picture behind the cogwheel: a destroyed road seen from the walker's own eyes (made once by _tools/gen-icon-road.mjs, kept in resources/icon-road.png).
// Set ICON_BACKGROUND=plain to go back to the plain dark background the icon had before (also the git tag icon-cog-only-v1).
// The icon is the cogwheel and the arrow on the dark background with a few green map roads behind them (like the streets of the Apple Maps icon, in the app's green).
// ICON_BACKGROUND=photo puts the rendered destroyed road behind them instead; ICON_BACKGROUND=plain leaves the background bare.
const ROAD_FILE = process.env.ICON_ROAD_FILE || 'resources/icon-road.png';
const useRoad = process.env.ICON_BACKGROUND === 'photo' && fs.existsSync(ROAD_FILE);
let road1024 = null;
let roadSmall = null;
if (useRoad) {
  // in the picture the horizon sits a little above the middle (44% of the way down); the top is cropped away so it lands 70% of the way up (30% down)
  const meta = await sharp(ROAD_FILE).metadata();
  const horizon = Number(process.env.ROAD_HORIZON ?? 0.44) * meta.height;
  const horizonAt = Number(process.env.ROAD_HORIZON_AT ?? 0.3);
  const top = Math.max(0, Math.round((horizon - horizonAt * meta.height) / (1 - horizonAt)));
  const side = meta.height - top;
  const square = sharp(ROAD_FILE).extract({ left: Math.round((meta.width - side) / 2), top, width: side, height: side });
  road1024 = await square.clone().resize(1024, 1024).jpeg({ quality: 88 }).toBuffer();
  roadSmall = await square.clone().resize(96, 96).jpeg({ quality: 72 }).toBuffer();
}
/** A few streets in the map's green: a wide main road crossing the icon on a slant, a street across it, a curving one and some small ones, each a dim band with a bright line down it. */
const road = (d, w, o = 1) => '<path d="' + d + '" stroke="#0a3d1c" stroke-width="' + (w + 10) + '" opacity="' + o + '"/><path d="' + d + '" stroke="' + DIM + '" stroke-width="' + w + '" opacity="' + (0.75 * o) + '"/><path d="' + d + '" stroke="' + GREEN + '" stroke-width="' + Math.max(3, w * 0.16) + '" opacity="' + (0.85 * o) + '"/>';
const ROADS = '<g fill="none" stroke-linecap="round" stroke-linejoin="round">'
  // a wide avenue on the slant, passing behind the cog and coming out at two corners
  + road('M-120 1000 L 330 700 C 470 610 560 430 700 330 L 1150 20', 96)
  // the street that crosses it the other way, with a bend
  + road('M-100 140 L 300 260 C 420 296 480 420 560 520 C 650 640 780 700 900 760 L 1140 880', 70)
  // the blocks near the edges
  + road('M-60 910 L 1100 910', 44, 0.95)
  + road('M906 -60 L 906 1100', 44, 0.95)
  // a couple of small ones
  + road('M-60 560 L 180 560', 26, 0.85)
  + road('M850 470 L 1100 470', 26, 0.85)
  + '</g>';
/** One road winding across the picture seen from above (ICON_BACKGROUND=curvy): bright edge lines, a dark surface, a dashed line down the middle. */
const CURVY_PATH = 'M 872 -90 L 872 250 C 872 410 800 462 650 462 L 400 462 C 236 462 148 540 148 704 L 148 1114';
const CURVY = '<g fill="none" stroke-linecap="butt" stroke-linejoin="round">'
  + '<path d="' + CURVY_PATH + '" stroke="' + GREEN + '" stroke-width="176" opacity="0.9"/>'
  + '<path d="' + CURVY_PATH + '" stroke="#031a0c" stroke-width="154"/>'
  + '<path d="' + CURVY_PATH + '" stroke="' + DIM + '" stroke-width="7" stroke-dasharray="48 34" opacity="0.95"/>'
  + '</g>';
const BACKGROUND = useRoad
  ? '<image href="data:image/jpeg;base64,' + (road1024 ? road1024.toString('base64') : '') + '" width="1024" height="1024"/><rect width="1024" height="1024" fill="#000a04" opacity="0.06"/>'
  : process.env.ICON_BACKGROUND === 'plain' ? '<rect width="1024" height="1024" fill="url(#sky)"/>' : process.env.ICON_BACKGROUND === 'curvy' ? '<rect width="1024" height="1024" fill="url(#sky)"/><g filter="url(#g)">' + CURVY + '</g>' : '<rect width="1024" height="1024" fill="url(#sky)"/><g filter="url(#g)">' + ROADS + '</g>';
/** The website's tab icon: the same background, small, in a rounded square with the green rim. */
const FLAT_BACKGROUND = useRoad
  ? '<clipPath id="rr"><rect width="1024" height="1024" rx="190"/></clipPath><image clip-path="url(#rr)" href="data:image/jpeg;base64,' + (roadSmall ? roadSmall.toString('base64') : '') + '" width="1024" height="1024"/><rect width="1024" height="1024" rx="190" fill="#000a04" opacity="0.22"/><rect x="26" y="26" width="972" height="972" rx="166" fill="none" stroke="#1f9a52" stroke-width="14"/>'
  : '<clipPath id="rr"><rect width="1024" height="1024" rx="190"/></clipPath><rect width="1024" height="1024" rx="190" fill="#04170c"/>' + (process.env.ICON_BACKGROUND === 'plain' ? '' : '<g clip-path="url(#rr)">' + ROADS + '</g>') + '<rect x="26" y="26" width="972" height="972" rx="166" fill="none" stroke="#1f9a52" stroke-width="14"/>';

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
    + (withBackground ? BACKGROUND : '')
    + '<g filter="url(#g)">'
    + (withBackground && (COG_SCALE !== 1 || COG_DY !== 0) ? '<g transform="translate(512 ' + (512 + COG_DY) + ') scale(' + COG_SCALE + ') translate(-512 -512)">' : '<g>')
    + '<path d="' + gear + '" fill="' + GREEN + '" stroke="' + GREEN + '" stroke-width="10" stroke-linejoin="round"/>'
    + '<circle cx="' + cx + '" cy="' + cy + '" r="' + windowR + '" fill="#04170c"/>'
    + '<path d="' + outline + '" fill="none" stroke="' + GREEN + '" stroke-width="18" stroke-linejoin="round" stroke-linecap="round"/>'
    + '<path d="' + solid + '" fill="' + GREEN + '" stroke="' + GREEN + '" stroke-width="18" stroke-linejoin="round"/>'
    + '</g></g></svg>';
}

const png = (svg, size) => sharp(Buffer.from(svg)).resize(size, size).png();

// ICON_PREVIEW=file.png: just that one picture (the full icon), not the app's real icons
if (process.env.ICON_PREVIEW) { await png(iconArt(true), 1024).toFile(process.env.ICON_PREVIEW); console.log('preview', process.env.ICON_PREVIEW); process.exit(0); }
// the store icon: the whole picture, full square (the stores round the corners themselves)
await png(iconArt(true), 1024).toFile('resources/icon-only.png');
// the adaptive Android icon: the picture inside the central safe zone on a transparent layer, over a plain dark layer
const small = await png(iconArt(false), 676).toBuffer();
await sharp({ create: { width: 1024, height: 1024, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).composite([{ input: small, gravity: 'center' }]).png().toFile('resources/icon-foreground.png');
if (useRoad) await sharp(road1024).png().toFile('resources/icon-background.png');
else if (process.env.ICON_BACKGROUND === 'plain') await sharp({ create: { width: 1024, height: 1024, channels: 4, background: DARK } }).png().toFile('resources/icon-background.png');
else await sharp(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024"><defs><filter id="g" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="8" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter><radialGradient id="sky" cx="0.5" cy="0.5" r="0.75"><stop offset="0" stop-color="#06301a"/><stop offset="1" stop-color="' + DARK + '"/></radialGradient></defs><rect width="1024" height="1024" fill="url(#sky)"/><g filter="url(#g)">' + ROADS + '</g></svg>')).png().toFile('resources/icon-background.png');
// the splash: an old television's stand-by test card in Pip-Boy green (rings, a sunburst, a crosshair, corner targets, gratings, and PLEASE STAND BY across the middle)
function standBySvg() {
  const W = 2732, c = W / 2;
  const G = GREEN, line = (d, w = 6, o = 0.9) => '<path d="' + d + '" fill="none" stroke="' + G + '" stroke-width="' + w + '" opacity="' + o + '" stroke-linecap="round"/>';
  let art = '';
  // the crosshair across the whole screen, with ticks
  art += line('M0 ' + c + 'H' + W, 5, 0.55) + line('M' + c + ' 0V' + W, 5, 0.55);
  for (let i = -33; i <= 33; i++) {
    if (i === 0) continue;
    const len = i % 5 === 0 ? 34 : 16;
    art += line('M' + (c + i * 40) + ' ' + (c - len) + 'V' + (c + len), 4, 0.5) + line('M' + (c - len) + ' ' + (c + i * 40) + 'H' + (c + len), 4, 0.5);
  }
  // the rings, and the sunburst between the two inner ones
  art += '<circle cx="' + c + '" cy="' + c + '" r="650" fill="none" stroke="' + G + '" stroke-width="16"/>';
  art += '<circle cx="' + c + '" cy="' + c + '" r="618" fill="none" stroke="' + G + '" stroke-width="4" opacity="0.8"/>';
  art += '<circle cx="' + c + '" cy="' + c + '" r="430" fill="none" stroke="' + G + '" stroke-width="7" opacity="0.8"/>';
  art += '<circle cx="' + c + '" cy="' + c + '" r="250" fill="none" stroke="' + G + '" stroke-width="5" opacity="0.7"/>';
  for (let i = 0; i < 24; i++) {
    const t0 = (i * 15 * Math.PI) / 180, t1 = ((i * 15 + 7.5) * Math.PI) / 180, r0 = 250, r1 = 618;
    const pt = (r, t) => (c + Math.cos(t) * r).toFixed(1) + ' ' + (c + Math.sin(t) * r).toFixed(1);
    art += '<path d="M' + pt(r0, t0) + 'L' + pt(r1, t0) + 'L' + pt(r1, t1) + 'L' + pt(r0, t1) + 'Z" fill="' + G + '" opacity="0.2"/>';
  }
  // the four corner targets
  for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const x = c + sx * 960, y = c + sy * 960;
    art += '<circle cx="' + x + '" cy="' + y + '" r="250" fill="none" stroke="' + G + '" stroke-width="10" opacity="0.85"/>';
    art += '<circle cx="' + x + '" cy="' + y + '" r="205" fill="none" stroke="' + G + '" stroke-width="4" opacity="0.6"/>';
    art += '<circle cx="' + x + '" cy="' + y + '" r="90" fill="none" stroke="' + G + '" stroke-width="5" opacity="0.7"/>';
    art += line('M' + (x - 250) + ' ' + y + 'H' + (x + 250) + 'M' + x + ' ' + (y - 250) + 'V' + (y + 250), 4, 0.6);
  }
  // the gratings at the left and right of the middle, and the step bars along the bottom
  for (const sx of [-1, 1]) for (let i = 0; i < 26; i++) {
    const x = c + sx * (780 + i * 14);
    art += line('M' + x + ' ' + (c - 150 + (i % 4) * 8) + 'V' + (c + 150 - (i % 4) * 8), 5, 0.55);
  }
  for (let i = 0; i < 11; i++) art += '<rect x="' + (c - 330 + i * 60) + '" y="2480" width="60" height="' + (60 - i * 4) + '" fill="' + G + '" opacity="' + (0.25 + i * 0.05) + '"/>';
  for (let i = 0; i < 8; i++) art += line('M' + (c - 190) + ' ' + (c + 700 + i * 18) + 'H' + (c + 190), 4, 0.75 - i * 0.07);
  // the band across the middle, and the words in it, drawn as strokes
  art += '<rect x="' + (c - 700) + '" y="' + (c - 92) + '" width="1400" height="184" fill="#021208" opacity="0.88"/>';
  art += line('M' + (c - 700) + ' ' + (c - 92) + 'H' + (c + 700) + 'M' + (c - 700) + ' ' + (c + 92) + 'H' + (c + 700), 6, 0.95);
  const L = { P: 'M0 6V0H2.6Q4 0 4 1.5T2.6 3H0', L: 'M0 0V6H3.6', E: 'M3.8 0H0V6H3.8M0 3H3', A: 'M0 6L2 0L4 6M0.7 4H3.3', S: 'M3.8 0.9Q3 0 2 0Q0 0 0 1.5Q0 2.7 2 3Q4 3.3 4 4.5Q4 6 2 6Q1 6 0.2 5.1', T: 'M0 0H4M2 0V6', N: 'M0 6V0L4 6V0', D: 'M0 0V6H1.8Q4 6 4 3Q4 0 1.8 0H0', B: 'M0 0V6H2.5Q4 6 4 4.5Q4 3 2.5 3H0M0 3H2.3Q3.8 3 3.8 1.5Q3.8 0 2.3 0H0', Y: 'M0 0L2 3L4 0M2 3V6' };
  const words = ['PLEASE', 'STAND', 'BY'], u = 15, gap = 1.5, space = 3.4;
  const widthOf = (w) => w.length * 4 + (w.length - 1) * gap;
  const total = words.reduce((acc, w) => acc + widthOf(w), 0) + space * (words.length - 1);
  let x = c - (total * u) / 2;
  let text = '';
  for (const w of words) {
    for (const ch of w) {
      text += '<path d="' + L[ch] + '" transform="translate(' + n(x) + ' ' + n(c - 3 * u) + ') scale(' + u + ')" fill="none" stroke="' + G + '" stroke-width="' + n(1.1) + '" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke" style="stroke-width:' + 15 + 'px"/>';
      x += (4 + gap) * u;
    }
    x += (space - gap) * u;
  }
  // scanlines and a soft glow over everything
  return '<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + W + '" viewBox="0 0 ' + W + ' ' + W + '">'
    + '<defs><filter id="glow" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="9" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>'
    + '<radialGradient id="crt" cx="0.5" cy="0.5" r="0.72"><stop offset="0" stop-color="#0b3a20"/><stop offset="0.65" stop-color="#03150a"/><stop offset="1" stop-color="' + DARK + '"/></radialGradient>'
    + '<pattern id="scan" width="8" height="8" patternUnits="userSpaceOnUse"><rect width="8" height="3" fill="#000" opacity="0.28"/></pattern></defs>'
    + '<rect width="' + W + '" height="' + W + '" fill="url(#crt)"/>'
    + '<g filter="url(#glow)">' + art + text + '</g>'
    + '<rect width="' + W + '" height="' + W + '" fill="url(#scan)"/>'
    + '<rect width="' + W + '" height="' + W + '" fill="none" stroke="#000" stroke-width="140" opacity="0.35"/></svg>';
}
await sharp(Buffer.from(standBySvg())).png().toFile('resources/splash.png');
await sharp('resources/splash.png').toFile('resources/splash-dark.png');
console.log('resources written');

// the website's icons, the same picture: the browser tab, the home-screen shortcut and the web manifest
const flat = iconArt(true).replace(' filter="url(#g)"', '').replace('<g filter="url(#g)">', '<g>').replace(BACKGROUND, FLAT_BACKGROUND);
fs.writeFileSync('public/favicon.svg', flat);
await png(iconArt(true), 180).toFile('public/apple-touch-icon.png');
await png(iconArt(true), 192).toFile('public/icon-192.png');
await png(iconArt(true), 512).toFile('public/icon-512.png');
await sharp(Buffer.from(flat)).resize(32, 32).png().toFile('public/favicon-32.png');
console.log('web icons written');
