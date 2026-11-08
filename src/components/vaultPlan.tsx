// The home vault drawn as a floorplan seen from above at a slight angle (the way the Sims does it): each room is a tile with its back wall along the top and its
// floor in front of it, and the furniture and the settlers stand on the floor, seen from the front with their tops showing. Old green-screen line art, as ever.
// One level is five rooms across and three deep; the rooms touch, and a doorway is cut in the wall between two that are joined.

import type { ReactElement, ReactNode } from 'react';
import { COLS, ROWS, type RoomType, type VaultRoom, roomDef } from '../lib/vaultHome';

export const INK = '#3dff8a';
export const DIM = '#13a550';
export const BG = '#021a0c';
const FRONT = '#063d1c';
const TOP = '#0d5e2d';
const GLASS = 'rgba(61,255,138,0.08)';

// ---- the geometry ----

/** A room's width (one slot), its back wall's height, and the depth of its floor. */
export const CW = 150;
export const WH = 36;
export const FD = 92;
export const RH = WH + FD;
export const GAP = 4;
export const LM = 14;
export const TM = 14;
export const VIEW_W = LM * 2 + COLS * CW + (COLS - 1) * GAP;
export const VIEW_H = TM * 2 + ROWS * RH + (ROWS - 1) * GAP;
/** Depth is drawn squashed: a thing one unit deeper on the floor stands this much higher on the screen. */
const K = 0.55;

export const cellX = (col: number) => LM + col * (CW + GAP);
export const cellY = (row: number) => TM + row * (RH + GAP);

/** The thickness of a wall seen from above (its top), and how much of its inner face shows leaning in toward the floor. */
export const WALL = 7;
export const LEAN = 8;
/** The size of a small room (the entryway and the bathroom): smaller than the standard room that fills a whole cell. */
const SMALL = { w: 116, h: 104 };
export const isSmall = (type: RoomType): boolean => roomDef(type).small === true;

export interface Box { x: number; y: number; w: number; h: number }
/** Where a room is drawn: a standard room fills its cell, a wide one two cells, and a small one (the entryway, the bathroom) sits in the middle of its cell. */
export const roomBox = (r: { type: RoomType; col: number; row: number }): Box => {
  const def = roomDef(r.type);
  const cx = cellX(r.col);
  const cy = cellY(r.row);
  if (def.small) return { x: cx + (CW - SMALL.w) / 2, y: cy + (RH - SMALL.h) / 2, w: SMALL.w, h: SMALL.h };
  return { x: cx, y: cy, w: def.slots * CW + (def.slots - 1) * GAP, h: RH };
};
/** The screen position of a spot on a room's floor: fx across (0 to 1) and fd deep (0 at the back wall, 1 at the front edge). */
export const floorPoint = (r: { type: RoomType; col: number; row: number }, fx: number, fd: number) => {
  const b = roomBox(r);
  const side = WALL + LEAN + 4;
  return { x: b.x + side + fx * (b.w - 2 * side), y: b.y + WH + 6 + fd * (b.h - WH - 14) };
};

/** Where a doorway between two rooms side by side is (the height of its floor), and where the one between a room and the one below it is (its x). */
export const hallY = (a: Box, b: Box): number => (Math.max(a.y, b.y) + WH + 14 + Math.min(a.y + a.h, b.y + b.h) - 12) / 2;
export const hallX = (a: Box, b: Box, cellLeft: number, cellRight: number): number => {
  const lo = Math.max(a.x, b.x, cellLeft) + 22;
  const hi = Math.min(a.x + a.w, b.x + b.w, cellRight) - 22;
  return hi > lo ? (lo + hi) / 2 : (Math.max(a.x, b.x, cellLeft) + Math.min(a.x + a.w, b.x + b.w, cellRight)) / 2;
};

// ---- the shell of a room: a little 3D box seen from above, with its walls standing up ----

type Wall = 'panels' | 'tiles' | 'bricks' | 'dots';
type Floor = 'planks' | 'tiles' | 'dots';
const STYLE: Record<RoomType, { wall: Wall; floor: Floor }> = {
  entry: { wall: 'panels', floor: 'tiles' },
  living: { wall: 'panels', floor: 'planks' },
  dining: { wall: 'panels', floor: 'planks' },
  bedroom: { wall: 'panels', floor: 'planks' },
  kitchen: { wall: 'tiles', floor: 'tiles' },
  bathroom: { wall: 'tiles', floor: 'tiles' },
  entertainment: { wall: 'panels', floor: 'planks' },
  game: { wall: 'bricks', floor: 'planks' },
  workshop: { wall: 'dots', floor: 'dots' },
};
const CAP = '#157a3d';
const FACE = '#052e14';
const SIDE = '#063c1b';
const FLOOR = '#031f0e';

/**
 * A room as a box with its front cut away (the Sims, or the old Shadowrun): the floor, the back wall standing up with its face toward you, and the two side walls
 * with their tops showing as thick strips and their inner faces leaning in. Everything is old green-screen line art.
 */
export function RoomShell({ x, y, w, h = RH, name, type }: { x: number; y: number; w: number; h?: number; name: string; type: RoomType }) {
  const st = STYLE[type];
  const ix = x + WALL + LEAN; // where the floor starts across, and how wide it is
  const iw = w - 2 * (WALL + LEAN);
  const fy = y + WH; // the foot of the back wall
  let wall = '';
  const x0 = x + WALL + 2;
  const x1 = x + w - WALL - 2;
  if (st.wall === 'panels') for (let i = x0 + 26; i < x1; i += 26) wall += `M${i} ${y + WALL + 3}V${fy - 3}`;
  if (st.wall === 'tiles') { for (let i = x0 + 12; i < x1; i += 12) wall += `M${i} ${y + WALL + 3}V${fy - 3}`; wall += `M${x0} ${(y + WALL + fy) / 2}H${x1}`; }
  if (st.wall === 'bricks') for (let r = 0; r < 3; r++) { const yy = y + WALL + 3 + r * 8; wall += `M${x0} ${yy}H${x1}`; for (let i = x0 + (r % 2) * 12 + 12; i < x1; i += 24) wall += `M${i} ${yy}V${yy + 8}`; }
  let floor = '';
  if (st.floor === 'planks') for (let yy = fy + 13; yy < y + h - 5; yy += 13) floor += `M${ix} ${yy}H${ix + iw}`;
  if (st.floor === 'tiles') { for (let yy = fy + 15; yy < y + h - 5; yy += 15) floor += `M${ix} ${yy}H${ix + iw}`; for (let i = ix + 18; i < ix + iw - 4; i += 18) floor += `M${i} ${fy + 2}V${y + h - 5}`; }
  let dots = '';
  if (st.floor === 'dots') for (let yy = fy + 12; yy < y + h - 7; yy += 15) for (let i = ix + 10 + ((yy / 15) % 2) * 8; i < ix + iw - 4; i += 20) dots += `M${i} ${yy}h.1`;
  return (
    <g>
      {/* a soft shadow under the whole box */}
      <rect x={x + 3} y={y + 5} width={w} height={h} rx="4" fill="#000" opacity="0.4" stroke="none" />
      {/* the floor, and its front edge */}
      <rect x={x + WALL} y={fy} width={w - 2 * WALL} height={h - WH} fill={FLOOR} stroke="none" />
      <path d={floor} stroke={DIM} strokeWidth="0.7" opacity="0.55" />
      {dots && <path d={dots} stroke={DIM} strokeWidth="2.2" opacity="0.6" />}
      <rect x={x + WALL} y={y + h - 5} width={w - 2 * WALL} height="5" fill="#0b5a2a" strokeWidth="1.2" />
      {/* the inner faces of the side walls: they lean in from the top of the wall to the floor */}
      <path d={`M${x + WALL} ${y + WALL} L${ix} ${fy} L${ix} ${y + h - 7} L${x + WALL} ${y + h - 5} Z`} fill={SIDE} strokeWidth="1.2" />
      <path d={`M${x + w - WALL} ${y + WALL} L${ix + iw} ${fy} L${ix + iw} ${y + h - 7} L${x + w - WALL} ${y + h - 5} Z`} fill={SIDE} strokeWidth="1.2" />
      {/* the back wall's face, standing up */}
      <rect x={x + WALL} y={y + WALL} width={w - 2 * WALL} height={WH - WALL} fill={FACE} strokeWidth="1.2" />
      <path d={wall} stroke={DIM} strokeWidth="0.8" opacity="0.7" />
      {/* the tops of the walls, as thick strips */}
      <rect x={x} y={y} width={w} height={WALL} rx="2" fill={CAP} strokeWidth="2" />
      <rect x={x} y={y} width={WALL} height={h - 3} rx="2" fill={CAP} strokeWidth="2" />
      <rect x={x + w - WALL} y={y} width={WALL} height={h - 3} rx="2" fill={CAP} strokeWidth="2" />
      <text x={x + WALL + 8} y={y + WALL + 17} fontSize="16" fill={INK} stroke="none" fontFamily="'VT323', monospace" letterSpacing="1">{name}</text>
    </g>
  );
}

/** The sign over the entryway. */
export function ExitSign({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <rect x={x} y={y} width="38" height="15" rx="3" fill="rgba(61,255,138,0.14)" />
      <text x={x + 19} y={y + 12} fontSize="14" fill={INK} stroke="none" fontFamily="'VT323', monospace" textAnchor="middle" letterSpacing="1.5">EXIT</text>
    </g>
  );
}

// ---- furniture, seen from the front with the top showing ----
// Each glyph is drawn with the middle of its front edge at the origin; up is negative y. A Box is a block: its front face, and its top face drawn above it.

function Box({ x, y = 0, w, d, h, z = 0, top = TOP, front = FRONT }: { x: number; y?: number; w: number; d: number; h: number; z?: number; top?: string; front?: string }) {
  const by = -y * K - z;
  const dd = d * K;
  return (
    <g strokeWidth="1.2">
      <rect x={x} y={by - h - dd} width={w} height={dd} fill={top} />
      <rect x={x} y={by - h} width={w} height={h} fill={front} />
    </g>
  );
}
const Line = ({ d, strokeWidth = '1.1' }: { d: string; strokeWidth?: string }) => <path d={d} strokeWidth={strokeWidth} />;

const Chair = ({ cx, back = true }: { cx: number; back?: boolean }): ReactElement => (
  <g>
    {back && <Box x={cx - 8} y={12} w={16} d={3} h={20} z={9} />}
    <Box x={cx - 8} w={16} d={14} h={4} z={9} />
    <Line d={`M${cx - 7} -9V0M${cx + 7} -9V0`} />
  </g>
);

const Cone = ({ cx, cy, r }: { cx: number; cy: number; r: number }) => <g><circle cx={cx} cy={cy} r={r} fill={BG} /><circle cx={cx} cy={cy} r={r / 3} fill={INK} stroke="none" /></g>;

interface Piece { fx: number; fd: number; art: ReactNode }
/** Where each piece of furniture stands in its room (across, and how far forward), and what it looks like. */
export const FURNITURE: Record<string, Piece> = {
  coatrack: { fx: 0.12, fd: 0.32, art: <g><ellipse cx="0" cy="-2" rx="9" ry="3" fill={FRONT} /><Line d="M0 -2V-48M0 -46l-9-5M0 -46l9-5M0 -38l-9-4M0 -38l9-4" /><path d="M6 -40q9 2 9 16h-13z" fill={DIM} /></g> },
  shoebench: { fx: 0.42, fd: 0.5, art: <g><Box x={-20} w={40} d={12} h={12} /><Line d="M-18 -7H18" /><ellipse cx="-9" cy="-14.5" rx="5" ry="2.4" fill={INK} /><ellipse cx="2" cy="-14.5" rx="5" ry="2.4" fill={INK} /><ellipse cx="13" cy="-14.5" rx="4" ry="2.2" fill={INK} /></g> },
  decon: { fx: 0.82, fd: 0.62, art: <g><Box x={-15} w={30} d={26} h={52} top={GLASS} front={GLASS} /><ellipse cx="0" cy="-3" rx="8" ry="2.6" /><Line d="M0 -52V-60h8M-7 -48h14l-2 4h-10z" /><Line d="M-5 -40v12M0 -40v14M5 -40v12" /><circle cx="0" cy="-22" r="0" /><path d="M-15 -52V0M15 -52V0" strokeWidth="2" /></g> },
  couch: { fx: 0.3, fd: 0.82, art: <g><Box x={-30} y={12} w={60} d={6} h={24} /><Box x={-30} w={60} d={14} h={12} /><Box x={-30} w={7} d={14} h={20} /><Box x={23} w={7} d={14} h={20} /><Line d="M-1 -12V0" /></g> },
  tv: { fx: 0.72, fd: 0.38, art: <g><Box x={-26} w={52} d={10} h={10} /><Box x={-22} y={2} w={44} d={4} h={28} z={10} front="#04180b" /><rect x="-18" y="-35" width="36" height="21" fill="rgba(61,255,138,0.18)" /></g> },
  armchair: { fx: 0.84, fd: 0.8, art: <g><Box x={-14} y={8} w={28} d={5} h={22} /><Box x={-14} w={28} d={14} h={12} /><Box x={-14} w={6} d={14} h={19} /><Box x={8} w={6} d={14} h={19} /></g> },
  coffeetable: { fx: 0.56, fd: 0.96, art: <g><Line d="M-16 -6V0M16 -6V0" /><Box x={-18} w={36} d={16} h={4} z={6} /></g> },
  table: { fx: 0.5, fd: 0.7, art: <g><Line d="M-31 -14V0M31 -14V0M-27 -20V-12M27 -20V-12" /><Box x={-34} w={68} d={28} h={5} z={14} /></g> },
  chairs: { fx: 0.5, fd: 0.92, art: <g><Chair cx={-46} /><Chair cx={46} /></g> },
  chandelier: { fx: 0.5, fd: 0.2, art: <g><Line d="M0 -96V-66" /><path d="M-15 -66h30l-5 9h-20z" fill={DIM} /><Line d="M-13 -66v-6M0 -66v-8M13 -66v-6" /><circle cx="-13" cy="-74" r="1.6" fill={INK} /><circle cx="0" cy="-76" r="1.6" fill={INK} /><circle cx="13" cy="-74" r="1.6" fill={INK} /></g> },
  chinacabinet: { fx: 0.93, fd: 0.38, art: <g><Box x={-19} w={38} d={12} h={58} /><rect x="-15" y="-54" width="30" height="46" fill={GLASS} /><Line d="M-15 -39H15M-15 -24H15" /><ellipse cx="-6" cy="-42" rx="5" ry="1.6" fill={INK} /><ellipse cx="7" cy="-27" rx="5" ry="1.6" fill={INK} /></g> },
  sinkcabinets: { fx: 0.3, fd: 0.4, art: <g><Box x={-36} w={72} d={16} h={26} /><Line d="M0 -26V0M-36 -14H36" /><ellipse cx="-14" cy="-31" rx="12" ry="3.2" fill={BG} /><Line d="M-14 -34v-9h7" /><circle cx="-4" cy="-8" r="1.2" fill={INK} /><circle cx="4" cy="-8" r="1.2" fill={INK} /></g> },
  fridge: { fx: 0.68, fd: 0.42, art: <g><Box x={-15} w={30} d={18} h={64} /><Line d="M-15 -44H15M11 -52v-10M11 -40v-9" strokeWidth="2" /></g> },
  stove: { fx: 0.9, fd: 0.44, art: <g><Box x={-17} w={34} d={16} h={28} /><ellipse cx="-7" cy="-31" rx="5.5" ry="2" fill={BG} /><ellipse cx="7" cy="-31" rx="5.5" ry="2" fill={BG} /><rect x="-12" y="-22" width="24" height="13" fill={GLASS} /><circle cx="-9" cy="-25" r="1.1" fill={INK} /><circle cx="9" cy="-25" r="1.1" fill={INK} /></g> },
  bed: { fx: 0.42, fd: 0.74, art: <g><Box x={-27} y={38} w={54} d={3} h={32} /><Box x={-27} w={54} d={38} h={10} /><Box x={-25} y={2} w={50} d={32} h={5} z={10} top={DIM} /><ellipse cx="-11" cy="-25" rx="8.5" ry="3.6" fill={BG} /><ellipse cx="11" cy="-25" rx="8.5" ry="3.6" fill={BG} /></g> },
  nightstand: { fx: 0.76, fd: 0.5, art: <g><Box x={-10} w={20} d={12} h={20} /><Line d="M-10 -10h20" /><circle cx="0" cy="-5" r="1.2" fill={INK} /></g> },
  dresser: { fx: 0.9, fd: 0.8, art: <g><Box x={-23} w={46} d={14} h={30} /><Line d="M-23 -10h46M-23 -20h46" /><circle cx="-7" cy="-5" r="1.2" fill={INK} /><circle cx="7" cy="-5" r="1.2" fill={INK} /><circle cx="-7" cy="-15" r="1.2" fill={INK} /><circle cx="7" cy="-15" r="1.2" fill={INK} /></g> },
  lamp: { fx: 0.62, fd: 0.58, art: <g><ellipse cx="0" cy="-2" rx="7" ry="2.4" fill={FRONT} /><Line d="M0 -2V-40" /><path d="M-9 -52h18l-4 14h-10z" fill={DIM} /></g> },
  toilet: { fx: 0.28, fd: 0.5, art: <g><Box x={-8} y={8} w={16} d={6} h={22} /><Box x={-9} w={18} d={14} h={10} /><ellipse cx="0" cy="-14" rx="8" ry="3" fill={BG} /></g> },
  bathsink: { fx: 0.58, fd: 0.46, art: <g><Box x={-4} y={4} w={8} d={8} h={22} /><Box x={-15} w={30} d={14} h={6} z={22} /><ellipse cx="0" cy="-33" rx="9" ry="2.6" fill={BG} /><Line d="M0 -35v-8h5" /></g> },
  shower: { fx: 0.86, fd: 0.62, art: <g><Box x={-15} w={30} d={26} h={54} top={GLASS} front={GLASS} /><Line d="M-15 -54V0M15 -54V0M-15 -54H15" /><path d="M2 -50V-6q-6 2-12 0V-50z" fill={DIM} opacity="0.6" /><Line d="M0 -54V-62h8" /></g> },
  seating: { fx: 0.5, fd: 0.9, art: <g>{[-34, 0, 34].map((cx) => <g key={cx}><Box x={cx - 12} y={10} w={24} d={4} h={26} /><Box x={cx - 12} w={24} d={14} h={12} /></g>)}</g> },
  screen: { fx: 0.72, fd: 0.18, art: <g><Box x={-60} w={120} d={3} h={56} z={8} front="#04180b" /><rect x="-55" y="-60" width="110" height="46" fill="rgba(61,255,138,0.2)" /><Line d="M-60 -8V0M60 -8V0" /></g> },
  speakers: { fx: 0.12, fd: 0.6, art: <g><Box x={-10} w={20} d={12} h={44} /><Cone cx={0} cy={-31} r={5} /><Cone cx={0} cy={-13} r={7} /></g> },
  pooltable: { fx: 0.46, fd: 0.74, art: <g><Line d="M-37 -10V0M37 -10V0" /><Box x={-42} w={84} d={40} h={7} z={10} /><rect x="-38" y="-39" width="76" height="20" fill={DIM} opacity="0.7" /><circle cx="-38" cy="-39" r="2.4" fill={BG} /><circle cx="38" cy="-39" r="2.4" fill={BG} /><circle cx="-38" cy="-19" r="2.4" fill={BG} /><circle cx="38" cy="-19" r="2.4" fill={BG} /><circle cx="14" cy="-29" r="1.6" fill={INK} /><circle cx="19" cy="-31" r="1.6" fill={INK} /><circle cx="19" cy="-27" r="1.6" fill={INK} /></g> },
  bar: { fx: 0.9, fd: 0.5, art: <g><Box x={-42} w={84} d={16} h={30} /><Box x={-44} w={88} d={18} h={3} z={30} /><Line d="M-30 -15v13M0 -15v13M30 -15v13" /><Line d="M-26 -36v-8M-20 -36v-10M10 -36v-8M17 -36v-10" /><ellipse cx="-16" cy="6" rx="6" ry="2.4" fill={FRONT} /><Line d="M-16 4V-4" /></g> },
  pinball: { fx: 0.14, fd: 0.78, art: <g><Box x={-14} w={28} d={26} h={26} /><Box x={-14} y={26} w={28} d={4} h={24} z={26} /><circle cx="-4" cy="-30" r="2.4" fill={BG} /><circle cx="5" cy="-27" r="2.4" fill={BG} /><Line d="M-8 -22l5 2M8 -22l-5 2" /></g> },
  toolchest: { fx: 0.18, fd: 0.55, art: <g><Box x={-23} w={46} d={16} h={32} /><Line d="M-23 -11h46M-23 -22h46" strokeWidth="1.1" /><Line d="M-5 -5h10M-5 -16h10M-5 -27h10" strokeWidth="2" /></g> },
  armorstand: { fx: 0.52, fd: 0.82, art: <g><ellipse cx="0" cy="-2" rx="20" ry="5" fill={FRONT} /><Box x={-11} w={9} d={9} h={18} z={4} /><Box x={2} w={9} d={9} h={18} z={4} /><Box x={-13} w={26} d={12} h={22} z={22} /><Box x={-21} w={8} d={8} h={24} z={20} /><Box x={13} w={8} d={8} h={24} z={20} /><Box x={-6} w={12} d={9} h={10} z={44} /><Line d="M-4 -52h8" /></g> },
  craftingtable: { fx: 0.84, fd: 0.55, art: <g><Box x={-36} w={72} d={20} h={26} /><Line d="M-36 -14H36" /><rect x="-30" y="-41" width="3" height="3" fill={INK} /><Line d="M-24 -36l14-2 6 4M2 -34h16l4 -2" /><Box x={24} w={10} d={8} h={6} z={26} /></g> },
};

/** The pieces that can be sat on or lain on, and how far a settler is lifted off the floor on them. */
export const LIFT: Record<string, number> = { couch: 8, armchair: 8, chairs: 8, seating: 9, bar: 12, bed: 12 };
export const SIT = new Set(['couch', 'armchair', 'chairs', 'seating', 'bar']);
export const LIE = new Set(['bed']);

/** A piece of furniture, in place in its room. */
export function PlacedPiece({ room, id, fresh }: { room: VaultRoom; id: string; fresh?: boolean }) {
  const p = FURNITURE[id];
  if (!p) return null;
  const at = floorPoint(room, p.fx, p.fd);
  // the small rooms (the entryway, the bathroom) hold the same things a little smaller
  const scale = isSmall(room.type) ? 0.84 : 1;
  return <g className={fresh ? 'rm-vh-fresh' : undefined} transform={`translate(${at.x} ${at.y}) scale(${scale})`}>{p.art}</g>;
}

/**
 * A doorway between two rooms side by side, with the short hallway between them when they do not touch (a small room is narrower than its cell). It cuts through
 * both walls (their tops and their leaning faces) and lays a strip of floor across, with a line along each side.
 */
export function HallAcross({ left, right }: { left: Box; right: Box }) {
  const y = hallY(left, right);
  const open = 15;
  const a = left.x + left.w - WALL - LEAN; // the foot of the left room's right wall
  const b = right.x + WALL + LEAN; // the foot of the right room's left wall
  return (
    <g>
      <rect x={a} y={y - open} width={Math.max(0, b - a)} height={open * 2} fill={FLOOR} stroke="none" />
      <path d={`M${a} ${y - open}H${b}M${a} ${y + open}H${b}`} strokeWidth="2" />
    </g>
  );
}

/** A doorway between a room and the one below it, with the hallway between them when they do not touch: it cuts through the lower room's back wall. */
export function HallDown({ above, below, x }: { above: Box; below: Box; x: number }) {
  const open = 15;
  const y1 = above.y + above.h - 6;
  const y2 = below.y + WH + 2;
  return (
    <g>
      <rect x={x - open} y={y1} width={open * 2} height={Math.max(0, y2 - y1)} fill={FLOOR} stroke="none" />
      <path d={`M${x - open} ${y1}V${y2}M${x + open} ${y1}V${y2}`} strokeWidth="2" />
    </g>
  );
}
