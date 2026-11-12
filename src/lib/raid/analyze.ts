// Looks at a finished render to find sensible places for the enemies to come from, for the places nobody marked by hand (the ones a person unlocks themselves).
// It cannot understand the picture, but it can tell the sky (smooth, bright, joined to the top) from things (texture), find the skyline, and tell flat open ground
// from walls. From that: where the horizon is (so the size of an enemy follows how far down it starts), spots on the ground and on piles of rubble, spots high up on
// the faces of buildings (for ones that climb down), and the edges of the picture at ground level (for ones that walk in from the side of a street).

import type { Spawns } from './engine';

const W = 64, H = 64;

export interface Found extends Spawns {
  /** Spots on a building or a ruin, well above the ground: an enemy starting here climbs down. */
  high: { u: number; v: number }[];
  /** Spots at the edges of the picture on the ground, where a street or a gap runs out of sight: an enemy starting here walks in from the side. */
  edges: { u: number; v: number }[];
}

export function analyzeSpawns(img: HTMLImageElement, fallback: Spawns): Found | null {
  try {
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, W, H);
    const px = ctx.getImageData(0, 0, W, H).data;
    const lum = new Float32Array(W * H), sat = new Float32Array(W * H);
    for (let i = 0; i < W * H; i++) {
      const r = px[i * 4], g = px[i * 4 + 1], b = px[i * 4 + 2];
      lum[i] = 0.3 * r + 0.59 * g + 0.11 * b;
      sat[i] = Math.max(r, g, b) - Math.min(r, g, b);
    }
    // texture: how much the picture changes around each point
    const tex = new Float32Array(W * H);
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
      const i = y * W + x;
      tex[i] = Math.abs(lum[i + 1] - lum[i - 1]) + Math.abs(lum[i + W] - lum[i - W]);
    }
    // sky: smooth stuff joined to the top edge (a flood fill down from the top row through calm pixels)
    // judged on a blurred copy: clouds are textured up close but calm at a distance, and the sky is only looked for in the top three quarters
    const blur = new Float32Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { let t = 0, n = 0; for (let yy = Math.max(0, y - 2); yy <= Math.min(H - 1, y + 2); yy++) for (let xx = Math.max(0, x - 2); xx <= Math.min(W - 1, x + 2); xx++) { t += lum[yy * W + xx]; n++; } blur[y * W + x] = t / n; }
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) { const i = y * W + x; tex[i] = Math.max(tex[i] * 0.5, Math.abs(blur[i + 1] - blur[i - 1]) + Math.abs(blur[i + W] - blur[i - W])); }
    const SMOOTH = 22;
    const sky = new Uint8Array(W * H);
    const stack: number[] = [];
    for (let x = 0; x < W; x++) { sky[x] = 1; stack.push(x); }
    while (stack.length) {
      const i = stack.pop() as number;
      const x = i % W, y = (i / W) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const j = ny * W + nx;
        if (sky[j] || ny > H * 0.75 || tex[j] > SMOOTH || Math.abs(blur[j] - blur[i]) > 20) continue;
        sky[j] = 1; stack.push(j);
      }
    }
    // the skyline of each column: the first row that is not sky
    const skyline = new Float32Array(W);
    for (let x = 0; x < W; x++) { let y = 0; while (y < H && sky[y * W + x]) y++; skyline[x] = y / H; }
    const sorted = [...skyline].sort((a, b) => a - b);
    const q = (p: number) => sorted[Math.min(W - 1, Math.floor(p * W))];
    // the horizon: below the typical skyline (buildings stand on the ground below it), kept to a believable band
    const horizon = Math.max(0.5, Math.min(0.8, q(0.7) + 0.1));

    // for each spot of a grid: is it open ground (low texture, not sky, in the lower part), rubble (rough, not sky, low), or a wall (high up under the skyline)?
    const ground: { u: number; v: number; s: number }[] = [];
    const high: { u: number; v: number; s: number }[] = [];
    for (let gy = 0; gy < 14; gy++) for (let gx = 0; gx < 18; gx++) {
      const u = (gx + 0.5) / 18, v = 0.3 + (gy + 0.5) * (0.7 / 14);
      const x = Math.min(W - 1, Math.floor(u * W)), y = Math.min(H - 1, Math.floor(v * H));
      if (sky[y * W + x]) continue;
      // average texture and saturation round the spot
      let t = 0, n = 0, s = 0;
      for (let yy = Math.max(0, y - 2); yy <= Math.min(H - 1, y + 2); yy++) for (let xx = Math.max(0, x - 2); xx <= Math.min(W - 1, x + 2); xx++) { t += tex[yy * W + xx]; s += sat[yy * W + xx]; n++; }
      t /= n; s /= n;
      const below = Math.min(H - 1, y + 4);
      if (sky[below * W + x]) continue; // nothing to stand on: it would be hanging in the air
      const down = v - skyline[x]; // how far below the skyline of this column
      if (down < 0.06) continue; // right at the roof line: the top of a building, in the air
      if (v >= horizon - 0.02 && v <= 0.9) ground.push({ u, v, s: 1 / (1 + t / 40) + Math.random() * 0.5 });
      else if (v > Math.max(0.42, horizon - 0.3) && v < horizon - 0.04 && down > 0.14 && t > 24) high.push({ u, v, s: t / 60 + down + Math.random() * 0.3 }); // on the face of something standing, above the ground
    }
    if (ground.length < 5) return null; // too little to go on: the hand-made or default spots are used
    // the best spread: take the best-scoring, then spots that are not near ones already taken
    const pick = (list: { u: number; v: number; s: number }[], count: number, gap: number) => {
      const out: { u: number; v: number }[] = [];
      for (const p of [...list].sort((a, b) => b.s - a.s)) {
        if (out.every((o) => Math.hypot(o.u - p.u, (o.v - p.v) * 1.4) > gap)) out.push({ u: p.u, v: p.v });
        if (out.length >= count) break;
      }
      return out;
    };
    const points = pick(ground, 9, 0.11);
    if (points.length < 4) return null;
    const highs = pick(high, 4, 0.2);
    // the edges: at the left and right of the picture, at the height of open ground that reaches the edge
    const edges: { u: number; v: number }[] = [];
    for (const side of [0, 1]) {
      const x = side === 0 ? 1 : W - 2;
      let best: { v: number; s: number } | null = null;
      for (let gy = 0; gy < 14; gy++) {
        const v = Math.max(horizon + 0.02, 0.6) + gy * (0.28 / 14), y = Math.min(H - 1, Math.floor(v * H));
        if (sky[y * W + x]) continue;
        let t = 0; for (let yy = Math.max(0, y - 2); yy <= Math.min(H - 1, y + 2); yy++) t += tex[yy * W + x];
        const s = 1 / (1 + t / 5 / 40);
        if (!best || s > best.s) best = { v, s };
      }
      if (best) edges.push({ u: side === 0 ? -0.04 : 1.04, v: best.v });
    }
    return { horizon, points, high: highs, edges, ...(fallback.scale !== undefined ? { scale: fallback.scale } : {}) };
  } catch {
    return null; // the picture cannot be read (it came from another site without permission): keep the usual spots
  }
}
