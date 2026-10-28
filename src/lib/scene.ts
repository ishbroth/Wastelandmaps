// Draws a wasteland scene for a place: an irradiated sky, ruined skyline, a cracked road, and a landmark that fits what the place was (a
// hospital with a fallen cross, a gas canopy with dry pumps, a church with a broken steeple...). It is drawn from scratch on a canvas from
// just the place's category and a seed, so the same place always looks the same. It uses no photos and none of Google's imagery.

import { seeded, type CategoryId } from './wasteland';
import type { LookId } from './looks';

export type SceneKind = CategoryId | 'vault';

export interface SceneSpec {
  kind: SceneKind;
  seed: number;
  look: LookId;
  /** Shown on signs where the scene has one ("MARKET", "VAULT 067"). */
  label?: string;
}

/** Canvas text needs the font loaded first, or signs fall back to a serif. Await this before starting a scene. */
export const sceneFontsReady = (): Promise<unknown> => (document.fonts ? document.fonts.load("40px VT323").catch(() => null) : Promise.resolve());

export const SCENE_W = 960;
export const SCENE_H = 540;

interface Palette {
  skyTop: string; skyBottom: string; sun: string; sunHalo: string;
  far: string; mid: string; near: string; ground: string; road: string;
  line: string; lineSoft: string; accent: string; glass: string; lit: string; mote: string;
}

const PALETTES: Record<LookId, Palette> = {
  pipboy: {
    skyTop: '#00140a', skyBottom: '#06401d', sun: '#c8ffd9', sunHalo: 'rgba(120,255,170,0.28)',
    far: '#05341a', mid: '#074d24', near: '#0a6a30', ground: '#021d0b', road: '#03170a',
    line: '#4dff95', lineSoft: '#1fa656', accent: '#d8ff6a', glass: '#01100a', lit: '#b6ffd0', mote: 'rgba(160,255,190,0.7)',
  },
  parchment: {
    skyTop: '#e9d9a8', skyBottom: '#cfb47a', sun: '#a3401f', sunHalo: 'rgba(163,64,31,0.18)',
    far: '#c9b07a', mid: '#b69857', near: '#9a7a43', ground: '#c8b17a', road: '#b9a06a',
    line: '#3b2a14', lineSoft: '#6e5430', accent: '#a3401f', glass: '#8a6e3e', lit: '#a3401f', mote: 'rgba(59,42,20,0.55)',
  },
};

type Ctx = CanvasRenderingContext2D;
type Rand = () => number;

interface Light { x: number; y: number; w: number; h: number; flicker: number; round?: boolean }

interface Built {
  base: HTMLCanvasElement;
  lights: Light[];
  sunX: number;
  sunY: number;
}

const FONT = "VT323, 'Courier New', monospace";

// ---- small drawing helpers ----

function box(ctx: Ctx, x: number, y: number, w: number, h: number, fill: string, stroke?: string, lw = 2) {
  ctx.fillStyle = fill;
  ctx.fillRect(x, y, w, h);
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.strokeRect(x, y, w, h); }
}

/** A building whose roofline has been broken by years of weather and worse. */
function brokenBlock(ctx: Ctx, x: number, baseY: number, w: number, h: number, rand: Rand, fill: string, stroke: string, lw = 1.5) {
  const steps = Math.max(3, Math.round(w / 12));
  ctx.beginPath();
  ctx.moveTo(x, baseY);
  ctx.lineTo(x, baseY - h);
  for (let i = 1; i <= steps; i++) {
    const px = x + (w * i) / steps;
    const bite = rand() < 0.35 ? rand() * h * 0.28 : rand() * h * 0.05;
    ctx.lineTo(px, baseY - h + bite);
  }
  ctx.lineTo(x + w, baseY);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = lw;
  ctx.stroke();
}

function windows(ctx: Ctx, x: number, y: number, w: number, h: number, cols: number, rows: number, rand: Rand, p: Palette, lights: Light[], litChance = 0.08) {
  const cw = w / cols;
  const ch = h / rows;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const wx = x + c * cw + cw * 0.18;
      const wy = y + r * ch + ch * 0.2;
      const ww = cw * 0.64;
      const wh = ch * 0.6;
      const broken = rand() < 0.3;
      ctx.fillStyle = p.glass;
      ctx.fillRect(wx, wy, ww, wh);
      ctx.strokeStyle = p.lineSoft;
      ctx.lineWidth = 1.2;
      ctx.strokeRect(wx, wy, ww, wh);
      if (broken) {
        ctx.beginPath();
        ctx.moveTo(wx, wy); ctx.lineTo(wx + ww * 0.6, wy + wh * 0.5); ctx.lineTo(wx + ww, wy + wh * 0.2);
        ctx.moveTo(wx + ww * 0.6, wy + wh * 0.5); ctx.lineTo(wx + ww * 0.3, wy + wh);
        ctx.stroke();
      } else if (rand() < litChance) {
        lights.push({ x: wx, y: wy, w: ww, h: wh, flicker: 0.4 + rand() * 0.6 });
      }
    }
  }
}

function deadTree(ctx: Ctx, x: number, baseY: number, h: number, rand: Rand, color: string) {
  ctx.strokeStyle = color;
  ctx.lineCap = 'round';
  const branch = (bx: number, by: number, len: number, angle: number, width: number, depth: number) => {
    const ex = bx + Math.cos(angle) * len;
    const ey = by + Math.sin(angle) * len;
    ctx.lineWidth = width;
    ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(ex, ey); ctx.stroke();
    if (depth <= 0) return;
    branch(ex, ey, len * (0.62 + rand() * 0.15), angle - 0.4 - rand() * 0.4, width * 0.7, depth - 1);
    branch(ex, ey, len * (0.55 + rand() * 0.15), angle + 0.4 + rand() * 0.4, width * 0.7, depth - 1);
  };
  branch(x, baseY, h * 0.38, -Math.PI / 2 + (rand() - 0.5) * 0.2, Math.max(2, h * 0.04), 4);
  ctx.lineCap = 'butt';
}

function wreckedCar(ctx: Ctx, x: number, baseY: number, scale: number, p: Palette) {
  ctx.save();
  ctx.translate(x, baseY);
  ctx.scale(scale, scale);
  ctx.fillStyle = p.mid; ctx.strokeStyle = p.line; ctx.lineWidth = 2 / scale;
  ctx.beginPath(); ctx.moveTo(-70, 0); ctx.lineTo(-70, -22); ctx.lineTo(-45, -26); ctx.lineTo(-28, -48); ctx.lineTo(24, -48); ctx.lineTo(44, -26); ctx.lineTo(70, -22); ctx.lineTo(70, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = p.glass; ctx.beginPath(); ctx.moveTo(-22, -26); ctx.lineTo(-12, -42); ctx.lineTo(18, -42); ctx.lineTo(32, -26); ctx.closePath(); ctx.fill(); ctx.stroke();
  for (const wx of [-42, 42]) { ctx.beginPath(); ctx.arc(wx, 2, 12, 0, Math.PI * 2); ctx.fillStyle = p.ground; ctx.fill(); ctx.stroke(); ctx.beginPath(); ctx.arc(wx, 2, 4, 0, Math.PI * 2); ctx.stroke(); }
  ctx.restore();
}

function barrel(ctx: Ctx, x: number, baseY: number, p: Palette) {
  ctx.fillStyle = p.mid; ctx.strokeStyle = p.line; ctx.lineWidth = 1.6;
  ctx.fillRect(x, baseY - 26, 18, 26); ctx.strokeRect(x, baseY - 26, 18, 26);
  ctx.beginPath(); ctx.moveTo(x, baseY - 17); ctx.lineTo(x + 18, baseY - 17); ctx.moveTo(x, baseY - 9); ctx.lineTo(x + 18, baseY - 9); ctx.stroke();
}

function sign(ctx: Ctx, text: string, cx: number, cy: number, size: number, p: Palette, lights: Light[], glow = true) {
  ctx.font = `${size}px ${FONT}`;
  const w = ctx.measureText(text).width + 16;
  const h = size * 0.9;
  ctx.fillStyle = p.glass; ctx.fillRect(cx - w / 2, cy - h / 2, w, h);
  ctx.strokeStyle = p.line; ctx.lineWidth = 2; ctx.strokeRect(cx - w / 2, cy - h / 2, w, h);
  ctx.fillStyle = p.line; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, cx, cy + 1);
  if (glow) lights.push({ x: cx - w / 2, y: cy - h / 2, w, h, flicker: 0.7 });
}

// ---- the landmarks ----

type Landmark = (ctx: Ctx, cx: number, gy: number, rand: Rand, p: Palette, lights: Light[], label?: string) => void;

const medical: Landmark = (ctx, cx, gy, rand, p, lights) => {
  brokenBlock(ctx, cx - 170, gy, 340, 200, rand, p.near, p.line, 2.4);
  windows(ctx, cx - 160, gy - 190, 320, 140, 8, 4, rand, p, lights, 0.06);
  box(ctx, cx - 40, gy - 60, 80, 60, p.glass, p.line); // entrance
  box(ctx, cx - 56, gy - 70, 112, 10, p.mid, p.line); // canopy
  // a big cross on a pole, leaning
  ctx.save(); ctx.translate(cx + 130, gy - 200); ctx.rotate(-0.14);
  ctx.strokeStyle = p.accent; ctx.lineWidth = 14; ctx.beginPath(); ctx.moveTo(0, -46); ctx.lineTo(0, 46); ctx.moveTo(-46, 0); ctx.lineTo(46, 0); ctx.stroke();
  ctx.restore();
  lights.push({ x: cx + 100, y: gy - 250, w: 60, h: 60, flicker: 0.5, round: true });
  wreckedCar(ctx, cx - 250, gy + 30, 0.9, p);
};

const school: Landmark = (ctx, cx, gy, rand, p, lights) => {
  brokenBlock(ctx, cx - 210, gy, 420, 120, rand, p.near, p.line, 2.4);
  windows(ctx, cx - 200, gy - 110, 400, 80, 12, 2, rand, p, lights, 0.04);
  brokenBlock(ctx, cx - 36, gy, 72, 230, rand, p.mid, p.line, 2.4); // clock tower
  ctx.strokeStyle = p.line; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx, gy - 175, 18, 0, Math.PI * 2); ctx.moveTo(cx, gy - 175); ctx.lineTo(cx, gy - 188); ctx.moveTo(cx, gy - 175); ctx.lineTo(cx + 10, gy - 170); ctx.stroke();
  // flagpole with a rag of a flag
  ctx.beginPath(); ctx.moveTo(cx + 150, gy); ctx.lineTo(cx + 150, gy - 200); ctx.stroke();
  ctx.fillStyle = p.accent; ctx.beginPath(); ctx.moveTo(cx + 150, gy - 198); ctx.lineTo(cx + 196, gy - 188); ctx.lineTo(cx + 168, gy - 180); ctx.lineTo(cx + 190, gy - 166); ctx.lineTo(cx + 150, gy - 172); ctx.closePath(); ctx.fill();
  for (let i = 0; i < 4; i++) box(ctx, cx - 170 + i * 20, gy + 12, 16, 10, p.mid, p.line, 1.4); // stacked desks
};

const market: Landmark = (ctx, cx, gy, rand, p, lights, label) => {
  brokenBlock(ctx, cx - 190, gy, 380, 130, rand, p.near, p.line, 2.4);
  // striped awning
  for (let i = 0; i < 12; i++) { ctx.fillStyle = i % 2 ? p.accent : p.mid; ctx.fillRect(cx - 190 + i * (380 / 12), gy - 90, 380 / 12, 26); }
  ctx.strokeStyle = p.line; ctx.lineWidth = 2; ctx.strokeRect(cx - 190, gy - 90, 380, 26);
  windows(ctx, cx - 180, gy - 56, 360, 50, 9, 1, rand, p, lights, 0.05);
  sign(ctx, label ?? 'MARKET', cx, gy - 150, 46, p, lights);
  for (let i = 0; i < 3; i++) { const x = cx - 230 + i * 34; ctx.strokeStyle = p.line; ctx.lineWidth = 1.6; ctx.strokeRect(x, gy + 18, 26, 20); ctx.beginPath(); ctx.arc(x + 5, gy + 44, 3, 0, 7); ctx.arc(x + 21, gy + 44, 3, 0, 7); ctx.stroke(); }
};

const fuel: Landmark = (ctx, cx, gy, rand, p, lights) => {
  box(ctx, cx - 190, gy - 130, 380, 22, p.mid, p.line, 2.4);
  for (const px of [-160, -30, 110, 170]) box(ctx, cx + px, gy - 108, 10, 108, p.near, p.line);
  for (const px of [-110, -20, 70]) { box(ctx, cx + px, gy - 52, 24, 52, p.near, p.line); box(ctx, cx + px + 3, gy - 46, 18, 14, p.glass, p.line, 1.4); }
  brokenBlock(ctx, cx - 190, gy - 108, 130, 70, rand, p.far, p.lineSoft, 1.4); // a half-collapsed kiosk behind
  // price sign on a tall pole
  box(ctx, cx + 214, gy - 230, 8, 230, p.near, p.line);
  sign(ctx, 'GAS', cx + 218, gy - 258, 38, p, lights);
  wreckedCar(ctx, cx - 250, gy + 34, 0.85, p);
};

const park: Landmark = (ctx, cx, gy, rand, p, lights) => {
  // fountain
  ctx.fillStyle = p.mid; ctx.strokeStyle = p.line; ctx.lineWidth = 2.4;
  ctx.beginPath(); ctx.ellipse(cx, gy + 10, 120, 28, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(cx, gy + 4, 96, 20, 0, 0, Math.PI * 2); ctx.fillStyle = p.glass; ctx.fill(); ctx.stroke();
  box(ctx, cx - 10, gy - 70, 20, 74, p.near, p.line);
  ctx.beginPath(); ctx.ellipse(cx, gy - 70, 42, 12, 0, 0, Math.PI * 2); ctx.fillStyle = p.mid; ctx.fill(); ctx.stroke();
  lights.push({ x: cx - 40, y: gy - 6, w: 80, h: 12, flicker: 0.9 });
  for (let i = 0; i < 5; i++) deadTree(ctx, cx - 300 + i * 150 + rand() * 40, gy + 10 + rand() * 14, 120 + rand() * 70, rand, p.line);
  // a bench and an old swing
  box(ctx, cx + 150, gy + 22, 70, 8, p.near, p.line); box(ctx, cx + 154, gy + 30, 6, 14, p.near, p.line); box(ctx, cx + 210, gy + 30, 6, 14, p.near, p.line);
  for (let i = 0; i < 24; i++) { const x = cx - 360 + rand() * 720; const y = gy + 20 + rand() * 40; ctx.strokeStyle = p.lineSoft; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 3, y - 10); ctx.moveTo(x, y); ctx.lineTo(x + 4, y - 12); ctx.stroke(); }
};

const guard: Landmark = (ctx, cx, gy, rand, p, lights) => {
  brokenBlock(ctx, cx - 160, gy, 320, 130, rand, p.near, p.line, 2.4);
  windows(ctx, cx - 150, gy - 120, 300, 80, 7, 2, rand, p, lights, 0.08);
  // watchtower
  box(ctx, cx + 120, gy - 230, 70, 50, p.mid, p.line, 2.4);
  for (const px of [124, 180]) { ctx.strokeStyle = p.line; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(cx + px, gy - 180); ctx.lineTo(cx + px - 6, gy - 60); ctx.stroke(); }
  lights.push({ x: cx + 132, y: gy - 218, w: 46, h: 14, flicker: 0.6 });
  // sandbag wall
  for (let row = 0; row < 2; row++) for (let i = 0; i < 11; i++) { ctx.fillStyle = p.mid; ctx.strokeStyle = p.line; ctx.lineWidth = 1.4; const x = cx - 190 + i * 34 + (row % 2) * 17; ctx.beginPath(); ctx.roundRect(x, gy + 6 - row * 16, 32, 15, 6); ctx.fill(); ctx.stroke(); }
  // flag
  ctx.strokeStyle = p.line; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(cx - 120, gy - 130); ctx.lineTo(cx - 120, gy - 230); ctx.stroke();
  ctx.fillStyle = p.accent; ctx.fillRect(cx - 118, gy - 228, 44, 26);
};

const cantina: Landmark = (ctx, cx, gy, rand, p, lights) => {
  brokenBlock(ctx, cx - 150, gy, 300, 130, rand, p.near, p.line, 2.4);
  windows(ctx, cx - 140, gy - 120, 280, 70, 6, 2, rand, p, lights, 0.5);
  box(ctx, cx - 28, gy - 62, 56, 62, p.glass, p.line);
  lights.push({ x: cx - 24, y: gy - 58, w: 48, h: 54, flicker: 0.35 });
  // mug sign on a pole
  box(ctx, cx + 176, gy - 190, 6, 190, p.near, p.line);
  ctx.strokeStyle = p.accent; ctx.lineWidth = 5; ctx.beginPath(); ctx.roundRect(cx + 146, gy - 250, 40, 48, 6); ctx.stroke(); ctx.beginPath(); ctx.arc(cx + 192, gy - 226, 14, -Math.PI / 2, Math.PI / 2); ctx.stroke();
  lights.push({ x: cx + 142, y: gy - 254, w: 64, h: 56, flicker: 0.55 });
  // string lights
  ctx.strokeStyle = p.lineSoft; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(cx - 150, gy - 130); ctx.quadraticCurveTo(cx - 20, gy - 70, cx + 150, gy - 134); ctx.stroke();
  for (let i = 1; i < 8; i++) { const t = i / 8; const x = (1 - t) * (1 - t) * (cx - 150) + 2 * (1 - t) * t * (cx - 20) + t * t * (cx + 150); const y = (1 - t) * (1 - t) * (gy - 130) + 2 * (1 - t) * t * (gy - 70) + t * t * (gy - 134); lights.push({ x: x - 3, y: y, w: 7, h: 7, flicker: 0.3 + rand() * 0.6, round: true }); }
  for (let i = 0; i < 3; i++) barrel(ctx, cx - 210 + i * 22, gy + 28, p);
};

const chapel: Landmark = (ctx, cx, gy, rand, p, lights) => {
  brokenBlock(ctx, cx - 150, gy, 300, 120, rand, p.near, p.line, 2.4);
  // steeple
  ctx.fillStyle = p.mid; ctx.strokeStyle = p.line; ctx.lineWidth = 2.4;
  ctx.beginPath(); ctx.moveTo(cx - 40, gy - 110); ctx.lineTo(cx - 28, gy - 250); ctx.lineTo(cx, gy - 330); ctx.lineTo(cx + 28, gy - 250); ctx.lineTo(cx + 40, gy - 110); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.lineWidth = 5; ctx.strokeStyle = p.accent; ctx.beginPath(); ctx.moveTo(cx, gy - 330); ctx.lineTo(cx, gy - 366); ctx.moveTo(cx - 14, gy - 350); ctx.lineTo(cx + 14, gy - 350); ctx.stroke();
  ctx.lineWidth = 2; ctx.strokeStyle = p.line;
  for (let i = 0; i < 4; i++) { const x = cx - 120 + i * 70; ctx.beginPath(); ctx.moveTo(x, gy - 20); ctx.lineTo(x, gy - 70); ctx.arc(x + 14, gy - 70, 14, Math.PI, 0); ctx.lineTo(x + 28, gy - 20); ctx.closePath(); ctx.fillStyle = p.glass; ctx.fill(); ctx.stroke(); }
  box(ctx, cx - 14, gy - 200, 28, 50, p.glass, p.line); lights.push({ x: cx - 10, y: gy - 196, w: 20, h: 42, flicker: 0.7 });
};

const transit: Landmark = (ctx, cx, gy, _rand, p, lights) => {
  // a great arched hall
  ctx.fillStyle = p.near; ctx.strokeStyle = p.line; ctx.lineWidth = 2.4;
  ctx.beginPath(); ctx.moveTo(cx - 210, gy); ctx.lineTo(cx - 210, gy - 80); ctx.arc(cx, gy - 80, 210, Math.PI, 0); ctx.lineTo(cx + 210, gy); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx - 150, gy); ctx.lineTo(cx - 150, gy - 70); ctx.arc(cx, gy - 70, 150, Math.PI, 0); ctx.lineTo(cx + 150, gy); ctx.closePath(); ctx.fillStyle = p.glass; ctx.fill(); ctx.stroke();
  for (let i = -3; i <= 3; i++) { ctx.beginPath(); ctx.moveTo(cx + i * 40, gy - 220); ctx.lineTo(cx + i * 40, gy - 10); ctx.strokeStyle = p.lineSoft; ctx.lineWidth = 1.2; ctx.stroke(); }
  // rails running into the dark
  ctx.strokeStyle = p.line; ctx.lineWidth = 2.4;
  for (const dx of [-40, 40]) { ctx.beginPath(); ctx.moveTo(cx + dx * 0.4, gy - 6); ctx.lineTo(cx + dx * 3.4, gy + 80); ctx.stroke(); }
  for (let i = 0; i < 6; i++) { const y = gy + i * 14; ctx.beginPath(); ctx.moveTo(cx - 30 - i * 9, y); ctx.lineTo(cx + 30 + i * 9, y); ctx.lineWidth = 1.4; ctx.stroke(); }
  // a signal post and a lit departures board
  box(ctx, cx + 240, gy - 120, 6, 120, p.near, p.line);
  lights.push({ x: cx + 232, y: gy - 138, w: 22, h: 22, flicker: 0.25, round: true });
  lights.push({ x: cx - 70, y: gy - 175, w: 140, h: 22, flicker: 0.6 });
};

const arena: Landmark = (ctx, cx, gy, rand, p, lights) => {
  for (let i = 0; i < 4; i++) {
    ctx.fillStyle = i % 2 ? p.mid : p.near; ctx.strokeStyle = p.line; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(cx, gy - 20 - i * 4, 230 - i * 10, 76 - i * 6, 0, 0, Math.PI, false); ctx.lineTo(cx - (220 - i * 10), gy - 70 - i * 18); ctx.ellipse(cx, gy - 70 - i * 18, 220 - i * 10, 58, 0, Math.PI, 0, true); ctx.closePath(); ctx.fill(); ctx.stroke();
  }
  for (const px of [-250, -110, 110, 250]) {
    box(ctx, cx + px - 4, gy - 250, 8, 250, p.near, p.line);
    box(ctx, cx + px - 26, gy - 270, 52, 22, p.glass, p.line);
    lights.push({ x: cx + px - 24, y: gy - 268, w: 48, h: 18, flicker: 0.25 + rand() * 0.5 });
  }
};

const lodging: Landmark = (ctx, cx, gy, rand, p, lights) => {
  brokenBlock(ctx, cx - 100, gy, 200, 300, rand, p.near, p.line, 2.4);
  windows(ctx, cx - 90, gy - 285, 180, 240, 6, 11, rand, p, lights, 0.07);
  box(ctx, cx - 40, gy - 36, 80, 36, p.glass, p.line);
  // vertical neon letters
  ctx.font = `34px ${FONT}`; ctx.textAlign = 'center'; ctx.fillStyle = p.accent;
  'HOTEL'.split('').forEach((ch, i) => ctx.fillText(ch, cx + 128, gy - 270 + i * 34));
  lights.push({ x: cx + 112, y: gy - 290, w: 32, h: 180, flicker: 0.45 });
  box(ctx, cx - 160, gy - 60, 40, 60, p.far, p.lineSoft, 1.4);
};

const other: Landmark = (ctx, cx, gy, rand, p) => {
  ctx.fillStyle = p.near; ctx.strokeStyle = p.line; ctx.lineWidth = 2.4;
  box(ctx, cx - 120, gy - 190, 44, 190, p.near, p.line, 2.4);
  box(ctx, cx + 76, gy - 150, 44, 150, p.near, p.line, 2.4);
  ctx.beginPath(); ctx.moveTo(cx - 120, gy - 190); ctx.arc(cx - 20, gy - 190, 100, Math.PI, Math.PI * 1.62); ctx.lineTo(cx - 40, gy - 210); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx + 120, gy - 150); ctx.arc(cx + 20, gy - 150, 100, 0, -Math.PI * 0.42, true); ctx.stroke();
  brokenBlock(ctx, cx - 20, gy, 40, 260, rand, p.mid, p.line, 2.4); // an obelisk
  for (let i = 0; i < 10; i++) box(ctx, cx - 170 + rand() * 340, gy + 6 + rand() * 20, 10 + rand() * 24, 6 + rand() * 8, p.mid, p.lineSoft, 1);
};

const vault: Landmark = (ctx, cx, gy, rand, p, lights, label) => {
  // a rock face with a concrete frame and the great round door
  ctx.fillStyle = p.far;
  ctx.beginPath(); ctx.moveTo(cx - 460, gy + 40); ctx.lineTo(cx - 420, gy - 160); ctx.lineTo(cx - 300, gy - 250); ctx.lineTo(cx - 140, gy - 290); ctx.lineTo(cx + 140, gy - 290); ctx.lineTo(cx + 300, gy - 250); ctx.lineTo(cx + 420, gy - 160); ctx.lineTo(cx + 460, gy + 40); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = p.lineSoft; ctx.lineWidth = 1.5; ctx.stroke();
  box(ctx, cx - 170, gy - 250, 340, 270, p.near, p.line, 3);
  ctx.beginPath(); ctx.arc(cx, gy - 110, 120, 0, Math.PI * 2); ctx.fillStyle = p.glass; ctx.fill(); ctx.strokeStyle = p.line; ctx.lineWidth = 5; ctx.stroke();
  ctx.beginPath(); ctx.arc(cx, gy - 110, 98, 0, Math.PI * 2); ctx.fillStyle = p.mid; ctx.fill(); ctx.lineWidth = 3; ctx.stroke();
  for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * 24, gy - 110 + Math.sin(a) * 24); ctx.lineTo(cx + Math.cos(a) * 98, gy - 110 + Math.sin(a) * 98); ctx.lineWidth = 6; ctx.stroke(); ctx.beginPath(); ctx.arc(cx + Math.cos(a) * 110, gy - 110 + Math.sin(a) * 110, 6, 0, Math.PI * 2); ctx.fillStyle = p.line; ctx.fill(); }
  ctx.beginPath(); ctx.arc(cx, gy - 110, 22, 0, Math.PI * 2); ctx.fillStyle = p.accent; ctx.fill(); ctx.strokeStyle = p.line; ctx.lineWidth = 3; ctx.stroke();
  sign(ctx, label ?? 'VAULT', cx, gy - 276, 44, p, lights);
  // hazard stripes along the base
  for (let i = 0; i < 17; i++) { ctx.fillStyle = i % 2 ? p.accent : p.glass; ctx.beginPath(); ctx.moveTo(cx - 170 + i * 20, gy + 20); ctx.lineTo(cx - 150 + i * 20, gy + 20); ctx.lineTo(cx - 140 + i * 20, gy + 40); ctx.lineTo(cx - 160 + i * 20, gy + 40); ctx.closePath(); ctx.fill(); }
  lights.push({ x: cx - 24, y: gy - 134, w: 48, h: 48, flicker: 0.4, round: true });
  for (let i = 0; i < 5; i++) barrel(ctx, cx - 240 + i * 24 + (rand() < 0.5 ? 0 : 3), gy + 46, p);
};

const LANDMARKS: Record<SceneKind, Landmark> = { medical, school, market, fuel, park, guard, cantina, chapel, transit, arena, lodging, other, vault };

// ---- building the picture ----

function build(spec: SceneSpec): Built {
  const p = PALETTES[spec.look];
  const rand = seeded(spec.seed);
  const base = document.createElement('canvas');
  base.width = SCENE_W;
  base.height = SCENE_H;
  const ctx = base.getContext('2d') as Ctx;
  const lights: Light[] = [];
  const horizon = SCENE_H * 0.64;

  // sky
  const sky = ctx.createLinearGradient(0, 0, 0, horizon);
  sky.addColorStop(0, p.skyTop);
  sky.addColorStop(1, p.skyBottom);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, SCENE_W, SCENE_H);

  // a sickly sun, low and large
  const sunX = SCENE_W * (0.2 + rand() * 0.6);
  const sunY = horizon - 120 - rand() * 80;
  ctx.fillStyle = p.sun;
  ctx.beginPath(); ctx.arc(sunX, sunY, 54, 0, Math.PI * 2); ctx.fill();

  // streaky clouds
  ctx.strokeStyle = p.lineSoft;
  for (let i = 0; i < 9; i++) {
    const y = 30 + rand() * (horizon - 150);
    const x = rand() * SCENE_W;
    const w = 120 + rand() * 260;
    ctx.globalAlpha = 0.25 + rand() * 0.25;
    ctx.lineWidth = 2 + rand() * 4;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + w, y + (rand() - 0.5) * 6); ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // two layers of skyline
  for (const layer of [{ fill: p.far, count: 22, hMax: 190, hMin: 50, line: p.lineSoft }, { fill: p.mid, count: 14, hMax: 150, hMin: 40, line: p.lineSoft }]) {
    let x = -20;
    for (let i = 0; i < layer.count && x < SCENE_W; i++) {
      const w = 36 + rand() * 70;
      brokenBlock(ctx, x, horizon + 6, w, layer.hMin + rand() * (layer.hMax - layer.hMin), rand, layer.fill, layer.line, 1.2);
      x += w * (0.55 + rand() * 0.5);
    }
  }

  // ground and a cracked road running to the horizon
  ctx.fillStyle = p.ground;
  ctx.fillRect(0, horizon, SCENE_W, SCENE_H - horizon);
  ctx.strokeStyle = p.lineSoft; ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.moveTo(0, horizon); ctx.lineTo(SCENE_W, horizon); ctx.stroke();
  ctx.fillStyle = p.road;
  ctx.beginPath(); ctx.moveTo(SCENE_W * 0.42, horizon); ctx.lineTo(SCENE_W * 0.58, horizon); ctx.lineTo(SCENE_W * 0.98, SCENE_H); ctx.lineTo(SCENE_W * 0.02, SCENE_H); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = p.line; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(SCENE_W * 0.42, horizon); ctx.lineTo(SCENE_W * 0.02, SCENE_H); ctx.moveTo(SCENE_W * 0.58, horizon); ctx.lineTo(SCENE_W * 0.98, SCENE_H); ctx.stroke();
  ctx.strokeStyle = p.lineSoft;
  for (let i = 0; i < 7; i++) { const t0 = i / 7, t1 = t0 + 0.05; ctx.lineWidth = 1 + t0 * 4; ctx.beginPath(); ctx.moveTo(SCENE_W * 0.5, horizon + (SCENE_H - horizon) * t0 * t0); ctx.lineTo(SCENE_W * 0.5, horizon + (SCENE_H - horizon) * t1 * t1); ctx.stroke(); }
  for (let i = 0; i < 14; i++) { // cracks
    let x = SCENE_W * (0.1 + rand() * 0.8); let y = horizon + 20 + rand() * (SCENE_H - horizon - 20);
    ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(x, y);
    for (let k = 0; k < 4; k++) { x += (rand() - 0.5) * 40; y += rand() * 14; ctx.lineTo(x, y); }
    ctx.stroke();
  }

  // the landmark
  LANDMARKS[spec.kind](ctx, SCENE_W * 0.5, horizon + 8, rand, p, lights, spec.label);

  // foreground clutter: debris, a dead tree at each edge
  for (let i = 0; i < 18; i++) box(ctx, rand() * SCENE_W, horizon + 40 + rand() * (SCENE_H - horizon - 50), 6 + rand() * 22, 4 + rand() * 9, p.mid, p.lineSoft, 1);
  if (spec.kind !== 'park') { deadTree(ctx, 70 + rand() * 40, SCENE_H - 14, 190 + rand() * 60, rand, p.line); deadTree(ctx, SCENE_W - 90 - rand() * 40, SCENE_H - 10, 160 + rand() * 60, rand, p.line); }

  return { base, lights, sunX, sunY };
}

interface Mote { x: number; y: number; vx: number; vy: number; r: number }

/**
 * Draws the scene on the canvas and keeps it alive: the sun pulses, lit windows and signs flicker, and ash drifts through. Returns a function
 * that stops the animation (call it when the scene is closed).
 */
export function startScene(canvas: HTMLCanvasElement, spec: SceneSpec, animate = true): () => void {
  canvas.width = SCENE_W;
  canvas.height = SCENE_H;
  const ctx = canvas.getContext('2d') as Ctx;
  const p = PALETTES[spec.look];
  const built = build(spec);
  const rand = seeded(spec.seed ^ 0x9e3779b9);
  const motes: Mote[] = Array.from({ length: 70 }, () => ({ x: rand() * SCENE_W, y: rand() * SCENE_H, vx: 0.2 + rand() * 0.6, vy: 0.05 + rand() * 0.35, r: 0.8 + rand() * 1.8 }));
  let raf = 0;
  let stopped = false;

  const frame = (time: number) => {
    ctx.drawImage(built.base, 0, 0);
    // the sun's halo breathes
    const pulse = 1 + Math.sin(time / 900) * 0.06;
    const halo = ctx.createRadialGradient(built.sunX, built.sunY, 40, built.sunX, built.sunY, 240 * pulse);
    halo.addColorStop(0, p.sunHalo);
    halo.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = halo;
    ctx.fillRect(0, 0, SCENE_W, SCENE_H);
    // lit windows and signs flicker
    for (const l of built.lights) {
      const flick = Math.sin(time / (260 + l.flicker * 500) + l.x) + Math.sin(time / 97 + l.y * 3) * 0.4;
      const on = flick > -1.1 + l.flicker * 0.5;
      if (!on) continue;
      ctx.globalAlpha = 0.45 + 0.4 * Math.abs(Math.sin(time / 400 + l.x));
      ctx.fillStyle = p.lit;
      if (l.round) { ctx.beginPath(); ctx.ellipse(l.x + l.w / 2, l.y + l.h / 2, l.w / 2, l.h / 2, 0, 0, Math.PI * 2); ctx.fill(); } else ctx.fillRect(l.x, l.y, l.w, l.h);
    }
    ctx.globalAlpha = 1;
    // drifting ash
    ctx.fillStyle = p.mote;
    for (const m of motes) {
      m.x += m.vx; m.y += m.vy;
      if (m.x > SCENE_W + 4) m.x = -4;
      if (m.y > SCENE_H + 4) m.y = -4;
      ctx.beginPath(); ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2); ctx.fill();
    }
    if (animate && !stopped) raf = requestAnimationFrame(frame);
  };

  if (animate) raf = requestAnimationFrame(frame);
  else frame(0);
  return () => {
    stopped = true;
    cancelAnimationFrame(raf);
  };
}
