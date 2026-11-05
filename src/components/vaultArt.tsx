// Everything the home vault is drawn with: old green-screen line art in SVG. Furniture is drawn with its origin at the floor under its middle (y goes up
// as it gets more negative); settlers likewise.

import type { ReactElement } from 'react';
import type { RoomType, SettlerKind } from '../lib/vaultHome';

export const INK = '#3dff8a';
export const DIM = '#13a550';
export const BG = '#021a0c';

// ---- the map of the vault, in drawing units ----
/** Width of one room slot including the tunnel after it, and the width of a standard room and of a bathroom. */
export const P = 250;
export const W = 190;
export const WB = 140;
/** Height of every room, the distance from the top of one room to the top of the next (the gap is the tunnel), and the floor inside a room. */
export const H = 104;
export const Q = 158;
export const FL = H - 8;
/** The margin to the left of the first slot (the vault door lives in it) and above the first row. */
export const LM = 100;
export const TM = 28;

export const VIEW_W = LM + 3 * P + 24;
export const VIEW_H = TM + 5 * Q;

export interface RoomBox { x: number; y: number; w: number }
export const roomWidth = (type: RoomType): number => (type === 'bathroom' ? WB : type === 'entertainment' || type === 'game' || type === 'workshop' ? P + W : W);
export const roomBox = (type: RoomType, col: number, row: number): RoomBox => {
  const w = roomWidth(type);
  const x = LM + col * P + (type === 'bathroom' ? (P - WB) / 2 : (P - W) / 2);
  return { x, y: TM + row * Q, w };
};
export const floorY = (row: number): number => TM + row * Q + FL;

// ---- furniture ----

/** Where each piece stands in its room (x from the room's left wall) and what it looks like. */
export const FURNITURE: Record<string, { x: number; art: ReactElement }> = {
  // living room
  couch: { x: 52, art: (
    <g>
      <rect x="-27" y="-36" width="54" height="24" rx="5" />
      <rect x="-33" y="-28" width="9" height="24" rx="3" />
      <rect x="24" y="-28" width="9" height="24" rx="3" />
      <rect x="-26" y="-18" width="52" height="12" rx="3" />
      <path d="M-28 -4 V0 M28 -4 V0" />
      <path d="M-8 -34 V-20 M8 -34 V-20" strokeDasharray="2 3" />
    </g>
  ) },
  coffeetable: { x: 103, art: (
    <g>
      <rect x="-15" y="-15" width="30" height="4" />
      <path d="M-12 -11 V0 M12 -11 V0 M-12 -5 H12" />
      <path d="M-5 -15 v-5 h6 v5 M1 -17 h3" />
    </g>
  ) },
  armchair: { x: 148, art: (
    <g>
      <rect x="-13" y="-36" width="26" height="28" rx="6" />
      <rect x="-16" y="-17" width="32" height="12" rx="3" />
      <rect x="-19" y="-26" width="7" height="22" rx="3" />
      <rect x="12" y="-26" width="7" height="22" rx="3" />
      <path d="M-14 -4 V0 M14 -4 V0" />
    </g>
  ) },
  tv: { x: 112, art: (
    <g>
      <rect x="-24" y="-78" width="48" height="32" rx="3" />
      <rect x="-20" y="-74" width="40" height="24" rx="2" />
      <path d="M-18 -68 H18 M-18 -63 H18 M-18 -58 H18 M-18 -53 H18" stroke={DIM} />
      <path d="M-6 -78 L-14 -90 M6 -78 L14 -90" />
      <path d="M-8 -46 V-42 H8 V-46" />
    </g>
  ) },
  // dining room
  table: { x: 100, art: (
    <g>
      <rect x="-30" y="-28" width="60" height="5" rx="1" />
      <path d="M-26 -23 V0 M26 -23 V0" />
      <ellipse cx="-12" cy="-31" rx="6" ry="1.6" />
      <ellipse cx="12" cy="-31" rx="6" ry="1.6" />
      <path d="M0 -29 v-8 M-2 -37 h4" />
    </g>
  ) },
  chairs: { x: 100, art: (
    <g>
      <g transform="translate(-42 0)"><path d="M-8 -14 V-40 M-8 -14 H7 M-6 -14 V0 M6 -14 V0" /><path d="M-8 -36 H-4" /></g>
      <g transform="translate(42 0) scale(-1 1)"><path d="M-8 -14 V-40 M-8 -14 H7 M-6 -14 V0 M6 -14 V0" /><path d="M-8 -36 H-4" /></g>
    </g>
  ) },
  chandelier: { x: 104, art: (
    <g>
      <path d="M0 -96 V-84" />
      <path d="M-26 -72 Q-13 -60 0 -68 Q13 -60 26 -72" />
      <circle cx="0" cy="-70" r="3" />
      <path d="M-26 -72 v-8 M-13 -66 v-8 M0 -68 v-9 M13 -66 v-8 M26 -72 v-8" />
      <path d="M-26 -84 q-2 -3 0 -5 q2 2 0 5 M-13 -78 q-2 -3 0 -5 q2 2 0 5 M0 -81 q-2 -3 0 -5 q2 2 0 5 M13 -78 q-2 -3 0 -5 q2 2 0 5 M26 -84 q-2 -3 0 -5 q2 2 0 5" stroke={INK} />
    </g>
  ) },
  chinacabinet: { x: 168, art: (
    <g>
      <rect x="-16" y="-68" width="32" height="68" rx="1" />
      <rect x="-13" y="-64" width="12" height="36" />
      <rect x="1" y="-64" width="12" height="36" />
      <path d="M-13 -52 H-1 M1 -52 H13 M-13 -40 H-1 M1 -40 H13" />
      <circle cx="-7" cy="-56" r="2" /><circle cx="7" cy="-56" r="2" /><path d="M-10 -44 h6 M4 -44 h6" />
      <rect x="-13" y="-24" width="26" height="24" />
      <path d="M0 -24 V0 M-3 -12 h1 M2 -12 h1" />
    </g>
  ) },
  // kitchen
  sinkcabinets: { x: 62, art: (
    <g>
      <rect x="-42" y="-30" width="84" height="30" />
      <path d="M-14 -30 V0 M14 -30 V0" />
      <rect x="-42" y="-34" width="84" height="4" />
      <path d="M-14 -34 V-39 H14 V-34" />
      <path d="M0 -39 V-50 Q0 -54 6 -54" />
      <rect x="-42" y="-82" width="84" height="26" />
      <path d="M-14 -82 V-56 M14 -82 V-56" />
      <path d="M-8 -50 h2 M20 -50 h2 M-24 -50 h2" />
    </g>
  ) },
  fridge: { x: 128, art: (
    <g>
      <rect x="-14" y="-66" width="28" height="66" rx="3" />
      <path d="M-14 -44 H14" />
      <path d="M9 -60 V-48 M9 -40 V-28" />
      <path d="M-6 -58 h8" stroke={DIM} />
    </g>
  ) },
  stove: { x: 164, art: (
    <g>
      <rect x="-16" y="-32" width="32" height="32" rx="2" />
      <rect x="-11" y="-24" width="22" height="14" />
      <path d="M-11 -27 H11" />
      <ellipse cx="-7" cy="-35" rx="6" ry="1.8" /><ellipse cx="8" cy="-35" rx="6" ry="1.8" />
      <circle cx="-9" cy="-29" r="1.2" /><circle cx="0" cy="-29" r="1.2" /><circle cx="9" cy="-29" r="1.2" />
      <path d="M-6 -42 q-3 -4 0 -8 q3 -4 0 -8" stroke={DIM} />
    </g>
  ) },
  // bedroom
  bed: { x: 70, art: (
    <g>
      <rect x="-35" y="-36" width="5" height="34" />
      <rect x="-33" y="-14" width="68" height="9" />
      <rect x="-30" y="-24" width="62" height="10" rx="3" />
      <ellipse cx="-21" cy="-27" rx="9" ry="4" />
      <path d="M-4 -24 V-14 M10 -24 V-14" stroke={DIM} />
      <rect x="32" y="-20" width="3" height="18" />
      <path d="M-32 -5 V0 M33 -5 V0" />
    </g>
  ) },
  nightstand: { x: 70, art: (
    <g>
      <g transform="translate(-50 0)"><rect x="-8" y="-22" width="16" height="22" /><path d="M-8 -11 H8 M-2 -16 h4 M-2 -5 h4" /></g>
      <g transform="translate(50 0)"><rect x="-8" y="-22" width="16" height="22" /><path d="M-8 -11 H8 M-2 -16 h4 M-2 -5 h4" /></g>
    </g>
  ) },
  dresser: { x: 150, art: (
    <g>
      <rect x="-17" y="-36" width="34" height="36" />
      <path d="M-17 -24 H17 M-17 -12 H17" />
      <path d="M-3 -30 h6 M-3 -18 h6 M-3 -6 h6" />
      <path d="M-14 0 v3 M14 0 v3" />
    </g>
  ) },
  lamp: { x: 177, art: (
    <g>
      <ellipse cx="0" cy="-2" rx="7" ry="2" />
      <path d="M0 -4 V-40" />
      <path d="M-8 -52 L8 -52 L11 -38 L-11 -38 Z" />
      <path d="M-14 -46 L-18 -50 M14 -46 L18 -50 M0 -56 V-60" stroke={DIM} />
    </g>
  ) },
  // bathroom
  toilet: { x: 28, art: (
    <g>
      <rect x="-14" y="-36" width="9" height="22" rx="1" />
      <path d="M-14 -14 H12 Q13 -4 5 -2 H-4 Q-10 -4 -10 -14" />
      <path d="M-5 -2 V0 H5 V-2" />
      <path d="M-4 -18 H10" />
      <path d="M-10 -38 h2" />
    </g>
  ) },
  bathsink: { x: 70, art: (
    <g>
      <path d="M-13 -30 H13 L10 -22 H-10 Z" />
      <rect x="-4" y="-22" width="8" height="22" />
      <path d="M0 -30 V-38 Q0 -42 5 -42" />
      <ellipse cx="0" cy="-60" rx="11" ry="14" />
      <path d="M-5 -66 q2 -4 6 -4" stroke={DIM} />
    </g>
  ) },
  shower: { x: 111, art: (
    <g>
      <rect x="-17" y="-74" width="34" height="74" />
      <path d="M-17 -68 H17" />
      <path d="M-10 -64 V-62 H3" />
      <path d="M3 -62 L10 -58 L5 -54 Z" />
      <path d="M3 -50 v5 M7 -48 v5 M11 -50 v5 M5 -38 v5 M10 -36 v5 M-1 -40 v5" stroke={DIM} />
      <path d="M-17 -10 H17" strokeDasharray="2 3" />
      <circle cx="0" cy="-2" r="2" />
    </g>
  ) },
  // entertainment room (two slots wide)
  seating: { x: 120, art: (
    <g>
      {[0, 1, 2].map((i) => {
        const sx = -40 + i * 32;
        const lift = (2 - i) * 9;
        return (
          <g key={i}>
            <rect x={sx - 6} y={-lift} width="28" height={lift || 0.01} />
            <rect x={sx} y={-28 - lift} width="5" height="24" rx="2" />
            <rect x={sx} y={-10 - lift} width="17" height="6" rx="2" />
            <path d={`M${sx + 15} ${-4 - lift} V${-lift}`} />
          </g>
        );
      })}
    </g>
  ) },
  screen: { x: 322, art: (
    <g>
      <rect x="-52" y="-84" width="104" height="58" rx="2" />
      <rect x="-48" y="-80" width="96" height="50" />
      <path d="M-48 -52 L-30 -66 L-16 -54 L0 -70 L18 -50 L32 -60 L48 -48" stroke={DIM} />
      <circle cx="30" cy="-72" r="5" stroke={DIM} />
      <path d="M-52 -84 q-8 28 0 58 M52 -84 q8 28 0 58" />
      <rect x="-56" y="-6" width="112" height="6" />
    </g>
  ) },
  speakers: { x: 322, art: (
    <g>
      <g transform="translate(-72 0)"><rect x="-8" y="-50" width="16" height="50" rx="2" /><circle cx="0" cy="-38" r="4" /><circle cx="0" cy="-20" r="6" /><path d="M-3 -50 h6" /></g>
      <g transform="translate(72 0)"><rect x="-8" y="-50" width="16" height="50" rx="2" /><circle cx="0" cy="-38" r="4" /><circle cx="0" cy="-20" r="6" /><path d="M-3 -50 h6" /></g>
      <path d="M-86 -56 q-6 4 0 8 M-90 -60 q-10 8 0 16 M86 -56 q6 4 0 8 M90 -60 q10 8 0 16" stroke={DIM} />
    </g>
  ) },
  // game room (two slots wide)
  pooltable: { x: 92, art: (
    <g>
      <path d="M-50 -22 H50 L58 -10 H-58 Z" />
      <path d="M-46 -10 V0 M46 -10 V0" />
      <circle cx="-48" cy="-22" r="2.2" /><circle cx="48" cy="-22" r="2.2" /><circle cx="-56" cy="-10" r="2.2" /><circle cx="56" cy="-10" r="2.2" />
      <circle cx="-16" cy="-17" r="2" /><circle cx="-10" cy="-15" r="2" /><circle cx="8" cy="-16" r="2" /><circle cx="22" cy="-14" r="2" />
      <path d="M62 -2 L74 -50" />
    </g>
  ) },
  bar: { x: 252, art: (
    <g>
      <rect x="-56" y="-36" width="112" height="36" />
      <rect x="-60" y="-40" width="120" height="4" />
      <path d="M-30 -36 V0 M0 -36 V0 M30 -36 V0" stroke={DIM} />
      <path d="M-56 -72 H56" />
      <path d="M-46 -72 v-10 h4 v10 M-34 -72 v-14 h4 v14 M-22 -72 v-9 h4 v9 M6 -72 v-12 h4 v12 M20 -72 v-10 h4 v10 M34 -72 v-14 h4 v14" />
      <path d="M-30 -40 v-7 h6 v7 M20 -40 v-7 h6 v7" />
    </g>
  ) },
  pinball: { x: 372, art: (
    <g>
      <rect x="-19" y="-64" width="38" height="26" rx="2" />
      <circle cx="-8" cy="-54" r="3" /><circle cx="6" cy="-50" r="3" /><path d="M-14 -44 H14" stroke={DIM} />
      <path d="M-18 -38 H18 L16 -6 H-16 Z" />
      <path d="M-10 -14 L-3 -10 M10 -14 L3 -10" />
      <circle cx="-5" cy="-26" r="2.5" /><circle cx="5" cy="-30" r="2.5" /><circle cx="0" cy="-20" r="1.5" />
      <path d="M-14 -6 V0 M14 -6 V0" />
    </g>
  ) },
  // workshop (two slots wide)
  toolchest: { x: 66, art: (
    <g>
      <rect x="-26" y="-42" width="52" height="42" />
      <rect x="-28" y="-48" width="56" height="6" />
      <path d="M-26 -30 H26 M-26 -18 H26 M-26 -8 H26" />
      <path d="M-5 -36 h10 M-5 -24 h10 M-5 -13 h10" />
      <circle cx="-20" cy="2" r="2.5" /><circle cx="20" cy="2" r="2.5" />
      <rect x="-24" y="-86" width="48" height="30" stroke={DIM} />
      <path d="M-16 -82 V-64 M-16 -64 l-3 -2 M-4 -82 L-4 -62 M6 -82 l8 18 M18 -82 v14" stroke={DIM} />
    </g>
  ) },
  armorstand: { x: 196, art: (
    <g>
      <rect x="-24" y="-4" width="48" height="4" />
      <path d="M0 -4 V-12" />
      <rect x="-9" y="-92" width="18" height="16" rx="6" />
      <path d="M-6 -85 H6" />
      <path d="M-20 -72 H20 L15 -42 H-15 Z" />
      <circle cx="-23" cy="-70" r="7" /><circle cx="23" cy="-70" r="7" />
      <path d="M-26 -64 L-30 -42 M26 -64 L30 -42" />
      <circle cx="0" cy="-58" r="5" /><path d="M0 -63 V-53 M-5 -58 H5" stroke={DIM} />
      <path d="M-10 -42 L-12 -8 M10 -42 L12 -8" />
      <rect x="-16" y="-10" width="9" height="6" /><rect x="7" y="-10" width="9" height="6" />
    </g>
  ) },
  craftingtable: { x: 332, art: (
    <g>
      <rect x="-52" y="-32" width="104" height="5" />
      <path d="M-48 -27 V0 M48 -27 V0 M-48 -10 H48" />
      <path d="M-30 -34 h26 l4 -6 h-8 v-6 h-8 v6 h-14 z" />
      <rect x="22" y="-46" width="14" height="14" />
      <path d="M29 -46 V-52 M24 -52 H34" />
      <path d="M-40 -14 h14 M-12 -14 h14" stroke={DIM} />
      <path d="M-50 -90 H50 M-40 -90 v22 M-40 -86 h18 v4 h-18 M-6 -90 v20 M-6 -84 h20 M20 -90 v18 M34 -90 v26" stroke={DIM} />
    </g>
  ) },
};

// ---- the vault door, the ladder, the faces ----

export function VaultDoor({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <circle r="38" />
      <circle r="31" />
      {[0, 60, 120, 180, 240, 300].map((a) => (
        <circle key={a} cx={Math.cos((a * Math.PI) / 180) * 34.5} cy={Math.sin((a * Math.PI) / 180) * 34.5} r="1.8" fill={INK} />
      ))}
      <circle r="15" />
      <path d="M-15 0 H15 M0 -15 V15 M-10.6 -10.6 L10.6 10.6 M10.6 -10.6 L-10.6 10.6" />
      <circle r="4" fill={INK} />
      <rect x="-44" y="-12" width="7" height="24" />
    </g>
  );
}

export function ExitSign({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect x="0" y="0" width="46" height="16" fill={BG} />
      <path d="M6 8 H15 M6 8 l4 -3 M6 8 l4 3" />
      <text x="18" y="12.5" fontSize="11" fill={INK} stroke="none" fontFamily="'VT323', monospace" letterSpacing="1">EXIT</text>
    </g>
  );
}

/** A mood as a face: ecstatic, happy, content, indifferent, displeased, sad, angry. */
export function Face({ word, size = 26 }: { word: string; size?: number }) {
  const mouth: Record<string, ReactElement> = {
    ECSTATIC: <path d="M-6 2 Q0 12 6 2 Z" fill={INK} />,
    HAPPY: <path d="M-6 3 Q0 10 6 3" />,
    CONTENT: <path d="M-4 5 Q0 7 4 5" />,
    INDIFFERENT: <path d="M-4 6 H4" />,
    DISPLEASED: <path d="M-4 7 Q0 4 4 7" />,
    SAD: <path d="M-6 9 Q0 3 6 9" />,
    ANGRY: <path d="M-6 8 Q0 4 6 8" />,
  };
  return (
    <svg viewBox="-12 -12 24 24" width={size} height={size} fill="none" stroke={INK} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle r="10.5" />
      <circle cx="-4" cy="-3" r="1.2" fill={INK} /><circle cx="4" cy="-3" r="1.2" fill={INK} />
      {word === 'ANGRY' && <path d="M-7.5 -7 L-2 -4.5 M7.5 -7 L2 -4.5" />}
      {word === 'SAD' && <path d="M-4 0 v3" stroke={DIM} />}
      {mouth[word] ?? mouth.CONTENT}
    </svg>
  );
}

// ---- settlers ----

export type Pose = 'walk' | 'stand' | 'sit' | 'lie' | 'climb';

/** A settler (a person, a dog or a cat), standing on the floor at the origin. phase runs 0..1 and moves the legs and the tail. */
export function SettlerArt({ kind, pose, phase }: { kind: SettlerKind; pose: Pose; phase: number }) {
  const s = Math.sin(phase * Math.PI * 2);
  const moving = pose === 'walk' || pose === 'climb';
  if (kind === 'dog' || kind === 'cat') {
    const dog = kind === 'dog';
    const sw = moving ? s * 3.5 : 0;
    if (pose === 'lie' || pose === 'sit') {
      return (
        <g>
          <ellipse cx="0" cy="-4" rx={dog ? 10 : 8} ry="3.6" />
          <circle cx={dog ? 11 : 9} cy="-5" r={dog ? 4 : 3.4} />
          {dog ? <path d="M13 -9 l2 -3 M9 -9 l-1 -4" /> : <path d="M8 -8 l1 -4 l3 3 M12 -7 l2 -3" />}
          <path d={dog ? 'M-10 -5 q-6 0 -8 -4' : 'M-8 -4 q-8 2 -8 -6 q0 -4 4 -3'} />
        </g>
      );
    }
    return (
      <g>
        <ellipse cx="0" cy="-9" rx={dog ? 9 : 7} ry={dog ? 4 : 3.4} />
        <circle cx={dog ? 10 : 8} cy="-12" r={dog ? 4 : 3.4} />
        {dog ? <path d="M13 -10 l4 1 M9 -16 l-1 -3 M13 -15 l2 -3" /> : <path d="M7 -15 l0 -4 l3 3 M11 -15 l2 -3 l1 3" />}
        <path d={dog ? `M-9 -11 l-5 ${-5 + s * 3}` : `M-7 -9 q-8 ${-2 + s * 2} -6 -12`} />
        <path d={`M-6 -6 L${-6 + sw} 0 M-3 -6 L${-3 - sw} 0 M4 -6 L${4 - sw} 0 M7 -6 L${7 + sw} 0`} />
      </g>
    );
  }
  const f = kind === 'female';
  if (pose === 'lie') {
    return (
      <g transform="translate(0 -3)">
        <circle cx="-13" cy="0" r="4.4" />
        <path d="M-9 0 H8 M8 0 l8 -1" />
        {f && <path d="M-16 -3 q-4 3 0 6" />}
        <path d="M-6 -3 l6 3" stroke={DIM} />
      </g>
    );
  }
  if (pose === 'sit') {
    return (
      <g>
        <circle cx="0" cy="-22" r="4.4" />
        {f && <path d="M-4 -24 q-4 6 -1 10 M4 -24 q4 6 1 10" />}
        <path d="M0 -17 V-7 M0 -7 H9 V0" />
        <path d="M0 -14 L7 -10" />
        {f && <path d="M0 -15 L-5 -7 H5 Z" />}
      </g>
    );
  }
  const leg = moving ? s * 5 : 0;
  const arm = moving ? -s * 4 : 0;
  const climbing = pose === 'climb';
  return (
    <g>
      <circle cx="0" cy="-27" r="4.6" />
      {f && <path d="M-4.4 -29 q-4 7 -1 12 M4.4 -29 q4 7 1 12" />}
      <path d="M0 -22 V-11" />
      <path d={climbing ? `M0 -20 L${-5 + arm} -26 M0 -20 L${5 - arm} -24` : `M0 -20 L${-5 + arm} -12 M0 -20 L${5 - arm} -12`} />
      {f && <path d="M0 -21 L-6 -9 H6 Z" />}
      <path d={`M0 -11 L${-leg} 0 M0 -11 L${leg} 0`} />
    </g>
  );
}
