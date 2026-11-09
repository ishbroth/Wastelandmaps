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

export const CELL = 120;
export const WALL_H = 54;
export const WALL_T = 6;
/** A small room (the entryway, the bathroom, the laundry room): this wide and deep, in the middle of its cell. */
export const SMALL = 82;
const KX = 0.866;
const KY = 0.5;

/** A point of the world on the screen. */
export const P = (x: number, y: number, z = 0): [number, number] => [(x - y) * KX, (x + y) * KY - z];
type V3 = [number, number, number];
const pts = (list: V3[]): string => list.map(([x, y, z]) => P(x, y, z).map((n) => Math.round(n * 10) / 10).join(',')).join(' ');

export interface Rect { x: number; y: number; w: number; d: number }
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
};
const hashOf = (s: string): number => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0;
  h ^= h >>> 15; h = Math.imul(h, 2246822519) >>> 0; h ^= h >>> 13;
  return h >>> 0;
};
type Pt = [number, number];
export interface Shape { rect: Rect; poly: Pt[]; notch: Rect | null }
/** The footprint of a room: its rect, the outline of its floor, and the notch if it has one. */
export function shapeOf(r: { type: RoomType; col: number; row: number }): Shape {
  const def = roomDef(r.type);
  const list = VARIANTS[r.type];
  const cx = r.col * CELL;
  const cy = r.row * CELL;
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
  entry: { wall: 'panels', floor: 'tiles' },
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

/**
 * A room: its floor (the shape of this room), the inside of its two back walls, the thick tops of those walls, and the edge of the floor slab at the front. `doorsL`
 * are the heights (y) of the doorways in the left back wall, `doorsR` the positions (x) of those in the right back wall. The walls are vault walls: molded steel with
 * a baseboard and rivets, a rounded corner post, piping and conduit, a fake window or two, and the odd poster.
 */
export function RoomShell({ rect, name, type, col, row, doorsL, doorsR }: { rect: Rect; name: string; type: RoomType; col: number; row: number; doorsL: number[]; doorsR: number[] }): ReactElement {
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
  const [lx, ly] = P(x - T, y - T, H + 13);
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
      {/* the inside of the left back wall, and of the right one */}
      <Poly p={[[x, y, 0], [x, y1, 0], [x, y1, H], [x, y, H]]} fill={FACE_L} />
      {wallL}
      <Poly p={[[x, y, 0], [x1, y, 0], [x1, y, H], [x, y, H]]} fill={FACE_R} />
      {wallR}
      {doorsL.map((c) => door(true, c))}
      {doorsR.map((c) => door(false, c))}
      {/* the thick tops of the walls, rounded off, and the molded post in the corner */}
      <Poly p={[[x, y, H], [x, y1, H], [x - T, y1, H], [x - T, y, H]]} fill={CAP} sw={2} />
      <Poly p={[[x, y, H], [x1, y, H], [x1, y - T, H], [x, y - T, H]]} fill={CAP} sw={2} />
      <Poly p={[[x, y, H], [x - T, y, H], [x - T, y - T, H], [x, y - T, H]]} fill={CAP} sw={2} />
      <line x1={P(x, y, 1)[0]} y1={P(x, y, 1)[1]} x2={P(x, y, H)[0]} y2={P(x, y, H)[1]} stroke={INK} strokeWidth="4.6" strokeLinecap="round" opacity="0.35" />
      <line x1={P(x, y, 3)[0]} y1={P(x, y, 3)[1]} x2={P(x, y, H - 2)[0]} y2={P(x, y, H - 2)[1]} stroke={CAP} strokeWidth="2.6" strokeLinecap="round" />
      <text x={lx} y={ly} fontSize="14" textAnchor="middle" fill={INK} stroke={BG} strokeWidth="3" paintOrder="stroke" fontFamily="'VT323', monospace" letterSpacing="1">{name}</text>
    </g>
  );
}

/** A room that could be built here: a faded outline of one, with a plus. */
export function RoomOutline({ rect, label, plain = false, near }: { rect: Rect; label: string; plain?: boolean; /** The side that touches a built room (the outline is clearest there and fades into the dark away from it). */ near?: 'left' | 'right' | 'back' | 'front' }): ReactElement {
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
      {!plain && <text x={cx} y={cy - 2} fontSize="34" textAnchor="middle" fill={INK} stroke="none" strokeDasharray="none" opacity="0.55" fontFamily="'VT323', monospace">+</text>}
      {!plain && <text x={cx} y={cy + 16} fontSize="14" textAnchor="middle" fill={INK} stroke="none" strokeDasharray="none" opacity="0.55" fontFamily="'VT323', monospace" letterSpacing="1.5">{label}</text>}
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
  const yc = (Math.max(left.y, right.y) + Math.min(left.y + left.d, right.y + right.d)) / 2;
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
  const xc = (Math.max(back.x, front.x) + Math.min(back.x + back.w, front.x + front.w)) / 2;
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
  if (left) { const l = roomRect(left); doorsL.push((Math.max(me.y, l.y) + Math.min(me.y + me.d, l.y + l.d)) / 2); }
  for (let c = room.col; c < room.col + slots; c++) {
    const back = at(c, room.row - 1);
    if (!back) continue;
    const b = roomRect(back);
    const lo = Math.max(me.x, b.x, c * CELL);
    const hi = Math.min(me.x + me.w, b.x + b.w, (c + 1) * CELL);
    doorsR.push((lo + hi) / 2);
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
/** A chair at (cx, cy); `dir` is the way it faces along y (1: toward +y, with its back on the -y side; -1: the other way round). */
const chair = (g: G, cx: number, cy: number, dir = 1) => <g key={`ch${cx}-${cy}`}>{g.box(cx - 5, cy - 4, 0, 2, 2, 6, DARK)}{g.box(cx + 5, cy - 4, 0, 2, 2, 6, DARK)}{dir > 0 && g.box(cx, cy - 6, 6, 12, 2.5, 17)}{g.box(cx, cy, 6, 12, 12, 3)}{dir < 0 && g.box(cx, cy + 6, 6, 12, 2.5, 17)}{g.box(cx - 5, cy + 4, 0, 2, 2, 6, DARK)}{g.box(cx + 5, cy + 4, 0, 2, 2, 6, DARK)}</g>;

/** Where each piece of furniture stands in its room (u across, v deep), which wall it faces from, and what it is made of. */
export const FURNITURE: Record<string, Piece> = {
  coatrack: { u: 0.1, v: 0.22, face: 'x', art: (g) => <g>{g.cyl(0, 0, 0, 5, 2, DARK)}{g.box(0, 0, 2, 2.4, 2.4, 40)}{g.box(4, 0, 34, 7, 1.8, 1.8)}{g.box(-4, 0, 30, 7, 1.8, 1.8)}{g.box(5, 0, 12, 7, 6, 20, { top: DIM })}</g> },
  shoebench: { u: 0.1, v: 0.62, face: 'x', art: (g) => <g>{g.box(0, 0, 0, 12, 34, 12)}{g.box(0, -9, 12, 8, 6, 3, DARK)}{g.box(0, 2, 12, 8, 6, 3, DARK)}{g.box(0, 12, 12, 7, 5, 3, DARK)}</g> },
  decon: { u: 0.72, v: 0.14, face: 'y', art: (g) => <g>{g.box(0, 0, 0, 26, 26, 2, DARK)}{g.box(0, 0, 2, 26, 26, 46, GLASS_SKIN)}{g.box(0, -7, 46, 10, 10, 3)}{g.box(0, -7, 28, 1.4, 1.4, 18, DARK)}{g.box(-5, -2, 8, 1, 1, 14, { top: INK, l: INK, r: INK })}{g.box(5, -2, 8, 1, 1, 14, { top: INK, l: INK, r: INK })}</g> },
  couch: { u: 0.5, v: 0.2, face: 'y', art: (g) => <g>{g.box(0, -10, 0, 54, 6, 28)}{g.box(0, 1, 0, 54, 18, 10)}{g.box(0, 2, 10, 40, 14, 3, { top: DIM })}{g.box(-24, 1, 10, 6, 18, 9)}{g.box(24, 1, 10, 6, 18, 9)}</g> },
  tv: { u: 0.1, v: 0.5, face: 'x', art: (g) => <g>{g.box(0, 0, 0, 12, 36, 10, DARK)}{g.box(-1, 0, 10, 4, 32, 22, DARK)}{g.flat([[1.4, -14, 12], [1.4, 14, 12], [1.4, 14, 30], [1.4, -14, 30]], SCREEN)}</g> },
  armchair: { u: 0.78, v: 0.62, face: 'y', art: (g) => <g>{g.box(0, -9, 0, 26, 5, 26)}{g.box(0, 1, 0, 26, 18, 10)}{g.box(0, 2, 10, 16, 14, 3, { top: DIM })}{g.box(-10, 1, 10, 5, 18, 8)}{g.box(10, 1, 10, 5, 18, 8)}</g> },
  coffeetable: { u: 0.5, v: 0.62, face: 'y', art: (g) => <g>{g.box(-12, -6, 0, 2, 2, 8, DARK)}{g.box(12, -6, 0, 2, 2, 8, DARK)}{g.box(-12, 6, 0, 2, 2, 8, DARK)}{g.box(12, 6, 0, 2, 2, 8, DARK)}{g.box(0, 0, 8, 30, 18, 3)}</g> },
  table: { u: 0.5, v: 0.5, face: 'y', art: (g) => <g>{g.box(-24, -12, 0, 3, 3, 16, DARK)}{g.box(24, -12, 0, 3, 3, 16, DARK)}{g.box(-24, 12, 0, 3, 3, 16, DARK)}{g.box(24, 12, 0, 3, 3, 16, DARK)}{g.box(0, 0, 16, 56, 32, 3)}</g> },
  chairs: { u: 0.5, v: 0.5, face: 'y', art: (g) => <g>{chair(g, -14, -26, 1)}{chair(g, 14, -26, 1)}{chair(g, -14, 26, -1)}{chair(g, 14, 26, -1)}</g> },
  chandelier: { u: 0.5, v: 0.5, face: 'y', art: (g) => <g>{g.box(0, 0, 50, 1.4, 1.4, 12, DARK)}{g.cyl(0, 0, 42, 11, 8)}{g.box(-9, 0, 50, 1.4, 1.4, 4, { top: INK, l: INK, r: INK })}{g.box(9, 0, 50, 1.4, 1.4, 4, { top: INK, l: INK, r: INK })}</g> },
  chinacabinet: { u: 0.1, v: 0.78, face: 'x', art: (g) => <g>{g.box(0, 0, 0, 14, 36, 50)}{g.flat([[7.4, -15, 8], [7.4, 15, 8], [7.4, 15, 46], [7.4, -15, 46]], GLASS)}{g.flat([[7.4, -15, 26], [7.4, 15, 26], [7.4, 15, 27], [7.4, -15, 27]], INK)}</g> },
  sinkcabinets: { u: 0.5, v: 0.1, face: 'y', art: (g) => <g>{g.box(0, 0, 0, 60, 18, 24)}{g.box(-12, 0, 24, 18, 12, 2, DARK)}{g.box(-12, -4, 26, 2, 2, 10, DARK)}</g> },
  fridge: { u: 0.1, v: 0.35, face: 'x', art: (g) => <g>{g.box(0, 0, 0, 24, 24, 58)}{g.box(12.6, -8, 30, 1.4, 1.4, 14, { top: INK, l: INK, r: INK })}{g.box(12.6, -8, 8, 1.4, 1.4, 14, { top: INK, l: INK, r: INK })}</g> },
  stove: { u: 0.85, v: 0.1, face: 'y', art: (g) => <g>{g.box(0, 0, 0, 28, 24, 26)}{g.cyl(-6, -4, 26, 5, 1, DARK)}{g.cyl(6, -4, 26, 5, 1, DARK)}{g.cyl(-6, 6, 26, 5, 1, DARK)}{g.cyl(6, 6, 26, 5, 1, DARK)}{g.flat([[-10, 12.1, 4], [10, 12.1, 4], [10, 12.1, 18], [-10, 12.1, 18]], SCREEN)}</g> },
  bed: { u: 0.5, v: 0.5, face: 'y', art: (g) => <g>{g.box(0, -34, 0, 44, 3, 30)}{g.box(0, 0, 0, 44, 66, 10)}{g.box(0, 6, 10, 40, 52, 6, { top: DIM })}{g.box(-10, -26, 16, 14, 9, 3, { top: INK })}{g.box(10, -26, 16, 14, 9, 3, { top: INK })}</g> },
  nightstand: { u: 0.88, v: 0.14, face: 'y', art: (g) => <g>{g.box(0, 0, 0, 16, 16, 16)}{g.box(0, 8.4, 6, 8, 1, 1.6, { top: INK, l: INK, r: INK })}</g> },
  dresser: { u: 0.1, v: 0.75, face: 'x', art: (g) => <g>{g.box(0, 0, 0, 18, 40, 28)}{g.box(9.4, -8, 6, 1, 8, 1.6, { top: INK, l: INK, r: INK })}{g.box(9.4, 8, 6, 1, 8, 1.6, { top: INK, l: INK, r: INK })}{g.box(9.4, -8, 18, 1, 8, 1.6, { top: INK, l: INK, r: INK })}{g.box(9.4, 8, 18, 1, 8, 1.6, { top: INK, l: INK, r: INK })}</g> },
  lamp: { u: 0.12, v: 0.2, face: 'x', art: (g) => <g>{g.cyl(0, 0, 0, 5, 2, DARK)}{g.box(0, 0, 2, 2, 2, 32, DARK)}{g.cyl(0, 0, 32, 7, 11, { top: INK, l: DIM, r: '#0c6b30' })}</g> },
  toilet: { u: 0.7, v: 0.2, face: 'y', art: (g) => <g>{g.box(0, -7, 0, 14, 6, 18)}{g.box(0, 0, 0, 16, 14, 10)}{g.cyl(0, 2, 10, 6, 1, DARK)}</g> },
  bathsink: { u: 0.25, v: 0.2, face: 'y', art: (g) => <g>{g.box(0, -3, 0, 8, 8, 20)}{g.box(0, 0, 20, 24, 16, 5)}{g.box(0, 1, 25, 14, 9, 1, DARK)}{g.box(0, -6, 25, 2, 2, 8, DARK)}</g> },
  shower: { u: 0.78, v: 0.74, face: 'y', art: (g) => <g>{g.box(0, 0, 0, 26, 26, 2, DARK)}{g.box(0, 0, 2, 26, 26, 46, GLASS_SKIN)}{g.box(0, -8, 44, 10, 8, 3)}{g.box(-6, 4, 2, 10, 14, 40, { top: DIM, l: '#0a5a28', r: '#06401c' })}</g> },
  washer: { u: 0.22, v: 0.2, face: 'y', art: (g) => <g>{g.box(0, 0, 0, 24, 24, 30, { top: '#15904a' })}{g.flat([[-5, 12.1, 6], [5, 12.1, 6], [9, 12.1, 12], [9, 12.1, 20], [5, 12.1, 26], [-5, 12.1, 26], [-9, 12.1, 20], [-9, 12.1, 12]], '#02130a')}{g.flat([[-4, 12.2, 9], [4, 12.2, 9], [7, 12.2, 14], [7, 12.2, 18], [4, 12.2, 23], [-4, 12.2, 23], [-7, 12.2, 18], [-7, 12.2, 14]], SCREEN)}{g.box(7, 12.4, 27, 4, 1, 2, { top: INK, l: INK, r: INK })}</g> },
  dryer: { u: 0.62, v: 0.2, face: 'y', art: (g) => <g>{g.box(0, 0, 0, 24, 24, 30, { top: '#15904a' })}{g.flat([[-5, 12.1, 6], [5, 12.1, 6], [9, 12.1, 12], [9, 12.1, 20], [5, 12.1, 26], [-5, 12.1, 26], [-9, 12.1, 20], [-9, 12.1, 12]], '#02130a')}{g.box(-6, 12.4, 27, 4, 1, 2, { top: INK, l: INK, r: INK })}{g.box(0, 12.4, 27, 4, 1, 2, { top: INK, l: INK, r: INK })}</g> },
  ironingboard: { u: 0.78, v: 0.7, face: 'y', art: (g) => <g>{g.box(-8, -4, 0, 1.6, 1.6, 22, DARK)}{g.box(8, 4, 0, 1.6, 1.6, 22, DARK)}{g.box(-8, 4, 0, 1.6, 1.6, 22, DARK)}{g.box(8, -4, 0, 1.6, 1.6, 22, DARK)}{g.box(0, 0, 22, 34, 12, 2)}{g.box(-9, 0, 24, 8, 5, 4, DARK)}</g> },
  seating: { u: 0.5, v: 0.62, face: 'y', art: (g) => <g>{[-32, 0, 32].map((cx) => <g key={cx}>{g.box(cx, -7, 6, 22, 4, 24)}{g.box(cx, 0, 0, 22, 16, 10)}</g>)}</g> },
  screen: { u: 0.5, v: 0.06, face: 'y', art: (g) => <g>{g.box(0, 0, 6, 100, 4, 48, DARK)}{g.flat([[-47, 2.1, 9], [47, 2.1, 9], [47, 2.1, 51], [-47, 2.1, 51]], SCREEN)}</g> },
  speakers: { u: 0.1, v: 0.3, face: 'x', art: (g) => <g>{g.box(0, 0, 0, 16, 16, 40)}{g.cyl(8.6, 0, 26, 4, 1, DARK)}{g.cyl(8.6, 0, 10, 6, 1, DARK)}</g> },
  pooltable: { u: 0.5, v: 0.5, face: 'y', art: (g) => <g>{g.box(-30, -14, 0, 4, 4, 14, DARK)}{g.box(30, -14, 0, 4, 4, 14, DARK)}{g.box(-30, 14, 0, 4, 4, 14, DARK)}{g.box(30, 14, 0, 4, 4, 14, DARK)}{g.box(0, 0, 14, 68, 36, 6)}{g.box(0, 0, 20, 62, 30, 0.6, { top: DIM })}{g.cyl(12, 0, 20.6, 2, 1.4, { top: INK })}</g> },
  bar: { u: 0.5, v: 0.1, face: 'y', art: (g) => <g>{g.box(0, 0, 0, 72, 18, 28)}{g.box(0, 2, 28, 76, 22, 3)}{g.cyl(-20, 22, 0, 4, 14)}{g.cyl(0, 22, 0, 4, 14)}{g.cyl(20, 22, 0, 4, 14)}</g> },
  pinball: { u: 0.1, v: 0.55, face: 'x', art: (g) => <g>{g.box(-2, 0, 0, 24, 28, 24)}{g.box(-10, 0, 24, 4, 28, 20, DARK)}{g.cyl(4, -4, 24, 2.2, 1, { top: INK })}{g.cyl(4, 5, 24, 2.2, 1, { top: INK })}</g> },
  toolchest: { u: 0.1, v: 0.25, face: 'x', art: (g) => <g>{g.box(0, 0, 0, 18, 36, 28)}{g.box(9.4, 0, 6, 1, 14, 1.6, { top: INK, l: INK, r: INK })}{g.box(9.4, 0, 14, 1, 14, 1.6, { top: INK, l: INK, r: INK })}{g.box(9.4, 0, 22, 1, 14, 1.6, { top: INK, l: INK, r: INK })}</g> },
  armorstand: { u: 0.5, v: 0.55, face: 'y', art: (g) => <g>{g.cyl(0, 0, 0, 18, 2, DARK)}{g.box(-5, 0, 2, 8, 9, 16)}{g.box(5, 0, 2, 8, 9, 16)}{g.box(0, 0, 18, 22, 12, 20)}{g.box(-14, 0, 20, 7, 8, 18)}{g.box(14, 0, 20, 7, 8, 18)}{g.box(0, 0, 38, 11, 10, 10)}</g> },
  craftingtable: { u: 0.6, v: 0.12, face: 'y', art: (g) => <g>{g.box(0, 0, 0, 56, 20, 22)}{g.box(-14, 0, 22, 14, 8, 3, DARK)}{g.box(14, 2, 22, 8, 8, 6)}</g> },
};

/** The pieces that can be sat on or lain on, and how far a settler is lifted off the floor on them. */
export const LIFT: Record<string, number> = { couch: 6, armchair: 6, chairs: 6, seating: 7, bar: 12, bed: 12 };
export const SIT = new Set(['couch', 'armchair', 'chairs', 'seating', 'bar']);
export const LIE = new Set(['bed']);

/** Where a piece stands in the world (its middle, on the floor). */
/** How big a piece is drawn in this room: a bit smaller in a small room, and 15% smaller than it was. */
export function pieceScale(room: { type: RoomType; col: number; row: number }): number {
  const box = roomRect(room);
  const fit = Math.min(box.w / (roomDef(room.type).slots * CELL), box.d / CELL);
  return (isSmall(room.type) ? Math.min(0.78, 0.36 + fit * 0.7) : Math.min(1, 0.38 + fit * 0.66)) * 0.85;
}

const stretch = (k: number): number => Math.max(0, Math.min(1, 0.5 + (k - 0.5) * 1.22));
export function pieceAt(room: VaultRoom, id: string): { x: number; y: number } | null {
  const p = FURNITURE[id];
  // the pieces stand against the walls, closer in than the open floor spots people walk to
  return p ? floorPoint(room, stretch(p.u), stretch(p.v), 8) : null;
}

/** Where a settler sits on a piece (in the piece's own units, from its middle) and which way they face on the screen (1 looks lower right, -1 lower left). */
export const SEATS: Record<string, { dx: number; dy: number; face: 1 | -1 }[]> = {
  couch: [{ dx: -13, dy: 3, face: -1 }, { dx: 13, dy: 3, face: -1 }],
  armchair: [{ dx: 0, dy: 3, face: -1 }],
  chairs: [{ dx: -14, dy: -26, face: -1 }, { dx: 14, dy: -26, face: -1 }, { dx: -14, dy: 26, face: 1 }, { dx: 14, dy: 26, face: 1 }],
  seating: [{ dx: -32, dy: 4, face: -1 }, { dx: 0, dy: 4, face: -1 }, { dx: 32, dy: 4, face: -1 }],
  bar: [{ dx: -20, dy: 22, face: 1 }, { dx: 0, dy: 22, face: 1 }, { dx: 20, dy: 22, face: 1 }],
};

/** A piece of furniture, in place in its room (the small rooms hold the same things a little smaller). */
export function PlacedPiece({ room, id, fresh }: { room: VaultRoom; id: string; fresh?: boolean }): ReactElement | null {
  const p = FURNITURE[id];
  const at = pieceAt(room, id);
  if (!p || !at) return null;
  const [X, Y] = P(at.x, at.y, 0);
  const scale = pieceScale(room);
  keyCount = 0;
  return <g className={fresh ? 'rm-vh-fresh' : undefined} transform={`translate(${X} ${Y}) scale(${scale})`}>{p.art(makeG(false))}</g>;
}
