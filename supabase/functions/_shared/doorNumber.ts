// Changing the four digits on a vault door in a finished picture WITHOUT drawing the picture again. The picture is never sent to an image model for this: the digits are found
// (the caller says roughly where), measured (their size, tilt and colour), painted out by filling the panel from its own surroundings, and the new digits are drawn on in the same place,
// the same size and the same tilt, in the same colour, softened to the picture's own sharpness. Everything outside the little window around the number stays byte for byte as it was.
//
// This file is plain computation on pixels (no imports), so it runs in the edge functions and in a Node test alike. The caller supplies the picture as RGBA pixels and a function that
// draws the digits as a coverage mask (see _shared/doorFont.ts).

export interface Rgba { width: number; height: number; data: Uint8Array | Uint8ClampedArray }
/** A rough box around the digits, in pixels. */
export interface Box { x: number; y: number; w: number; h: number }
/** Draws text as coverage (0-255) in a w x h mask: the four digits laid out in four equal cells, each digit as tall as the mask. */
export type DigitMask = (text: string, w: number, h: number) => Uint8Array;

export interface Measured { cx: number; cy: number; width: number; height: number; /** the baseline direction and the (leaning) direction of the strokes, as unit vectors in the picture */ ex: [number, number]; ey: [number, number]; ink: [number, number, number]; inkFraction: number }

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

/** Finds the digits inside (and a little around) the rough box: which pixels are ink, where the text sits, how big and how tilted it is. Null when nothing that looks like painted digits is there. */
export function measureDigits(img: Rgba, rough: Box): { m: Measured; ink: Uint8Array; win: Box } | null {
  const pad = Math.round(Math.max(rough.w, rough.h) * 0.25);
  const x0 = clamp(Math.round(rough.x) - pad, 0, img.width - 1), y0 = clamp(Math.round(rough.y) - pad, 0, img.height - 1);
  const x1 = clamp(Math.round(rough.x + rough.w) + pad, x0 + 8, img.width), y1 = clamp(Math.round(rough.y + rough.h) + pad, y0 + 8, img.height);
  const win: Box = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  const n = win.w * win.h;
  const px = (i: number, c: number) => img.data[((win.y + Math.floor(i / win.w)) * img.width + win.x + (i % win.w)) * 4 + c];
  // two colours: the panel (the commonest colour in the window) and the ink (the farthest from it); a few rounds of 2-means settle them
  const med = [0, 1, 2].map((c) => { const v = new Uint8Array(256); for (let i = 0; i < n; i++) v[px(i, c)]++; let s = 0; for (let k = 0; k < 256; k++) { s += v[k]; if (s >= n / 2) return k; } return 128; });
  let a = med.slice();
  let b = [0, 0, 0];
  let far = -1;
  for (let i = 0; i < n; i++) { const d = (px(i, 0) - a[0]) ** 2 + (px(i, 1) - a[1]) ** 2 + (px(i, 2) - a[2]) ** 2; if (d > far) { far = d; b = [px(i, 0), px(i, 1), px(i, 2)]; } }
  const inkOf = new Uint8Array(n);
  for (let round = 0; round < 6; round++) {
    const sa = [0, 0, 0], sb = [0, 0, 0]; let na = 0, nb = 0;
    for (let i = 0; i < n; i++) {
      const r = px(i, 0), g = px(i, 1), bl = px(i, 2);
      const da = (r - a[0]) ** 2 + (g - a[1]) ** 2 + (bl - a[2]) ** 2, db = (r - b[0]) ** 2 + (g - b[1]) ** 2 + (bl - b[2]) ** 2;
      if (db < da) { inkOf[i] = 1; sb[0] += r; sb[1] += g; sb[2] += bl; nb++; } else { inkOf[i] = 0; sa[0] += r; sa[1] += g; sa[2] += bl; na++; }
    }
    if (na === 0 || nb === 0) return null;
    a = sa.map((v) => v / na); b = sb.map((v) => v / nb);
  }
  const fraction = inkOf.reduce((s, v) => s + v, 0) / n;
  // digits are a small part of their window; and the ink must differ clearly from the panel
  const gap = Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2);
  if (fraction < 0.04 || fraction > 0.45 || gap < 60) return null;
  // keep only what is shaped like painted digits: blobs about as tall as the digits (not the long edge of a panel or a speck), and not narrower than a stroke
  const ink = new Uint8Array(n);
  const rx0 = rough.x - win.x - rough.w * 0.1, ry0 = rough.y - win.y - rough.h * 0.2, rx1 = rough.x - win.x + rough.w * 1.1, ry1 = rough.y - win.y + rough.h * 1.2;
  const seen = new Uint8Array(n);
  let count = 0, mx = 0, my = 0, blobs = 0;
  const blobList: { cx: number; cy: number; cells: number[] }[] = [];
  for (let s0 = 0; s0 < n; s0++) {
    if (!inkOf[s0] || seen[s0]) continue;
    const stack = [s0]; seen[s0] = 1;
    const cells: number[] = [];
    let bx0 = win.w, by0 = win.h, bx1 = 0, by1 = 0;
    while (stack.length) {
      const i = stack.pop() as number; cells.push(i);
      const x = i % win.w, y = Math.floor(i / win.w);
      if (x < bx0) bx0 = x; if (x > bx1) bx1 = x; if (y < by0) by0 = y; if (y > by1) by1 = y;
      for (const j of [x > 0 ? i - 1 : -1, x < win.w - 1 ? i + 1 : -1, y > 0 ? i - win.w : -1, y < win.h - 1 ? i + win.w : -1]) if (j >= 0 && inkOf[j] && !seen[j]) { seen[j] = 1; stack.push(j); }
    }
    const bw = bx1 - bx0 + 1, bh = by1 - by0 + 1;
    const ccx = (bx0 + bx1) / 2, ccy = (by0 + by1) / 2;
    // (a painted stroke is several pixels thick; the thin bright line along a panel's edge is not)
    const thickness = cells.length / Math.max(bw, bh);
    const okSize = cells.length >= 6 && bh >= rough.h * 0.4 && bh <= rough.h * 1.3 && bw <= rough.w * 0.7 && thickness >= rough.h * 0.08;
    if (!okSize || ccx < rx0 || ccx > rx1 || ccy < ry0 || ccy > ry1) continue;
    blobs++;
    blobList.push({ cx: ccx, cy: ccy, cells });
    for (const i of cells) { ink[i] = 1; count++; mx += i % win.w; my += Math.floor(i / win.w); }
  }
  if (blobs < 3 || count < 30) return null;
  mx /= count; my /= count;
  // the baseline: a line through the digits' centres (the numbers sit on a slope when the door is seen at an angle)
  let theta = 0;
  if (blobList.length >= 3) {
    const bx = blobList.reduce((t, k) => t + k.cx, 0) / blobList.length, by = blobList.reduce((t, k) => t + k.cy, 0) / blobList.length;
    let num = 0, den = 0;
    for (const k of blobList) { num += (k.cx - bx) * (k.cy - by); den += (k.cx - bx) ** 2; }
    if (den > 0) theta = Math.atan(num / den);
  }
  // the lean of the strokes: each digit's own long axis, measured from vertical (painted door numbers are sheared by perspective, not just turned)
  const leans: number[] = [];
  for (const k of blobList) {
    let kx = 0, ky = 0;
    for (const i of k.cells) { kx += i % win.w; ky += Math.floor(i / win.w); }
    kx /= k.cells.length; ky /= k.cells.length;
    let a1 = 0, a2 = 0, a3 = 0;
    for (const i of k.cells) { const dx = (i % win.w) - kx, dy = Math.floor(i / win.w) - ky; a1 += dx * dx; a2 += dy * dy; a3 += dx * dy; }
    const ang = 0.5 * Math.atan2(2 * a3, a1 - a2); // the long axis, from the x axis
    let vx = Math.cos(ang), vy = Math.sin(ang);
    if (vy < 0) { vx = -vx; vy = -vy; }
    leans.push(Math.atan2(-vx, vy));
  }
  leans.sort((p1, p2) => p1 - p2);
  const phi = clamp(leans.length ? leans[Math.floor(leans.length / 2)] : 0, -0.5, 0.5);
  const ex: [number, number] = [Math.cos(theta), Math.sin(theta)];
  const ey: [number, number] = [-Math.sin(phi), Math.cos(phi)];
  const det = ex[0] * ey[1] - ex[1] * ey[0];
  const us: number[] = [], vs: number[] = [];
  for (let i = 0; i < n; i++) if (ink[i]) {
    const dx = (i % win.w) - mx, dy = Math.floor(i / win.w) - my;
    us.push((dx * ey[1] - dy * ey[0]) / det); vs.push((ex[0] * dy - ex[1] * dx) / det);
  }
  const q = (arr: number[], p: number) => { const s2 = Float64Array.from(arr).sort(); return s2[Math.min(s2.length - 1, Math.max(0, Math.floor(p * (s2.length - 1))))]; };
  const u0 = q(us, 0.02), u1 = q(us, 0.98), v0 = q(vs, 0.02), v1 = q(vs, 0.98);
  const width = u1 - u0 + 3, height = v1 - v0 + 3;
  if (width < 12 || height < 6 || width / height < 1.6 || width / height > 9) return null; // four digits in a row are clearly wider than tall
  const cu = (u0 + u1) / 2, cv = (v0 + v1) / 2;
  const cx = win.x + mx + cu * ex[0] + cv * ey[0], cy = win.y + my + cu * ex[1] + cv * ey[1];
  return { m: { cx, cy, width, height, ex, ey, ink: [Math.round(b[0]), Math.round(b[1]), Math.round(b[2])], inkFraction: fraction }, ink, win };
}

/** Paints the old digits out and the new ones in. Returns a new picture (the input is not changed). */
export function swapDigits(img: Rgba, rough: Box, newText: string, draw: DigitMask): { out: Rgba; measured: Measured } | null {
  const found = measureDigits(img, rough);
  if (!found) return null;
  const { m, ink, win } = found;
  const out: Rgba = { width: img.width, height: img.height, data: new Uint8Array(img.data) };
  const n = win.w * win.h;
  // 1. the old digits' pixels (grown by two, to take their soft edges too) become holes
  let hole = new Uint8Array(n);
  for (let i = 0; i < n; i++) if (ink[i]) hole[i] = 1;
  for (let r = 0; r < 2; r++) {
    const next = hole.slice();
    for (let y = 0; y < win.h; y++) for (let x = 0; x < win.w; x++) {
      if (hole[y * win.w + x]) continue;
      if ((x > 0 && hole[y * win.w + x - 1]) || (x < win.w - 1 && hole[y * win.w + x + 1]) || (y > 0 && hole[(y - 1) * win.w + x]) || (y < win.h - 1 && hole[(y + 1) * win.w + x])) next[y * win.w + x] = 1;
    }
    hole = next;
  }
  // 2. fill the holes from what is around them (each hole pixel relaxes to the average of its neighbours, so the panel's shading carries across)
  const ch = [0, 1, 2].map((c) => {
    const v = new Float32Array(n);
    for (let i = 0; i < n; i++) v[i] = img.data[((win.y + Math.floor(i / win.w)) * img.width + win.x + (i % win.w)) * 4 + c];
    return v;
  });
  const holes: number[] = [];
  for (let i = 0; i < n; i++) if (hole[i]) holes.push(i);
  // start every hole at the average of the panel pixels around, then relax
  for (let c = 0; c < 3; c++) {
    let s = 0, k = 0;
    for (let i = 0; i < n; i++) if (!hole[i] && !ink[i]) { s += ch[c][i]; k++; }
    const mean = k ? s / k : 128;
    for (const i of holes) ch[c][i] = mean;
  }
  for (let it = 0; it < 220; it++) {
    for (let c = 0; c < 3; c++) {
      const v = ch[c];
      for (const i of holes) {
        const x = i % win.w, y = Math.floor(i / win.w);
        let s = 0, k = 0;
        if (x > 0) { s += v[i - 1]; k++; } if (x < win.w - 1) { s += v[i + 1]; k++; }
        if (y > 0) { s += v[i - win.w]; k++; } if (y < win.h - 1) { s += v[i + win.w]; k++; }
        v[i] = s / k;
      }
    }
  }
  // the panel has a little grain: put the same amount back into the filled pixels (so the patch is not suspiciously smooth)
  let grain = 0, gk = 0;
  for (let i = 0; i < n; i++) {
    if (hole[i] || ink[i]) continue;
    const x = i % win.w, y = Math.floor(i / win.w);
    if (x < 1 || y < 1 || x >= win.w - 1 || y >= win.h - 1) continue;
    const mean = (ch[1][i - 1] + ch[1][i + 1] + ch[1][i - win.w] + ch[1][i + win.w]) / 4;
    grain += (ch[1][i] - mean) ** 2; gk++;
  }
  const sigma = gk ? Math.min(6, Math.sqrt(grain / gk) * 0.8) : 0;
  let seed = 1234567;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296 - 0.5; };
  // 3. the new digits, drawn as a mask the size of the old ones' text box, then turned to the same tilt and softened a little
  const mw = Math.max(8, Math.round(m.width)), mh = Math.max(6, Math.round(m.height));
  const mask = draw(newText, mw, mh);
  const det = m.ex[0] * m.ey[1] - m.ex[1] * m.ey[0];
  const alpha = new Float32Array(n);
  for (let y = 0; y < win.h; y++) for (let x = 0; x < win.w; x++) {
    // (x, y) in the window -> its place in the upright text box
    const dx = win.x + x + 0.5 - m.cx, dy = win.y + y + 0.5 - m.cy;
    const u = (dx * m.ey[1] - dy * m.ey[0]) / det * (mw / m.width) + mw / 2, v = (m.ex[0] * dy - m.ex[1] * dx) / det * (mh / m.height) + mh / 2;
    if (u < 0 || v < 0 || u >= mw - 1 || v >= mh - 1) continue;
    const iu = Math.floor(u), iv = Math.floor(v), fu = u - iu, fv = v - iv;
    const a00 = mask[iv * mw + iu], a10 = mask[iv * mw + iu + 1], a01 = mask[(iv + 1) * mw + iu], a11 = mask[(iv + 1) * mw + iu + 1];
    alpha[y * win.w + x] = ((a00 * (1 - fu) + a10 * fu) * (1 - fv) + (a01 * (1 - fu) + a11 * fu) * fv) / 255;
  }
  // a soft edge like the old painted one (a light blur of the coverage)
  const soft = new Float32Array(n);
  for (let y = 0; y < win.h; y++) for (let x = 0; x < win.w; x++) {
    let s = 0, w = 0;
    for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
      const xx = x + ox, yy = y + oy;
      if (xx < 0 || yy < 0 || xx >= win.w || yy >= win.h) continue;
      const k = ox === 0 && oy === 0 ? 7 : ox === 0 || oy === 0 ? 1 : 0.4;
      s += alpha[yy * win.w + xx] * k; w += k;
    }
    soft[y * win.w + x] = s / w;
  }
  // 4. composite: the filled panel, with the ink colour over it (kept as bright or dark as the panel's light there is)
  let panelLum = 0, pk = 0;
  for (let i = 0; i < n; i++) if (!hole[i] && !ink[i]) { panelLum += ch[1][i]; pk++; }
  panelLum = pk ? panelLum / pk : 128;
  for (let i = 0; i < n; i++) {
    const x = i % win.w, y = Math.floor(i / win.w);
    const o = ((win.y + y) * img.width + win.x + x) * 4;
    const g = hole[i] ? sigma * 2 * rnd() : 0;
    const light = clamp(0.85 + 0.15 * (ch[1][i] / Math.max(1, panelLum)), 0.8, 1.15);
    const a = soft[i];
    for (let c = 0; c < 3; c++) {
      const base = hole[i] ? ch[c][i] + g : img.data[o + c];
      out.data[o + c] = clamp(Math.round(base * (1 - a) + clamp(m.ink[c] * light, 0, 255) * a), 0, 255);
    }
  }
  return { out, measured: m };
}
