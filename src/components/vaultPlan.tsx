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
export const roomBox = (r: { type: RoomType; col: number; row: number }) => {
  const slots = roomDef(r.type).slots;
  return { x: cellX(r.col), y: cellY(r.row), w: slots * CW + (slots - 1) * GAP, h: RH };
};
/** The screen position of a spot on a room's floor: fx across (0 to 1) and fd deep (0 at the back wall, 1 at the front edge). */
export const floorPoint = (r: { type: RoomType; col: number; row: number }, fx: number, fd: number) => {
  const b = roomBox(r);
  return { x: b.x + 10 + fx * (b.w - 20), y: b.y + WH + 8 + fd * (FD - 14) };
};

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
  entertainment: { wall: 'panels', floor: 'planks' },
  game: { wall: 'bricks', floor: 'planks' },
  workshop: { wall: 'dots', floor: 'dots' },
};

export function RoomShell({ x, y, w, name, type }: { x: number; y: number; w: number; name: string; type: RoomType }) {
  const st = STYLE[type];
  let wall = '';
  if (st.wall === 'panels') for (let i = 30; i < w; i += 30) wall += `M${x + i} ${y + 3}V${y + WH - 3}`;
  if (st.wall === 'tiles') { for (let i = 14; i < w; i += 14) wall += `M${x + i} ${y + 3}V${y + WH - 3}`; wall += `M${x + 3} ${y + WH / 2}H${x + w - 3}`; }
  if (st.wall === 'bricks') for (let r = 0; r < 3; r++) { const yy = y + 4 + r * 10; wall += `M${x + 3} ${yy}H${x + w - 3}`; for (let i = (r % 2) * 14 + 14; i < w; i += 28) wall += `M${x + i} ${yy}V${yy + 10}`; }
  let floor = '';
  const fy = y + WH;
  if (st.floor === 'planks') for (let yy = fy + 14; yy < y + RH - 4; yy += 14) floor += `M${x + 3} ${yy}H${x + w - 3}`;
  if (st.floor === 'tiles') { for (let yy = fy + 16; yy < y + RH - 4; yy += 16) floor += `M${x + 3} ${yy}H${x + w - 3}`; for (let i = 20; i < w - 4; i += 20) floor += `M${x + i} ${fy + 3}V${y + RH - 3}`; }
  let dots = '';
  if (st.floor === 'dots') for (let yy = fy + 12; yy < y + RH - 6; yy += 16) for (let i = 14 + ((yy / 16) % 2) * 9; i < w - 6; i += 22) dots += `M${x + i} ${yy}h.1`;
  return (
    <g>
      <rect x={x} y={y} width={w} height={RH} rx="7" fill={BG} strokeWidth="2.4" />
      <rect x={x + 1.2} y={y + 1.2} width={w - 2.4} height={WH - 1.2} rx="6" fill="#04270f" stroke="none" />
      <path d={wall} stroke={DIM} strokeWidth="0.8" opacity="0.7" />
      <path d={`M${x} ${y + WH}H${x + w}`} strokeWidth="1.8" />
      <path d={floor} stroke={DIM} strokeWidth="0.7" opacity="0.55" />
      {dots && <path d={dots} stroke={DIM} strokeWidth="2.2" opacity="0.6" />}
      <text x={x + 10} y={y + 25} fontSize="17" fill={INK} stroke="none" fontFamily="'VT323', monospace" letterSpacing="1">{name}</text>
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
  tv: { fx: 0.58, fd: 0.38, art: <g><Box x={-26} w={52} d={10} h={10} /><Box x={-22} y={2} w={44} d={4} h={28} z={10} front="#04180b" /><rect x="-18" y="-35" width="36" height="21" fill="rgba(61,255,138,0.18)" /></g> },
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
  return <g className={fresh ? 'rm-vh-fresh' : undefined} transform={`translate(${at.x} ${at.y})`}>{p.art}</g>;
}

/** Joined rooms: a doorway cut into the wall between them. */
export function Doorway({ x, y, vertical }: { x: number; y: number; vertical?: boolean }) {
  return vertical
    ? <g><rect x={x - 15} y={y - 4} width="30" height="8" fill={BG} stroke="none" /><path d={`M${x - 15} ${y - 4}V${y + 4}M${x + 15} ${y - 4}V${y + 4}`} strokeWidth="1.6" /></g>
    : <g><rect x={x - 3} y={y - 15} width="6" height="30" fill={BG} stroke="none" /><path d={`M${x - 3} ${y - 15}H${x + 3}M${x - 3} ${y + 15}H${x + 3}`} strokeWidth="1.6" /></g>;
}
