const fs = require('fs');
const p = '_tools/make-app-art.mjs';
const raw = fs.readFileSync(p, 'utf8'); const crlf = raw.includes('\r\n'); let s = raw.replace(/\r\n/g, '\n');
const a = s.indexOf('// the splash: the picture in the middle');
const b = s.indexOf("await sharp('resources/splash.png').toFile('resources/splash-dark.png');");
if (a < 0 || b < 0) throw new Error('bounds');
const block = String.raw`// the splash: an old television's stand-by test card in Pip-Boy green (rings, a sunburst, a crosshair, corner targets, gratings, and PLEASE STAND BY across the middle)
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
`;
s = s.slice(0, a) + block + s.slice(b);
fs.writeFileSync(p, crlf ? s.replace(/\n/g, '\r\n') : s);
