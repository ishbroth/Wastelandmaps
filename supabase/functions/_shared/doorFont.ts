// Draws vault-door digits as a coverage mask, from a TrueType font loaded with opentype.js (the caller loads it: in the edge functions `npm:opentype.js`, in the Node test `opentype.js`).
// Each of the four digits sits in its own equal cell and is as tall as the mask, which is how painted door numbers are laid out. No imports, so it runs anywhere.

import type { DigitMask } from './doorNumber.ts';

// deno-lint-ignore no-explicit-any
type Font = any;
type Pt = [number, number];

/** A glyph outline as closed polygons (curves cut into short straight pieces). */
// deno-lint-ignore no-explicit-any
function flatten(commands: any[]): Pt[][] {
  const out: Pt[][] = [];
  let cur: Pt[] = [];
  let x = 0, y = 0, sx = 0, sy = 0;
  for (const c of commands) {
    if (c.type === 'M') { if (cur.length > 2) out.push(cur); cur = [[c.x, c.y]]; x = sx = c.x; y = sy = c.y; }
    else if (c.type === 'L') { cur.push([c.x, c.y]); x = c.x; y = c.y; }
    else if (c.type === 'Q') { for (let t = 1; t <= 12; t++) { const k = t / 12, a = (1 - k) * (1 - k), b = 2 * (1 - k) * k, d = k * k; cur.push([a * x + b * c.x1 + d * c.x, a * y + b * c.y1 + d * c.y]); } x = c.x; y = c.y; }
    else if (c.type === 'C') { for (let t = 1; t <= 16; t++) { const k = t / 16, a = (1 - k) ** 3, b = 3 * (1 - k) ** 2 * k, d = 3 * (1 - k) * k * k, e = k ** 3; cur.push([a * x + b * c.x1 + d * c.x2 + e * c.x, a * y + b * c.y1 + d * c.y2 + e * c.y]); } x = c.x; y = c.y; }
    else if (c.type === 'Z') { if (cur.length > 2) out.push(cur); cur = []; x = sx; y = sy; }
  }
  if (cur.length > 2) out.push(cur);
  return out;
}

/** Fills polygons (non-zero winding) into a w x h coverage mask, 4x4 samples per pixel. */
function fill(polys: Pt[][], w: number, h: number): Uint8Array {
  const S = 4, W = w * S, H = h * S;
  const hits = new Uint8Array(W * H);
  const edges: [number, number, number, number, number][] = [];
  for (const p of polys) for (let i = 0; i < p.length; i++) {
    const a = p[i], b = p[(i + 1) % p.length];
    if (a[1] === b[1]) continue;
    edges.push(a[1] < b[1] ? [a[0] * S, a[1] * S, b[0] * S, b[1] * S, 1] : [b[0] * S, b[1] * S, a[0] * S, a[1] * S, -1]);
  }
  for (let r = 0; r < H; r++) {
    const yc = r + 0.5;
    const xs: [number, number][] = [];
    for (const [x1, y1, x2, y2, dir] of edges) if (yc >= y1 && yc < y2) xs.push([x1 + ((yc - y1) / (y2 - y1)) * (x2 - x1), dir]);
    xs.sort((a, b) => a[0] - b[0]);
    let wind = 0;
    for (let i = 0; i < xs.length - 1; i++) {
      wind += xs[i][1];
      if (wind !== 0) { const from = Math.max(0, Math.round(xs[i][0])), to = Math.min(W, Math.round(xs[i + 1][0])); for (let x = from; x < to; x++) hits[r * W + x] = 1; }
    }
  }
  const mask = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let s = 0;
    for (let oy = 0; oy < S; oy++) for (let ox = 0; ox < S; ox++) s += hits[(y * S + oy) * W + x * S + ox];
    mask[y * w + x] = Math.round((s / (S * S)) * 255);
  }
  return mask;
}

export function digitMaker(font: Font): DigitMask {
  return (text, w, h) => {
    const glyphs = [...text].map((ch) => {
      const path = font.getPath(ch, 0, 0, 100); // y grows downward, the baseline at 0
      const bb = path.getBoundingBox();
      return { polys: flatten(path.commands), x1: bb.x1, x2: bb.x2, y1: bb.y1, y2: bb.y2 };
    });
    const eight = font.getPath('8', 0, 0, 100).getBoundingBox();
    const tall = eight.y2 - eight.y1; // the height of a digit at size 100
    const cell = w / Math.max(1, glyphs.length);
    const sy = h / tall;
    const widest = Math.max(...glyphs.map((g) => g.x2 - g.x1));
    // keep the digits' own proportions unless they would crowd their cells (then squeeze them across)
    const sx = Math.min(sy, (cell * 0.84) / widest);
    const polys: Pt[][] = [];
    glyphs.forEach((g, i) => {
      const gw = (g.x2 - g.x1) * sx;
      const ox = i * cell + (cell - gw) / 2 - g.x1 * sx;
      for (const p of g.polys) polys.push(p.map(([px, py]): Pt => [ox + px * sx, (py - eight.y1) * sy]));
    });
    const mask = fill(polys, w, h);
    // painted numbers are a little heavier than the font's own strokes: grow the coverage by a fraction of a pixel
    const heavy = new Uint8Array(mask);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const near = Math.max(x > 0 ? mask[i - 1] : 0, x < w - 1 ? mask[i + 1] : 0, y > 0 ? mask[i - w] : 0, y < h - 1 ? mask[i + w] : 0);
      heavy[i] = Math.max(mask[i], Math.round(near * 0.55));
    }
    return heavy;
  };
}
