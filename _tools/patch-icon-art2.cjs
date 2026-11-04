const fs = require('fs');
const p = '_tools/make-app-art.mjs';
const raw = fs.readFileSync(p, 'utf8'); const crlf = raw.includes('\r\n'); let s = raw.replace(/\r\n/g, '\n');
const a = s.indexOf('/**\n * The store icon:');
const b = s.indexOf('const png = (svg, size)');
if (a < 0 || b < 0) throw new Error('bounds');
const fn = String.raw`/**
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
  const rot = (-45 * Math.PI) / 180, k = 1.18;
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

`;
s = s.slice(0, a) + fn + s.slice(b);
fs.writeFileSync(p, crlf ? s.replace(/\n/g, '\r\n') : s);
