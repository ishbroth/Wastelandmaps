import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { vaultCall, type Account } from '../lib/account';
import { LOOT_TYPES, bagTotal } from '../lib/raid/loot';
type Bag = Partial<Record<string, number>>;
import {
  COLS, ROOM_DEFS, ROWS, buildCost, furnishCost, furnitureOf, moodAt, roomAt, roomComplete, roomDef, settlersWaiting, slotsOf, whyNotBuild,
  type RoomType, type Settler, type SettlerKind, type VaultHome, type VaultRoom,
} from '../lib/vaultHome';
import { BG, DIM, ExitSign, FL, FURNITURE, Face, H, INK, LM, P, Q, ROUND, SettlerArt, TM, VIEW_H, VIEW_W, VaultDoor, W, floorY, roomBox, type Pose } from './vaultArt';

const REASONS: Record<string, string> = {
  loot: 'NOT ENOUGH LOOT',
  stale: 'THE VAULT CHANGED ON ANOTHER DEVICE: TRY AGAIN',
  not_cleared: 'CLEAR YOUR HOME VAULT FIRST',
  no_home: 'YOU HAVE NO HOME VAULT',
  server: 'COULD NOT REACH THE VAULT',
  pay: 'THE LOOT DOES NOT ADD UP',
};

type Panel = { kind: 'build'; col: number; row: number; type?: RoomType } | { kind: 'room'; idx: number; item?: string } | null;

// ---- where a cell's ladder goes ----

/** The span of x a room covers inside one slot. */
function cellRange(v: VaultHome, col: number, row: number): [number, number] | null {
  const room = roomAt(v, col, row);
  if (!room) return null;
  const b = roomBox(room.type, room.col, room.row);
  if (slotsOf(room) === 2) return col === room.col ? [b.x, LM + (room.col + 1) * P] : [LM + (room.col + 1) * P, b.x + b.w];
  return [b.x, b.x + b.w];
}

/** Where the ladder between a cell and the cell under it stands, or null if the two rooms do not overlap enough for one. */
function ladderX(v: VaultHome, col: number, row: number): number | null {
  const a = cellRange(v, col, row);
  const b = cellRange(v, col, row + 1);
  if (!a || !b) return null;
  const lo = Math.max(a[0], b[0]);
  const hi = Math.min(a[1], b[1]);
  return hi - lo >= 26 ? lo + 15 : null;
}

// ---- the settlers' wandering ----

interface Sim { id: number; kind: SettlerKind; x: number; y: number; path: { x: number; y: number; climb?: boolean }[]; face: 1 | -1; phase: number; pose: Pose; until: number; lift: number; use: string }

const SIT = new Set(['couch', 'armchair', 'chairs', 'seating', 'bar']);
const LIE = new Set(['bed']);
const LIFT: Record<string, number> = { couch: 9, armchair: 9, chairs: 11, seating: 11, bar: 12, bed: 12 };
const pick = <T,>(a: T[]): T => a[Math.floor(Math.random() * a.length)];
const clampCol = (x: number) => Math.max(0, Math.min(COLS - 1, Math.floor((x - LM) / P)));
const clampRow = (y: number) => Math.max(0, Math.min(ROWS - 1, Math.round((y - TM - FL) / Q)));

/** The list of places to walk through to get from one cell to another (cells joined sideways, or by a ladder). */
function route(v: VaultHome, from: [number, number], to: [number, number]): Sim['path'] {
  const key = (c: number, r: number) => `${c},${r}`;
  const prev = new Map<string, [number, number] | null>([[key(...from), null]]);
  const queue: [number, number][] = [from];
  while (queue.length) {
    const [c, r] = queue.shift() as [number, number];
    if (c === to[0] && r === to[1]) break;
    const next: [number, number][] = [];
    if (roomAt(v, c - 1, r)) next.push([c - 1, r]);
    if (roomAt(v, c + 1, r)) next.push([c + 1, r]);
    if (ladderX(v, c, r) !== null) next.push([c, r + 1]);
    if (r > 0 && ladderX(v, c, r - 1) !== null) next.push([c, r - 1]);
    for (const n of next) if (!prev.has(key(...n))) { prev.set(key(...n), [c, r]); queue.push(n); }
  }
  if (!prev.has(key(...to))) return [];
  const cells: [number, number][] = [];
  for (let at: [number, number] | null = to; at; at = prev.get(key(...at)) ?? null) cells.unshift(at);
  const path: Sim['path'] = [];
  for (let i = 1; i < cells.length; i++) {
    const [c, r] = cells[i];
    const [pc, pr] = cells[i - 1];
    if (r === pr) path.push({ x: LM + c * P + P / 2, y: floorY(r) });
    else {
      const lx = ladderX(v, pc, Math.min(pr, r)) as number;
      path.push({ x: lx, y: floorY(pr) }, { x: lx, y: floorY(r), climb: true });
    }
  }
  return path;
}

function plan(s: Sim, v: VaultHome) {
  const room = pick(v.rooms);
  const b = roomBox(room.type, room.col, room.row);
  let tx = b.x + 14 + Math.random() * (b.w - 28);
  let use = '';
  if (room.furniture.length && Math.random() < 0.65) {
    use = pick(room.furniture);
    tx = b.x + FURNITURE[use].x + (use === 'chairs' ? pick([-44, 44]) : 0);
  }
  const from: [number, number] = [clampCol(s.x), clampRow(s.y)];
  const to: [number, number] = [clampCol(tx), room.row];
  const path = route(v, from, to);
  if (!path.length && (from[0] !== to[0] || from[1] !== to[1])) { s.x = tx; s.y = floorY(room.row); }
  path.push({ x: tx, y: floorY(room.row) });
  s.path = path;
  s.lift = 0;
  s.use = use;
  s.until = 0;
}

function arrive(s: Sim, now: number) {
  const use = s.use;
  const pet = s.kind === 'dog' || s.kind === 'cat';
  if (use && (SIT.has(use) || LIE.has(use))) {
    s.pose = LIE.has(use) || (pet && use !== 'bar') ? 'lie' : 'sit';
    s.lift = LIFT[use] ?? 0;
    s.until = now + 5000 + Math.random() * 6000;
  } else {
    s.pose = 'stand';
    s.until = now + (use ? 3500 + Math.random() * 4000 : 700 + Math.random() * 2200);
    if (use) s.face = pick([1, -1]);
  }
}

function useSettlers(vault: VaultHome | null) {
  const sims = useRef<Sim[]>([]);
  const vref = useRef<VaultHome | null>(vault);
  vref.current = vault;
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!vault) return;
    const have = new Set(sims.current.map((s) => s.id));
    for (const st of vault.settlers as Settler[]) {
      if (!have.has(st.id)) sims.current.push({ id: st.id, kind: st.kind, x: roomBox('living', 0, 0).x + 30 + Math.random() * 100, y: floorY(0), path: [], face: 1, phase: Math.random(), pose: 'stand', until: 0, lift: 0, use: '' });
    }
  }, [vault]);
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let frame = 0;
    const loop = (t: number) => {
      const dt = Math.min(0.1, (t - last) / 1000);
      last = t;
      const v = vref.current;
      const now = Date.now();
      if (v && v.rooms.length) {
        for (const s of sims.current) {
          if (s.until > now) continue;
          if (s.pose !== 'walk' && s.pose !== 'climb' && s.path.length === 0) { s.lift = 0; plan(s, v); }
          const wp = s.path[0];
          if (!wp) { s.pose = 'stand'; s.until = now + 600; continue; }
          const dx = wp.x - s.x;
          const dy = wp.y - s.y;
          const dist = Math.hypot(dx, dy);
          const speed = wp.climb ? 22 : s.kind === 'dog' ? 36 : s.kind === 'cat' ? 31 : 27;
          if (dist <= speed * dt) {
            s.x = wp.x; s.y = wp.y; s.path.shift();
            if (!s.path.length) arrive(s, now);
          } else {
            s.x += (dx / dist) * speed * dt; s.y += (dy / dist) * speed * dt;
            if (Math.abs(dx) > 0.5) s.face = dx > 0 ? 1 : -1;
            s.phase = (s.phase + dt * (wp.climb ? 1.3 : 2.2)) % 1;
            s.pose = wp.climb ? 'climb' : 'walk';
          }
        }
      }
      if (++frame % 3 === 0) setTick((n) => (n + 1) % 1_000_000);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
  return sims.current;
}

// ---- the loot you pay with ----

function LootPicker({ title, cost, have, busy, onPay, onBack }: { title: string; cost: number; have: Bag; busy: boolean; onPay: (pay: Bag) => void; onBack: () => void }) {
  const [pay, setPay] = useState<Bag>({});
  const chosen = bagTotal(pay as never);
  const set = (id: string, n: number) => setPay((p) => ({ ...p, [id]: Math.max(0, Math.min(have[id] ?? 0, n)) }));
  const total = LOOT_TYPES.reduce((n, l) => n + (have[l.id] ?? 0), 0);
  const auto = () => {
    const next: Bag = {};
    for (let i = 0; i < cost; i++) {
      const best = LOOT_TYPES.map((l) => ({ id: l.id, left: (have[l.id] ?? 0) - (next[l.id] ?? 0) })).sort((a, b) => b.left - a.left)[0];
      if (!best || best.left <= 0) break;
      next[best.id] = (next[best.id] ?? 0) + 1;
    }
    setPay(next);
  };
  return (
    <div className="rm-vh-sheet-body">
      <h3>{title}</h3>
      <p>PAY EXACTLY {cost} PIECES OF LOOT, ANY MIX. <b>{chosen}/{cost}</b></p>
      {total < cost && <p className="rm-vh-warn">YOU ONLY HAVE {total} PIECES. GO LOOT SOME MORE PLACES.</p>}
      <ul className="rm-vh-loot">
        {LOOT_TYPES.map((l) => (
          <li key={l.id} className={(have[l.id] ?? 0) === 0 ? 'none' : ''}>
            <span>{l.name}</span><i>{have[l.id] ?? 0}</i>
            <button type="button" disabled={(pay[l.id] ?? 0) <= 0} onClick={() => set(l.id, (pay[l.id] ?? 0) - 1)} aria-label={`less ${l.name}`}>−</button>
            <b>{pay[l.id] ?? 0}</b>
            <button type="button" disabled={(pay[l.id] ?? 0) >= (have[l.id] ?? 0) || chosen >= cost} onClick={() => set(l.id, (pay[l.id] ?? 0) + 1)} aria-label={`more ${l.name}`}>+</button>
          </li>
        ))}
      </ul>
      <div className="rm-vh-row">
        <button type="button" className="rm-btn rm-btn-ghost" onClick={onBack}>BACK</button>
        <button type="button" className="rm-btn rm-btn-ghost" disabled={total < cost} onClick={auto}>AUTO</button>
        <button type="button" className="rm-btn" disabled={busy || chosen !== cost} onClick={() => onPay(pay)}>{busy ? 'WORKING…' : 'BUILD'}</button>
      </div>
    </div>
  );
}

/** What a settler looks like in the picker. */
function SettlerPreview({ kind }: { kind: SettlerKind }) {
  return (
    <svg viewBox="-22 -38 44 42" width="64" height="62" fill="none" stroke={INK} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><SettlerArt kind={kind} pose="stand" phase={0} /></svg>
  );
}

/**
 * Your home vault, entered from its snapshot once it is cleared: a grid of rooms (three across, five down) that you clear and build out of loot, fill with
 * furniture out of more loot, and share with settlers who wander about and need looking after. Everything is drawn as old green-screen line art.
 */
export default function VaultHome({ title, account, onExit }: { title: string; account: Account; onExit: () => void }) {
  const [vault, setVault] = useState<VaultHome | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [panel, setPanel] = useState<Panel>(null);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  // which room is blown up in the view (null: the whole vault), and the piece of furniture or room that has just been bought and is still materializing
  const [focus, setFocus] = useState<number | null>(null);
  const focusRef = useRef<number | null>(null);
  focusRef.current = focus;
  const [fresh, setFresh] = useState<{ room: number; item?: string } | null>(null);
  useEffect(() => {
    if (!fresh) return;
    const id = window.setTimeout(() => setFresh(null), 2600);
    return () => window.clearTimeout(id);
  }, [fresh]);
  // the camera: the picture is a window onto the vault, and moving between the whole vault and one room slides and scales that window
  const viewRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  useEffect(() => {
    const el = viewRef.current;
    if (!el) return;
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const [vb, setVb] = useState<number[] | null>(null);
  const vbRef = useRef<number[] | null>(null);

  // checking in: now, and every half minute while it is open
  useEffect(() => {
    let off = false;
    const visit = async () => {
      const r = await vaultCall({ action: 'visit' });
      if (off) return;
      if (r.ok) { setVault(r.vault); setError(null); } else setError(REASONS[r.reason] ?? 'COULD NOT ENTER THE VAULT');
    };
    void visit();
    const id = window.setInterval(() => { if (!document.hidden) void visit(); }, 30_000);
    return () => { off = true; window.clearInterval(id); };
  }, []);
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const sims = useSettlers(vault);

  const act = useCallback(async (body: Parameters<typeof vaultCall>[0], done?: (v: VaultHome) => void) => {
    setBusy(true);
    const r = await vaultCall(body);
    setBusy(false);
    if (r.ok) { setVault(r.vault); setError(null); setPanel(null); done?.(r.vault); void account.refresh(); } else setError(REASONS[r.reason] ?? r.reason);
  }, [account]);

  const mood = vault ? moodAt({ ...vault, seenAt: now }, now) : null;
  const waiting = vault ? settlersWaiting(vault) : 0;

  // the part of the picture that only changes when the vault does
  const scene = useMemo(() => {
    if (!vault) return null;
    const open = (col: number, row: number) => !roomAt(vault, col, row) && col >= 0 && col < COLS && row >= 0 && row < ROWS
      && [[-1, 0], [1, 0], [0, -1], [0, 1]].some(([dc, dr]) => roomAt(vault, col + dc, row + dr));
    const tunnels: React.ReactElement[] = [];
    const rooms: React.ReactElement[] = [];
    const cells: React.ReactElement[] = [];
    const tapRoom = (e: React.MouseEvent, idx: number) => {
      if (focusRef.current !== null) return; // while a room is blown up, a tap anywhere (this room too) shrinks it back
      e.stopPropagation();
      setFocus(idx);
      setPanel({ kind: 'room', idx });
    };
    vault.rooms.forEach((room, idx) => {
      const def = roomDef(room.type);
      const b = roomBox(room.type, room.col, room.row);
      const y = floorY(room.row);
      const right = roomAt(vault, room.col + slotsOf(room), room.row);
      if (right) {
        const rb = roomBox(right.type, right.col, right.row);
        tunnels.push(<g key={`h${idx}`}><path d={`M${b.x + b.w} ${y - 34} H${rb.x} M${b.x + b.w} ${y} H${rb.x}`} /><path d={`M${b.x + b.w + 4} ${y - 17} H${rb.x - 4}`} stroke={DIM} strokeDasharray="3 4" /></g>);
      }
      // a short piece of tunnel leading toward each place the next room could go
      const last = room.col + slotsOf(room) - 1;
      if (open(room.col - 1, room.row)) tunnels.push(<g key={`sl${idx}`}><path d={`M${b.x} ${y - 34} H${b.x - 24} M${b.x} ${y} H${b.x - 24}`} /><path d={`M${b.x - 4} ${y - 17} H${b.x - 22}`} stroke={DIM} strokeDasharray="3 4" /></g>);
      if (open(last + 1, room.row)) tunnels.push(<g key={`sr${idx}`}><path d={`M${b.x + b.w} ${y - 34} H${b.x + b.w + 24} M${b.x + b.w} ${y} H${b.x + b.w + 24}`} /><path d={`M${b.x + b.w + 4} ${y - 17} H${b.x + b.w + 22}`} stroke={DIM} strokeDasharray="3 4" /></g>);
      for (let c = room.col; c <= last; c++) {
        const range = cellRange(vault, c, room.row) as [number, number];
        const sx = range[0] + 15;
        if (open(c, room.row + 1)) tunnels.push(<g key={`sd${idx}-${c}`}><path d={`M${sx - 13} ${b.y + H} V${b.y + H + 28} M${sx + 13} ${b.y + H} V${b.y + H + 28}`} />{[8, 16, 24].map((d) => <path key={d} d={`M${sx - 7} ${b.y + H + d} H${sx + 7}`} stroke={DIM} />)}</g>);
        if (open(c, room.row - 1)) tunnels.push(<g key={`su${idx}-${c}`}><path d={`M${sx - 13} ${b.y} V${b.y - 28} M${sx + 13} ${b.y} V${b.y - 28}`} />{[8, 16, 24].map((d) => <path key={d} d={`M${sx - 7} ${b.y - d} H${sx + 7}`} stroke={DIM} />)}</g>);
        const lx = ladderX(vault, c, room.row);
        if (lx === null) continue;
        const y1 = b.y + FL;
        const y2 = floorY(room.row + 1);
        const bottom = b.y + H;
        const top = TM + (room.row + 1) * Q;
        tunnels.push(
          <g key={`v${idx}-${c}`}>
            <path d={`M${lx - 13} ${bottom} V${top} M${lx + 13} ${bottom} V${top}`} />
            <path d={`M${lx - 7} ${y1} V${y2} M${lx + 7} ${y1} V${y2}`} stroke={INK} />
            {Array.from({ length: Math.floor((y2 - y1) / 8) }, (_, i) => <path key={i} d={`M${lx - 7} ${y1 + 5 + i * 8} H${lx + 7}`} stroke={DIM} />)}
            <path d={`M${lx - 13} ${bottom - 1} H${lx + 13} M${lx - 13} ${top + 1} H${lx + 13}`} stroke={BG} strokeWidth="3" />
          </g>,
        );
      }
      rooms.push(
        <g key={`r${idx}`} className={`rm-vh-room${fresh && fresh.room === idx && !fresh.item ? ' rm-vh-fresh' : ''}`} onClick={(e) => tapRoom(e, idx)} role="button" aria-label={def.name}>
          <rect x={b.x} y={b.y} width={b.w} height={H} rx={ROUND} fill={BG} strokeWidth="2.4" />
          <rect x={b.x + 4} y={b.y + 4} width={b.w - 8} height={H - 8} rx={ROUND - 3} stroke={DIM} />
          <path d={`M${b.x + 4} ${b.y + FL} H${b.x + b.w - 4}`} stroke={DIM} />
          <text x={b.x + b.w - 13} y={b.y + H - 8} fontSize="15" fill={INK} stroke="none" fontFamily="'VT323', monospace" textAnchor="end" letterSpacing="1.2">{def.name.toUpperCase()}</text>
          {room.furniture.map((id) => (FURNITURE[id] ? <g key={id} className={fresh && fresh.room === idx && fresh.item === id ? 'rm-vh-fresh' : undefined} transform={`translate(${b.x + FURNITURE[id].x} ${b.y + FL})`}>{FURNITURE[id].art}</g> : null))}
          {idx === 0 && <ExitSign x={b.x + 12} y={b.y + 24} />}
        </g>,
      );
    });
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        if (!open(col, row)) continue;
        const x = LM + col * P + (P - W) / 2;
        cells.push(
          <g key={`c${col}-${row}`} className="rm-vh-open" onClick={(e) => { if (focusRef.current !== null) return; e.stopPropagation(); setPanel({ kind: 'build', col, row }); }} role="button" aria-label="Clear and build a room here">
            <rect x={x} y={TM + row * Q} width={W} height={H} rx={ROUND} strokeDasharray="6 5" fill="rgba(61,255,138,0.04)" />
            <text x={x + W / 2} y={TM + row * Q + H / 2 - 2} fontSize="30" fill={INK} stroke="none" fontFamily="'VT323', monospace" textAnchor="middle">+</text>
            <text x={x + W / 2} y={TM + row * Q + H / 2 + 20} fontSize="17" fill={INK} stroke="none" fontFamily="'VT323', monospace" textAnchor="middle" letterSpacing="1.5">CLEAR &amp; BUILD</text>
          </g>,
        );
      }
    }
    const first = roomBox('living', 0, 0);
    return (
      <>
        {tunnels}
        <VaultDoor x={4} top={first.y + 8} bottom={floorY(0)} />
        {cells}
        {rooms}
      </>
    );
  }, [vault, fresh]);

  // where the camera should be: over the whole vault, or over one room (above the upgrade popup while that is open)
  const docked = panel?.kind === 'room';
  const target = useMemo<number[] | null>(() => {
    if (!size || !vault || size.w < 10 || size.h < 10) return null;
    const room = focus !== null ? vault.rooms[focus] : undefined;
    if (!room) {
      const sc = Math.min(size.w / VIEW_W, size.h / VIEW_H);
      const w = size.w / sc;
      const h = size.h / sc;
      return [(VIEW_W - w) / 2, (VIEW_H - h) * 0.3, w, h].map((n) => Math.round(n * 10) / 10);
    }
    const b = roomBox(room.type, room.col, room.row);
    const usable = docked ? Math.max(120, size.h - window.innerHeight * 0.46) : size.h;
    const pad = 14;
    const sc = Math.min(size.w / (b.w + 2 * pad), usable / (H + 2 * pad), 4);
    const w = size.w / sc;
    const h = size.h / sc;
    return [b.x + b.w / 2 - w / 2, b.y + H / 2 - usable / 2 / sc, w, h].map((n) => Math.round(n * 10) / 10);
  }, [size, vault, focus, docked]);
  const targetKey = target ? target.join(',') : '';
  useEffect(() => {
    if (!target) return;
    const from = vbRef.current;
    if (!from) { vbRef.current = target; setVb(target); return; }
    const t0 = performance.now();
    let raf = 0;
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / 480);
      const e = 1 - Math.pow(1 - k, 3);
      const cur = from.map((v, i) => v + (target[i] - v) * e);
      vbRef.current = cur;
      setVb(cur);
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetKey]);

  const room: VaultRoom | undefined = panel?.kind === 'room' ? vault?.rooms[panel.idx] : undefined;
  const ownLoot = account.loot;

  return createPortal(
    <div className="rm-vh" role="dialog" aria-label="Your home vault">
      <div className="rm-vh-top">
        <b>{title}</b>
        <button type="button" className="rm-btn rm-vh-exit" onClick={onExit}>LEAVE</button>
      </div>
      {mood && vault && vault.settlers.length > 0 && (
        <div className="rm-vh-mood" title={`Baseline ${mood.baseline}, lowest ${mood.floor}`}>
          <Face word={mood.word} />
          <span>HAPPINESS</span>
          <div className="rm-vh-bar"><div style={{ width: `${mood.shown}%` }} /></div>
          <b>{mood.shown}</b>
          <em>{mood.word}</em>
        </div>
      )}
      {error && <p className="rm-vh-error" onClick={() => setError(null)}>{error}</p>}
      <div className="rm-vh-view" ref={viewRef}>
        {!vault && !error && <p className="rm-vh-wait">ENTERING THE VAULT…</p>}
        {vault && vb && (
          <svg viewBox={vb.join(' ')} fill="none" stroke={INK} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" onClick={() => { if (focus !== null && !panel) setFocus(null); }}>
            {scene}
            {sims.map((s) => (
              <g key={s.id} transform={`translate(${s.x} ${s.y - s.lift}) scale(${s.face} 1)`}><SettlerArt kind={s.kind} pose={s.pose} phase={s.phase} /></g>
            ))}
          </svg>
        )}
        {focus !== null && !panel && !waiting && <button type="button" className="rm-btn rm-vh-fab" onClick={() => setPanel({ kind: 'room', idx: focus })}>UPGRADES</button>}
      </div>
      {docked && !waiting && <div className="rm-vh-backdrop" onClick={() => setPanel(null)} />}

      {vault && panel && !waiting && (
        <div className={`rm-vh-sheet${panel.kind === 'room' ? ' dock' : ''}`} onClick={(e) => { if (e.target === e.currentTarget) setPanel(null); }}>
          <div className="rm-vh-sheet-card">
            {panel.kind === 'build' && !panel.type && (
              <div className="rm-vh-sheet-body">
                <h3>CLEAR &amp; BUILD</h3>
                <p>WHAT KIND OF ROOM? IT STARTS EMPTY, AND WHAT YOU PICK DECIDES THE FURNITURE YOU CAN ADD.</p>
                <ul className="rm-vh-types">
                  {ROOM_DEFS.map((d) => {
                    const why = whyNotBuild(vault, d.id, panel.col, panel.row);
                    const cost = buildCost(vault, d.id);
                    return (
                      <li key={d.id}>
                        <button type="button" disabled={!!why} onClick={() => setPanel({ ...panel, type: d.id })}>
                          <span>{d.name.toUpperCase()}{d.slots === 2 ? ' (2 SLOTS)' : ''}</span>
                          <i>{why ? why.toUpperCase() : `${cost} PIECES`}</i>
                        </button>
                      </li>
                    );
                  })}
                </ul>
                <div className="rm-vh-row"><button type="button" className="rm-btn rm-btn-ghost" onClick={() => setPanel(null)}>CANCEL</button></div>
              </div>
            )}
            {panel.kind === 'build' && panel.type && (
              <LootPicker
                title={`BUILD A ${roomDef(panel.type).name.toUpperCase()}`} cost={buildCost(vault, panel.type)} have={ownLoot} busy={busy}
                onBack={() => setPanel({ kind: 'build', col: panel.col, row: panel.row })}
                onPay={(pay) => void act({ action: 'build', type: panel.type as string, col: panel.col, row: panel.row, pay }, (v) => setFresh({ room: v.rooms.length - 1 }))}
              />
            )}
            {panel.kind === 'room' && room && !panel.item && (
              <div className="rm-vh-sheet-body">
                <button type="button" className="rm-vh-x" onClick={() => setPanel(null)} aria-label="Close">×</button>
                <h3>{roomDef(room.type).name.toUpperCase()}</h3>
                <p>{roomComplete(room) ? 'FULLY FURNISHED.' : `NEXT PIECE: ${furnishCost(room)} PIECES OF LOOT.`}</p>
                <ul className="rm-vh-types">
                  {furnitureOf(room.type).map((f) => {
                    const placed = room.furniture.includes(f.id);
                    return (
                      <li key={f.id}>
                        <button type="button" disabled={placed} onClick={() => setPanel({ ...panel, item: f.id })}>
                          <span>{f.name.toUpperCase()}</span><i>{placed ? 'PLACED' : `${furnishCost(room)} PIECES`}</i>
                        </button>
                      </li>
                    );
                  })}
                </ul>
                <div className="rm-vh-row"><button type="button" className="rm-btn rm-btn-ghost" onClick={() => setPanel(null)}>CLOSE</button></div>
              </div>
            )}
            {panel.kind === 'room' && room && panel.item && (
              <LootPicker
                title={`ADD ${(furnitureOf(room.type).find((f) => f.id === panel.item)?.name ?? '').toUpperCase()}`} cost={furnishCost(room)} have={ownLoot} busy={busy}
                onBack={() => setPanel({ kind: 'room', idx: panel.idx })}
                onPay={(pay) => void act({ action: 'furnish', room: panel.idx, item: panel.item as string, pay }, () => setFresh({ room: panel.idx, item: panel.item }))}
              />
            )}
          </div>
        </div>
      )}

      {vault && waiting > 0 && (
        <div className="rm-vh-sheet">
          <div className="rm-vh-sheet-card">
            <div className="rm-vh-sheet-body">
              <h3>A SETTLER HAS ARRIVED</h3>
              <p>THEY HAVE MOVED INTO YOUR VAULT. WHO ARE THEY?</p>
              <div className="rm-vh-kinds">
                {(['male', 'female', 'dog', 'cat'] as SettlerKind[]).map((k) => (
                  <button key={k} type="button" disabled={busy} onClick={() => void act({ action: 'settler', kind: k })}><SettlerPreview kind={k} /><span>{k === 'male' ? 'MAN' : k === 'female' ? 'WOMAN' : k.toUpperCase()}</span></button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
      <div className="rm-vh-scan" aria-hidden="true" />
    </div>,
    document.body,
  );
}
