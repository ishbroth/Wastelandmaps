const fs = require('fs');
const p = '_tools/make-app-art.mjs';
const raw = fs.readFileSync(p, 'utf8'); const crlf = raw.includes('\r\n'); let s = raw.replace(/\r\n/g, '\n');
const rep = (a, b, l) => { if (!s.includes(a)) throw new Error('missing ' + l); s = s.replace(a, () => b); };
rep("const png = (svg, size)", String.raw`/**
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
  const s2 = 236, tilt = (42 * Math.PI) / 180;
  const pts = [[0, -1.0], [0.74, 0.86], [0, 0.4], [-0.74, 0.86]].map(([x, y]) => {
    const px = x * s2, py = (y + 0.02) * s2;
    return [n(cx + px * Math.cos(tilt) - py * Math.sin(tilt)), n(cy + px * Math.sin(tilt) + py * Math.cos(tilt))];
  });
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

const png = (svg, size)`, 'icon art');
rep("await png(art(true), 1024).toFile('resources/icon-only.png');", "await png(iconArt(true), 1024).toFile('resources/icon-only.png');", 'icon only');
rep("const small = await png(art(false), 676).toBuffer();", "const small = await png(iconArt(false), 676).toBuffer();", 'fg');
fs.writeFileSync(p, crlf ? s.replace(/\n/g, '\r\n') : s);
