// The home vault as a little diorama: every room is a box with its top taken off, seen from above and from a corner (the way the Sims is drawn), so you look
// down into it and see its floor and the inside of its two back walls, standing up. The front two walls are cut away. The rooms sit side by side on a floorplan
// that can grow in any direction, and the furniture and the settlers are drawn from the same angle. Old green-screen line art, as ever.
//
// World units: a standard room is CELL by CELL on the floor and WALL_H tall; x runs toward the lower right of the screen, y toward the lower left, z up.

import type { ReactElement, ReactNode } from 'react';
import { roomDef, type RoomType, type VaultRoom } from '../lib/vaultHome';

export const INK = '#3dff8a';
export const DIM = '#13a550';
export const BG = '#021a0c';

// ---- the projection ----

export const CELL = 168;
export const WALL_H = 54;
export const WALL_T = 6;
/** A small room (the entryway, the bathroom, the laundry room): this wide and deep, in the middle of its cell. */
export const SMALL = 115;
const KX = 0.866;
const KY = 0.5;

/** A point of the world on the screen. */
export const P = (x: number, y: number, z = 0): [number, number] => [(x - y) * KX, (x + y) * KY - z];
/** The spot of the floor (z = 0) that a point of the picture shows: the opposite of P. */
export const unproject = (sx: number, sy: number): { x: number; y: number } => { const a = sx / KX, b = sy / KY; return { x: (a + b) / 2, y: (b - a) / 2 }; };
type V3 = [number, number, number];
const pts = (list: V3[]): string => list.map(([x, y, z]) => P(x, y, z).map((n) => Math.round(n * 10) / 10).join(',')).join(' ');

export interface Rect { x: number; y: number; w: number; d: number; /** Where a corridor's middle line runs (hallways), when it is not the middle of the box. */ xc?: number; yc?: number }
export const cellRect = (col: number, row: number): Rect => ({ x: col * CELL, y: row * CELL, w: CELL, d: CELL });
// ---- the shapes of the rooms ----
// Each kind of room has a few shapes and sizes; which one a room gets is picked from where it is built (so it is always the same for that room). A room is
// always centered in its cell, so the doorways and halls to its neighbors line up whatever its shape. The odd bits (a notch cut from the front corner, a bay
// along the front edge) are on the sides that are cut away, so only the floor changes there.

interface Variant {
  /** Width and depth as a part of the room's cell (width: of all of its cells). */
  w: number;
  d: number;
  /** A notch cut out of the front corner, as a part of the room's width and depth (an L-shaped room). */
  notch?: [number, number];
  /** A bay along the front edge: from and to (parts of the width) and how far it sticks out. */
  bump?: [number, number, number];
}
const VARIANTS: Partial<Record<RoomType, Variant[]>> = {
  living: [{ w: 1, d: 1, notch: [0.3, 0.32] }, { w: 0.92, d: 0.96, notch: [0.34, 0.3] }, { w: 1, d: 0.84 }],
  dining: [{ w: 1, d: 0.7 }, { w: 0.72, d: 1 }, { w: 0.92, d: 0.68 }],
  kitchen: [{ w: 0.92, d: 0.88, bump: [0.3, 0.7, 10] }, { w: 1, d: 0.8 }, { w: 0.86, d: 0.96, notch: [0.28, 0.28] }],
  bedroom: [{ w: 0.86, d: 0.86 }, { w: 1, d: 0.8, bump: [0.35, 0.65, 9] }, { w: 0.8, d: 1 }],
  bathroom: [{ w: 0.58, d: 0.7 }, { w: 0.7, d: 0.58 }, { w: 0.62, d: 0.62 }],
  laundry: [{ w: 0.6, d: 0.66 }, { w: 0.68, d: 0.58 }, { w: 0.6, d: 0.6 }],
  entertainment: [{ w: 0.98, d: 0.9 }, { w: 0.92, d: 1, bump: [0.35, 0.65, 10] }, { w: 0.9, d: 0.8 }],
  game: [{ w: 0.96, d: 0.84, notch: [0.2, 0.3] }, { w: 0.9, d: 0.95 }, { w: 1, d: 0.78 }],
  workshop: [{ w: 0.94, d: 1, notch: [0.16, 0.3] }, { w: 0.98, d: 0.86, bump: [0.55, 0.85, 9] }, { w: 0.9, d: 0.9 }],
  garden: [{ w: 0.96, d: 0.9 }, { w: 0.92, d: 1, bump: [0.35, 0.65, 10] }, { w: 1, d: 0.84 }],
  study: [{ w: 1, d: 1 }, { w: 1, d: 0.96, notch: [0.2, 0.24] }, { w: 0.98, d: 1, bump: [0.4, 0.7, 8] }],
};
const hashOf = (s: string): number => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0;
  h ^= h >>> 15; h = Math.imul(h, 2246822519) >>> 0; h ^= h >>> 13;
  return h >>> 0;
};
type Pt = [number, number];
export interface Shape { rect: Rect; poly: Pt[]; notch: Rect | null }
/** The hallway's floor: a corridor 30 wide through the middle of its cell, a whole cell long. It runs the way its neighbors are (left and right, or up and down); with neighbors on two axes it is an elbow, a tee or a crossing. */
let hallLookup: ((level: number, col: number, row: number) => boolean) | null = null;
/** Tells the drawing which cells have a room (so a hallway knows which way it runs). Set it before drawing. */
export const setHallLookup = (f: ((level: number, col: number, row: number) => boolean) | null): void => { hallLookup = f; };

const HALL_W = 60; // twice as wide as a doorway
function hallwayShape(r: { col: number; row: number; level?: number }): Shape & { nb: { l: boolean; r: boolean; b: boolean; f: boolean } } {
  const level = r.level ?? 0;
  const has = (dc: number, dr: number) => !!hallLookup?.(level, r.col + dc, r.row + dr);
  const nb = { l: has(-1, 0), r: has(1, 0), b: has(0, -1), f: has(0, 1) };
  const horiz = nb.l || nb.r;
  const vert = nb.b || nb.f;
  let al = nb.l, ar = nb.r, ab = nb.b, af = nb.f;
  // with neighbors on one axis only (or none) it runs the whole cell along that axis, a dead end included
  if (horiz && !vert) { al = true; ar = true; } else if (vert && !horiz) { ab = true; af = true; } else if (!horiz && !vert) { al = true; ar = true; }
  const X0 = r.col * CELL, Y0 = r.row * CELL;
  const cx = X0 + CELL / 2, cy = Y0 + CELL / 2, h = HALL_W / 2;
  const xs = [X0, cx - h, cx + h, X0 + CELL];
  const ys = [Y0, cy - h, cy + h, Y0 + CELL];
  const fill = [[false, ab, false], [al, true, ar], [false, af, false]]; // [row][col]
  const filled = (i: number, j: number) => i >= 0 && i < 3 && j >= 0 && j < 3 && fill[j][i];
  // the outline of the filled cells, clockwise
  const next = new Map<string, Pt>();
  const key = (p: Pt) => `${p[0]},${p[1]}`;
  for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) {
    if (!filled(i, j)) continue;
    if (!filled(i, j - 1)) next.set(key([xs[i], ys[j]]), [xs[i + 1], ys[j]]);
    if (!filled(i + 1, j)) next.set(key([xs[i + 1], ys[j]]), [xs[i + 1], ys[j + 1]]);
    if (!filled(i, j + 1)) next.set(key([xs[i + 1], ys[j + 1]]), [xs[i], ys[j + 1]]);
    if (!filled(i - 1, j)) next.set(key([xs[i], ys[j + 1]]), [xs[i], ys[j]]);
  }
  const start: Pt = next.size ? ([...next.keys()][0].split(',').map(Number) as Pt) : [xs[1], ys[1]];
  const raw: Pt[] = [start];
  for (let p = next.get(key(start)); p && key(p) !== key(start) && raw.length < 40; p = next.get(key(p))) raw.push(p);
  // only the corners
  const poly = raw.filter((p, i) => {
    const a = raw[(i + raw.length - 1) % raw.length], b = raw[(i + 1) % raw.length];
    return !((a[0] === p[0] && p[0] === b[0]) || (a[1] === p[1] && p[1] === b[1]));
  });
  const x = al ? xs[0] : xs[1], x1 = ar ? xs[3] : xs[2], y = ab ? ys[0] : ys[1], y1 = af ? ys[3] : ys[2];
  return { rect: { x, y, w: x1 - x, d: y1 - y, xc: cx, yc: cy }, poly, notch: null, nb };
}

/** The footprint of a room: its rect, the outline of its floor, and the notch if it has one. */
export function shapeOf(r: { type: RoomType; col: number; row: number; level?: number }): Shape {
  const def = roomDef(r.type);
  const list = VARIANTS[r.type];
  // a hallway is a narrow square in the middle of its cell (a little wider than a doorway); the tunnels to its neighbors make it long
  const cx = r.col * CELL;
  const cy = r.row * CELL;
  if (r.type === 'hallway') return hallwayShape(r);
  if (!list) return { rect: { x: cx + (CELL - SMALL) / 2, y: cy + (CELL - SMALL) / 2, w: SMALL, d: SMALL }, poly: [], notch: null };
  const v = list[hashOf(`${r.type}:${r.col}:${r.row}`) % list.length];
  const w = def.slots * CELL * v.w;
  const d = CELL * v.d;
  const x = cx + (def.slots * CELL - w) / 2;
  const y = cy + (CELL - d) / 2;
  const rect = { x, y, w, d };
  const x1 = x + w;
  const y1 = y + d;
  let poly: Pt[] = [[x, y], [x1, y], [x1, y1], [x, y1]];
  let notch: Rect | null = null;
  if (v.notch) {
    const nx = w * v.notch[0];
    const ny = d * v.notch[1];
    notch = { x: x1 - nx, y: y1 - ny, w: nx, d: ny };
    poly = [[x, y], [x1, y], [x1, y1 - ny], [x1 - nx, y1 - ny], [x1 - nx, y1], [x, y1]];
  } else if (v.bump) {
    const xa = x + w * v.bump[0];
    const xb = x + w * v.bump[1];
    poly = [[x, y], [x1, y], [x1, y1], [xb, y1], [xb, y1 + v.bump[2]], [xa, y1 + v.bump[2]], [xa, y1], [x, y1]];
  }
  return { rect, poly, notch };
}

/** The floor of a room: a standard room fills most of its cell, a wide one two cells along x, and a small one sits in the middle of its cell. */
export const roomRect = (r: { type: RoomType; col: number; row: number }): Rect => shapeOf(r).rect;
export const isSmall = (type: RoomType): boolean => roomDef(type).small === true;

/** A spot on a room's floor: u across (0 to 1 along x, from the left back wall) and v deep (0 to 1 along y, from the right back wall). A spot that falls in a notch is moved out of it. */
export const floorPoint = (r: { type: RoomType; col: number; row: number }, u: number, v: number, m = 12): { x: number; y: number } => {
  const { rect: a, notch } = shapeOf(r);
  let x = a.x + m + u * (a.w - 2 * m);
  let y = a.y + m + v * (a.d - 2 * m);
  if (notch && x > notch.x - 8 && y > notch.y - 8) {
    if (x - (notch.x - 8) < y - (notch.y - 8)) x = notch.x - 8; else y = notch.y - 8;
  }
  return { x, y };
};

/** The screen box that holds a rect with its walls (for fitting the camera and zooming onto a room). */
export function screenBox(rects: Rect[]): { x: number; y: number; w: number; h: number } {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const r of rects) {
    for (const [x, y, z] of [[r.x, r.y, WALL_H + 14], [r.x + r.w, r.y, 0], [r.x, r.y + r.d, 0], [r.x + r.w, r.y + r.d, -9]] as V3[]) {
      const [X, Y] = P(x, y, z);
      x0 = Math.min(x0, X); x1 = Math.max(x1, X); y0 = Math.min(y0, Y); y1 = Math.max(y1, Y);
    }
  }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

// ---- the shell of a room ----

type Wall = 'panels' | 'tiles' | 'bricks' | 'dots';
type Floor = 'planks' | 'tiles' | 'dots';
const STYLE: Record<RoomType, { wall: Wall; floor: Floor }> = {
  hallway: { wall: 'panels', floor: 'tiles' },
  study: { wall: 'panels', floor: 'planks' },
  garden: { wall: 'tiles', floor: 'dots' },
  entry: { wall: 'panels', floor: 'tiles' },
  stairs: { wall: 'bricks', floor: 'dots' },
  living: { wall: 'panels', floor: 'planks' },
  dining: { wall: 'panels', floor: 'planks' },
  bedroom: { wall: 'panels', floor: 'planks' },
  kitchen: { wall: 'tiles', floor: 'tiles' },
  bathroom: { wall: 'tiles', floor: 'tiles' },
  laundry: { wall: 'tiles', floor: 'dots' },
  entertainment: { wall: 'panels', floor: 'planks' },
  game: { wall: 'bricks', floor: 'planks' },
  workshop: { wall: 'dots', floor: 'dots' },
};
const FLOOR = '#042a12';
const SLAB = '#0a4d24';
const FACE_L = '#073a1b'; // the inside of the left back wall
const FACE_R = '#0a4a22'; // the inside of the right back wall (a little lighter: it faces the light)
const CAP = '#19a050';
const DOOR = '#021208';
const TOP = '#117a3c';
const SIDE_Y = '#0a4a22';
const SIDE_X = '#063018';
const GLASS = 'rgba(61,255,138,0.10)';

const Poly = ({ p, fill, sw = 1.2, stroke = INK }: { p: V3[]; fill: string; sw?: number; stroke?: string }): ReactElement => <polygon points={pts(p)} fill={fill} stroke={stroke} strokeWidth={sw} strokeLinejoin="round" />;
const Seg = ({ a, b, c = DIM, sw = 0.8, o = 0.6 }: { a: V3; b: V3; c?: string; sw?: number; o?: number }): ReactElement => { const [x1, y1] = P(...a); const [x2, y2] = P(...b); return <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={c} strokeWidth={sw} opacity={o} />; };

// ---- the stairs between levels ----

/** A solid box drawn with its three visible faces (for the steps). */
const Slab = ({ x0, y0, x1, y1, z0 = 0, z1, k }: { x0: number; y0: number; x1: number; y1: number; z0?: number; z1: number; k: string }): ReactElement => (
  <g key={k}>
    <Poly p={[[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]]} fill={SIDE_Y} sw={0.9} />
    <Poly p={[[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]]} fill={SIDE_X} sw={0.9} />
    <Poly p={[[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]]} fill={TOP} sw={0.9} />
  </g>
);

/** The hole in the floor of a room that has a stairwell under it: out of the way of the furniture, in a front corner (the walls there are cut away). */
export const HOLE = 46;
export function holeRect(room: { type: RoomType; col: number; row: number; furniture: string[] }): Rect {
  const S = HOLE;
  const { rect, notch } = shapeOf(room);
  const m = 12;
  const spots: Rect[] = [
    { x: rect.x + rect.w - m - S, y: rect.y + rect.d - m - S, w: S, d: S },
    { x: rect.x + m, y: rect.y + rect.d - m - S, w: S, d: S },
    { x: rect.x + rect.w - m - S, y: rect.y + (rect.d - S) / 2, w: S, d: S },
    { x: rect.x + (rect.w - S) / 2, y: rect.y + rect.d - m - S, w: S, d: S },
  ];
  const centers = room.furniture.map((id) => pieceAt(room as VaultRoom, id)).filter((p): p is { x: number; y: number } => !!p);
  const free = (r: Rect) =>
    !(notch && r.x < notch.x + notch.w && r.x + r.w > notch.x && r.y < notch.y + notch.d && r.y + r.d > notch.y)
    && centers.every((c) => Math.abs(c.x - (r.x + S / 2)) > S / 2 + 15 || Math.abs(c.y - (r.y + S / 2)) > S / 2 + 15);
  return spots.find(free) ?? spots[0];
}

/**
 * A black rectangular hole, flush with the floor, with a flight of stairs going down into the dark along the far wall (the steps fade to black) and a handrail
 * slanting down along with them. Nothing stands above the floor but the top of the rail. What is below the floor is only seen through the opening, so it is
 * clipped to it; the flight is narrow and shallow enough that its steps are not hidden by the near rim.
 */
export function StairHole({ hole }: { hole: Rect }): ReactElement {
  const hx0 = hole.x, hy0 = hole.y, hx1 = hole.x + hole.w, hy1 = hole.y + hole.d;
  const D = 26;
  const n = 6;
  const id = `hole${Math.round(hx0)}_${Math.round(hy0)}`;
  const top = hy1 - 3;
  const bottom = hy0 + 3;
  const run = (top - bottom) / n;
  const rise = D / (n + 1);
  const xl = hx0 + 3;
  const xr = hx0 + 3 + 19;
  // the steps go down toward the back, each darker than the one above it
  const shade = (i: number): string => `rgb(${Math.round(16 - i * 2)},${Math.round(88 - i * 12)},${Math.round(42 - i * 5.8)})`;
  const steps = Array.from({ length: n }, (_, i) => {
    const y1 = top - i * run, y0 = y1 - run, z = -(i + 1) * rise;
    return (
      <g key={`t${i}`}>
        <Poly p={[[xl, y0, z], [xr, y0, z], [xr, y1, z], [xl, y1, z]]} fill={shade(i)} sw={0.9} stroke={i < 4 ? INK : DIM} />
        <Poly p={[[xl, y1, z], [xr, y1, z], [xr, y1, z + rise], [xl, y1, z + rise]]} fill="#02150a" sw={0.6} stroke={DIM} />
      </g>
    );
  });
  const railTop = 5, railEnd = -(n * rise) + 5;
  return (
    <g>
      <defs><clipPath id={id}><polygon points={pts([[hx0, hy0, 0], [hx1, hy0, 0], [hx1, hy1, 0], [hx0, hy1, 0]])} /></clipPath></defs>
      <Poly p={[[hx0, hy0, 0], [hx1, hy0, 0], [hx1, hy1, 0], [hx0, hy1, 0]]} fill="#000503" sw={0} />
      <g clipPath={`url(#${id})`}>
        <Poly p={[[hx0, hy0, 0], [hx0, hy1, 0], [hx0, hy1, -D], [hx0, hy0, -D]]} fill="#02150a" sw={0.8} stroke={DIM} />
        <Poly p={[[hx0, hy0, 0], [hx1, hy0, 0], [hx1, hy0, -D], [hx0, hy0, -D]]} fill="#010a05" sw={0.8} stroke={DIM} />
        {steps}
        <Poly p={[[xr, top, 0], [xr, bottom, -n * rise], [xr, bottom, -D], [xr, top, -D]]} fill="#010a05" sw={0.6} stroke={DIM} />
        <Seg a={[xr + 1, top, railTop]} b={[xr + 1, bottom + 2, railEnd]} c={INK} sw={1.5} o={0.95} />
        <Seg a={[xr + 1, top, railTop]} b={[xr + 1, top, 0]} c={INK} sw={1.5} o={0.95} />
      </g>
      <polygon points={pts([[hx0, hy0, 0], [hx1, hy0, 0], [hx1, hy1, 0], [hx0, hy1, 0]])} fill="none" stroke={INK} strokeWidth="1.6" strokeLinejoin="round" />
    </g>
  );
}

/** The flight of stairs up in a stairwell room: eight steps rising along the left back wall toward the back, as high as the wall. */
function StairsUp({ rect }: { rect: Rect }): ReactElement {
  const n = 8;
  const lo = rect.y + 6;
  // the wall this flight stands against can have a doorway in the middle of it (30 wide): the lowest step ends well before that
  const hi = Math.min(rect.y + rect.d - 8, rect.y + rect.d / 2 - 15 - 6);
  const run = (hi - lo) / n;
  const x0 = rect.x + 3;
  const x1 = rect.x + 29;
  const out: ReactElement[] = [];
  for (let i = n - 1; i >= 0; i--) out.push(<Slab key={`s${i}`} k={`s${i}`} x0={x0} x1={x1} y0={hi - (i + 1) * run} y1={hi - i * run} z1={(i + 1) * 5.4} />);
  return <g>{out}</g>;
}

/** An arrow painted on the floor of a stairwell: which way it goes. */
function StairArrow({ rect, way, down }: { rect: Rect; way: 'up' | 'down'; down: boolean }): ReactElement {
  // a stairwell with a hole in its floor keeps its arrow on the clear stretch in front of it
  const x = rect.x + rect.w * (down ? 0.5 : 0.62), y = rect.y + rect.d * (down ? 0.88 : 0.72);
  const [X, Y] = P(x, y, 0);
  const d = way === 'up' ? 'M0 -9 L9 3 H3 V10 H-3 V3 H-9 Z' : 'M0 9 L9 -3 H3 V-10 H-3 V-3 H-9 Z';
  return <g transform={`translate(${X} ${Y}) scale(1.1 0.7)`} pointerEvents="none"><path d={d} fill="rgba(61,255,138,0.2)" stroke={INK} strokeWidth={1.4} strokeLinejoin="round" /></g>;
}

const STEEL = '#0b5a2a';
const PANEL = '#06301a';

/** Things stuck on a wall, drawn flat on its plane: local x runs along the wall, local y is minus the height. */
function WallThing({ along, wall, t, kind }: { along: 'y' | 'x'; wall: number; t: number; kind: 'window' | 'thumbs' | 'cog' | 'atom' | 'calm' | 'junction' }): ReactElement {
  const [X, Y] = along === 'y' ? P(wall, t, 0) : P(t, wall, 0);
  const ax = along === 'y' ? -KX : KX;
  let art: ReactElement;
  if (kind === 'window') {
    art = (
      <g>
        <rect x={-14} y={-45} width={28} height={21} rx={2.5} fill={STEEL} stroke={INK} strokeWidth={0.9} />
        <rect x={-11.5} y={-42.5} width={23} height={16} rx={1} fill="rgba(150,255,190,0.30)" stroke={DIM} strokeWidth={0.6} />
        <path d="M-11.5 -29 L-6 -34 L-1 -30 L5 -36 L11.5 -30 V-26.5 H-11.5Z" fill="rgba(61,255,138,0.5)" stroke="none" />
        <circle cx={6.5} cy={-39} r={2.4} fill={INK} stroke="none" opacity={0.9} />
        <path d="M0 -42.5V-26.5M-11.5 -34.5H11.5" stroke={INK} strokeWidth={0.7} />
      </g>
    );
  } else if (kind === 'junction') {
    art = (
      <g>
        <rect x={-5} y={-36} width={10} height={13} rx={1.5} fill={STEEL} stroke={INK} strokeWidth={0.9} />
        <path d="M0.8 -34 L-2 -29.5 L1.4 -29.5 L-1 -25" fill="none" stroke={INK} strokeWidth={1} />
        <path d="M0 -36V-45" stroke={INK} strokeWidth={1.6} />
      </g>
    );
  } else {
    art = (
      <g>
        <rect x={-7.5} y={-43} width={15} height={20} rx={1} fill={PANEL} stroke={INK} strokeWidth={0.8} />
        {kind === 'thumbs' && (
          <g fill="none" stroke={INK} strokeWidth={1}>
            <circle cx={0} cy={-37} r={3.2} fill={INK} stroke="none" />
            <path d="M0 -33.6V-28M-4.2 -32.4 0 -31.4 4.2 -32.4M5.4 -31.2V-35.6M0 -28 -2.8 -24.4M0 -28 2.8 -24.4" />
            <circle cx={-1.1} cy={-37.4} r={0.5} fill={PANEL} stroke="none" /><circle cx={1.1} cy={-37.4} r={0.5} fill={PANEL} stroke="none" />
          </g>
        )}
        {kind === 'cog' && (
          <g fill="none" stroke={INK}>
            <circle cx={0} cy={-35} r={5.2} strokeWidth={2.4} strokeDasharray="1.7 1.3" />
            <circle cx={0} cy={-35} r={3.4} strokeWidth={0.8} /><circle cx={0} cy={-35} r={1.1} fill={INK} stroke="none" />
            <path d="M-5 -26.5H5M-3.4 -24.5H3.4" strokeWidth={1} />
          </g>
        )}
        {kind === 'atom' && (
          <g fill="none" stroke={INK} strokeWidth={0.8}>
            <ellipse cx={0} cy={-34} rx={6} ry={2.3} /><ellipse cx={0} cy={-34} rx={6} ry={2.3} transform="rotate(60 0 -34)" /><ellipse cx={0} cy={-34} rx={6} ry={2.3} transform="rotate(120 0 -34)" />
            <circle cx={0} cy={-34} r={1.4} fill={INK} stroke="none" />
            <path d="M-4.4 -26H4.4" strokeWidth={1} />
          </g>
        )}
        {kind === 'calm' && (
          <g fill="none" stroke={INK} strokeWidth={1.2}>
            <path d="M-4.6 -39H4.6M-4.6 -36H4.6M-3 -33H3" />
            <path d="M0 -29.6V-26.4" strokeWidth={1.6} /><circle cx={0} cy={-24.9} r={0.4} fill={INK} stroke="none" />
          </g>
        )}
      </g>
    );
  }
  return <g transform={`matrix(${ax} ${KY} 0 1 ${X} ${Y})`} strokeLinecap="round" strokeLinejoin="round">{art}</g>;
}

const THINGS: ('window' | 'thumbs' | 'cog' | 'atom' | 'calm' | 'junction')[] = ['window', 'thumbs', 'cog', 'atom', 'calm', 'junction'];

/** A hallway: the floor of a corridor with low walls along its sides, open where it joins a neighbor (see HallX and HallY for the tunnels to rooms). Chained, hallways make long corridors and corners. It has no name. */
function HallwayShell({ type, col, row, level }: { type: RoomType; col: number; row: number; level: number }): ReactElement {
  const shape = hallwayShape({ col, row, level });
  const { poly, nb } = shape;
  const H = 18;
  const T = 4;
  const X0 = col * CELL, Y0 = row * CELL;
  // an edge on the border of the cell where a neighbor joins is an opening, not a wall
  const opening = (a: Pt, b: Pt): boolean =>
    (a[0] === X0 && b[0] === X0 && nb.l) || (a[0] === X0 + CELL && b[0] === X0 + CELL && nb.r) || (a[1] === Y0 && b[1] === Y0 && nb.b) || (a[1] === Y0 + CELL && b[1] === Y0 + CELL && nb.f);
  const slabs: ReactElement[] = [];
  const walls: ReactElement[] = [];
  const front: { a: Pt; b: Pt; nx: number; ny: number }[] = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const nx = Math.sign(b[1] - a[1]);
    const ny = -Math.sign(b[0] - a[0]);
    if (nx > 0 || ny > 0) front.push({ a, b, nx, ny });
    else if (!opening(a, b)) {
      if (nx < 0) {
        const lo = Math.min(a[1], b[1]), hi = Math.max(a[1], b[1]), x = a[0];
        walls.push(<g key={`w${i}`}><Poly p={[[x, lo, 0], [x, hi, 0], [x, hi, H], [x, lo, H]]} fill={FACE_L} /><Poly p={[[x, lo, H], [x, hi, H], [x - T, hi, H], [x - T, lo, H]]} fill={CAP} sw={1.6} /></g>);
      } else {
        const lo = Math.min(a[0], b[0]), hi = Math.max(a[0], b[0]), y = a[1];
        walls.push(<g key={`w${i}`}><Poly p={[[lo, y, 0], [hi, y, 0], [hi, y, H], [lo, y, H]]} fill={FACE_R} /><Poly p={[[lo, y, H], [hi, y, H], [hi, y - T, H], [lo, y - T, H]]} fill={CAP} sw={1.6} /></g>);
      }
    }
  }
  front.sort((p, q) => p.a[0] + p.a[1] + p.b[0] + p.b[1] - (q.a[0] + q.a[1] + q.b[0] + q.b[1]));
  front.forEach((e, i) => slabs.push(<Poly key={`s${i}`} p={[[e.a[0], e.a[1], 0], [e.b[0], e.b[1], 0], [e.b[0], e.b[1], -9], [e.a[0], e.a[1], -9]]} fill={e.nx > 0 ? SLAB : '#073a1b'} />));
  const seams: ReactNode[] = [];
  const { rect } = shape;
  const clip = `hv${col}_${row}_${level}`;
  for (let t = rect.x + 10; t < rect.x + rect.w; t += 10) seams.push(<Seg key={`a${t}`} a={[t, rect.y, 0]} b={[t, rect.y + rect.d, 0]} o={0.35} />);
  for (let t = rect.y + 10; t < rect.y + rect.d; t += 10) seams.push(<Seg key={`b${t}`} a={[rect.x, t, 0]} b={[rect.x + rect.w, t, 0]} o={0.35} />);
  const outline = poly.map(([px, py]) => P(px, py, 0).join(',')).join(' ');
  void type;
  return (
    <g>
      <defs><clipPath id={clip}><polygon points={outline} /></clipPath></defs>
      {slabs}
      <polygon points={outline} fill={FLOOR} stroke={INK} strokeWidth="1.2" strokeLinejoin="round" />
      <g clipPath={`url(#${clip})`}>{seams}</g>
      {walls}
    </g>
  );
}

/**
 * A room: its floor (the shape of this room), the inside of its two back walls, the thick tops of those walls, and the edge of the floor slab at the front. `doorsL`
 * are the heights (y) of the doorways in the left back wall, `doorsR` the positions (x) of those in the right back wall. The walls are vault walls: molded steel with
 * a baseboard and rivets, a rounded corner post, piping and conduit, a fake window or two, and the odd poster.
 */
export function RoomShell({ rect, name, type, col, row, level = 0, doorsL, doorsR, hole = false, down = false, way, furniture = [], labelFront = false }: { rect: Rect; name: string; type: RoomType; col: number; row: number; level?: number; doorsL: number[]; doorsR: number[]; /** A stairwell below: a hole in the floor with stairs going down. */ hole?: boolean; /** Which way a stairwell goes, shown as an arrow on its floor. */ way?: 'up' | 'down'; /** A stairwell that goes down (its twin is on the level below): the floor has a hole with stairs going down into the dark; otherwise a stairwell shows its flight going up. */ down?: boolean; furniture?: string[]; /** The name goes below the front corner instead of above the back one (a hallway runs behind the room, and the name would seem to be its). */ labelFront?: boolean }): ReactElement {
  if (type === 'hallway') return <HallwayShell type={type} col={col} row={row} level={level} />;
  const { x, y, w, d } = rect;
  const x1 = x + w;
  const y1 = y + d;
  const H = WALL_H;
  const T = WALL_T;
  const st = STYLE[type];
  const shape = shapeOf({ type, col, row });
  const poly: Pt[] = shape.poly.length ? shape.poly : [[x, y], [x1, y], [x1, y1], [x, y1]];
  const clip = `vf${Math.round(x)}_${Math.round(y)}`;
  const floor: ReactNode[] = [];
  const bx1 = x1 + 12;
  const by1 = y1 + 12;
  if (st.floor === 'planks') for (let yy = y + 14; yy < by1; yy += 14) floor.push(<Seg key={`fp${yy}`} a={[x, yy, 0]} b={[bx1, yy, 0]} />);
  if (st.floor === 'tiles') {
    for (let yy = y + 16; yy < by1; yy += 16) floor.push(<Seg key={`ft${yy}`} a={[x, yy, 0]} b={[bx1, yy, 0]} o={0.45} />);
    for (let xx = x + 16; xx < bx1; xx += 16) floor.push(<Seg key={`fu${xx}`} a={[xx, y, 0]} b={[xx, by1, 0]} o={0.45} />);
  }
  if (st.floor === 'dots') for (let yy = y + 12; yy < by1; yy += 16) for (let xx = x + 12 + ((yy / 16) % 2) * 8; xx < bx1; xx += 20) { const [X, Y] = P(xx, yy, 0); floor.push(<circle key={`fd${xx}-${yy}`} cx={X} cy={Y} r="1.2" fill={DIM} opacity="0.6" />); }
  // a floor of steel plates: a seam border just inside the edge, and bolts in the corners
  const seam = 5;
  for (const [a, b] of [[[x + seam, y + seam], [x1 - seam, y + seam]], [[x + seam, y + seam], [x + seam, y1 - seam]]] as [Pt, Pt][]) floor.push(<Seg key={`sm${a[0]}${b[0]}${a[1]}${b[1]}`} a={[a[0], a[1], 0]} b={[b[0], b[1], 0]} o={0.5} sw={1.2} />);
  // the vault's cog on the entryway floor
  if (type === 'entry') {
    const cg = (rr: number, n: number) => Array.from({ length: n }, (_, i) => `${x + w / 2 + Math.cos((i / n) * Math.PI * 2) * rr},${y + d / 2 + Math.sin((i / n) * Math.PI * 2) * rr}`);
    const teeth: string[] = [];
    for (let i = 0; i < 24; i++) { const a0 = (i / 24) * Math.PI * 2; const r = i % 2 ? 24 : 29; teeth.push(`${x + w / 2 + Math.cos(a0) * r},${y + d / 2 + Math.sin(a0) * r}`); }
    const world = (list: string[]) => list.map((s) => { const [px, py] = s.split(',').map(Number); return P(px, py, 0).join(','); }).join(' ');
    floor.push(<polygon key="cog" points={world(teeth)} fill="none" stroke={DIM} strokeWidth="1.2" opacity="0.7" />, <polygon key="cog2" points={world(cg(17, 20))} fill="none" stroke={DIM} strokeWidth="1" opacity="0.6" />);
  }
  const wallL: ReactNode[] = [];
  const wallR: ReactNode[] = [];
  const lines = (along: 'y' | 'x', from: number, to: number, out: ReactNode[], key: string) => {
    const at = (t: number, z: number): V3 => (along === 'y' ? [x, t, z] : [t, y, z]);
    if (st.wall === 'panels') for (let t = from + 24; t < to - 2; t += 24) out.push(<Seg key={`${key}p${t}`} a={at(t, 3)} b={at(t, H - 3)} />);
    if (st.wall === 'tiles') {
      for (let t = from + 12; t < to - 2; t += 12) out.push(<Seg key={`${key}t${t}`} a={at(t, 3)} b={at(t, H - 3)} o={0.45} />);
      for (let z = 14; z < H - 2; z += 14) out.push(<Seg key={`${key}h${z}`} a={at(from, z)} b={at(to, z)} o={0.45} />);
    }
    if (st.wall === 'bricks') {
      for (let z = 9, r = 0; z < H - 2; z += 9, r++) {
        out.push(<Seg key={`${key}b${z}`} a={at(from, z)} b={at(to, z)} o={0.5} />);
        for (let t = from + (r % 2) * 12 + 12; t < to - 2; t += 24) out.push(<Seg key={`${key}v${z}-${t}`} a={at(t, z)} b={at(t, z + 9)} o={0.5} />);
      }
    }
    if (st.wall === 'dots') for (let z = 12; z < H - 4; z += 14) for (let t = from + 10; t < to - 4; t += 16) { const [X, Y] = P(...at(t, z)); out.push(<circle key={`${key}d${z}-${t}`} cx={X} cy={Y} r="1.3" fill={DIM} opacity="0.6" />); }
    // molded steel: a dark baseboard with rivets, a bevel under the cap, and a pipe along the top
    out.push(<Poly key={`${key}bb`} p={[at(from, 0), at(to, 0), at(to, 5), at(from, 5)]} fill="#021a0c" sw={0.8} />);
    for (let t = from + 9; t < to - 4; t += 18) { const [X, Y] = P(...at(t, 2.6)); out.push(<circle key={`${key}rv${t}`} cx={X} cy={Y} r="0.9" fill={INK} opacity="0.7" />); }
    out.push(<Seg key={`${key}bv`} a={at(from, H - 4)} b={at(to, H - 4)} c={INK} o={0.5} sw={1} />);
    out.push(<Poly key={`${key}pp`} p={[at(from + 1, H - 12), at(to - 1, H - 12), at(to - 1, H - 8), at(from + 1, H - 8)]} fill={STEEL} sw={0.8} />);
    out.push(<Seg key={`${key}ph`} a={at(from + 1, H - 10.8)} b={at(to - 1, H - 10.8)} c={INK} o={0.55} sw={0.7} />);
    for (let t = from + 14; t < to - 6; t += 30) out.push(<Poly key={`${key}pb${t}`} p={[at(t, H - 13), at(t + 2.4, H - 13), at(t + 2.4, H - 7), at(t, H - 7)]} fill={DIM} sw={0.6} />);
    // the things on the wall, away from the doorways
    const doors = along === 'y' ? doorsL : doorsR;
    const spots = [0.24, 0.5, 0.76].map((f) => from + f * (to - from)).filter((t) => doors.every((c) => Math.abs(c - t) > 24));
    const seed = hashOf(`${type}:${col}:${row}:${key}`);
    const want = Math.min(spots.length, key === 'L' ? 2 : 2);
    for (let i = 0; i < want; i++) {
      const spot = spots[(i + (seed % spots.length)) % spots.length];
      const kind = THINGS[(seed >>> (3 + i * 4)) % THINGS.length];
      if (out.some((o) => (o as ReactElement | null)?.key === `${key}w${spot}`)) continue;
      out.push(<WallThing key={`${key}w${spot}`} along={along} wall={along === 'y' ? x : y} t={spot} kind={kind} />);
    }
  };
  lines('y', y, y1, wallL, 'L');
  lines('x', x, x1, wallR, 'R');
  const door = (alongY: boolean, c: number) => {
    const lo = c - 15;
    const hi = c + 15;
    const quad: V3[] = alongY ? [[x, lo, 0], [x, hi, 0], [x, hi, 42], [x, lo, 42]] : [[lo, y, 0], [hi, y, 0], [hi, y, 42], [lo, y, 42]];
    const frame: V3[] = alongY ? [[x, lo - 2, 0], [x, hi + 2, 0], [x, hi + 2, 45], [x, lo - 2, 45]] : [[lo - 2, y, 0], [hi + 2, y, 0], [hi + 2, y, 45], [lo - 2, y, 45]];
    return <g key={`dr${alongY}${c}`}><Poly p={frame} fill={STEEL} sw={1} /><Poly p={quad} fill={DOOR} sw={1.6} /></g>;
  };
  void name; void labelFront;
  // the slab edges at the front: every edge of the floor that faces the viewer (+x or +y), farthest first
  const edges: { a: Pt; b: Pt; nx: number; ny: number }[] = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const nx = Math.sign(b[1] - a[1]);
    const ny = -Math.sign(b[0] - a[0]);
    if (nx > 0 || ny > 0) edges.push({ a, b, nx, ny });
  }
  edges.sort((p, q) => p.a[0] + p.a[1] + p.b[0] + p.b[1] - (q.a[0] + q.a[1] + q.b[0] + q.b[1]));
  return (
    <g>
      <defs><clipPath id={clip}><polygon points={poly.map(([px, py]) => P(px, py, 0).join(',')).join(' ')} /></clipPath></defs>
      {edges.map((e, i) => <Poly key={`sl${i}`} p={[[e.a[0], e.a[1], 0], [e.b[0], e.b[1], 0], [e.b[0], e.b[1], -9], [e.a[0], e.a[1], -9]]} fill={e.nx > 0 ? SLAB : '#073a1b'} />)}
      <polygon points={poly.map(([px, py]) => P(px, py, 0).join(',')).join(' ')} fill={FLOOR} stroke={INK} strokeWidth="1.2" strokeLinejoin="round" />
      <g clipPath={`url(#${clip})`}>{floor}</g>
      {hole && <StairHole hole={holeRect({ type, col, row, furniture })} />}
      {type === 'stairs' && down && <StairHole hole={{ x: rect.x + (rect.w - 62) / 2, y: rect.y + (rect.d - 62) / 2 + 4, w: 62, d: 62 }} />}
      {/* the inside of the left back wall, and of the right one */}
      <Poly p={[[x, y, 0], [x, y1, 0], [x, y1, H], [x, y, H]]} fill={FACE_L} />
      {wallL}
      <Poly p={[[x, y, 0], [x1, y, 0], [x1, y, H], [x, y, H]]} fill={FACE_R} />
      {wallR}
      {doorsL.map((c) => door(true, c))}
      {doorsR.map((c) => door(false, c))}
      {type === 'stairs' && !down && <StairsUp rect={rect} />}
      {type === 'stairs' && way && <StairArrow rect={rect} way={way} down={down} />}
      {/* the thick tops of the walls, rounded off, and the molded post in the corner */}
      <Poly p={[[x, y, H], [x, y1, H], [x - T, y1, H], [x - T, y, H]]} fill={CAP} sw={2} />
      <Poly p={[[x, y, H], [x1, y, H], [x1, y - T, H], [x, y - T, H]]} fill={CAP} sw={2} />
      <Poly p={[[x, y, H], [x - T, y, H], [x - T, y - T, H], [x, y - T, H]]} fill={CAP} sw={2} />
      <line x1={P(x, y, 1)[0]} y1={P(x, y, 1)[1]} x2={P(x, y, H)[0]} y2={P(x, y, H)[1]} stroke={INK} strokeWidth="4.6" strokeLinecap="round" opacity="0.35" />
      <line x1={P(x, y, 3)[0]} y1={P(x, y, 3)[1]} x2={P(x, y, H - 2)[0]} y2={P(x, y, H - 2)[1]} stroke={CAP} strokeWidth="2.6" strokeLinecap="round" />
    </g>
  );
}

/** A room that could be built here: a faded outline of one, with a plus. */
/** A shovel and a pickaxe, crossed: the sign of a place where a room can be dug out. */
const DigTools = ({ x, y }: { x: number; y: number }): ReactElement => (
  <g transform={`translate(${x} ${y}) scale(0.95)`} stroke={INK} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="none" fill="none" opacity="0.9">
    <path d="M10 -10 L-4 4" /><path d="M7.4 -13 L13 -7.4" />
    <path d="M-4 4 L-10.5 2.5 Q-14.5 5.5 -13.5 10 L-15 15.5 L-8.5 12.5 Q-3.5 9.5 -4 4 Z" fill={INK} />
    <path d="M-9 -9 L6 6" />
    <path d="M-15 -4 Q-9 -15 3.5 -12" strokeWidth="2.3" />
    <path d="M-15 -4 L-12.4 -7.4 M3.5 -12 L2 -8.6" />
  </g>
);

export function RoomOutline({ rect, label: _label, plain = false, near }: { rect: Rect; label: string; plain?: boolean; /** The side that touches a built room (the outline is clearest there and fades into the dark away from it). */ near?: 'left' | 'right' | 'back' | 'front' }): ReactElement {
  const { x, y, w, d } = rect;
  const x1 = x + w;
  const y1 = y + d;
  const H = WALL_H * 0.5;
  const [cx, cy] = P(x + w / 2, y + d / 2, 0);
  const id = `fade${Math.round(x)}_${Math.round(y)}${plain ? 'p' : ''}`;
  // the fade runs across the screen from the side by the built room to about a third of the way in
  const from = near === 'left' ? P(x, y1, 0) : near === 'right' ? P(x1, y, 0) : near === 'back' ? P(x, y, 0) : P(x1, y1, 0);
  const to = near === 'left' ? P(x1, y, 0) : near === 'right' ? P(x, y1, 0) : near === 'back' ? P(x1, y1, 0) : P(x, y, 0);
  return (
    <g strokeDasharray="5 4" opacity={plain ? 0.4 : 1}>
      {!plain && (
        <defs>
          <linearGradient id={id} gradientUnits="userSpaceOnUse" x1={from[0]} y1={from[1]} x2={to[0]} y2={to[1]}>
            <stop offset="0" stopColor="#fff" stopOpacity="1" />
            <stop offset="0.34" stopColor="#fff" stopOpacity="0.04" />
            <stop offset="1" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
          <mask id={id + 'm'} maskUnits="userSpaceOnUse" x={cx - 400} y={cy - 400} width="800" height="800">
            <rect x={cx - 400} y={cy - 400} width="800" height="800" fill={`url(#${id})`} />
          </mask>
        </defs>
      )}
      <g mask={plain ? undefined : `url(#${id}m)`} fill="rgba(61,255,138,0.07)">
        <polygon points={pts([[x, y, 0], [x1, y, 0], [x1, y1, 0], [x, y1, 0]])} stroke={INK} strokeWidth="1.8" />
        <polyline points={pts([[x, y1, 0], [x, y, 0], [x1, y, 0]])} fill="none" stroke={INK} strokeWidth="1.5" />
        <polygon points={pts([[x, y, 0], [x, y1, 0], [x, y1, H], [x, y, H]])} stroke={INK} strokeWidth="1.2" />
        <polygon points={pts([[x, y, 0], [x1, y, 0], [x1, y, H], [x, y, H]])} stroke={INK} strokeWidth="1.2" />
      </g>
      {!plain && <DigTools x={cx} y={cy} />}
    </g>
  );
}

/** The outline of a vault door (a cogwheel) on the entryway's cut-away front-left wall: tap it to leave. */
export function VaultDoor({ rect, onTap }: { rect: Rect; onTap: () => void }): ReactElement {
  // the wall plane y = rect.y + rect.d, running along x; a point (u, v) on it is x = mid + u, z = v
  const xm = rect.x + rect.w / 2;
  const yw = rect.y + rect.d;
  const zc = WALL_H * 0.5;
  const R = 21;
  const teeth = 12;
  const pt = (r: number, a: number) => P(xm + Math.cos(a) * r, yw, zc + Math.sin(a) * r).join(',');
  let cog = '';
  for (let i = 0; i < teeth; i++) {
    const a0 = (i / teeth) * Math.PI * 2;
    const st = (Math.PI * 2) / teeth;
    cog += `${i ? 'L' : 'M'}${pt(R - 5, a0)}L${pt(R, a0 + st * 0.12)}L${pt(R, a0 + st * 0.38)}L${pt(R - 5, a0 + st * 0.5)}`;
  }
  cog += 'Z';
  const ring = (r: number) => Array.from({ length: 24 }, (_, i) => pt(r, (i / 24) * Math.PI * 2)).join(' ');
  const [sx, sy] = P(xm, yw, zc + R + 14);
  return (
    <g role="button" aria-label="Leave the vault" style={{ cursor: 'pointer' }} onClick={(e) => { e.stopPropagation(); onTap(); }}>
      <polygon points={[[xm - 30, yw, zc - 30], [xm + 30, yw, zc - 30], [xm + 30, yw, zc + 30], [xm - 30, yw, zc + 30]].map(([a, b, c]) => P(a, b, c).join(',')).join(' ')} fill="rgba(61,255,138,0.001)" stroke="none" />
      <g strokeDasharray="4 3" opacity="0.75">
        <path d={cog} fill="rgba(61,255,138,0.08)" stroke={INK} strokeWidth="1.5" />
        <polygon points={ring(R - 9)} stroke={INK} strokeWidth="1.2" />
        <polygon points={ring(5)} stroke={INK} strokeWidth="1.2" />
      </g>
      <g>
        <rect x={sx - 19} y={sy - 14} width="38" height="15" rx="3" fill="rgba(2,26,12,0.85)" stroke={INK} strokeWidth="1" />
        <text x={sx} y={sy - 3} fontSize="14" fill={INK} stroke="none" textAnchor="middle" fontFamily="'VT323', monospace" letterSpacing="1.5">EXIT</text>
      </g>
    </g>
  );
}

/** The sign over the entryway. */
export function ExitSign({ rect }: { rect: Rect }): ReactElement {
  const [x, y] = P(rect.x + rect.w * 0.5, rect.y, WALL_H - 10);
  return (
    <g>
      <rect x={x - 19} y={y - 14} width="38" height="15" rx="3" fill="rgba(2,26,12,0.85)" stroke={INK} strokeWidth="1" />
      <text x={x} y={y - 3} fontSize="14" fill={INK} stroke="none" textAnchor="middle" fontFamily="'VT323', monospace" letterSpacing="1.5">EXIT</text>
    </g>
  );
}

/** A doorway between two rooms side by side along x (a left one and a right one), with the hallway between them when they do not touch. */
export function HallX({ left, right }: { left: Rect; right: Rect }): ReactElement | null {
  const yc = left.yc ?? right.yc ?? (Math.max(left.y, right.y) + Math.min(left.y + left.d, right.y + right.d)) / 2;
  const a = left.x + left.w;
  const b = right.x;
  if (b - a < 1) return null;
  return (
    <g>
      <Poly p={[[a, yc - 14, 0], [b, yc - 14, 0], [b, yc + 14, 0], [a, yc + 14, 0]]} fill={FLOOR} />
      <Poly p={[[a, yc - 14, 0], [b, yc - 14, 0], [b, yc - 14, 18], [a, yc - 14, 18]]} fill={FACE_R} />
      <Poly p={[[a, yc - 14, 18], [b, yc - 14, 18], [b, yc - 14 - 4, 18], [a, yc - 14 - 4, 18]]} fill={CAP} />
      <Poly p={[[a, yc + 14, 0], [b, yc + 14, 0], [b, yc + 14, -9], [a, yc + 14, -9]]} fill="#073a1b" />
    </g>
  );
}

/** A doorway between a room and the one in front of it along y (a back one and a front one), with the hallway between them when they do not touch. */
export function HallY({ back, front }: { back: Rect; front: Rect }): ReactElement | null {
  const xc = back.xc ?? front.xc ?? (Math.max(back.x, front.x) + Math.min(back.x + back.w, front.x + front.w)) / 2;
  const a = back.y + back.d;
  const b = front.y;
  if (b - a < 1) return null;
  return (
    <g>
      <Poly p={[[xc - 14, a, 0], [xc + 14, a, 0], [xc + 14, b, 0], [xc - 14, b, 0]]} fill={FLOOR} />
      <Poly p={[[xc - 14, a, 0], [xc - 14, b, 0], [xc - 14, b, 18], [xc - 14, a, 18]]} fill={FACE_L} />
      <Poly p={[[xc - 14, a, 18], [xc - 14, b, 18], [xc - 14 - 4, b, 18], [xc - 14 - 4, a, 18]]} fill={CAP} />
      <Poly p={[[xc + 14, a, 0], [xc + 14, b, 0], [xc + 14, b, -9], [xc + 14, a, -9]]} fill={SLAB} />
    </g>
  );
}

/** The door positions a room needs in its back walls: where its neighbors on the left (col - 1) and behind (row - 1) join it. */
export function doorsOf(room: VaultRoom, at: (col: number, row: number) => VaultRoom | undefined): { doorsL: number[]; doorsR: number[] } {
  const me = roomRect(room);
  const slots = roomDef(room.type).slots;
  const doorsL: number[] = [];
  const doorsR: number[] = [];
  const left = at(room.col - 1, room.row);
  if (left) { const l = roomRect(left); doorsL.push(l.yc ?? (Math.max(me.y, l.y) + Math.min(me.y + me.d, l.y + l.d)) / 2); }
  for (let c = room.col; c < room.col + slots; c++) {
    const back = at(c, room.row - 1);
    if (!back) continue;
    const b = roomRect(back);
    const lo = Math.max(me.x, b.x, c * CELL);
    const hi = Math.min(me.x + me.w, b.x + b.w, (c + 1) * CELL);
    doorsR.push(b.xc ?? (lo + hi) / 2);
  }
  return { doorsL, doorsR };
}

// ---- furniture, in boxes ----
// Each piece is drawn about its own middle, facing the viewer: along the left back wall it faces +x, along the right back wall +y. A piece is made of boxes (drawn
// farthest-back first) and cylinders in local units; "face x" turns it by swapping the two floor axes.

interface Skin { top?: string; l?: string; r?: string; line?: string }
/** What a piece's drawing helpers are: boxes and cylinders in the piece's own units. */
export interface G {
  box(cx: number, cy: number, z: number, w: number, d: number, h: number, skin?: Skin): ReactElement;
  cyl(cx: number, cy: number, z: number, r: number, h: number, skin?: Skin): ReactElement;
  /** A flat shape on a face of a box, for screens and windows: (x, y) are in the piece's units, z up. */
  flat(points: V3[], fill: string): ReactElement;
}

let keyCount = 0;
function makeG(swap: boolean): G {
  const sx = (x: number, y: number): [number, number] => (swap ? [y, x] : [x, y]);
  return {
    box(cx, cy, z, w, d, h, skin = {}) {
      const [X, Y] = sx(cx, cy);
      const [W, D] = swap ? [d, w] : [w, d];
      const x0 = X - W / 2, y0 = Y - D / 2, x1 = X + W / 2, y1 = Y + D / 2;
      const top = skin.top ?? TOP;
      const left = skin.l ?? SIDE_Y; // the side that faces +y: seen on the left of the box
      const right = skin.r ?? SIDE_X; // the side that faces +x: seen on its right
      const stroke = skin.line ?? INK;
      return (
        <g key={`b${keyCount++}`}>
          <Poly p={[[x0, y1, z], [x1, y1, z], [x1, y1, z + h], [x0, y1, z + h]]} fill={left} sw={1} stroke={stroke} />
          <Poly p={[[x1, y0, z], [x1, y1, z], [x1, y1, z + h], [x1, y0, z + h]]} fill={right} sw={1} stroke={stroke} />
          <Poly p={[[x0, y0, z + h], [x1, y0, z + h], [x1, y1, z + h], [x0, y1, z + h]]} fill={top} sw={1} stroke={stroke} />
        </g>
      );
    },
    cyl(cx, cy, z, r, h, skin = {}) {
      const [X, Y] = sx(cx, cy);
      const n = 12;
      const ring = (zz: number): V3[] => Array.from({ length: n }, (_, i) => { const a = (i / n) * Math.PI * 2; return [X + Math.cos(a) * r, Y + Math.sin(a) * r, zz] as V3; });
      const bottom = ring(z);
      const top = ring(z + h);
      const sides: ReactElement[] = [];
      for (let i = 0; i < n; i++) {
        const mid = ((i + 0.5) / n) * Math.PI * 2;
        if (Math.cos(mid) + Math.sin(mid) <= 0) continue; // faces away
        const j = (i + 1) % n;
        sides.push(<Poly key={`c${i}`} p={[bottom[i], bottom[j], top[j], top[i]]} fill={Math.cos(mid) > Math.sin(mid) ? (skin.r ?? SIDE_X) : (skin.l ?? SIDE_Y)} sw={0.6} stroke={skin.line ?? INK} />);
      }
      return <g key={`y${keyCount++}`}>{sides}<Poly p={top} fill={skin.top ?? TOP} sw={0.9} stroke={skin.line ?? INK} /></g>;
    },
    flat(points, fill) {
      return <polygon key={`f${keyCount++}`} points={pts(points.map(([x, y, z]) => { const [a, b] = sx(x, y); return [a, b, z] as V3; }))} fill={fill} stroke="none" />;
    },
  };
}

interface Piece { u: number; v: number; face: 'x' | 'y'; art: (g: G) => ReactNode }
const DARK: Skin = { top: '#0a3a1c', l: '#06280f', r: '#041c0b' };
const GLASS_SKIN: Skin = { top: GLASS, l: GLASS, r: GLASS };
const SCREEN = 'rgba(61,255,138,0.28)';
// ---- skins and small helpers for the furniture ----
const UPH: Skin = { top: '#1a9a4e', l: '#0e6a32', r: '#084d24' }; // upholstery: couches, chairs, seats
const UPH2: Skin = { top: '#2fc86e', l: '#16a050', r: '#0d7a3c' }; // cushions: a little brighter
const PILLOW: Skin = { top: '#8dffbc', l: '#46cf80', r: '#2aa862' };
const APPL: Skin = { top: '#27a85a', l: '#16703a', r: '#0c4f28' }; // enamel: appliances
const WORKTOP: Skin = { top: '#22b862', l: '#12803e', r: '#0b5e2c' };
const TILE: Skin = { top: '#0f8a42', l: '#0a5a28', r: '#063a1a' };
const GLOWS: Skin = { top: INK, l: INK, r: INK };
const GROOVE: Skin = { top: '#02130a', l: '#02130a', r: '#02130a', line: '#0b5a2a' };
const GLINT = 'rgba(205,255,225,0.42)';

/** A box with its top edge bevelled (cushions, mattresses, counters): the top is a slightly smaller box on the body. */
const soft = (g: G, cx: number, cy: number, z: number, w: number, d: number, h: number, skin: Skin = {}) => (
  <g key={`sf${cx}-${cy}-${z}-${w}`}>{g.box(cx, cy, z, w, d, Math.max(0.6, h - 1.2), skin)}{g.box(cx, cy, z + Math.max(0.6, h - 1.2), Math.max(1, w - 1.6), Math.max(1, d - 1.6), 1.2, skin)}</g>
);
/** A round shape on a face of a piece (a porthole, a speaker cone, a plate): plane 'x' at x = at, or 'y' at y = at; centered (a, b) on it with radius r. */
const disc = (g: G, plane: 'x' | 'y', at: number, a: number, b: number, r: number, fill: string, n = 14) =>
  g.flat(Array.from({ length: n }, (_, i) => { const t = (i / n) * Math.PI * 2; const p = a + Math.cos(t) * r; const q = b + Math.sin(t) * r; return (plane === 'x' ? [at, p, q] : [p, at, q]) as V3; }), fill);
/** Seams and grooves on a front face: a horizontal one, and a vertical one (front along y at `at`, or along x at `at`). */
const hY = (g: G, x0: number, x1: number, at: number, z: number) => g.box((x0 + x1) / 2, at, z, x1 - x0, 0.6, 0.7, GROOVE);
const vY = (g: G, x: number, at: number, z0: number, z1: number) => g.box(x, at, z0, 0.7, 0.6, z1 - z0, GROOVE);
const hX = (g: G, y0: number, y1: number, at: number, z: number) => g.box(at, (y0 + y1) / 2, z, 0.6, y1 - y0, 0.7, GROOVE);
const vX = (g: G, y: number, at: number, z0: number, z1: number) => g.box(at, y, z0, 0.6, 0.7, z1 - z0, GROOVE);

/** A chair at (cx, cy); `dir` is the way it faces along y (1: toward +y, with its back on the -y side; -1: the other way round). */
const chair = (g: G, cx: number, cy: number, dir = 1) => (
  <g key={`ch${cx}-${cy}`}>
    {g.box(cx - 5, cy - 4, 0, 1.8, 1.8, 6, DARK)}{g.box(cx + 5, cy - 4, 0, 1.8, 1.8, 6, DARK)}
    {dir > 0 && <g>{g.box(cx - 5, cy - 6, 6, 1.8, 2, 17, DARK)}{g.box(cx + 5, cy - 6, 6, 1.8, 2, 17, DARK)}{g.box(cx, cy - 6, 12, 8, 1.2, 8, UPH)}{g.box(cx, cy - 6, 20, 12, 2.2, 3)}</g>}
    {g.box(cx, cy, 6, 12, 12, 2.4)}{g.box(cx, cy, 8.4, 10.5, 10.5, 1.2, UPH2)}
    {dir < 0 && <g>{g.box(cx - 5, cy + 6, 6, 1.8, 2, 17, DARK)}{g.box(cx + 5, cy + 6, 6, 1.8, 2, 17, DARK)}{g.box(cx, cy + 6, 12, 8, 1.2, 8, UPH)}{g.box(cx, cy + 6, 20, 12, 2.2, 3)}</g>}
    {g.box(cx - 5, cy + 4, 0, 1.8, 1.8, 6, DARK)}{g.box(cx + 5, cy + 4, 0, 1.8, 1.8, 6, DARK)}
  </g>
);

// ---- little plants, drawn flat in the screen from a point on the ground (for the hallway pieces and the garden) ----
let plantKey = 0;
/** A leaf (an oval) whose middle stands at (x, y, z) of the piece, turned by `rot` degrees. */
const leaf = (x: number, y: number, z: number, rx: number, ry: number, rot: number, fill: string): ReactElement => {
  const [X, Y] = P(x, y, z);
  return <ellipse key={`lf${plantKey++}`} cx={X} cy={Y} rx={rx} ry={ry} transform={`rotate(${rot} ${X} ${Y})`} fill={fill} stroke={INK} strokeWidth={0.7} />;
};
/** A few blades of grass or water weed standing from (x, y, z), this high. */
const sprig = (x: number, y: number, z: number, h: number): ReactElement => {
  const [X, Y] = P(x, y, z);
  return <path key={`sp${plantKey++}`} d={`M${X} ${Y}q-1.6 ${-h / 2} 0.8 ${-h}M${X} ${Y}q2 ${-h / 2} -0.6 ${-h * 0.8}`} fill="none" stroke={INK} strokeWidth={0.9} strokeLinecap="round" />;
};
/** A corn plant: a stalk, long leaves bending out, and a cob. */
const cornStalk = (x: number, y: number, z: number, h: number): ReactElement => {
  const [X, Y] = P(x, y, z);
  return (
    <g key={`cs${plantKey++}`} strokeLinecap="round" strokeLinejoin="round">
      <path d={`M${X} ${Y}L${X} ${Y - h}`} stroke={INK} strokeWidth={1.5} />
      <path d={`M${X} ${Y - h * 0.3}q-10 -3 -12 -10q8 3 12 6M${X} ${Y - h * 0.5}q10 -3 12 -10q-8 3 -12 6M${X} ${Y - h * 0.72}q-9 -2 -10 -9q7 2 10 5M${X} ${Y - h * 0.9}q8 -2 9 -8q-6 2 -9 5`} fill={DIM} stroke={INK} strokeWidth={0.7} />
      <ellipse cx={X + 2.2} cy={Y - h * 0.55} rx={1.8} ry={4.4} fill={INK} stroke="none" />
      <path d={`M${X} ${Y - h}l-1.4 -4M${X} ${Y - h}l1.4 -4M${X} ${Y - h}l0 -5`} stroke={INK} strokeWidth={0.8} />
    </g>
  );
};
/** A tato plant (a mutated potato): a low bush of broad leaves with a couple of tubers showing in the soil. */
const tatoPlant = (x: number, y: number): ReactElement => {
  const [X, Y] = P(x, y, 0.4);
  return (
    <g key={`tp${plantKey++}`}>
      <ellipse cx={X + 3} cy={Y + 0.5} rx={2.6} ry={1.4} fill={INK} stroke="none" opacity={0.8} />
      <ellipse cx={X - 4} cy={Y - 4} rx={4.6} ry={2.6} transform={`rotate(-30 ${X - 4} ${Y - 4})`} fill={DIM} stroke={INK} strokeWidth={0.7} />
      <ellipse cx={X + 4} cy={Y - 4.6} rx={4.6} ry={2.6} transform={`rotate(30 ${X + 4} ${Y - 4.6})`} fill={DIM} stroke={INK} strokeWidth={0.7} />
      <ellipse cx={X} cy={Y - 7} rx={4.2} ry={2.8} fill={INK} stroke={INK} strokeWidth={0.7} />
      <ellipse cx={X} cy={Y - 3} rx={3.4} ry={2.2} fill={DIM} stroke={INK} strokeWidth={0.7} />
    </g>
  );
};
/** A mutfruit bush: round and leafy, hung with bright fruit. */
const mutfruitBush = (x: number, y: number, z: number): ReactElement => {
  const [X, Y] = P(x, y, z);
  const blobs: [number, number, number][] = [[-8, -4, 7.4], [8, -4, 7.4], [0, -10, 8.4], [-4, 0, 7], [5, 0, 7], [0, -16, 6.4]];
  const fruit: [number, number][] = [[-10, -5], [10, -6], [3, -12], [-5, 1], [7, 2], [-2, -17], [0, -7], [-7, -10]];
  return (
    <g key={`mb${plantKey++}`}>
      {blobs.map(([dx, dy, r], i) => <circle key={`b${i}`} cx={X + dx} cy={Y + dy} r={r} fill={DIM} stroke={INK} strokeWidth={0.7} />)}
      {fruit.map(([dx, dy], i) => <circle key={`f${i}`} cx={X + dx} cy={Y + dy} r={2.6} fill={INK} stroke="none" />)}
    </g>
  );
};

/** Where each piece of furniture stands in its room (u across, v deep), which wall it faces from, and what it is made of. */
export const FURNITURE: Record<string, Piece> = {
  coatrack: { u: 0.1, v: 0.22, face: 'x', art: (g) => <g>{g.cyl(0, 0, 0, 5.5, 1.6, DARK)}{g.cyl(0, 0, 1.6, 3.4, 1.4, DARK)}{g.box(0, 0, 3, 2.2, 2.2, 40)}{g.cyl(0, 0, 43, 2.2, 3, { top: INK })}{g.box(4, 0, 38, 7, 1.6, 1.6)}{g.box(-4, 0, 34, 7, 1.6, 1.6)}{g.box(0, 4, 36, 1.6, 7, 1.6)}{g.box(0, -4, 31, 1.6, 7, 1.6)}{soft(g, 6, 0, 10, 6, 8, 24, UPH)}{g.box(6, 0, 12, 1, 1, 12, GROOVE)}{g.cyl(4, 0, 39.6, 3.6, 1.6, DARK)}</g> },
  shoebench: { u: 0.1, v: 0.62, face: 'x', art: (g) => <g>{g.box(-4, -14, 0, 2, 2, 9, DARK)}{g.box(-4, 14, 0, 2, 2, 9, DARK)}{g.box(4, -14, 0, 2, 2, 9, DARK)}{g.box(4, 14, 0, 2, 2, 9, DARK)}{g.box(0, 0, 3, 11, 32, 1.4, DARK)}{g.box(1.5, -9, 4.4, 6, 4, 2.6, DARK)}{g.box(1.5, -2, 4.4, 6, 4, 2.6, DARK)}{g.box(1.5, 7, 4.4, 6, 4, 2.6, DARK)}{g.box(1.5, 13, 4.4, 5, 3.4, 2.4, DARK)}{g.box(0, 0, 9, 12, 34, 3)}{soft(g, 0, 0, 12, 10, 30, 3, UPH2)}{g.box(0, 6, 15, 7, 5, 3, DARK)}{g.box(0, -4, 15, 7, 5, 3, DARK)}</g> },
  decon: { u: 0.72, v: 0.14, face: 'y', art: (g) => <g>{g.box(0, 0, 0, 26, 26, 2, DARK)}{Array.from({ length: 5 }, (_, i) => <g key={`dz${i}`}>{g.box(-10 + i * 5, 12.4, 0.2, 2.6, 0.8, 1.6, i % 2 ? GLOWS : DARK)}</g>)}{g.box(0, -11, 2, 26, 3, 46, DARK)}{g.box(-8, -9, 8, 1.2, 1.2, 30, GLOWS)}{g.box(0, -9, 8, 1.2, 1.2, 30, GLOWS)}{g.box(8, -9, 8, 1.2, 1.2, 30, GLOWS)}{g.box(0, -6, 46, 24, 11, 3)}{g.cyl(-7, -2, 44, 2, 2, { top: INK })}{g.cyl(7, -2, 44, 2, 2, { top: INK })}{g.cyl(0, -6, 49, 1.8, 1.8, { top: INK })}{g.box(0, 0, 2, 26, 26, 44, GLASS_SKIN)}{g.box(11, 0, 24, 1, 1, 4, GLOWS)}</g> },
  couch: { u: 0.5, v: 0.2, face: 'y', art: (g) => <g>{g.box(-24, -8, 0, 3, 3, 3, DARK)}{g.box(24, -8, 0, 3, 3, 3, DARK)}{g.box(-24, 8, 0, 3, 3, 3, DARK)}{g.box(24, 8, 0, 3, 3, 3, DARK)}{g.box(0, -10, 3, 54, 6, 25, UPH)}{g.box(0, 1, 3, 54, 18, 7, UPH)}{soft(g, -17, -6, 10, 17, 7, 17, UPH2)}{soft(g, 0, -6, 10, 17, 7, 17, UPH2)}{soft(g, 17, -6, 10, 17, 7, 17, UPH2)}{soft(g, -10, 4, 10, 19, 13, 4, UPH2)}{soft(g, 10, 4, 10, 19, 13, 4, UPH2)}{soft(g, -24.25, -1.5, 3, 5.5, 23, 15, UPH)}{soft(g, 24.25, -1.5, 3, 5.5, 23, 15, UPH)}{soft(g, -17, 3, 14, 8, 4, 8, PILLOW)}</g> },
  tv: { u: 0.1, v: 0.5, face: 'x', art: (g) => <g>{g.box(0, 0, 0, 12, 36, 10, DARK)}{vX(g, 0, 6, 1.4, 9)}{g.box(6.5, -6, 4, 1, 1.6, 3, GLOWS)}{g.box(6.5, 6, 4, 1, 1.6, 3, GLOWS)}{g.box(-1, 0, 10, 3, 10, 2, DARK)}{g.box(-1, 0, 12, 4, 32, 20, DARK)}{g.flat([[1.4, -14, 14], [1.4, 14, 14], [1.4, 14, 30], [1.4, -14, 30]], SCREEN)}{g.flat([[1.5, -12, 25], [1.5, -5, 25], [1.5, -9, 29], [1.5, -12, 29]], GLINT)}{g.box(1.2, 12.5, 12.6, 0.8, 1.4, 0.8, GLOWS)}</g> },
  armchair: { u: 0.78, v: 0.62, face: 'y', art: (g) => <g>{g.box(-10, -7, 0, 2.5, 2.5, 3, DARK)}{g.box(10, -7, 0, 2.5, 2.5, 3, DARK)}{g.box(-10, 8, 0, 2.5, 2.5, 3, DARK)}{g.box(10, 8, 0, 2.5, 2.5, 3, DARK)}{g.box(0, -9, 3, 26, 5, 23, UPH)}{g.box(0, 1, 3, 26, 18, 7, UPH)}{soft(g, 0, -5, 10, 17, 6, 14, UPH2)}{soft(g, 0, 4, 10, 17, 13, 4, UPH2)}{soft(g, -10.5, -0.75, 3, 5, 21.5, 14, UPH)}{soft(g, 10.5, -0.75, 3, 5, 21.5, 14, UPH)}</g> },
  coffeetable: { u: 0.5, v: 0.62, face: 'y', art: (g) => <g>{g.box(-12, -6, 0, 2, 2, 8, DARK)}{g.box(12, -6, 0, 2, 2, 8, DARK)}{g.box(-12, 6, 0, 2, 2, 8, DARK)}{g.box(12, 6, 0, 2, 2, 8, DARK)}{g.box(0, 0, 2.5, 26, 14, 1.2, DARK)}{soft(g, 0, 0, 8, 30, 18, 3)}{g.box(-7, -2, 11, 9, 6, 1.6, UPH2)}{g.box(-7, -2, 12.6, 8, 5, 1.4, PILLOW)}{g.cyl(8, 3, 11, 1.7, 3, { top: INK })}</g> },
  table: { u: 0.5, v: 0.5, face: 'y', art: (g) => <g>{g.box(-24, -12, 0, 3, 3, 16, DARK)}{g.box(24, -12, 0, 3, 3, 16, DARK)}{g.box(-24, 12, 0, 3, 3, 16, DARK)}{g.box(24, 12, 0, 3, 3, 16, DARK)}{g.box(0, 0, 13, 50, 26, 3, DARK)}{soft(g, 0, 0, 16, 56, 32, 3)}{g.cyl(-14, -9, 19, 3.4, 0.6, { top: DIM })}{g.cyl(14, -9, 19, 3.4, 0.6, { top: DIM })}{g.cyl(-14, 9, 19, 3.4, 0.6, { top: DIM })}{g.cyl(14, 9, 19, 3.4, 0.6, { top: DIM })}{g.cyl(0, 0, 19, 4.2, 1.8, DARK)}{g.cyl(0, 0, 20.8, 2.4, 2, { top: INK })}{g.cyl(-8, 0, 19, 0.9, 6, { top: INK })}{g.cyl(8, 0, 19, 0.9, 6, { top: INK })}</g> },
  chairs: { u: 0.5, v: 0.5, face: 'y', art: (g) => <g>{chair(g, -14, -26, 1)}{chair(g, 14, -26, 1)}{chair(g, -14, 26, -1)}{chair(g, 14, 26, -1)}</g> },
  chandelier: { u: 0.5, v: 0.5, face: 'y', art: (g) => <g>{g.box(0, 0, 54, 1.2, 1.2, 10, DARK)}{g.cyl(0, 0, 49, 2, 5, DARK)}{g.cyl(0, 0, 46.5, 3.4, 2.5)}{g.box(0, 0, 46, 24, 1.6, 1.6)}{g.box(0, 0, 46, 1.6, 24, 1.6)}{[[-12, 0], [12, 0], [0, -12], [0, 12]].map(([x, y]) => <g key={`cd${x}${y}`}>{g.cyl(x, y, 44.8, 1.8, 1.4, DARK)}{g.cyl(x, y, 46.2, 1.1, 5, { top: INK })}{g.box(x, y, 51.2, 0.9, 0.9, 1.8, GLOWS)}</g>)}</g> },
  chinacabinet: { u: 0.1, v: 0.78, face: 'x', art: (g) => <g>{g.box(0, 0, 0, 15, 37, 3, DARK)}{g.box(0, 0, 3, 14, 36, 46)}{g.box(0, 0, 49, 16, 38, 2.2)}{g.flat([[7.3, -15, 26], [7.3, 15, 26], [7.3, 15, 46], [7.3, -15, 46]], GLASS)}{g.flat([[7.3, -15, 6], [7.3, 15, 6], [7.3, 15, 22], [7.3, -15, 22]], 'rgba(2,19,8,0.5)')}{vX(g, 0, 7, 26, 46)}{vX(g, 0, 7, 6, 22)}{hX(g, -15, 15, 7, 36)}{hX(g, -15, 15, 7, 22.5)}{disc(g, 'x', 7.5, -8, 41, 3, 'rgba(125,255,176,0.6)')}{disc(g, 'x', 7.5, 0, 41, 3, 'rgba(125,255,176,0.6)')}{disc(g, 'x', 7.5, 8, 41, 3, 'rgba(125,255,176,0.6)')}{g.box(7.6, -9, 36.6, 2.6, 2.6, 3, GLOWS)}{g.box(7.6, 8, 36.6, 2.6, 2.6, 3, GLOWS)}{g.box(7.7, -2.5, 20, 1, 1.2, 4, GLOWS)}{g.box(7.7, 2.5, 20, 1, 1.2, 4, GLOWS)}</g> },
  sinkcabinets: { u: 0.5, v: 0.1, face: 'y', art: (g) => <g>{g.box(0, 1, 0, 56, 15, 2, DARK)}{g.box(0, 0, 2, 60, 18, 22)}{vY(g, -10, 9.2, 3, 23)}{vY(g, 10, 9.2, 3, 23)}{g.box(-13, 9.6, 14, 1.2, 1, 6, GLOWS)}{g.box(-7, 9.6, 14, 1.2, 1, 6, GLOWS)}{g.box(7, 9.6, 14, 1.2, 1, 6, GLOWS)}{g.box(13, 9.6, 14, 1.2, 1, 6, GLOWS)}{g.box(0, -8, 27, 60, 2, 8, DARK)}{soft(g, 0, 1, 24, 62, 20, 3, WORKTOP)}{g.box(-12, 2, 27, 18, 12, 0.6, DARK)}{g.cyl(-12, -4, 27, 1.3, 6)}{g.box(-12, -1, 32.4, 1.4, 6, 1.4)}{g.cyl(10, 3, 27, 2.6, 1.4, { top: INK })}</g> },
  fridge: { u: 0.1, v: 0.35, face: 'x', art: (g) => <g>{g.box(0, -9, 0, 20, 4, 2, DARK)}{g.box(0, 9, 0, 20, 4, 2, DARK)}{soft(g, 0, 0, 2, 24, 24, 56, APPL)}{hX(g, -11.5, 11.5, 12.2, 36)}{g.box(12.6, -8, 38, 1.4, 1.4, 14, GLOWS)}{g.box(12.6, -8, 10, 1.4, 1.4, 20, GLOWS)}{g.flat([[12.4, 3, 44], [12.4, 9, 44], [12.4, 9, 51], [12.4, 3, 51]], SCREEN)}{g.box(12.5, 7, 30, 0.6, 0.6, 0.6, GLOWS)}</g> },
  stove: { u: 0.85, v: 0.1, face: 'y', art: (g) => <g>{g.box(0, 0, 0, 28, 24, 26)}{g.box(0, -10, 26, 28, 3, 9, DARK)}{g.box(-6, -8.4, 31, 4, 1, 2, GLOWS)}{[[-6, -4], [6, -4], [-6, 6], [6, 6]].map(([x, y]) => <g key={`bn${x}${y}`}>{g.cyl(x, y, 26, 5.2, 0.8, DARK)}{g.cyl(x, y, 26.8, 3, 0.5, { top: DIM })}</g>)}{g.flat([[-10, 12.1, 4], [10, 12.1, 4], [10, 12.1, 18], [-10, 12.1, 18]], '#02130a')}{g.flat([[-8, 12.2, 6], [8, 12.2, 6], [8, 12.2, 16], [-8, 12.2, 16]], SCREEN)}{g.flat([[-6, 12.3, 12], [-2, 12.3, 12], [-4, 12.3, 15], [-6, 12.3, 15]], GLINT)}{g.box(0, 12.9, 19.4, 20, 1.2, 1.4, GLOWS)}{[-9, -3, 3, 9].map((x) => <g key={`kn${x}`}>{g.box(x, 12.5, 22.4, 2.4, 1.2, 2.4, GLOWS)}</g>)}</g> },
  bed: { u: 0.5, v: 0.5, face: 'y', art: (g) => <g>{g.box(0, -34, 0, 46, 3, 32)}{g.box(0, -32, 10, 36, 0.8, 16, DARK)}{g.box(-21, -34, 0, 3, 4, 36, DARK)}{g.box(21, -34, 0, 3, 4, 36, DARK)}{g.box(0, 0, 0, 44, 66, 10)}{soft(g, 0, 3, 10, 40, 58, 6, UPH)}{g.box(0, 10, 16, 40, 42, 1.8, UPH2)}{g.box(0, -11, 16, 40, 5, 3, PILLOW)}{soft(g, -10, -26, 16, 14, 9, 4, PILLOW)}{soft(g, 10, -26, 16, 14, 9, 4, PILLOW)}{g.box(0, 33, 0, 46, 3, 16)}</g> },
  nightstand: { u: 0.88, v: 0.14, face: 'y', art: (g) => <g>{g.box(-6, -6, 0, 2, 2, 2, DARK)}{g.box(6, -6, 0, 2, 2, 2, DARK)}{g.box(-6, 6, 0, 2, 2, 2, DARK)}{g.box(6, 6, 0, 2, 2, 2, DARK)}{g.box(0, 0, 2, 16, 16, 14)}{hY(g, -7, 7, 8.2, 9)}{g.box(0, 8.6, 5.4, 3, 1, 1.4, GLOWS)}{g.box(0, 8.6, 12, 3, 1, 1.4, GLOWS)}{g.box(-3, 0, 16, 7, 5, 1.6, UPH2)}{g.box(4, 1, 16, 6, 4, 3.4, DARK)}{g.flat([[4, 3.1, 17], [7, 3.1, 17], [7, 3.1, 18.6], [4, 3.1, 18.6]], SCREEN)}</g> },
  dresser: { u: 0.1, v: 0.75, face: 'x', art: (g) => <g>{g.box(0, -17, 0, 14, 3, 2, DARK)}{g.box(0, 17, 0, 14, 3, 2, DARK)}{g.box(0, 0, 2, 18, 40, 26)}{hX(g, -18, 18, 9.2, 11)}{hX(g, -18, 18, 9.2, 20)}{g.box(9.6, -8, 6, 1, 8, 1.4, GLOWS)}{g.box(9.6, 8, 6, 1, 8, 1.4, GLOWS)}{g.box(9.6, -8, 15, 1, 8, 1.4, GLOWS)}{g.box(9.6, 8, 15, 1, 8, 1.4, GLOWS)}{g.box(9.6, -8, 24, 1, 8, 1.4, GLOWS)}{g.box(9.6, 8, 24, 1, 8, 1.4, GLOWS)}{g.box(-6, 0, 28, 2.2, 28, 14, DARK)}{g.flat([[-4.8, -12, 30], [-4.8, 12, 30], [-4.8, 12, 40], [-4.8, -12, 40]], GLINT)}{g.box(2, -10, 28, 5, 6, 2.6, UPH2)}{g.cyl(3, 10, 28, 1.6, 5, { top: INK })}</g> },
  lamp: { u: 0.12, v: 0.2, face: 'x', art: (g) => <g>{g.cyl(0, 0, 0, 5.6, 1.2, DARK)}{g.cyl(0, 0, 1.2, 4.4, 1, DARK)}{g.box(0, 0, 2.2, 1.8, 1.8, 28, DARK)}{g.cyl(0, 0, 29.6, 7.2, 1, DARK)}{g.cyl(0, 0, 30.6, 6.4, 10, { top: '#9dffc4', l: DIM, r: '#0c6b30' })}{g.box(0, 0, 40.6, 1, 1, 2.6, DARK)}</g> },
  toilet: { u: 0.7, v: 0.2, face: 'y', art: (g) => <g>{g.box(0, -7, 5, 14, 6, 12, APPL)}{g.box(0, -7, 17, 15, 7, 1.6, WORKTOP)}{g.cyl(0, -7, 18.6, 1.2, 1.2, { top: INK })}{g.box(0, 1, 0, 9, 10, 6, DARK)}{g.cyl(0, 3, 6, 7.8, 5, UPH)}{g.cyl(0, 3, 11, 8.2, 1.4, { top: DIM })}{g.cyl(0, 3.4, 12.2, 5.4, 0.4, { top: '#02130a' })}</g> },
  bathsink: { u: 0.25, v: 0.2, face: 'y', art: (g) => <g>{g.cyl(0, -3, 0, 3.6, 18, UPH)}{g.box(0, -9.6, 29, 18, 1, 16, GLASS_SKIN)}{g.box(0, -9, 18, 24, 2, 7, DARK)}{soft(g, 0, 0, 18, 24, 16, 5, APPL)}{g.box(0, 1, 22.6, 16, 10, 0.5, DARK)}{g.cyl(0, -6, 23, 1.2, 5)}{g.box(0, -3, 27, 1.4, 5, 1.4)}{g.cyl(-5, -5, 23, 1, 2, { top: INK })}{g.cyl(5, -5, 23, 1, 2, { top: INK })}</g> },
  shower: { u: 0.78, v: 0.74, face: 'y', art: (g) => <g>{g.box(0, 0, 0, 26, 26, 2, DARK)}{g.box(0, -12, 2, 26, 2, 46, TILE)}{g.box(-12, 0, 2, 2, 26, 46, TILE)}{g.cyl(3, 2, 2, 2, 0.5, DARK)}{g.box(-8, -10, 2, 1.4, 1.4, 40, DARK)}{g.box(-8, -7, 40, 1.4, 7, 1.4, DARK)}{g.cyl(-8, -3, 38.6, 3.6, 1.4, { top: INK })}{g.box(-3, -10.6, 22, 3, 1.2, 3, GLOWS)}{g.box(12, 0, 2, 1.2, 26, 46, GLASS_SKIN)}{g.box(0, 12, 2, 26, 1.2, 46, GLASS_SKIN)}</g> },
  washer: { u: 0.22, v: 0.2, face: 'y', art: (g) => <g>{g.box(0, 0, 0, 24, 24, 30, APPL)}{g.box(0, -8, 30, 24, 8, 4, DARK)}{[-7, 0, 7].map((x) => <g key={`wk${x}`}>{g.cyl(x, -8, 34, 1.7, 1.2, { top: INK })}</g>)}{disc(g, 'y', 12.1, 0, 15, 10.4, '#0b5a2a')}{disc(g, 'y', 12.2, 0, 15, 9, '#02130a')}{disc(g, 'y', 12.3, 0, 15, 7.4, SCREEN)}{disc(g, 'y', 12.4, -2.6, 18, 2, GLINT, 8)}{g.box(9.6, 12.3, 16, 1.2, 1, 6, GLOWS)}{g.cyl(8, 3, 30, 2.4, 6, { top: INK })}</g> },
  dryer: { u: 0.62, v: 0.2, face: 'y', art: (g) => <g>{g.box(0, 0, 0, 24, 24, 30, APPL)}{g.box(0, -8, 30, 24, 8, 4, DARK)}{g.cyl(-5, -8, 34, 1.7, 1.2, { top: INK })}{g.cyl(5, -8, 34, 1.7, 1.2, { top: INK })}{disc(g, 'y', 12.1, 0, 15, 10.4, '#0b5a2a')}{disc(g, 'y', 12.2, 0, 15, 9, '#02130a')}{disc(g, 'y', 12.3, 0, 15, 7.4, 'rgba(61,255,138,0.16)')}{g.flat([[-5, 12.4, 11], [-1, 12.4, 10], [2, 12.4, 13], [-2, 12.4, 15]], 'rgba(61,255,138,0.38)')}{g.flat([[1, 12.4, 17], [5, 12.4, 16], [6, 12.4, 19], [2, 12.4, 20]], 'rgba(61,255,138,0.3)')}{g.box(9.6, 12.3, 16, 1.2, 1, 6, GLOWS)}</g> },
  ironingboard: { u: 0.78, v: 0.7, face: 'y', art: (g) => <g>{g.box(-8, -4, 0, 1.6, 1.6, 22, DARK)}{g.box(8, 4, 0, 1.6, 1.6, 22, DARK)}{g.box(-8, 4, 0, 1.6, 1.6, 22, DARK)}{g.box(8, -4, 0, 1.6, 1.6, 22, DARK)}{g.box(0, 0, 10, 16, 1.2, 1.2, DARK)}{g.box(0, 0, 10, 1.2, 8, 1.2, DARK)}{soft(g, 0, 0, 22, 34, 12, 2.6, UPH2)}{g.box(-9, 0, 24.6, 8, 5, 2.6, DARK)}{g.box(-9, 0, 27.2, 5, 1.4, 1.6, GLOWS)}{g.box(6, 1, 24.6, 9, 6, 1.2, PILLOW)}</g> },
  seating: { u: 0.5, v: 0.62, face: 'y', art: (g) => <g>{[-32, 0, 32].map((cx) => <g key={cx}>{g.box(cx, 0, 0, 20, 14, 3, DARK)}{soft(g, cx, -7, 3, 20, 4, 24, UPH)}{soft(g, cx, -7, 24, 16, 4, 6, UPH2)}{soft(g, cx, 1, 3, 20, 14, 7, UPH2)}</g>)}{[-43, -21, 21, 43].map((x) => <g key={`ar${x}`}>{g.box(x, 0, 3, 2.4, 14, 11, DARK)}</g>)}{g.cyl(-21, 3, 14, 1.4, 0.8, { top: INK })}{g.cyl(21, 3, 14, 1.4, 0.8, { top: INK })}</g> },
  screen: { u: 0.5, v: 0.06, face: 'y', art: (g) => <g>{g.box(0, 0, 0, 100, 6, 4, DARK)}{g.box(0, 0, 4, 100, 4, 50, DARK)}{g.flat([[-44, 2.1, 7], [44, 2.1, 7], [44, 2.1, 52], [-44, 2.1, 52]], SCREEN)}{g.flat([[-36, 2.2, 36], [-18, 2.2, 36], [-30, 2.2, 49], [-36, 2.2, 49]], GLINT)}{soft(g, -47, 2.5, 4, 6, 6, 50, UPH)}{soft(g, 47, 2.5, 4, 6, 6, 50, UPH)}{g.box(0, 2.5, 54, 100, 6, 4, UPH)}</g> },
  speakers: { u: 0.1, v: 0.3, face: 'x', art: (g) => <g>{g.box(0, 0, 0, 17, 17, 2, DARK)}{soft(g, 0, 0, 2, 16, 16, 38, DARK)}{disc(g, 'x', 8.2, 0, 32, 3.2, '#0b5a2a')}{disc(g, 'x', 8.3, 0, 32, 2, INK, 10)}{disc(g, 'x', 8.2, 0, 16, 7, '#0b5a2a')}{disc(g, 'x', 8.3, 0, 16, 5.6, '#02130a')}{disc(g, 'x', 8.4, 0, 16, 2.2, DIM, 10)}{g.box(8.3, 0, 4, 0.8, 5, 1, GLOWS)}</g> },
  pooltable: { u: 0.5, v: 0.5, face: 'y', art: (g) => <g>{g.box(-29, -13, 0, 5, 5, 14, DARK)}{g.box(29, -13, 0, 5, 5, 14, DARK)}{g.box(-29, 13, 0, 5, 5, 14, DARK)}{g.box(29, 13, 0, 5, 5, 14, DARK)}{g.box(0, 0, 14, 68, 36, 6)}{g.box(0, 0, 20, 62, 30, 0.6, { top: '#0e8a40', l: DIM, r: DIM })}{g.box(0, -16.5, 20, 64, 3, 2.4, DARK)}{g.box(0, 16.5, 20, 64, 3, 2.4, DARK)}{g.box(-32.5, 0, 20, 3, 30, 2.4, DARK)}{g.box(32.5, 0, 20, 3, 30, 2.4, DARK)}{[[-30, -14], [30, -14], [-30, 14], [30, 14], [0, -15], [0, 15]].map(([x, y]) => <g key={`pk${x}${y}`}>{g.cyl(x, y, 20.6, 2.6, 0.9, { top: '#010a05' })}</g>)}{[[10, 0], [13, -1.8], [13, 1.8], [16, -3.6], [16, 0], [16, 3.6]].map(([x, y], i) => <g key={`bl${i}`}>{g.cyl(x, y, 20.6, 1.5, 2.2, { top: i % 2 ? INK : '#9dffc4' })}</g>)}{g.cyl(-14, 2, 20.6, 1.5, 2.2, { top: '#e8fff0' })}</g> },
  bar: { u: 0.5, v: 0.1, face: 'y', art: (g) => <g>{g.box(0, -9, 0, 72, 2, 38, DARK)}{g.box(0, 0, 0, 72, 18, 28)}{vY(g, -24, 9.2, 2, 26)}{vY(g, -8, 9.2, 2, 26)}{vY(g, 8, 9.2, 2, 26)}{vY(g, 24, 9.2, 2, 26)}{g.box(0, 10, 3, 70, 1.2, 1.2, DARK)}{soft(g, 0, 2, 28, 76, 22, 3, WORKTOP)}{[-24, -17, -10, 14, 20].map((x) => <g key={`bt${x}`}>{g.cyl(x, -6, 31, 1.3, 6, { top: INK })}</g>)}{g.cyl(4, 4, 31, 1.6, 2.6, { top: '#9dffc4' })}{[-20, 0, 20].map((x) => <g key={`st${x}`}>{g.cyl(x, 22, 0, 3.6, 1, DARK)}{g.cyl(x, 22, 1, 1, 10.6, DARK)}{g.cyl(x, 22, 10.4, 4.6, 2.4, { top: '#2fc86e', l: '#16a050', r: '#0d7a3c' })}</g>)}</g> },
  pinball: { u: 0.1, v: 0.55, face: 'x', art: (g) => <g>{g.box(-9, -11, 0, 2.4, 2.4, 8, DARK)}{g.box(-9, 11, 0, 2.4, 2.4, 8, DARK)}{g.box(9, -11, 0, 2.4, 2.4, 6, DARK)}{g.box(9, 11, 0, 2.4, 2.4, 6, DARK)}{g.box(0, 0, 6, 24, 28, 7)}{g.flat([[-11, -13, 19], [11, -13, 15], [11, 13, 15], [-11, 13, 19]], SCREEN)}{g.cyl(-2, -6, 17, 2.2, 1, { top: INK })}{g.cyl(-3, 5, 17.5, 2.2, 1, { top: INK })}{g.cyl(2, -1, 16.4, 2, 1, { top: INK })}{g.box(7, -5, 15.6, 3.4, 1.2, 1.2, DARK)}{g.box(7, 5, 15.6, 3.4, 1.2, 1.2, DARK)}{g.box(-10, 0, 13, 4, 28, 22, DARK)}{g.flat([[-7.9, -12, 24], [-7.9, 12, 24], [-7.9, 12, 33], [-7.9, -12, 33]], 'rgba(61,255,138,0.4)')}{g.flat([[-7.8, -10, 26], [-7.8, -2, 26], [-7.8, -2, 30], [-7.8, -10, 30]], GLINT)}{g.box(-9, 0, 35, 3, 28, 2, DARK)}</g> },
  toolchest: { u: 0.1, v: 0.25, face: 'x', art: (g) => <g>{g.cyl(-5, -15, 0, 2, 2.4, DARK)}{g.cyl(-5, 15, 0, 2, 2.4, DARK)}{g.cyl(5, -15, 0, 2, 2.4, DARK)}{g.cyl(5, 15, 0, 2, 2.4, DARK)}{g.box(0, 0, 2.4, 18, 36, 24, APPL)}{g.box(0, 0, 26.4, 19, 37, 2.2)}{hX(g, -17, 17, 9.2, 10)}{hX(g, -17, 17, 9.2, 17)}{hX(g, -17, 17, 9.2, 22)}{g.box(9.6, 0, 6, 1, 14, 1.4, GLOWS)}{g.box(9.6, 0, 13.4, 1, 14, 1.4, GLOWS)}{g.box(9.6, 0, 19.2, 1, 14, 1.4, GLOWS)}{g.box(9.6, 14, 23.6, 1, 2, 1.6, GLOWS)}{g.box(0, -10, 28.6, 3, 12, 1.4, DARK)}{g.cyl(2, 8, 28.6, 1.6, 1.4, { top: INK })}</g> },
  armorstand: { u: 0.5, v: 0.55, face: 'y', art: (g) => <g>{g.cyl(0, 0, 0, 18, 2, DARK)}{g.box(0, -6, 2, 3, 3, 34, DARK)}{g.box(-5, 0, 2, 7, 8, 13, UPH)}{g.box(5, 0, 2, 7, 8, 13, UPH)}{soft(g, -5, 1, 15, 8, 9, 5, APPL)}{soft(g, 5, 1, 15, 8, 9, 5, APPL)}{g.box(0, -2, 18, 20, 5, 16, DARK)}{soft(g, 0, 0, 18, 22, 12, 20, APPL)}{g.box(0, 6.2, 30, 10, 0.8, 4, GLOWS)}{g.box(-14, 0, 20, 7, 8, 18, UPH)}{g.box(14, 0, 20, 7, 8, 18, UPH)}{soft(g, -14, 0, 35, 9, 10, 4, APPL)}{soft(g, 14, 0, 35, 9, 10, 4, APPL)}{soft(g, 0, 0, 38, 11, 10, 11, APPL)}{g.box(0, 5.3, 44, 8, 0.8, 2.2, GLOWS)}</g> },
  craftingtable: { u: 0.6, v: 0.12, face: 'y', art: (g) => <g>{g.box(-25, -8, 0, 4, 4, 20, DARK)}{g.box(25, -8, 0, 4, 4, 20, DARK)}{g.box(-25, 8, 0, 4, 4, 20, DARK)}{g.box(25, 8, 0, 4, 4, 20, DARK)}{g.box(0, 0, 6, 50, 14, 1.6, DARK)}{g.box(-16, 1, 7.6, 10, 8, 4, UPH)}{g.box(4, 0, 7.6, 8, 6, 3, DARK)}{g.box(0, -9, 21, 52, 2, 16, DARK)}{g.box(-18, -7.6, 23, 1, 1, 12, GLOWS)}{g.box(-10, -7.6, 26, 1, 1, 9, GLOWS)}{g.box(-2, -7.6, 22, 1, 1, 13, GLOWS)}{g.box(8, -7.6, 25, 1, 1, 10, GLOWS)}{soft(g, 0, 1, 20, 56, 20, 3, WORKTOP)}{g.cyl(-14, 3, 23, 4.6, 2, { top: INK })}{g.cyl(-14, 3, 25, 1.6, 0.4, { top: '#02130a' })}{g.box(14, 3, 23, 9, 7, 5, DARK)}{g.box(20, 3, 25, 5, 1.4, 1.6, GLOWS)}{g.box(2, 5, 23, 10, 2, 1.4, GLOWS)}</g> },
  // ---- the hallway pieces (one to a hallway) ----
  fishtank: { u: 0.5, v: 0.5, face: 'y', art: (g) => <g>{g.box(0, 0, 0, 22, 12, 9, DARK)}{g.box(0, 0, 9, 22, 12, 15, GLASS_SKIN)}{g.box(0, 0, 9, 20, 10, 8, { top: 'rgba(61,255,138,0.2)', l: 'rgba(61,255,138,0.2)', r: 'rgba(61,255,138,0.2)' })}{leaf(-5, 2, 17, 2.4, 1.2, -20, INK)}{leaf(4, 0, 19, 2.4, 1.2, 15, INK)}{sprig(-8, -3, 9, 9)}{sprig(7, -2, 9, 7)}{g.box(0, 0, 24, 22, 12, 1.6, DARK)}</g> },
  weaponrack: { u: 0.5, v: 0.5, face: 'y', art: (g) => <g>{g.box(0, -3, 0, 24, 3, 30, DARK)}{g.box(0, 0, 21, 22, 1.8, 1.8)}{g.box(-1, 0, 22.8, 18, 1.6, 2.4, DARK)}{g.box(-9, 0, 20, 6, 1.8, 3.4)}{g.box(0, 0, 11, 22, 1.8, 1.8)}{g.box(1, 0, 12.8, 16, 1.6, 2.4, DARK)}{g.box(9, 0, 10, 6, 1.8, 3.4)}{g.box(-9, 0, 2, 3.4, 2.4, 5, DARK)}{g.box(9, 0, 2, 3.4, 2.4, 5, DARK)}</g> },
  statue: { u: 0.5, v: 0.5, face: 'y', art: (g) => <g>{g.box(0, 0, 0, 16, 16, 11)}{g.box(0, 0, 11, 14, 14, 2, DARK)}{g.box(0, 0, 13, 7, 5, 14)}{g.cyl(0, 0, 27, 3.6, 5)}{g.box(5.5, 0, 22, 3, 3, 9)}{g.box(-5, 0, 14, 2.4, 3, 11)}{g.box(-1.6, 0, 13, 3, 3, 3)}{g.box(1.6, 0, 13, 3, 3, 3)}</g> },
  plant: { u: 0.5, v: 0.5, face: 'y', art: (g) => <g>{g.cyl(0, 0, 0, 7, 9, DARK)}{g.cyl(0, 0, 9, 6, 1.2, { top: '#0a3a1c', l: '#06280f', r: '#041c0b' })}{g.box(0, 0, 10, 2, 2, 14, DARK)}{leaf(0, 0, 27, 9, 7, 0, DIM)}{leaf(-6, 1, 23, 6, 4.4, -25, INK)}{leaf(6, 1, 24, 6, 4.4, 25, INK)}{leaf(0, 0, 33, 6, 4.6, 0, INK)}{leaf(-3, 0, 20, 5, 3.6, -40, DIM)}{leaf(4, 0, 19, 5, 3.6, 40, DIM)}</g> },
  // ---- the garden: three crops, some in raised planters, some in the ground ----
  corn: { u: 0.27, v: 0.3, face: 'y', art: (g) => <g>{[-13, 13].map((cy) => <g key={`cp${cy}`}>{g.box(0, cy, 0, 64, 16, 9, { top: '#0a2a12', l: '#0a3a1c', r: '#06280f' })}{g.box(0, cy, 9, 60, 12, 0.8, { top: '#052008' })}{[-24, -12, 0, 12, 24].map((cx) => cornStalk(cx, cy, 9, cx % 5 === 0 ? 33 : 38))}</g>)}</g> },
  tatoes: { u: 0.5, v: 0.74, face: 'y', art: (g) => <g>{[-18, 0, 18].map((cy) => <g key={`tr${cy}`}>{g.flat([[-34, cy - 6, 0.4], [34, cy - 6, 0.4], [34, cy + 6, 0.4], [-34, cy + 6, 0.4]], '#0a2a12')}{[-26, -13, 0, 13, 26].map((cx) => tatoPlant(cx, cy))}</g>)}</g> },
  mutfruit: { u: 0.74, v: 0.3, face: 'y', art: (g) => <g>{[-22, 22].map((cx) => <g key={`mp${cx}`}>{g.cyl(cx, 0, 0, 16, 9, { top: '#0a2a12', l: '#0a3a1c', r: '#06280f' })}{g.cyl(cx, 0, 9, 2.4, 14, { top: '#117a3c', l: '#0a5a28', r: '#06401c' })}{mutfruitBush(cx, 0, 23)}</g>)}</g> },
  // ---- the study ----
  bookshelf: { u: 0.1, v: 0.5, face: 'x', art: (g) => <g>{g.box(0, 0, 0, 12, 38, 52)}{g.box(1.2, 0, 3, 9.6, 34, 1, DARK)}{g.box(1.2, 0, 19, 9.6, 34, 1, DARK)}{g.box(1.2, 0, 35, 9.6, 34, 1, DARK)}{[0, 1, 2].map((row) => [-15, -11, -7, -3.2, 0.8, 5, 9, 13].map((y, i) => <g key={`bk${row}-${i}`}>{g.box(1.6, y, 4 + row * 16, 7.6, 3.2, 10 + ((i + row) % 3) * 1.8, i % 3 === 0 ? { top: INK, l: '#19a050', r: '#117a3c' } : i % 3 === 1 ? { top: DIM, l: '#0a5a28', r: '#06401c' } : DARK)}</g>))}{g.box(0, 0, 52, 12, 38, 1.6)}</g> },
  desk: { u: 0.5, v: 0.08, face: 'y', art: (g) => <g>{[-23, 23].flatMap((cx) => [-8, 8].map((cy) => <g key={`dl${cx}${cy}`}>{g.box(cx, cy, 0, 3, 3, 15, DARK)}</g>))}{g.box(0, 0, 15, 54, 22, 3)}{g.box(18, 0, 3, 14, 19, 12, { top: '#0a3a1c', l: '#0a4a22', r: '#063018' })}{g.box(18.6, 9.8, 8, 8, 1, 1.6, { top: INK, l: INK, r: INK })}{g.box(-10, -4, 18, 18, 2, 12, DARK)}{g.box(-10, -4, 18, 5, 4, 2, DARK)}{g.flat([[-17, -2.9, 19.5], [-3, -2.9, 19.5], [-3, -2.9, 28.5], [-17, -2.9, 28.5]], SCREEN)}{g.box(10, 2, 18, 11, 8, 2.6)}{g.box(10, 2, 20.6, 9, 7, 2.2, DARK)}{g.cyl(-22, 5, 18, 3.4, 1.6, DARK)}{g.box(-22, 5, 19.4, 1.4, 1.4, 11, DARK)}{g.cyl(-22, 5, 30, 4, 4, { top: INK, l: DIM, r: '#0c6b30' })}{chair(g, 0, 24, -1)}</g> },
  guitar: { u: 0.1, v: 0.62, face: 'x', art: (g) => <g>{g.box(0, 0, 8, 2.4, 15, 12, { top: '#19a050', l: '#117a3c', r: '#0a5a28' })}{g.box(0, 0, 19, 2.4, 11, 7, { top: '#19a050', l: '#117a3c', r: '#0a5a28' })}{g.box(0, 0, 25, 1.8, 3.4, 24, DARK)}{g.box(0, 0, 49, 2.4, 5, 6, DARK)}{g.flat([[1.4, -2.6, 12], [1.4, 2.6, 12], [1.4, 3.4, 15], [1.4, 2.6, 18], [1.4, -2.6, 18], [1.4, -3.4, 15]], '#02130a')}{g.box(1, 0, 8.6, 1, 8, 1.4, DARK)}</g> },
  easel: { u: 0.8, v: 0.42, face: 'y', art: (g) => <g>{g.box(-11, 7, 0, 2, 2, 42, DARK)}{g.box(11, 7, 0, 2, 2, 42, DARK)}{g.box(0, -8, 0, 2, 2, 40, DARK)}{g.box(0, 2, 14, 28, 4, 2.4, DARK)}{g.box(0, 2.4, 16, 26, 1.8, 28, { top: '#117a3c', l: '#0e6a32', r: '#084d24' })}{g.flat([[-10, 3.4, 19], [10, 3.4, 19], [10, 3.4, 40], [-10, 3.4, 40]], 'rgba(61,255,138,0.12)')}{g.flat([[-10, 3.5, 19], [-3, 3.5, 30], [3, 3.5, 24], [10, 3.5, 33], [10, 3.5, 19]], 'rgba(61,255,138,0.55)')}{g.flat([[4, 3.5, 34], [8, 3.5, 34], [8, 3.5, 38], [4, 3.5, 38]], INK)}{g.cyl(15, 6, 0, 2.6, 5, { top: INK, l: DIM, r: '#0c6b30' })}{g.cyl(-15, 8, 0, 2.2, 4.4, { top: INK, l: DIM, r: '#0c6b30' })}</g> },
  // ---- the study's instrument: a wall mount until it is chosen, then a guitar (on the wall), a piano, a harp or a drum set ----
  instrument: { u: 0.1, v: 0.62, face: 'x', art: (g) => <g>{g.box(0, 0, 14, 1.8, 18, 20, DARK)}{g.box(1.4, 0, 22, 1.2, 12, 1.4, { top: INK, l: INK, r: INK })}{g.box(1.4, 0, 30, 1.2, 12, 1.4, { top: INK, l: INK, r: INK })}</g> },
  piano: { u: 0.76, v: 0.5, face: 'y', art: (g) => {
    // a baby grand: the keyboard along the front, a straight left side, and the curve of the bent side tapering to the tail
    const wing: [number, number][] = [[-23, 14], [-23, -26], [-6, -26], [3, -22], [11, -15], [18, -6], [22, 3], [23, 14]];
    const sides: ReactElement[] = [];
    wing.forEach(([x, y], i) => {
      const [x2, y2] = wing[(i + 1) % wing.length];
      const nx = Math.sign(y2 - y);
      const ny = -Math.sign(x2 - x);
      if (nx > 0 || ny > 0) sides.push(g.flat([[x, y, 14], [x2, y2, 14], [x2, y2, 26], [x, y, 26]], nx > 0 ? '#0a4a22' : '#063018'));
    });
    return (
      <g>
        {g.box(-20, 10, 0, 3.4, 3.4, 14, DARK)}{g.box(20, 10, 0, 3.4, 3.4, 14, DARK)}{g.box(-8, -22, 0, 3.4, 3.4, 14, DARK)}
        {g.box(0, 12, 3, 1.4, 1.4, 11, DARK)}{g.box(0, 12, 1.4, 8, 3, 1.6, DARK)}
        {g.flat([...wing.map(([x, y]) => [x, y, 14] as [number, number, number])], '#021a0c')}
        {sides}
        {g.flat(wing.map(([x, y]) => [x, y, 26] as [number, number, number]), '#117a3c')}
        {g.flat([[-19, -22, 26.2], [-8, -22, 26.2], [6, -14, 26.2], [16, -4, 26.2], [19, 4, 26.2], [-19, 4, 26.2]], 'rgba(61,255,138,0.2)')}
        {g.box(0, 15.6, 20, 42, 4.4, 2.4, DARK)}
        {g.flat([[-19, 13.6, 22.5], [19, 13.6, 22.5], [19, 17.4, 22.5], [-19, 17.4, 22.5]], 'rgba(61,255,138,0.75)')}
        {[-15, -11, -4, 0, 4, 11, 15].map((x) => <g key={`bk${x}`}>{g.box(x, 14.8, 22.5, 1.6, 2.4, 1.2, DARK)}</g>)}
        {g.box(0, 9, 26, 15, 1.4, 8, DARK)}
        {g.box(0, 29, 7, 24, 9, 2.6, { top: '#117a3c', l: '#0a5a28', r: '#06401c' })}{g.box(-10, 27, 0, 2, 2, 7, DARK)}{g.box(10, 27, 0, 2, 2, 7, DARK)}{g.box(-10, 31, 0, 2, 2, 7, DARK)}{g.box(10, 31, 0, 2, 2, 7, DARK)}
      </g>
    );
  } },
  harp: { u: 0.8, v: 0.55, face: 'y', art: (g) => <g>{g.box(0, 0, 0, 22, 12, 4, DARK)}{g.box(-9, 0, 4, 3.2, 3.2, 46)}{g.box(9, 0, 4, 5, 8, 34)}{g.box(0, 0, 47, 24, 5, 3.4)}{[-6, -3, 0, 3, 6].map((x) => <g key={`st${x}`}>{g.flat([[x - 0.3, 0, 12 + x * 0.4], [x + 0.3, 0, 12 + x * 0.4], [x + 0.3, 0, 46], [x - 0.3, 0, 46]], INK)}</g>)}</g> },
  drums: { u: 0.8, v: 0.6, face: 'y', art: (g) => <g>{g.box(0, -6, 0, 20, 16, 16)}{g.box(0, -6, 16, 20, 16, 1.4, { top: INK, l: INK, r: INK })}{g.cyl(-9, -4, 17, 5, 5)}{g.cyl(9, -4, 17, 5, 5)}{g.cyl(-2, 9, 13, 6, 4)}{g.box(-18, -2, 0, 1, 1, 34, DARK)}{g.cyl(-18, -2, 34, 7.5, 0.8, { top: INK, l: DIM, r: DIM })}{g.box(18, 4, 0, 1, 1, 26, DARK)}{g.cyl(18, 4, 26, 5.5, 0.8, { top: INK, l: DIM, r: DIM })}{g.cyl(0, 20, 0, 4, 9, DARK)}</g> },
};

/** The pieces that can be sat on or lain on, and how far a settler is lifted off the floor on them. */
export const LIFT: Record<string, number> = { desk: 6, couch: 6, armchair: 6, chairs: 6, seating: 7, bar: 12, bed: 12 };
export const SIT = new Set(['couch', 'armchair', 'chairs', 'seating', 'bar', 'desk']);
export const LIE = new Set(['bed']);

/** Where a piece stands in the world (its middle, on the floor). */
/** How big a piece is drawn in this room: a bit smaller in a small room, and 15% smaller than it was. */
export function pieceScale(room: { type: RoomType; col: number; row: number }): number {
  if (room.type === 'hallway') return 0.78;
  const box = roomRect(room);
  const fit = Math.min(box.w / (roomDef(room.type).slots * CELL), box.d / CELL);
  return (isSmall(room.type) ? Math.min(0.78, 0.36 + fit * 0.7) : Math.min(1, 0.38 + fit * 0.66)) * 0.78;
}

const stretch = (k: number): number => Math.max(0, Math.min(1, 0.5 + (k - 0.5) * 1.22));
/** How far each piece reaches along the wall it stands against, from its middle (in its own units). */
const HALF: Record<string, number> = {
  coatrack: 6, shoebench: 17, decon: 13, couch: 27, tv: 18, lamp: 7, chinacabinet: 18, sinkcabinets: 30, fridge: 12, stove: 14, nightstand: 8, dresser: 20, toilet: 8, bathsink: 12,
  washer: 12, dryer: 12, bookshelf: 19, desk: 27, guitar: 8, instrument: 9, piano: 26, screen: 50, speakers: 8, bar: 38, pinball: 14, toolchest: 18, craftingtable: 28,
};
/** The doorways of a room (see doorsOf): heights (y) along the left back wall and positions (x) along the right one. */
export interface Doors { doorsL: number[]; doorsR: number[] }

/** Slides a piece along its wall until it is clear of every doorway (the nearest free spot); if there is none it stays where it is. */
function clearOfDoors(t: number, lo: number, hi: number, doors: number[], half: number): number {
  const need = half + 18;
  const blocked = (x: number) => doors.some((c) => Math.abs(x - c) < need);
  if (!blocked(t)) return t;
  const tries = doors.flatMap((c) => [c - need - 1, c + need + 1]).filter((x) => x >= lo && x <= hi && !blocked(x));
  if (tries.length === 0) return t;
  return tries.reduce((best, x) => (Math.abs(x - t) < Math.abs(best - t) ? x : best));
}

/** Where a piece stands: against its wall, but not in front of a doorway (the layout changes when a room is built next to this one and a doorway appears). */
export function pieceAt(room: VaultRoom, id: string, doors?: Doors): { x: number; y: number } | null {
  const p = FURNITURE[id];
  if (!p) return null;
  if (room.type === 'hallway') { const r = roomRect(room); return { x: r.xc ?? r.x + r.w / 2, y: r.yc ?? r.y + r.d / 2 }; }
  // the pieces stand against the walls, closer in than the open floor spots people walk to
  const pt = floorPoint(room, stretch(p.u), stretch(p.v), 8);
  const rect = roomRect(room);
  // a piece that belongs to a wall stands right against it: its back edge a hair from the wall
  const k = pieceScale(room);
  if (p.face === 'x' && p.u <= 0.25) pt.x = rect.x + backOf(id, 'x') * k + 1.2;
  if (p.face === 'y' && p.v <= 0.25) pt.y = rect.y + backOf(id, 'y') * k + 1.2;
  if (!doors) return pt;
  const half = (HALF[id] ?? 14) * pieceScale(room);
  if (p.face === 'x' && p.u <= 0.15 && doors.doorsL.length) pt.y = clearOfDoors(pt.y, rect.y + half + 4, rect.y + rect.d - half - 4, doors.doorsL, half);
  if (p.face === 'y' && p.v <= 0.22 && doors.doorsR.length) pt.x = clearOfDoors(pt.x, rect.x + half + 4, rect.x + rect.w - half - 4, doors.doorsR, half);
  return pt;
}

// ---- where the furniture goes: around the doors ----

interface Foot { x0: number; x1: number; y0: number; y1: number }
const footCache = new Map<string, Foot>();
/** The floor space a piece takes, from its middle, in its own units: found by running its drawing once against a recorder. */
function footOf(id: string): Foot {
  const hit = footCache.get(id);
  if (hit) return hit;
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  const see = (ax: number, ay: number) => { x0 = Math.min(x0, ax); x1 = Math.max(x1, ax); y0 = Math.min(y0, ay); y1 = Math.max(y1, ay); };
  const rec: G = {
    box: (cx, cy, _z, w, d) => { see(cx - w / 2, cy - d / 2); see(cx + w / 2, cy + d / 2); return null as unknown as ReactElement; },
    cyl: (cx, cy, _z, r) => { see(cx - r, cy - r); see(cx + r, cy + r); return null as unknown as ReactElement; },
    flat: (points) => { for (const [x, y] of points) see(x, y); return null as unknown as ReactElement; },
  };
  try { FURNITURE[id]?.art(rec); } catch { /* a piece drawn with its own svg: the default below */ }
  const foot: Foot = Number.isFinite(x0) ? { x0, x1, y0, y1 } : { x0: -10, x1: 10, y0: -10, y1: 10 };
  footCache.set(id, foot);
  return foot;
}
/** How far the back of a piece (the side against its wall) is behind its middle, in its own units. */
const backOf = (id: string, axis: 'x' | 'y'): number => Math.max(1, -(axis === 'x' ? footOf(id).x0 : footOf(id).y0));

const overlaps = (a: Rect, b: Rect, pad = 0): boolean => a.x < b.x + b.w + pad && a.x + a.w + pad > b.x && a.y < b.y + b.d + pad && a.y + a.d + pad > b.y;
const overlapArea = (a: Rect, b: Rect): number => Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.d, b.y + b.d) - Math.max(a.y, b.y));
export type Spot = { x: number; y: number; /** Drawn turned a quarter (its back to the other back wall). */ swap?: boolean };
/** Pieces drawn around another one (so they move with it). */
const ANCHORED: Record<string, string> = { chairs: 'table', chandelier: 'table' };
const layoutCache = new Map<string, Map<string, Spot>>();
/** A neighbor's wall hides this much of the stretch next to it (for the low pieces along a wall). */
const HIDDEN_BAND = 34;

/**
 * Where each piece of a room stands, worked out around where the doors are: the pieces that belong to a wall slide along it out of the doorway's way (and out of
 * each other's), or move to the other wall if theirs has no room; the ones for the middle of the room (the table, the bed, the plants, a couch) find a spot that
 * keeps a clear lane from every door to the middle, out of the stretch that a neighbor's wall hides from view, away from the hole of a stairwell. It all runs
 * again when a room is built next door. A hallway's piece stands against its wall.
 */
export function layoutOf(room: VaultRoom, at: (col: number, row: number) => VaultRoom | undefined, hasHole = false): Map<string, Spot> {
  const rect = roomRect(room);
  const out = new Map<string, Spot>();
  if (room.type === 'hallway') {
    const sh = hallwayShape({ col: room.col, row: room.row, level: room.level });
    const cx = rect.xc ?? rect.x + rect.w / 2;
    const cy = rect.yc ?? rect.y + rect.d / 2;
    const k = pieceScale(room);
    const topOpen = sh.nb.b || (sh.nb.f && !sh.nb.l && !sh.nb.r); // the top of the middle square is a wall unless a corridor runs that way
    const leftOpen = sh.nb.l || (sh.nb.r && !sh.nb.b && !sh.nb.f);
    for (const id of room.furniture) {
      if (!topOpen) out.set(id, { x: cx, y: cy - HALL_W / 2 + backOf(id, 'y') * k + 1.2 });
      else if (!leftOpen) out.set(id, { x: cx - HALL_W / 2 + backOf(id, 'y') * k + 1.2, y: cy, swap: true });
      else out.set(id, { x: cx, y: cy });
    }
    return out;
  }
  const slots = roomDef(room.type).slots;
  const doors = doorsOf(room, at);
  const rightN = at(room.col + slots, room.row);
  let frontN: VaultRoom | undefined;
  for (let i = 0; i < slots && !frontN; i++) frontN = at(room.col + i, room.row + 1);
  const mid = (a: number, b: number, c: number, d: number) => (Math.max(a, c) + Math.min(b, d)) / 2;
  const rightY = rightN ? (roomRect(rightN).yc ?? mid(rect.y, rect.y + rect.d, roomRect(rightN).y, roomRect(rightN).y + roomRect(rightN).d)) : 0;
  const frontX = frontN ? (roomRect(frontN).xc ?? mid(rect.x, rect.x + rect.w, roomRect(frontN).x, roomRect(frontN).x + roomRect(frontN).w)) : 0;
  const key = [room.type, room.col, room.row, room.level, room.furniture.join(','), JSON.stringify(room.put ?? null), doors.doorsL.join(','), doors.doorsR.join(','), Math.round(rightY), Math.round(frontX), hasHole ? 1 : 0].join('|');
  const hit = layoutCache.get(key);
  if (hit) return hit;
  if (layoutCache.size > 400) layoutCache.clear();

  const k = pieceScale(room);
  const shape = shapeOf(room);
  const cx = rect.x + rect.w / 2;
  const cy = rect.y + rect.d / 2;
  const LANE = 17;
  const blocked: Rect[] = [];
  doors.doorsL.forEach((c) => blocked.push({ x: rect.x, y: c - LANE, w: cx - rect.x, d: 2 * LANE }));
  doors.doorsR.forEach((c) => blocked.push({ x: c - LANE, y: rect.y, w: 2 * LANE, d: cy - rect.y }));
  if (rightN) blocked.push({ x: cx, y: rightY - LANE, w: rect.x + rect.w - cx, d: 2 * LANE });
  if (frontN) blocked.push({ x: frontX - LANE, y: cy, w: 2 * LANE, d: rect.y + rect.d - cy });
  if (hasHole) { const h = holeRect({ type: room.type, col: room.col, row: room.row, furniture: room.furniture }); blocked.push({ x: h.x - 5, y: h.y - 5, w: h.w + 10, d: h.d + 10 }); }
  if (shape.notch) blocked.push(shape.notch);
  // the stretch along a neighbor's wall can be hidden by it: keep the middle-of-the-room pieces out of it
  const maxX = rightN ? rect.x + rect.w * 0.62 : rect.x + rect.w;
  const maxY = frontN ? rect.y + rect.d * 0.62 : rect.y + rect.d;

  const ids = room.furniture.filter((id) => FURNITURE[id]);
  // a piece's footprint at a spot; the ones drawn around it (a table's chairs) count too
  const feet = (id: string): Foot => {
    const f = { ...footOf(id) };
    for (const other of ids) if (ANCHORED[other] === id) { const g = footOf(other); f.x0 = Math.min(f.x0, g.x0); f.x1 = Math.max(f.x1, g.x1); f.y0 = Math.min(f.y0, g.y0); f.y1 = Math.max(f.y1, g.y1); }
    return f;
  };
  const box = (f: Foot, x: number, y: number): Rect => ({ x: x + f.x0 * k, y: y + f.y0 * k, w: (f.x1 - f.x0) * k, d: (f.y1 - f.y0) * k });
  const placed: Rect[] = [];
  const cost = (r: Rect) => blocked.reduce((n, b) => n + overlapArea(r, b), 0) * 4 + placed.reduce((n, b) => n + (overlaps(r, b, 3) ? 400 + overlapArea(r, b) * 8 : 0), 0);
  const turned = (f: Foot): Foot => ({ x0: f.y0, x1: f.y1, y0: f.x0, y1: f.x1 });
  const isLeftWall = (id: string) => FURNITURE[id].face === 'x' && FURNITURE[id].u <= 0.25;
  const isRightWall = (id: string) => FURNITURE[id].face === 'y' && FURNITURE[id].v <= 0.25;
  const manual = room.put ?? {};
  const lead = ids.filter((id) => !ANCHORED[id] && !manual[id]);
  const order = [...lead.filter(isLeftWall), ...lead.filter(isRightWall), ...lead.filter((id) => !isLeftWall(id) && !isRightWall(id))];
  // what the owner has put down stays where it was put (the rest is laid out around it)
  for (const id of ids) {
    const m = manual[id];
    if (!m || ANCHORED[id]) continue;
    const spot: Spot = { x: rect.x + m.u * rect.w, y: rect.y + m.v * rect.d, ...(m.swap ? { swap: true } : {}) };
    out.set(id, spot);
    placed.push(box(m.swap ? turned(feet(id)) : feet(id), spot.x, spot.y));
  }

  /** The best spot along a wall for a piece: its cost (0 is a clean fit) and where. */
  const alongWall = (id: string, wall: 'L' | 'R', swap: boolean, wantAlong: number): { cost: number; spot: Spot } => {
    const f0 = feet(id);
    const f = swap ? turned(f0) : f0;
    let best = { cost: Infinity, dist: Infinity, spot: { x: cx, y: cy } as Spot };
    if (wall === 'L') {
      const x = rect.x - f.x0 * k + 1.2;
      const lo = rect.y - f.y0 * k + 3;
      const hi = (frontN ? rect.y + rect.d - HIDDEN_BAND : rect.y + rect.d - 3) - f.y1 * k;
      for (let y = lo; y <= Math.max(lo, hi); y += 2) {
        const c = cost(box(f, x, y));
        const dist = Math.abs(y - wantAlong);
        if (c < best.cost || (c === best.cost && dist < best.dist)) best = { cost: c, dist, spot: { x, y, ...(swap ? { swap: true } : {}) } };
      }
    } else {
      const y = rect.y - f.y0 * k + 1.2;
      const lo = rect.x - f.x0 * k + 3;
      const hi = (rightN ? rect.x + rect.w - HIDDEN_BAND : rect.x + rect.w - 3) - f.x1 * k;
      for (let x = lo; x <= Math.max(lo, hi); x += 2) {
        const c = cost(box(f, x, y));
        const dist = Math.abs(x - wantAlong);
        if (c < best.cost || (c === best.cost && dist < best.dist)) best = { cost: c, dist, spot: { x, y, ...(swap ? { swap: true } : {}) } };
      }
    }
    return { cost: best.cost, spot: best.spot };
  };

  for (const id of order) {
    const p = FURNITURE[id];
    const f = feet(id);
    const want = floorPoint(room, stretch(p.u), stretch(p.v), 8);
    let final: Spot | null = null;
    let footUsed: Foot = f;
    if (isLeftWall(id) || isRightWall(id)) {
      const own: 'L' | 'R' = isLeftWall(id) ? 'L' : 'R';
      const mine = alongWall(id, own, false, own === 'L' ? want.y : want.x);
      let pick = mine;
      let swapped = false;
      if (mine.cost > 0) {
        // no clean fit on its own wall: the other wall, with the piece turned to stand against it
        const other = alongWall(id, own === 'L' ? 'R' : 'L', true, own === 'L' ? cx : cy);
        if (other.cost < mine.cost) { pick = other; swapped = true; }
      }
      final = pick.spot;
      footUsed = swapped ? turned(f) : f;
    } else {
      // the middle of the room: the free spot nearest to where it would like to be
      const x0 = rect.x - f.x0 * k + 6;
      const x1 = Math.min(maxX, rect.x + rect.w) - f.x1 * k - 6;
      const y0 = rect.y - f.y0 * k + 6;
      const y1 = Math.min(maxY, rect.y + rect.d) - f.y1 * k - 6;
      let best = { cost: Infinity, dist: Infinity };
      for (let x = x0; x <= Math.max(x0, x1); x += 5) for (let y = y0; y <= Math.max(y0, y1); y += 5) {
        const c = cost(box(f, x, y));
        const dist = (x - want.x) ** 2 + (y - want.y) ** 2;
        if (c < best.cost || (c === best.cost && dist < best.dist)) { best = { cost: c, dist }; final = { x, y }; }
      }
    }
    const spot = final ?? want;
    out.set(id, spot);
    placed.push(box(footUsed, spot.x, spot.y));
  }
  // what is drawn around another piece goes where that one went
  for (const id of ids) {
    const anchor = ANCHORED[id];
    if (!anchor) continue;
    out.set(id, out.get(anchor) ?? { x: cx, y: cy });
  }
  layoutCache.set(key, out);
  return out;
}

/** The lanes that have to stay clear on a room's floor: from each doorway to the middle of the room. */
function lanesOf(room: VaultRoom, at: (col: number, row: number) => VaultRoom | undefined): Rect[] {
  const rect = roomRect(room);
  const slots = roomDef(room.type).slots;
  const doors = doorsOf(room, at);
  const rightN = at(room.col + slots, room.row);
  let frontN: VaultRoom | undefined;
  for (let i = 0; i < slots && !frontN; i++) frontN = at(room.col + i, room.row + 1);
  const mid = (a: number, b: number, c: number, d: number) => (Math.max(a, c) + Math.min(b, d)) / 2;
  const cx = rect.x + rect.w / 2, cy = rect.y + rect.d / 2;
  const LANE = 17;
  const out: Rect[] = [];
  doors.doorsL.forEach((c) => out.push({ x: rect.x, y: c - LANE, w: cx - rect.x, d: 2 * LANE }));
  doors.doorsR.forEach((c) => out.push({ x: c - LANE, y: rect.y, w: 2 * LANE, d: cy - rect.y }));
  if (rightN) { const r = roomRect(rightN); const y = r.yc ?? mid(rect.y, rect.y + rect.d, r.y, r.y + r.d); out.push({ x: cx, y: y - LANE, w: rect.x + rect.w - cx, d: 2 * LANE }); }
  if (frontN) { const r = roomRect(frontN); const x = r.xc ?? mid(rect.x, rect.x + rect.w, r.x, r.x + r.w); out.push({ x: x - LANE, y: cy, w: 2 * LANE, d: rect.y + rect.d - cy }); }
  return out;
}

/** The floor space of a piece (with what is drawn around it) standing here, in the room's units. */
export function footBox(room: VaultRoom, id: string, x: number, y: number, swap = false): Rect {
  const k = pieceScale(room);
  const f = { ...footOf(id) };
  for (const other of room.furniture) if (ANCHORED[other] === id) { const g = footOf(other); f.x0 = Math.min(f.x0, g.x0); f.x1 = Math.max(f.x1, g.x1); f.y0 = Math.min(f.y0, g.y0); f.y1 = Math.max(f.y1, g.y1); }
  const t = swap ? { x0: f.y0, x1: f.y1, y0: f.x0, y1: f.x1 } : f;
  return { x: x + t.x0 * k, y: y + t.y0 * k, w: (t.x1 - t.x0) * k, d: (t.y1 - t.y0) * k };
}

/** Can this piece stand here? It must be on the floor of its room, clear of every other piece, of the doorways' lanes and of the hole in the floor. */
export function pieceFits(room: VaultRoom, at: (col: number, row: number) => VaultRoom | undefined, hasHole: boolean, id: string, x: number, y: number, swap: boolean): boolean {
  if (room.type === 'hallway') return false;
  const rect = roomRect(room);
  const { notch } = shapeOf(room);
  const b = footBox(room, id, x, y, swap);
  if (b.x < rect.x + 1 || b.y < rect.y + 1 || b.x + b.w > rect.x + rect.w - 1 || b.y + b.d > rect.y + rect.d - 1) return false;
  if (notch && overlaps(b, notch)) return false;
  if (lanesOf(room, at).some((l) => overlapArea(b, l) > 0)) return false;
  if (hasHole) { const h = holeRect({ type: room.type, col: room.col, row: room.row, furniture: room.furniture }); if (overlaps(b, { x: h.x - 3, y: h.y - 3, w: h.w + 6, d: h.d + 6 })) return false; }
  const lay = layoutOf(room, at, hasHole);
  for (const other of room.furniture) {
    if (other === id || ANCHORED[other] === id || ANCHORED[id] === other) continue;
    const spot = lay.get(other);
    if (!spot || !FURNITURE[other]) continue;
    if (overlaps(b, footBox(room, other, spot.x, spot.y, !!spot.swap), 2)) return false;
  }
  return true;
}

/** Where a settler sits on a piece (in the piece's own units, from its middle) and which way they face on the screen (1 looks lower right, -1 lower left). */
export const SEATS: Record<string, { dx: number; dy: number; face: 1 | -1 }[]> = {
  couch: [{ dx: -13, dy: 3, face: -1 }, { dx: 13, dy: 3, face: -1 }],
  armchair: [{ dx: 0, dy: 3, face: -1 }],
  chairs: [{ dx: -14, dy: -26, face: -1 }, { dx: 14, dy: -26, face: -1 }, { dx: -14, dy: 26, face: 1 }, { dx: 14, dy: 26, face: 1 }],
  seating: [{ dx: -32, dy: 4, face: -1 }, { dx: 0, dy: 4, face: -1 }, { dx: 32, dy: 4, face: -1 }],
  bar: [{ dx: -20, dy: 22, face: 1 }, { dx: 0, dy: 22, face: 1 }, { dx: 20, dy: 22, face: 1 }],
  desk: [{ dx: 0, dy: 24, face: 1 }],
};

/** A piece of furniture, in place in its room (the small rooms hold the same things a little smaller). */
export function PlacedPiece({ room, id, fresh, doors, pos }: { room: VaultRoom; id: string; fresh?: boolean; doors?: Doors; pos?: { x: number; y: number; swap?: boolean } }): ReactElement | null {
  const p = FURNITURE[id];
  const at = pos ?? pieceAt(room, id, doors);
  if (!p || !at) return null;
  const [X, Y] = P(at.x, at.y, 0);
  const scale = pieceScale(room);
  keyCount = 0;
  return <g className={fresh ? 'rm-vh-fresh' : undefined} transform={`translate(${X} ${Y}) scale(${scale})`}>{p.art(makeG(!!pos?.swap))}</g>;
}
