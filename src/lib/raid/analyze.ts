// Looks at a finished render to find sensible places for the enemies to come from, for the places nobody marked by hand (the ones a person unlocks themselves).
// It cannot understand the picture, but it can tell the sky (smooth, bright, joined to the top) from things (texture), find the street (a large calm patch of ground
// joined to the bottom of the picture), and see where the buildings meet it. From that:
//  - most enemies start ON THE GROUND: at the foot of the buildings and rubble, where they meet the street (as if they came out of the wreck), and a few farther up the street;
//  - the size of an enemy follows perspective: how tall a building is in the picture, against how tall that sort of building really is, says how tall a person
//    standing at its foot looks, and a person nearer the camera (lower in the picture) is bigger, shrinking to nothing at the horizon.

import type { Spawns } from './engine';

const W = 96, H = 96;
/** A grown person's height in metres. */
const PERSON_M = 1.75;

export interface Found extends Spawns {
  /** Spots on a building or a ruin, well above the ground: an enemy starting here climbs down (rare). */
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
    return analyzeRgba(ctx.getImageData(0, 0, W, H).data, fallback, Math.random);
  } catch {
    return null; // the picture cannot be read (it came from another site without permission): keep the usual spots
  }
}

/** The analysis on the picture's pixels (96 by 96, RGBA), kept apart from the page so it can be tried on pictures directly. */
export function analyzeRgba(px: ArrayLike<number>, fallback: Spawns, random: () => number, debug?: { ground?: Uint8Array; sky?: Uint8Array }): Found | null {
  const lum = new Float32Array(W * H), sat = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) {
    const r = px[i * 4], g = px[i * 4 + 1], b = px[i * 4 + 2];
    lum[i] = 0.3 * r + 0.59 * g + 0.11 * b;
    sat[i] = Math.max(r, g, b) - Math.min(r, g, b);
  }
  const blur = new Float32Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let t = 0, n = 0;
    for (let yy = Math.max(0, y - 2); yy <= Math.min(H - 1, y + 2); yy++) for (let xx = Math.max(0, x - 2); xx <= Math.min(W - 1, x + 2); xx++) { t += lum[yy * W + xx]; n++; }
    blur[y * W + x] = t / n;
  }
  // texture: how much the picture changes around each point (scaled to the 64-point sampling the thresholds were tuned on)
  const tex = new Float32Array(W * H);
  const k = W / 64;
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    const i = y * W + x;
    const fine = (Math.abs(lum[i + 1] - lum[i - 1]) + Math.abs(lum[i + W] - lum[i - W])) * k;
    const coarse = (Math.abs(blur[i + 1] - blur[i - 1]) + Math.abs(blur[i + W] - blur[i - W])) * k;
    tex[i] = Math.max(fine * 0.5, coarse);
  }
  // sky: smooth stuff joined to the top edge (a flood fill down from the top row through calm pixels), only looked for in the top three quarters
  const SMOOTH = 22;
  const sky = new Uint8Array(W * H);
  const stack: number[] = [];
  for (let x = 0; x < W; x++) { sky[x] = 1; stack.push(x); }
  const four = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  while (stack.length) {
    const i = stack.pop() as number;
    const x = i % W, y = (i / W) | 0;
    for (const [dx, dy] of four) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const j = ny * W + nx;
      if (sky[j] || ny > H * 0.75 || tex[j] > SMOOTH || Math.abs(blur[j] - blur[i]) > 20) continue;
      sky[j] = 1; stack.push(j);
    }
  }
  const skyline = new Float32Array(W); // per column: the first row (0-1) that is not sky
  for (let x = 0; x < W; x++) { let y = 0; while (y < H && sky[y * W + x]) y++; skyline[x] = y / H; }

  // ground: the calm patches joined to the bottom edge (a street, a pavement, bare earth), grown upward through pixels that look like their neighbour
  const ground = new Uint8Array(W * H);
  const GT = 42;
  // the colour of the ground at the bottom of each column (an average over its neighbours): the ground higher up has to stay close to it, so a smooth wall is not taken for street
  const seedRgb = new Float32Array(W * 3);
  for (let x = 0; x < W; x++) {
    let r = 0, g = 0, bl = 0, n = 0;
    for (let xx = Math.max(0, x - 7); xx <= Math.min(W - 1, x + 7); xx++) for (let y = Math.floor(H * 0.92); y < H; y++) { const i = (y * W + xx) * 4; r += px[i]; g += px[i + 1]; bl += px[i + 2]; n++; }
    seedRgb[x * 3] = r / n; seedRgb[x * 3 + 1] = g / n; seedRgb[x * 3 + 2] = bl / n;
  }
  const farFromSeed = (x: number, i: number) => Math.hypot(px[i * 4] - seedRgb[x * 3], px[i * 4 + 1] - seedRgb[x * 3 + 1], px[i * 4 + 2] - seedRgb[x * 3 + 2]) > 58;
  for (let x = 0; x < W; x++) for (let y = Math.floor(H * 0.9); y < H; y++) {
    const i = y * W + x;
    if (!sky[i] && tex[i] < GT) { ground[i] = 1; stack.push(i); }
  }
  while (stack.length) {
    const i = stack.pop() as number;
    const x = i % W, y = (i / W) | 0;
    for (const [dx, dy] of four) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const j = ny * W + nx;
      if (ground[j] || sky[j] || ny < H * 0.36 || tex[j] > GT * 1.15 || Math.abs(lum[j] - lum[i]) > 14 || Math.abs(sat[j] - sat[i]) > 26 || farFromSeed(nx, j)) continue;
      ground[j] = 1; stack.push(j);
    }
  }
  let groundCount = 0;
  for (let i = 0; i < W * H; i++) groundCount += ground[i];
  if (debug) { debug.ground = ground; debug.sky = sky; }
  // the top of the ground in each column (the highest ground pixel joined to the bottom of the column)
  const groundTop = new Float32Array(W).fill(1);
  const hasGround = new Uint8Array(W);
  for (let x = 0; x < W; x++) {
    // climbing the column from the bottom, a gap of up to two rows (a line painted on the road) does not end the ground
    let y = H - 1, top = H;
    while (y >= 0) {
      if (ground[y * W + x]) { top = y; y--; continue; }
      let g = y;
      while (g >= 0 && g > y - 3 && !ground[g * W + x]) g--;
      if (g >= 0 && g > y - 3 && ground[g * W + x]) { y = g; continue; }
      break;
    }
    if (H - top >= 3) { hasGround[x] = 1; groundTop[x] = top / H; }
  }
  const groundCols = [...Array(W).keys()].filter((x) => hasGround[x]);
  if (groundCount < W * H * 0.05 || groundCols.length < W * 0.25) return analyzeRough(tex, sky, skyline, fallback, random);

  // the horizon: where open ground runs out under the sky (a street going off into the distance) is as far as the ground goes; otherwise it is kept above every building's foot
  const openFar: number[] = [];
  const bases: { x: number; v: number; up: number }[] = [];
  for (const x of groundCols) {
    const top = groundTop[x];
    const y = Math.max(0, Math.floor(top * H) - 3);
    if (sky[y * W + x]) openFar.push(top); // sky right above the ground: open distance
    else bases.push({ x, v: top, up: skyline[x] });
  }
  const sortedTops = groundCols.map((x) => groundTop[x]).sort((a, b) => a - b);
  const farthest = sortedTops[Math.floor(sortedTops.length * 0.08)];
  let horizon = openFar.length >= groundCols.length * 0.2 ? Math.min(...openFar) - 0.01 : farthest - 0.08;
  horizon = Math.max(0.45, Math.min(0.82, horizon));

  // how tall a person looks at the foot of the buildings, from how tall the buildings look against how tall they are
  const buildingM = Math.max(3, fallback.buildingM ?? 20);
  const builtBases = bases.filter((b) => b.up < b.v - 0.12); // somewhere with a real building or ruin standing above the ground
  let vRef: number, hRef: number;
  if (builtBases.length >= 4) {
    const vs = builtBases.map((b) => b.v).sort((a, b) => a - b);
    const ups = builtBases.map((b) => b.up).sort((a, b) => a - b);
    vRef = vs[Math.floor(vs.length / 2)];
    const roof = ups[Math.floor(ups.length / 2)];
    const visible = Math.max(0.1, vRef - roof);
    hRef = visible * (PERSON_M / buildingM) * (roof < 0.04 ? 0.6 : 1); // a building that runs off the top of the picture is taller than it shows
  } else {
    vRef = Math.min(0.95, (horizon + 1) / 2);
    hRef = 0.1 * (8 / buildingM) ** 0.6;
  }
  vRef = Math.max(horizon + 0.1, Math.min(0.97, vRef));
  hRef = Math.max(0.022, Math.min(0.22, hRef));

  // where they start: mostly at the foot of the buildings and rubble, on the ground, as if they came out of the wreck; some farther up the street, smaller
  const footSpots: { u: number; v: number; s: number }[] = [];
  for (const b of builtBases) {
    if (b.x % 3 !== 0) continue;
    footSpots.push({ u: (b.x + 0.5) / W, v: Math.min(0.95, b.v + 0.02 + random() * 0.05), s: (b.v - b.up) + random() * 0.15 });
  }
  const roadSpots: { u: number; v: number; s: number }[] = [];
  for (let gy = 0; gy < 18; gy++) for (let gx = 0; gx < 24; gx++) {
    const u = (gx + 0.5) / 24, v = horizon + 0.04 + (gy + 0.5) * ((0.93 - horizon - 0.04) / 18);
    const x = Math.min(W - 1, Math.floor(u * W)), y = Math.min(H - 1, Math.floor(v * H));
    if (!ground[y * W + x]) continue;
    // well inside the ground (not on its edge), and farther up the street scores higher than close in
    let inside = true;
    for (const [dx, dy] of [[2, 0], [-2, 0], [0, 2], [0, -2]]) { const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= W || yy >= H || !ground[yy * W + xx]) inside = false; }
    if (inside) roadSpots.push({ u, v, s: (1 - v) + random() * 0.6 });
  }
  const pick = (list: { u: number; v: number; s: number }[], count: number, gap: number) => {
    const out: { u: number; v: number }[] = [];
    for (const p of [...list].sort((a, b) => b.s - a.s)) {
      if (out.every((o) => Math.hypot(o.u - p.u, (o.v - p.v) * 1.4) > gap)) out.push({ u: p.u, v: p.v });
      if (out.length >= count) break;
    }
    return out;
  };
  const feet = pick(footSpots, 6, 0.1);
  const road = pick(roadSpots, feet.length >= 4 ? 3 : 8, 0.12);
  const points = [...feet, ...road];
  if (points.length < 4) return analyzeRough(tex, sky, skyline, fallback, random);

  // the edges: where the ground reaches the left or right side of the picture, at mid-height of the ground there
  const edges: { u: number; v: number }[] = [];
  for (const side of [0, 1]) {
    const x = side === 0 ? 1 : W - 2;
    if (!hasGround[x]) continue;
    edges.push({ u: side === 0 ? -0.04 : 1.04, v: Math.min(0.93, (groundTop[x] + 0.95) / 2 + 0.03) });
  }
  // a few spots high on the faces of things standing (rare climbers and flyers)
  const high: { u: number; v: number }[] = [];
  for (const b of builtBases) {
    if (b.x % 12 !== 0) continue;
    const v = b.up + (b.v - b.up) * (0.3 + random() * 0.2);
    if (v > b.up + 0.08) high.push({ u: (b.x + 0.5) / W, v });
  }
  return { horizon, points, high: high.slice(0, 4), edges, person: { v: vRef, h: hRef }, ...(fallback.scale !== undefined ? { scale: fallback.scale } : {}) };
}

/** A picture with no clear street (rubble field, trees, a view with no ground showing): the ground is guessed from where it is rough and low. */
function analyzeRough(tex: Float32Array, sky: Uint8Array, skyline: Float32Array, fallback: Spawns, random: () => number): Found | null {
  const horizon = horizonFromSkyline(skyline);
  const ground: { u: number; v: number; s: number }[] = [];
  for (let gy = 0; gy < 14; gy++) for (let gx = 0; gx < 18; gx++) {
    const u = (gx + 0.5) / 18, v = horizon + 0.02 + (gy + 0.5) * ((0.93 - horizon - 0.02) / 14);
    const x = Math.min(W - 1, Math.floor(u * W)), y = Math.min(H - 1, Math.floor(v * H));
    if (sky[y * W + x] || sky[Math.min(H - 1, y + 4) * W + x]) continue;
    let t = 0, n = 0;
    for (let yy = Math.max(0, y - 2); yy <= Math.min(H - 1, y + 2); yy++) for (let xx = Math.max(0, x - 2); xx <= Math.min(W - 1, x + 2); xx++) { t += tex[yy * W + xx]; n++; }
    ground.push({ u, v, s: 1 / (1 + t / n / 40) + random() * 0.5 });
  }
  if (ground.length < 5) return null;
  const out: { u: number; v: number }[] = [];
  for (const p of ground.sort((a, b) => b.s - a.s)) {
    if (out.every((o) => Math.hypot(o.u - p.u, (o.v - p.v) * 1.4) > 0.11)) out.push({ u: p.u, v: p.v });
    if (out.length >= 9) break;
  }
  if (out.length < 4) return null;
  const buildingM = Math.max(3, fallback.buildingM ?? 20);
  return { horizon, points: out, high: [], edges: [], person: { v: 0.9, h: Math.max(0.022, Math.min(0.2, 0.12 * (8 / buildingM) ** 0.6)) }, ...(fallback.scale !== undefined ? { scale: fallback.scale } : {}) };
}

/** Where the horizon is, from the skyline: below the typical skyline (buildings stand on ground below it), kept to a believable band. */
function horizonFromSkyline(skyline: Float32Array): number {
  const sorted = [...skyline].sort((a, b) => a - b);
  return Math.max(0.5, Math.min(0.8, sorted[Math.min(W - 1, Math.floor(0.7 * W))] + 0.1));
}
