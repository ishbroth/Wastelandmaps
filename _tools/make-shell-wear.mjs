// Paints the wear on the Pip-Boy's plastic shell: dents, scratches, chipped paint, rust streaks and old bloodstains, as two SVG pictures that index.css lays over the casing.
//   node _tools/make-shell-wear.mjs      -> prints the two data addresses (--shell-wear-edge, --shell-wear-body); index.css holds the result
// The edge picture is stretched over the whole screen and its marks sit along the four borders (the ring of casing is only a few pixels wide); the body picture tiles over the page behind the screens.
import fs from 'node:fs';

let seed = 20261128;
const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const between = (a, b) => a + (b - a) * rnd();
const f1 = (n) => n.toFixed(1);

/** A point near one of the four borders of a 1000 x 1000 picture: edge 0 top, 1 right, 2 bottom, 3 left. */
const nearEdge = (depth) => { const e = Math.floor(rnd() * 4), t = between(10, 990), d = between(2, depth); return e === 0 ? [t, d] : e === 1 ? [1000 - d, t] : e === 2 ? [t, 1000 - d] : [d, t]; };
const anywhere = (size) => [between(20, size - 20), between(20, size - 20)];

function marks(place, count) {
  const out = { defs: '', body: '' };
  // dents: a dark hollow with a pale rim on its lower edge
  for (let i = 0; i < count.dents; i++) {
    const [x, y] = place(26), rx = between(count.big ? 26 : 8, count.big ? 60 : 22), ry = rx * between(0.6, 1.2), id = `d${i}`;
    out.defs += `<radialGradient id="${id}" cx="42%" cy="40%" r="60%"><stop offset="0" stop-color="#000" stop-opacity=".5"/><stop offset=".7" stop-color="#000" stop-opacity=".22"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>`;
    out.body += `<ellipse cx="${f1(x)}" cy="${f1(y)}" rx="${f1(rx)}" ry="${f1(ry)}" fill="url(#${id})"/><path d="M${f1(x - rx * 0.8)} ${f1(y + ry * 0.55)} Q${f1(x)} ${f1(y + ry * 1.05)} ${f1(x + rx * 0.8)} ${f1(y + ry * 0.55)}" fill="none" stroke="#e8f2e4" stroke-opacity=".28" stroke-width="${f1(count.big ? 2 : 1.2)}"/>`;
  }
  // scratches: pale and dark thin lines, mostly short
  for (let i = 0; i < count.scratches; i++) {
    const [x, y] = place(30), len = between(count.big ? 30 : 12, count.big ? 120 : 60), a = between(0, Math.PI);
    out.body += `<line x1="${f1(x)}" y1="${f1(y)}" x2="${f1(x + Math.cos(a) * len)}" y2="${f1(y + Math.sin(a) * len)}" stroke="${rnd() < 0.55 ? '#dfe9db' : '#0a0f0a'}" stroke-opacity="${f1(between(0.16, 0.42))}" stroke-width="${f1(between(0.5, 1.4))}"/>`;
  }
  // chips: the paint gone, bare dark metal showing, with a light edge
  for (let i = 0; i < count.chips; i++) {
    const [x, y] = place(22), n = 6, r = between(2, count.big ? 12 : 7);
    const pts = Array.from({ length: n }, (_, k) => { const ang = (k / n) * Math.PI * 2, rr = r * between(0.5, 1.2); return `${f1(x + Math.cos(ang) * rr)},${f1(y + Math.sin(ang) * rr)}`; }).join(' ');
    out.body += `<polygon points="${pts}" fill="#11160f" fill-opacity=".72" stroke="#c9d6c4" stroke-opacity=".35" stroke-width=".8"/>`;
  }
  // rust streaks running down from a chip
  for (let i = 0; i < count.rust; i++) {
    const [x, y] = place(26), len = between(24, count.big ? 160 : 80);
    out.body += `<path d="M${f1(x)} ${f1(y)} q${f1(between(-6, 6))} ${f1(len * 0.5)} ${f1(between(-8, 8))} ${f1(len)}" fill="none" stroke="#7a4217" stroke-opacity=".38" stroke-width="${f1(between(2, 5))}" stroke-linecap="round"/>`;
  }
  // bloodstains: a dark irregular pool, a drip or two, and spatter
  for (let i = 0; i < count.blood; i++) {
    const [x, y] = place(30), r = between(count.big ? 22 : 9, count.big ? 52 : 24), n = 9;
    const pts = Array.from({ length: n }, (_, k) => { const ang = (k / n) * Math.PI * 2, rr = r * between(0.55, 1.25); return [x + Math.cos(ang) * rr, y + Math.sin(ang) * rr * 0.8]; });
    const d = pts.map(([px, py], k) => `${k ? 'L' : 'M'}${f1(px)} ${f1(py)}`).join(' ') + 'Z';
    out.body += `<path d="${d}" fill="#4e0a07" fill-opacity=".62" stroke="#2a0504" stroke-opacity=".5" stroke-width="1" stroke-linejoin="round"/>`;
    out.body += `<path d="${d}" transform="translate(${f1(x * 0.12)} ${f1(y * 0.12)}) scale(.88)" fill="#6e100a" fill-opacity=".35"/>`;
    for (let k = 0; k < 2 + Math.floor(rnd() * 2); k++) { const dx = between(-r * 0.6, r * 0.6), len = between(r, r * 3); out.body += `<path d="M${f1(x + dx)} ${f1(y + r * 0.5)} v${f1(len)}" stroke="#4e0a07" stroke-opacity=".5" stroke-width="${f1(between(1.5, 3.5))}" stroke-linecap="round" fill="none"/><circle cx="${f1(x + dx)}" cy="${f1(y + r * 0.5 + len)}" r="${f1(between(1.6, 3.4))}" fill="#4e0a07" fill-opacity=".55"/>`; }
    for (let k = 0; k < 8; k++) out.body += `<circle cx="${f1(x + between(-r * 2, r * 2))}" cy="${f1(y + between(-r * 1.4, r * 1.4))}" r="${f1(between(0.8, 3))}" fill="#5a0b08" fill-opacity="${f1(between(0.35, 0.7))}"/>`;
  }
  return out;
}

const svg = (w, h, m, preserve) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" preserveAspectRatio="${preserve}"><defs>${m.defs}</defs>${m.body}</svg>`;
const uri = (s) => 'url("data:image/svg+xml,' + s.replace(/%/g, '%25').replace(/#/g, '%23').replace(/</g, '%3C').replace(/>/g, '%3E').replace(/"/g, "'") + '")';

const edge = marks(nearEdge, { dents: 26, scratches: 120, chips: 70, rust: 7, blood: 9 });
const body = marks((s) => anywhere(s + 900), { dents: 7, scratches: 36, chips: 20, rust: 3, blood: 3, big: true });
const css = `  --shell-wear-edge: ${uri(svg(1000, 1000, edge, 'none'))};\n  --shell-wear-body: ${uri(svg(900, 900, body, 'xMidYMid slice'))};\n`;
fs.writeFileSync(new URL('./shell-wear.css.txt', import.meta.url), css);
console.log('wrote _tools/shell-wear.css.txt', css.length, 'bytes');
