// What the settlers do in the vault: wander, and use the furniture. A settler picks a piece (sits at the table in a chair they pull out, watches the television they turned
// on, lies on a bed, plays an instrument, cooks at the stove...), walks to the open side of it AROUND everything else in the room (never through furniture), does it for
// a while facing the right way, then stands up and goes on. All of it is plain functions on the vault and the settlers, so it can be checked without a screen.

import { COLS, ROWS, roomAt, roomsOn, type SettlerKind, type VaultHome, type VaultRoom } from '../lib/vaultHome';
import { CELL, USES, floorPoint, footprints, holeRect, layoutOf, roomRect, shapeOf, useAt, type Rect, type UseSpot } from './vaultIso';
import type { Pose } from './vaultArt';

export interface Pt { x: number; y: number }

/** What a settler's doing changes in the room: the television or screen is on, or a dining chair is pulled out. */
export interface Fx { room: number; piece: string; kind: 'screen' | 'chair'; chair?: number }

/** One thing to do: go to the open side of a piece (from), step to the spot (x, y), and stay there for a while in this pose, facing this way. */
export interface Step {
  x: number; y: number; from: Pt; face: 1 | -1; pose: Pose; lift: number; tilt: number; action?: string; hold: number;
  /** The room (an index into the vault's rooms) and the seat it takes (so nobody else takes it). */
  room: number; seat?: string; fx?: Fx;
}

export interface Sim {
  id: number; kind: SettlerKind; level: number; x: number; y: number; path: Pt[]; face: 1 | -1; phase: number; pose: Pose; until: number; lift: number; tilt: number; action?: string;
  queue: Step[]; cur: Step | null; /** Where they stood up from: the open side of the piece they were at. */ exit: Pt | null; fx: Fx | null; seat: string | null;
}

const pick = <T,>(a: T[]): T => a[Math.floor(Math.random() * a.length)];
export const cellOf = (x: number, y: number): [number, number] => [Math.max(0, Math.min(COLS - 1, Math.floor(x / CELL))), Math.max(0, Math.min(ROWS - 1, Math.floor(y / CELL)))];
const between = (lo: number, hi: number): number => lo + Math.random() * (hi - lo);

// ---- the floor of a room, with the furniture on it ----

/** How far from a piece a settler's middle has to stay (about half a body). */
const BODY = 6;
export interface Arena { room: VaultRoom; rect: Rect; notch: Rect | null; named: { id: string; box: Rect }[]; hole: Rect | null }
export function arenaOf(v: VaultHome, room: VaultRoom): Arena {
  const at = (c: number, r: number) => roomAt(v, room.level, c, r);
  const hasHole = room.type !== 'stairs' && roomAt(v, room.level + 1, room.col, room.row)?.type === 'stairs';
  const { rect, notch } = shapeOf(room);
  const named = room.type === 'hallway' || room.type === 'stairs' ? [] : footprints(room, at, hasHole);
  return { room, rect, notch, named, hole: hasHole ? holeRect(room) : null };
}
const within = (b: Rect, x: number, y: number, m: number): boolean => x > b.x - m && x < b.x + b.w + m && y > b.y - m && y < b.y + b.d + m;
/** Can a settler not stand here: off the floor, in the notch, or in (or touching) a piece of furniture or the hole in the floor? */
export function blocked(a: Arena, x: number, y: number): boolean {
  if (a.room.type !== 'hallway' && (x < a.rect.x + 8 || x > a.rect.x + a.rect.w - 8 || y < a.rect.y + 8 || y > a.rect.y + a.rect.d - 8)) return true;
  if (a.notch && within(a.notch, x, y, BODY)) return true;
  if (a.hole && within(a.hole, x, y, BODY)) return true;
  return a.named.some((n) => within(n.box, x, y, BODY));
}
const clear = (a: Arena, p: Pt, q: Pt): boolean => {
  const n = Math.max(1, Math.ceil(Math.hypot(q.x - p.x, q.y - p.y) / 3));
  for (let i = 1; i < n; i++) if (blocked(a, p.x + ((q.x - p.x) * i) / n, p.y + ((q.y - p.y) * i) / n)) return false;
  return true;
};

/** The way from a to b across one room, around its furniture: a straight line if that is clear, otherwise a search over a grid, pulled tight. */
export function avoid(a: Arena, from: Pt, to: Pt): Pt[] {
  if (clear(a, from, to)) return [to];
  const step = 6, x0 = a.rect.x + 8, y0 = a.rect.y + 8;
  const nx = Math.max(2, Math.floor((a.rect.w - 16) / step) + 1), ny = Math.max(2, Math.floor((a.rect.d - 16) / step) + 1);
  const ok = (i: number, j: number) => i >= 0 && j >= 0 && i < nx && j < ny && !blocked(a, x0 + i * step, y0 + j * step);
  const near = (p: Pt): [number, number] | null => {
    const ci = Math.max(0, Math.min(nx - 1, Math.round((p.x - x0) / step))), cj = Math.max(0, Math.min(ny - 1, Math.round((p.y - y0) / step)));
    for (let r = 0; r <= 8; r++) for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) if (Math.max(Math.abs(di), Math.abs(dj)) === r && ok(ci + di, cj + dj)) return [ci + di, cj + dj];
    return null;
  };
  const s = near(from), g = near(to);
  if (!s || !g) return [to];
  const id = (i: number, j: number) => j * nx + i;
  const best = new Map<number, number>([[id(...s), 0]]);
  const came = new Map<number, number>();
  const open: { f: number; i: number; j: number }[] = [{ f: 0, i: s[0], j: s[1] }];
  const h = (i: number, j: number) => Math.hypot(i - g[0], j - g[1]);
  let found = false;
  while (open.length) {
    let k = 0;
    for (let m = 1; m < open.length; m++) if (open[m].f < open[k].f) k = m;
    const { i, j } = open.splice(k, 1)[0];
    if (i === g[0] && j === g[1]) { found = true; break; }
    const here = best.get(id(i, j)) as number;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const ni = i + di, nj = j + dj;
      if (!ok(ni, nj) || (di !== 0 && dj !== 0 && (!ok(i + di, j) || !ok(i, j + dj)))) continue;
      const cost = here + (di !== 0 && dj !== 0 ? 1.414 : 1);
      if (cost < (best.get(id(ni, nj)) ?? Infinity)) { best.set(id(ni, nj), cost); came.set(id(ni, nj), id(i, j)); open.push({ f: cost + h(ni, nj), i: ni, j: nj }); }
    }
  }
  if (!found) return [to];
  const cells: Pt[] = [];
  for (let at: number | undefined = id(...g); at !== undefined; at = came.get(at)) cells.unshift({ x: x0 + (at % nx) * step, y: y0 + Math.floor(at / nx) * step });
  const pts = [from, ...cells, to];
  // pull the string tight: skip every point that can be walked past
  const out: Pt[] = [];
  let i = 0;
  while (i < pts.length - 1) {
    let j = pts.length - 1;
    while (j > i + 1 && !clear(a, pts[i], pts[j])) j--;
    out.push(pts[j]);
    i = j;
  }
  return out;
}

// ---- getting from room to room ----

/** The points to walk through to get from one cell to another on a level (world positions): through the doorways between joined rooms. */
function route(v: VaultHome, level: number, from: [number, number], to: [number, number], end: Pt): Pt[] {
  const key = (c: number, r: number) => `${c},${r}`;
  const prev = new Map<string, [number, number] | null>([[key(...from), null]]);
  const queue: [number, number][] = [from];
  while (queue.length) {
    const [c, r] = queue.shift() as [number, number];
    if (c === to[0] && r === to[1]) break;
    for (const [dc, dr] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      const n: [number, number] = [c + dc, r + dr];
      if (!roomAt(v, level, n[0], n[1]) || roomAt(v, level, n[0], n[1])?.type === 'stairs' || prev.has(key(...n))) continue;
      prev.set(key(...n), [c, r]);
      queue.push(n);
    }
  }
  if (!prev.has(key(...to))) return [end];
  const cells: [number, number][] = [];
  for (let at: [number, number] | null = to; at; at = prev.get(key(...at)) ?? null) cells.unshift(at);
  const path: Pt[] = [];
  for (let i = 1; i < cells.length; i++) {
    const [c, r] = cells[i];
    const [pc, pr] = cells[i - 1];
    const ra = roomAt(v, level, pc, pr);
    const rb = roomAt(v, level, c, r);
    if (!ra || !rb || ra === rb) continue; // inside one wide room there is no door
    const A = roomRect(ra);
    const B = roomRect(rb);
    if (r === pr) {
      // along x, through the doorway in the right room's left wall
      const dir = c > pc ? 1 : -1;
      const y = A.yc ?? B.yc ?? (Math.max(A.y, B.y) + Math.min(A.y + A.d, B.y + B.d)) / 2;
      path.push({ x: dir > 0 ? A.x + A.w - 9 : A.x + 9, y }, { x: dir > 0 ? B.x + 9 : B.x + B.w - 9, y });
    } else {
      // along y, through the doorway in the front room's right wall
      const dir = r > pr ? 1 : -1;
      const x = A.xc ?? B.xc ?? (Math.max(A.x, B.x, c * CELL) + Math.min(A.x + A.w, B.x + B.w, (c + 1) * CELL)) / 2;
      path.push({ x, y: dir > 0 ? A.y + A.d - 9 : A.y + 9 }, { x, y: dir > 0 ? B.y + 9 : B.y + B.d - 9 });
    }
  }
  path.push(end);
  return path;
}

/** The whole way from one spot to another on a level: through the doorways, and around the furniture inside every room on the way. */
export function walkTo(v: VaultHome, level: number, from: Pt, to: Pt): Pt[] {
  const arenas = new Map<VaultRoom, Arena>();
  const arena = (r: VaultRoom) => { let a = arenas.get(r); if (!a) { a = arenaOf(v, r); arenas.set(r, a); } return a; };
  const rough = route(v, level, cellOf(from.x, from.y), cellOf(to.x, to.y), to);
  const out: Pt[] = [];
  let prev = from;
  for (const q of rough) {
    const rp = roomAt(v, level, ...cellOf(prev.x, prev.y));
    const rq = roomAt(v, level, ...cellOf(q.x, q.y));
    if (rp && rp === rq && rp.type !== 'hallway' && rp.type !== 'stairs') out.push(...avoid(arena(rp), prev, q));
    else out.push(q);
    prev = q;
  }
  return out;
}

/** An open spot on a room's floor, away from the furniture. */
export function freePoint(v: VaultHome, room: VaultRoom): Pt {
  const a = arenaOf(v, room);
  for (let i = 0; i < 40; i++) {
    const p = floorPoint(room, 0.1 + Math.random() * 0.8, 0.2 + Math.random() * 0.7);
    if (!blocked(a, p.x, p.y)) return p;
  }
  const r = roomRect(room);
  return { x: r.xc ?? r.x + r.w / 2, y: r.yc ?? r.y + r.d / 2 };
}

// ---- choosing what to do ----

const HOLD: Record<string, [number, number]> = { sit: [8, 14], lie: [12, 22], play: [7, 13], drum: [7, 12], cook: [6, 10], drink: [4, 8], fridge: [2.5, 4], pool: [6, 11], tvon: [1.4, 1.4] };
const holdFor = (u: UseSpot, pet: boolean): number => {
  const [lo, hi] = HOLD[u.action ?? (u.pose === 'lie' ? 'lie' : 'sit')] ?? HOLD.sit;
  return (pet ? 1.3 : 1) * between(lo, hi) * 1000;
};

/** The seats and spots a settler could use in a room right now (not taken, and with an open side to come at it from). */
function options(v: VaultHome, room: VaultRoom, roomIdx: number, pet: boolean, taken: Set<string>): { id: string; i: number; u: UseSpot; step: Step }[] {
  const arena = arenaOf(v, room);
  const out: { id: string; i: number; u: UseSpot; step: Step }[] = [];
  const at = (c: number, r: number) => roomAt(v, room.level, c, r);
  const hasHole = room.type !== 'stairs' && roomAt(v, room.level + 1, room.col, room.row)?.type === 'stairs';
  const spots = layoutOf(room, at, hasHole);
  for (const id of room.furniture) {
    const uses = USES[id];
    const sp = spots.get(id);
    if (!uses || !sp) continue;
    uses.forEach((u, i) => {
      if (pet && !u.pets) return;
      const key = `${roomIdx}:${id}:${i}`;
      if (taken.has(key)) return;
      let w = useAt(room, sp, u);
      if (blocked(arena, w.ax, w.ay)) {
        // the open side is taken by something else: come at it from a little to one side or the other
        const side = [26, -26].map((d) => useAt(room, sp, { ...u, ax: u.ax + (u.lx === 0 ? d : 0), ay: u.ay + (u.lx === 0 ? 0 : d) })).find((alt) => !blocked(arena, alt.ax, alt.ay));
        if (!side) return; // no open side to come at it from
        w = side;
      }
      out.push({
        id, i, u,
        step: {
          x: w.x, y: w.y, from: { x: w.ax, y: w.ay }, face: w.face, pose: pet && u.pose !== 'stand' ? 'lie' : u.pose, lift: u.lift, tilt: pet && !u.bed ? 0 : w.tilt,
          ...(pet ? {} : u.action ? { action: u.action } : {}), hold: holdFor(u, pet), room: roomIdx, seat: key,
          ...(u.chair !== undefined ? { fx: { room: roomIdx, piece: id, kind: 'chair' as const, chair: u.chair } } : {}),
        },
      });
    });
  }
  return out;
}

/** Every seat or spot that is spoken for: held by a settler, or the next thing one of them is going to do. */
export function takenSeats(sims: Sim[]): Set<string> {
  const out = new Set<string>();
  for (const s of sims) { if (s.seat) out.add(s.seat); for (const q of s.queue) if (q.seat) out.add(q.seat); if (s.cur?.seat) out.add(s.cur.seat); }
  return out;
}

/** Gives a settler something to do next: use a piece of furniture in a room on their level, or just wander to an open spot. */
export function plan(s: Sim, v: VaultHome, sims: Sim[]): void {
  const rooms = roomsOn(v, s.level).filter((r) => r.type !== 'stairs');
  if (!rooms.length) return;
  const room = pick(rooms);
  const roomIdx = v.rooms.indexOf(room);
  const pet = s.kind === 'dog' || s.kind === 'cat';
  const taken = takenSeats(sims);
  const all = Math.random() < 0.7 ? options(v, room, roomIdx, pet, taken) : [];
  // a television is a small errand: go and turn it on, then sit down (or stand) to watch it
  const choice = all.length ? pick(all) : null;
  if (!choice) {
    const p = freePoint(v, room);
    s.queue.push({ x: p.x, y: p.y, from: p, face: s.face, pose: 'stand', lift: 0, tilt: 0, hold: between(0.7, 3) * 1000, room: roomIdx });
    return;
  }
  if (choice.id === 'tv') {
    const on: Step = { ...choice.step, fx: { room: roomIdx, piece: 'tv', kind: 'screen' }, hold: 1400 };
    s.queue.push(on);
    const seats = options(v, room, roomIdx, false, new Set([...taken, ...(choice.step.seat ? [choice.step.seat] : [])])).filter((o) => o.id === 'couch' || o.id === 'armchair');
    const watch = Math.round(between(9, 16) * 1000);
    if (seats.length) {
      const o = pick(seats);
      // they face the television from wherever they sit
      const dx = choice.step.x - o.step.x, dy = choice.step.y - o.step.y;
      s.queue.push({ ...o.step, face: dx - dy >= 0 ? 1 : -1, action: 'watch', hold: watch });
    } else on.hold += watch;
    return;
  }
  const step = choice.step;
  // the movie starts when someone sits down in the theatre seats
  if (choice.id === 'seating') {
    const screen = room.furniture.includes('screen');
    if (screen) step.fx = { room: roomIdx, piece: 'screen', kind: 'screen' };
  }
  s.queue.push(step);
}

/** Starts a step: the way there (from where they stand, or stood up from), around everything. */
export function begin(s: Sim, step: Step, v: VaultHome): void {
  const from = s.exit ?? { x: s.x, y: s.y };
  const path = walkTo(v, s.level, from, step.from);
  s.path = [...(s.exit ? [s.exit] : []), ...path, ...(step.x !== step.from.x || step.y !== step.from.y ? [{ x: step.x, y: step.y }] : [])];
  s.exit = null;
  s.cur = step;
  s.seat = step.seat ?? null;
  s.pose = 'stand'; s.lift = 0; s.tilt = 0; s.action = undefined;
  if (step.fx?.kind === 'chair') s.fx = step.fx; // the chair is pulled out as they come to it
}

/** They have got there: the pose, the way they face, and what the room does (the screen comes on). */
export function arrive(s: Sim, now: number): void {
  const c = s.cur;
  if (!c) { s.pose = 'stand'; s.until = now + 600; return; }
  s.pose = c.pose; s.face = c.face; s.lift = c.lift; s.tilt = c.tilt; s.action = c.action;
  s.until = now + c.hold;
  s.exit = c.from;
  if (c.fx?.kind === 'screen') s.fx = c.fx;
}

/** Done with everything they were doing: free the seat, and the room goes back (the screen goes off, the chair is pushed in). */
export function finish(s: Sim): void {
  s.seat = null; s.fx = null; s.cur = null;
  s.pose = 'stand'; s.lift = 0; s.tilt = 0; s.action = undefined;
}

/** What settlers are doing to the furniture right now, by room and piece: which screens are on and which dining chairs are pulled out. */
export function liveOf(sims: Sim[]): Map<string, { on?: boolean; pulled?: number[] }> {
  const out = new Map<string, { on?: boolean; pulled?: number[] }>();
  for (const s of sims) {
    const f = s.fx;
    if (!f) continue;
    const k = `${f.room}:${f.piece}`;
    const e = out.get(k) ?? {};
    if (f.kind === 'screen') e.on = true;
    else if (f.chair !== undefined) e.pulled = [...(e.pulled ?? []), f.chair];
    out.set(k, e);
  }
  return out;
}
