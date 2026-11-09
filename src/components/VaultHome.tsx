import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { vaultCall, type Account } from '../lib/account';
import ConfirmSpend from './ConfirmSpend';
import { describeBag, lootName, type LootId } from '../lib/raid/loot';
type Bag = Partial<Record<string, number>>;
import {
  COLS, ENTRY_AT, isDoorCell, LEVELS, ROOMS_FOR_VACATION, ROOMS_TO_DIG, ROOM_DEFS, ROWS, buildRecipe, deepestLevel, furnishCost, furnishRecipe, furnitureOf, hasDecon, moodAt, roomAt, roomComplete, roomDef, roomsOn, settlersWaiting, slotsOf,
  whyNotBuild, whyNotDig, DECON_REASON, MAX_VACATIONS, vacationRecipe,
  type RoomType, type Settler, type SettlerKind, type VaultHome, type VaultRoom,
} from '../lib/vaultHome';
import { Face, SettlerArt, type Pose } from './vaultArt';
import { CELL, ExitSign, FURNITURE, HallX, HallY, INK, LIE, LIFT, P, PlacedPiece, RoomOutline, VaultDoor, RoomShell, SIT, cellRect, doorsOf, floorPoint, pieceAt, roomRect, screenBox, type Rect } from './vaultIso';

const REASONS: Record<string, string> = {
  loot: 'NOT ENOUGH LOOT',
  stale: 'THE VAULT CHANGED ON ANOTHER DEVICE: TRY AGAIN',
  not_cleared: 'CLEAR YOUR HOME VAULT FIRST',
  no_home: 'YOU HAVE NO HOME VAULT',
  server: 'COULD NOT REACH THE VAULT',
};

/** The settler's scale in the floorplan. */
const SETTLER_SCALE = 0.95;

/** A discovered place far from home that could be turned into a vacation vault. */
export interface VacationChoice { placeId: string; name: string; icon: string; km: number }
/** What the home vault needs to offer vacation vaults: the places that qualify, how many are already made, and the way to make one (answers with a message if it did not work). */
export interface VacationOffer {
  choices: VacationChoice[];
  count: number;
  /** Ten rooms are built, so vacation vaults can be made. */
  ready: boolean;
  /** The vacation vaults they have now (one of them can be replaced by a new place when all four are used). */
  mine: { placeId: string; name: string }[];
  unlock: (placeId: string, icon: string, replace?: string) => Promise<string | null>;
}

type Panel = { kind: 'build'; level: number; col: number; row: number; type?: RoomType } | { kind: 'room'; idx: number; item?: string } | { kind: 'vacation'; pick?: VacationChoice } | null;

// ---- the settlers' wandering ----

interface Sim { id: number; kind: SettlerKind; level: number; x: number; y: number; path: { x: number; y: number }[]; face: 1 | -1; phase: number; pose: Pose; until: number; lift: number; use: string }

const pick = <T,>(a: T[]): T => a[Math.floor(Math.random() * a.length)];
const cellOf = (x: number, y: number): [number, number] => [Math.max(0, Math.min(COLS - 1, Math.floor(x / CELL))), Math.max(0, Math.min(ROWS - 1, Math.floor(y / CELL)))];

/** The points to walk through to get from one cell to another on a level (world positions): through the doorways between joined rooms. */
function route(v: VaultHome, level: number, from: [number, number], to: [number, number], end: { x: number; y: number }): Sim['path'] {
  const key = (c: number, r: number) => `${c},${r}`;
  const prev = new Map<string, [number, number] | null>([[key(...from), null]]);
  const queue: [number, number][] = [from];
  while (queue.length) {
    const [c, r] = queue.shift() as [number, number];
    if (c === to[0] && r === to[1]) break;
    for (const [dc, dr] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      const n: [number, number] = [c + dc, r + dr];
      if (!roomAt(v, level, n[0], n[1]) || prev.has(key(...n))) continue;
      prev.set(key(...n), [c, r]);
      queue.push(n);
    }
  }
  if (!prev.has(key(...to))) return [end];
  const cells: [number, number][] = [];
  for (let at: [number, number] | null = to; at; at = prev.get(key(...at)) ?? null) cells.unshift(at);
  const path: Sim['path'] = [];
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
      const y = (Math.max(A.y, B.y) + Math.min(A.y + A.d, B.y + B.d)) / 2;
      path.push({ x: dir > 0 ? A.x + A.w - 9 : A.x + 9, y }, { x: dir > 0 ? B.x + 9 : B.x + B.w - 9, y });
    } else {
      // along y, through the doorway in the front room's right wall
      const dir = r > pr ? 1 : -1;
      const x = (Math.max(A.x, B.x, c * CELL) + Math.min(A.x + A.w, B.x + B.w, (c + 1) * CELL)) / 2;
      path.push({ x, y: dir > 0 ? A.y + A.d - 9 : A.y + 9 }, { x, y: dir > 0 ? B.y + 9 : B.y + B.d - 9 });
    }
  }
  path.push(end);
  return path;
}

function plan(s: Sim, v: VaultHome) {
  const rooms = roomsOn(v, s.level);
  if (!rooms.length) return;
  const room = pick(rooms);
  const use = room.furniture.length && Math.random() < 0.65 ? pick(room.furniture) : '';
  let spot = floorPoint(room, 0.1 + Math.random() * 0.8, 0.25 + Math.random() * 0.7);
  if (use && FURNITURE[use]) {
    const p = FURNITURE[use];
    // beside the piece, on the side that faces the room
    spot = floorPoint(room, Math.min(1, p.u + (p.face === 'x' ? 0.16 : 0) + (use === 'chairs' ? pick([-0.18, 0.18]) : 0)), Math.min(1, p.v + (p.face === 'y' ? 0.16 : 0)));
  }
  s.path = route(v, s.level, cellOf(s.x, s.y), cellOf(spot.x, spot.y), spot);
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
    const levels = [...new Set(vault.rooms.map((r) => r.level))];
    for (const st of vault.settlers as Settler[]) {
      if (have.has(st.id)) continue;
      // each settler lives on one level (spread out over the ones that have rooms), and wanders only there
      const level = levels[st.id % levels.length] ?? 0;
      const home = roomsOn(vault, level)[0] ?? vault.rooms[0];
      const at = floorPoint(home, 0.2 + Math.random() * 0.6, 0.4 + Math.random() * 0.4);
      sims.current.push({ id: st.id, kind: st.kind, level, x: at.x, y: at.y, path: [], face: 1, phase: Math.random(), pose: 'stand', until: 0, lift: 0, use: '' });
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
          if (s.pose !== 'walk' && s.path.length === 0) { s.lift = 0; plan(s, v); }
          const wp = s.path[0];
          if (!wp) { s.pose = 'stand'; s.until = now + 600; continue; }
          const dx = wp.x - s.x;
          const dy = wp.y - s.y;
          const dist = Math.hypot(dx, dy);
          const speed = s.kind === 'dog' ? 44 : s.kind === 'cat' ? 38 : 32;
          if (dist <= speed * dt) {
            s.x = wp.x; s.y = wp.y; s.path.shift();
            if (!s.path.length) arrive(s, now);
          } else {
            s.x += (dx / dist) * speed * dt; s.y += (dy / dist) * speed * dt;
            const across = dx - dy; // along the screen
            if (Math.abs(across) > 0.5) s.face = across > 0 ? 1 : -1;
            s.phase = (s.phase + dt * 2.2) % 1;
            s.pose = 'walk';
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

/** Does the loot cover this mix, and what is short? */
function shortOf(recipe: Bag, have: Bag): { id: string; need: number }[] {
  return Object.entries(recipe).filter(([id, n]) => (n ?? 0) > (have[id] ?? 0)).map(([id, n]) => ({ id, need: (n ?? 0) - (have[id] ?? 0) }));
}

/** The mix of loot a room or a piece of furniture costs: each kind with how many are needed and how many you have. The button works only when you have all of it. */
function RecipeCard({ title, what, recipe, have, busy, onPay, onBack, verb }: { title: string; what: string; recipe: Bag; have: Bag; busy: boolean; onPay: () => Promise<void>; onBack: () => void; verb: string }) {
  const short = shortOf(recipe, have);
  // tapping the button asks first: nothing is spent until it is confirmed
  const [asking, setAsking] = useState(false);
  const kinds = Object.entries(recipe).filter(([, n]) => (n ?? 0) > 0);
  return (
    <div className="rm-vh-sheet-body">
      <h3>{title}</h3>
      <p>IT COSTS {kinds.map(([id, n]) => `${n} ${lootName(id as LootId).toUpperCase()}`).join(', ')}.</p>
      <ul className="rm-vh-loot rm-vh-recipe">
        {kinds.map(([id, n]) => {
          const got = have[id] ?? 0;
          return (
            <li key={id} className={got >= (n ?? 0) ? 'ok' : 'short'}>
              <span>{lootName(id as LootId)}</span><b>{n}</b><i>YOU HAVE {got}</i><em>{got >= (n ?? 0) ? '✓' : '✗'}</em>
            </li>
          );
        })}
      </ul>
      {short.length > 0 && <p className="rm-vh-warn">YOU ARE SHORT {short.map((x) => `${x.need} ${lootName(x.id as LootId).toUpperCase()}`).join(', ')}. LOOT SOME MORE PLACES.</p>}
      <div className="rm-vh-row">
        <button type="button" className="rm-btn rm-btn-ghost" onClick={onBack}>BACK</button>
        <button type="button" className="rm-btn" disabled={busy || short.length > 0} onClick={() => setAsking(true)}>{busy ? 'WORKING…' : verb}</button>
      </div>
      {asking && (
        <ConfirmSpend
          tone="vault" title="SPEND THIS LOOT?" what={what} cost={recipe as never} have={have as never} verb={verb}
          onClose={() => setAsking(false)} onConfirm={async () => { await onPay(); return null; }}
        />
      )}
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
 * Your home vault, entered from its snapshot once it is cleared: a floorplan seen from above at a slight angle, five rooms across and three deep, that you clear
 * and build out of loot, fill with furniture out of more loot, and share with settlers who wander about and need looking after. It goes down five levels (each
 * with its own floorplan: the arrows at the side move between them), and 15 rooms is the most there can be. Everything is drawn as old green-screen line art.
 */
export default function VaultHome({ title, account, onExit, vaultKey, vacation }: { title: string; account: Account; onExit: () => void; /** The place id of a vacation vault (the home vault when absent). */ vaultKey?: string; vacation?: VacationOffer }) {
  const call = useCallback((body: Parameters<typeof vaultCall>[0]) => vaultCall({ ...body, vault: vaultKey }), [vaultKey]);
  const [vault, setVault] = useState<VaultHome | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState('');
  const [panel, setPanel] = useState<Panel>(null);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [level, setLevel] = useState(0);
  // which room is blown up in the view (null: the whole level), and the piece of furniture or room that has just been bought and is still materializing
  const [focus, setFocus] = useState<number | null>(null);
  const focusRef = useRef<number | null>(null);
  focusRef.current = focus;
  const [fresh, setFresh] = useState<{ room: number; item?: string } | null>(null);
  useEffect(() => {
    if (!fresh) return;
    const id = window.setTimeout(() => setFresh(null), 2600);
    return () => window.clearTimeout(id);
  }, [fresh]);
  // a message that flashes for a moment: why something cannot be done yet
  const flashTimer = useRef(0);
  const say = useCallback((text: string) => {
    setFlash(text.toUpperCase());
    window.clearTimeout(flashTimer.current);
    flashTimer.current = window.setTimeout(() => setFlash(''), 3600);
  }, []);
  // the camera: the picture is a window onto the level, and moving between the whole level and one room slides and scales that window
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
  const svgRef = useRef<SVGSVGElement>(null);
  const vbRef = useRef<number[] | null>(null);
  const animating = useRef(false);
  const prevFocus = useRef<number | null>(null);
  // The camera: the picture is an svg whose window (its viewBox) is fitted to the floorplan, so a vault of one room is close up and a bigger one farther back.
  const setWindow = (w: number[]) => {
    vbRef.current = w;
    svgRef.current?.setAttribute('viewBox', w.map((n) => Math.round(n * 100) / 100).join(' '));
  };

  // checking in: now, and every half minute while it is open
  useEffect(() => {
    let off = false;
    const visit = async () => {
      const r = await call({ action: 'visit' });
      if (off) return;
      if (r.ok) { setVault(r.vault); setError(null); } else setError(REASONS[r.reason] ?? 'COULD NOT ENTER THE VAULT');
    };
    void visit();
    const id = window.setInterval(() => { if (!document.hidden) void visit(); }, 30_000);
    return () => { off = true; window.clearInterval(id); };
  }, [call]);
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const sims = useSettlers(vault);

  const act = useCallback(async (body: Parameters<typeof vaultCall>[0], done?: (v: VaultHome) => void) => {
    setBusy(true);
    const r = await call(body);
    setBusy(false);
    if (r.ok) { setVault(r.vault); setError(null); setPanel(null); done?.(r.vault); void account.refresh(); } else setError(REASONS[r.reason] ?? r.reason);
  }, [account, call]);

  const mood = vault ? moodAt({ ...vault, seenAt: now }, now) : null;
  const waiting = vault ? settlersWaiting(vault) : 0;

  /** Moves to another level (back to the whole-level view). */
  const goLevel = useCallback((to: number) => { setFocus(null); setPanel(null); setLevel(to); }, []);
  const down = () => {
    if (!vault) return;
    if (level < deepestLevel(vault)) { goLevel(level + 1); return; }
    const why = whyNotDig(vault, level);
    if (why) { say(why); return; }
    goLevel(level + 1);
  };

  // the cells where a room could be built: next to a room of this level, or (on a level with no rooms yet) under a room of the level above
  const openCells = useMemo<[number, number][]>(() => {
    if (!vault) return [];
    const out: [number, number][] = [];
    const here = roomsOn(vault, level);
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        if (roomAt(vault, level, col, row) || isDoorCell(vault, level, col, row)) continue;
        const ok = here.length === 0 ? level > 0 && !!roomAt(vault, level - 1, col, row) : [[-1, 0], [1, 0], [0, -1], [0, 1]].some(([dc, dr]) => roomAt(vault, level, col + dc, row + dr));
        if (ok) out.push([col, row]);
      }
    }
    return out;
  }, [vault, level]);

  // the part of the picture that only changes when the vault does: the rooms and the places for more, back to front, each room with the halls that join it to the ones behind it
  const scene = useMemo(() => {
    if (!vault) return null;
    const here = roomsOn(vault, level);
    const at = (c: number, r: number) => roomAt(vault, level, c, r);
    const tapRoom = (e: React.MouseEvent, idx: number) => {
      if (focusRef.current !== null) return; // while a room is blown up, a tap anywhere (this room too) shrinks it back
      e.stopPropagation();
      setFocus(idx);
      setPanel({ kind: 'room', idx });
    };
    type Layer = { key: string; depth: number; room?: { idx: number; room: VaultRoom }; el: React.ReactElement };
    const layers: Layer[] = [];
    vault.rooms.forEach((room, idx) => {
      if (room.level !== level) return;
      const def = roomDef(room.type);
      const slots = slotsOf(room);
      const me = roomRect(room);
      const { doorsL, doorsR } = doorsOf(room, at);
      const halls: React.ReactElement[] = [];
      const left = at(room.col - 1, room.row);
      if (left) halls.push(<HallX key="hx" left={roomRect(left)} right={me} />);
      for (let c = room.col; c < room.col + slots; c++) {
        const back = at(c, room.row - 1);
        if (back) halls.push(<HallY key={`hy${c}`} back={roomRect(back)} front={me} />);
      }
      layers.push({
        key: `r${idx}`, depth: room.col + slots - 1 + room.row, room: { idx, room },
        el: (
          <g className={`rm-vh-room${fresh && fresh.room === idx && !fresh.item ? ' rm-vh-fresh' : ''}`} role="button" aria-label={def.name}>
            {halls}
            <RoomShell rect={me} name={def.name.toUpperCase()} type={room.type} doorsL={doorsL} doorsR={doorsR} />
          </g>
        ),
      });
    });
    for (const [col, row] of openCells) {
      layers.push({
        key: `c${col}-${row}`, depth: col + row,
        el: (
          <g className="rm-vh-open" role="button" aria-label="Clear and build a room here" onClick={(e) => {
            if (focusRef.current !== null) return;
            e.stopPropagation();
            if (!hasDecon(vault)) { say(DECON_REASON); return; }
            setPanel({ kind: 'build', level, col, row });
          }}>
            <RoomOutline rect={cellRect(col, row)} label={here.length === 0 ? 'DIG DOWN' : 'CLEAR & BUILD'} near={roomAt(vault, level, col - 1, row) ? 'left' : roomAt(vault, level, col, row - 1) ? 'back' : roomAt(vault, level, col + 1, row) ? 'right' : roomAt(vault, level, col, row + 1) ? 'front' : undefined} />
          </g>
        ),
      });
    }
    layers.sort((a, b) => a.depth - b.depth);
    // the level above, faintly, so you can see what you are digging under
    const ghosts = level > 0 ? vault.rooms.filter((r) => r.level === level - 1).map((r, i) => <RoomOutline key={`g${i}`} rect={roomRect(r)} label="" plain />) : [];
    const entry = vault.rooms.find((r) => r.type === 'entry' && r.level === level);
    return { layers, ghosts, entry, tapRoom };
  }, [vault, fresh, level, say, openCells]);

  // the furniture of each room, with where it stands (so it can be painted among the settlers, back to front)
  const pieces = useMemo(() => {
    const out = new Map<number, { key: string; depth: number; el: React.ReactElement }[]>();
    if (!vault) return out;
    vault.rooms.forEach((room, idx) => {
      if (room.level !== level) return;
      out.set(idx, room.furniture.flatMap((id) => {
        const at = pieceAt(room, id);
        return at ? [{ key: `f${idx}-${id}`, depth: at.x + at.y, el: <PlacedPiece key={`f${idx}-${id}`} room={room} id={id} fresh={!!fresh && fresh.room === idx && fresh.item === id} /> }] : [];
      }));
    });
    return out;
  }, [vault, level, fresh]);

  // where the window should be while a room is blown up (above the upgrade popup while that is open)
  const docked = panel?.kind === 'room';
  const roomWindow = (): number[] | null => {
    if (!size || !vault || focus === null) return null;
    const room = vault.rooms[focus];
    if (!room) return null;
    const b = screenBox([roomRect(room)]);
    const usable = docked ? Math.max(120, size.h - window.innerHeight * 0.46) : size.h;
    const pad = 14;
    const sc = Math.min(size.w / (b.w + 2 * pad), usable / (b.h + 2 * pad), 4);
    const w = size.w / sc;
    const h = size.h / sc;
    return [b.x + b.w / 2 - w / 2, b.y + b.h / 2 - usable / 2 / sc, w, h];
  };
  /** The window that shows the whole floorplan, with the places for more rooms: close up on one room, farther back as the vault grows. */
  const fitWindow = (): number[] | null => {
    if (!size || !vault) return null;
    const rects: Rect[] = vault.rooms.filter((r) => r.level === level).map(roomRect);
    for (const [c, r] of openCells) rects.push(cellRect(c, r));
    if (rects.length === 0) rects.push(cellRect(ENTRY_AT.col, ENTRY_AT.row));
    const b = screenBox(rects);
    const pad = 26;
    const sc = Math.min(size.w / (b.w + 2 * pad), size.h / (b.h + 2 * pad), 1.7);
    const w = size.w / sc;
    const h = size.h / sc;
    return [b.x + b.w / 2 - w / 2, b.y + b.h / 2 - h / 2, w, h];
  };
  const ready = !!vault && !!size;
  const roomCount = vault ? vault.rooms.filter((r) => r.level === level).length : 0;
  const prevLevel = useRef(-1);
  useLayoutEffect(() => {
    if (!ready || !size) return;
    const to = roomWindow() ?? fitWindow();
    if (!to) return;
    const from = vbRef.current;
    const newLevel = prevLevel.current !== level;
    prevLevel.current = level;
    prevFocus.current = focus;
    // the first picture, a new level and a turn of the phone just appear; moving onto a room, off it, or back as the vault grows, slides
    if (!from || newLevel) { setWindow(to); return; }
    animating.current = true;
    const t0 = performance.now();
    let raf = 0;
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / 520);
      const e = 1 - Math.pow(1 - k, 3);
      setWindow(from.map((v, i) => v + (to[i] - v) * e));
      if (k < 1) raf = requestAnimationFrame(step);
      else animating.current = false;
    };
    raf = requestAnimationFrame(step);
    return () => { cancelAnimationFrame(raf); animating.current = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, focus, docked, level, roomCount, openCells.length, size?.w, size?.h]);

  const room: VaultRoom | undefined = panel?.kind === 'room' ? vault?.rooms[panel.idx] : undefined;
  const ownLoot = account.loot;
  const rooms = vault ? vault.rooms.length : 0;
  const canDown = !!vault && (level < deepestLevel(vault) || whyNotDig(vault, level) === null);

  return createPortal(
    <div className="rm-vh" role="dialog" aria-label="Your home vault" onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
      <div className="rm-vh-top">
        <b>{title}</b>
        {vacation && !vaultKey && rooms >= ROOMS_FOR_VACATION && <button type="button" className="rm-btn rm-vh-exit rm-vh-vac" onClick={() => setPanel({ kind: 'vacation' })}>VACATION VAULT</button>}
        <button type="button" className={`rm-btn rm-vh-exit${vacation && !vaultKey && rooms >= ROOMS_FOR_VACATION ? ' rm-vh-leave' : ''}`} onClick={onExit}>LEAVE</button>
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
      {flash && <p className="rm-vh-flash" role="status">{flash}</p>}
      <div className="rm-vh-viewwrap">
      <div className={`rm-vh-view${focus !== null ? ' focused' : ''}`} ref={viewRef}>
        {!vault && !error && <p className="rm-vh-wait">ENTERING THE VAULT…</p>}
        {vault && size && scene && (() => {
          // each settler is painted with the room it is in (or, in a hall, with the front-most one), back to front among that room's furniture
          const rooms = scene.layers.filter((l) => l.room);
          const frontIdx = rooms.length ? (rooms[rooms.length - 1].room as { idx: number }).idx : -1;
          const ownerOf = (x: number, y: number): number => rooms.find((l) => { const r = roomRect((l.room as { room: VaultRoom }).room); return x >= r.x - 5 && x <= r.x + r.w + 5 && y >= r.y - 5 && y <= r.y + r.d + 5; })?.room?.idx ?? frontIdx;
          const settlers = sims.filter((s) => s.level === level).map((s) => ({ owner: ownerOf(s.x, s.y), key: `s${s.id}`, depth: s.x + s.y + 0.5, el: (() => { const [X, Y] = P(s.x, s.y, 0); return <g key={`s${s.id}`} transform={`translate(${X} ${Y - s.lift * SETTLER_SCALE}) scale(${s.face * SETTLER_SCALE} ${SETTLER_SCALE})`}><SettlerArt kind={s.kind} pose={s.pose} phase={s.phase} /></g>; })() }));
          return (
            <svg ref={svgRef} className="rm-vh-svg" style={{ width: size.w, height: size.h }} fill="none" stroke={INK} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" onClick={() => { if (focus !== null && !panel) setFocus(null); }}>
              {scene.ghosts}
              {scene.layers.map((l) => {
                const here = l.room;
                const things = here ? [...(pieces.get(here.idx) ?? []), ...settlers.filter((t) => t.owner === here.idx)].sort((x, y) => x.depth - y.depth) : [];
                return <g key={l.key} onClick={here ? (e) => scene.tapRoom(e, here.idx) : undefined}>{l.el}{things.map((t) => t.el)}</g>;
              })}
              {scene.entry && <ExitSign rect={roomRect(scene.entry)} />}
              {scene.entry && <VaultDoor rect={roomRect(scene.entry)} onTap={onExit} />}
            </svg>
          );
        })()}
      </div>
        {vault && (vault.legacy || deepestLevel(vault) > 0 || (hasDecon(vault) && roomsOn(vault, level).length >= ROOMS_TO_DIG)) && (
          <div className="rm-vh-levels" role="group" aria-label="Levels">
            <button type="button" className="rm-vh-lv" disabled={level <= 0} onClick={() => goLevel(level - 1)} aria-label="Up one level">▲</button>
            <span>LEVEL {level + 1}<i>OF {LEVELS}</i></span>
            <button type="button" className={`rm-vh-lv${canDown ? '' : ' locked'}`} disabled={level + 1 >= LEVELS} onClick={down} aria-label="Down one level">▼</button>
          </div>
        )}
      </div>
      {focus !== null && !panel && !waiting && <button type="button" className="rm-btn rm-vh-fab" onClick={() => setPanel({ kind: 'room', idx: focus })}>UPGRADES</button>}
      {docked && !waiting && <div className="rm-vh-backdrop" onClick={() => setPanel(null)} />}

      {vault && panel && !waiting && (
        <div className={`rm-vh-sheet${panel.kind === 'room' ? ' dock' : ''}`} onClick={(e) => { if (e.target === e.currentTarget) setPanel(null); }}>
          <div className="rm-vh-sheet-card">
            {panel.kind === 'vacation' && vacation && !panel.pick && (
              <div className="rm-vh-sheet-body">
                <h3>VACATION VAULT</h3>
                <p>{vacation.count >= MAX_VACATIONS
                  ? `YOU HAVE ALL ${MAX_VACATIONS} OF YOUR VACATION VAULTS.`
                  : `PICK A PLACE YOU HAVE DISCOVERED OUTSIDE YOUR HOME METRO AREA. IT BECOMES A VAULT OF ITS OWN, WITH ITS OWN ENTRYWAY. (${vacation.count} OF ${MAX_VACATIONS} MADE)`}</p>
                {vacation.count < MAX_VACATIONS && (vacation.choices.length === 0
                  ? <p className="rm-vh-warn">NOTHING YET: DISCOVER PLACES OUTSIDE YOUR HOME METRO AREA, OR UNLOCK AN ADDRESS THERE, THEN COME BACK.</p>
                  : (
                    <ul className="rm-vh-types rm-vh-places">
                      {vacation.choices.map((c) => (
                        <li key={c.placeId}><button type="button" onClick={() => setPanel({ kind: 'vacation', pick: c })}><span>{c.name.toUpperCase()}</span><i>{Math.round(c.km).toLocaleString()} KM AWAY</i></button></li>
                      ))}
                    </ul>
                  ))}
                <div className="rm-vh-row"><button type="button" className="rm-btn rm-btn-ghost" onClick={() => setPanel(null)}>CLOSE</button></div>
              </div>
            )}
            {panel.kind === 'vacation' && vacation && panel.pick && (
              <RecipeCard
                verb="UNLOCK" what={panel.pick.name.toUpperCase()} title={`TURN ${panel.pick.name.toUpperCase()} INTO A VAULT`} recipe={vacationRecipe(vault, panel.pick.placeId)} have={ownLoot} busy={busy}
                onBack={() => setPanel({ kind: 'vacation' })}
                onPay={async () => {
                  const pick = panel.pick as VacationChoice;
                  setBusy(true);
                  const problem = await vacation.unlock(pick.placeId, pick.icon);
                  setBusy(false);
                  void account.refresh();
                  if (problem) { setError(problem); return; }
                  setPanel(null);
                  say(`${pick.name} IS NOW YOUR VACATION VAULT: FIND IT ON THE MAP`);
                }}
              />
            )}
            {panel.kind === 'build' && !panel.type && (
              <div className="rm-vh-sheet-body">
                <h3>{roomsOn(vault, panel.level).length === 0 ? 'DIG DOWN' : 'CLEAR & BUILD'}</h3>
                <ul className="rm-vh-types">
                  {ROOM_DEFS.filter((d) => d.buildable !== false).map((d) => {
                    const why = whyNotBuild(vault, d.id, panel.level, panel.col, panel.row);
                    const mix = describeBag(buildRecipe(vault, d.id) as never).toUpperCase();
                    return (
                      <li key={d.id}>
                        <button type="button" disabled={!!why} onClick={() => setPanel({ ...panel, type: d.id })}>
                          <span>{d.name.toUpperCase()}{d.slots === 2 ? ' (2 SLOTS)' : ''}</span>
                          <i>{why ? why.toUpperCase() : mix}</i>
                        </button>
                      </li>
                    );
                  })}
                </ul>
                <div className="rm-vh-row"><button type="button" className="rm-btn rm-btn-ghost" onClick={() => setPanel(null)}>CANCEL</button></div>
              </div>
            )}
            {panel.kind === 'build' && panel.type && (
              <RecipeCard
                verb="BUILD" what={roomDef(panel.type).name.toUpperCase()} title={`BUILD A ${roomDef(panel.type).name.toUpperCase()}`} recipe={buildRecipe(vault, panel.type)} have={ownLoot} busy={busy}
                onBack={() => setPanel({ kind: 'build', level: panel.level, col: panel.col, row: panel.row })}
                onPay={() => act({ action: 'build', type: panel.type as string, level: panel.level, col: panel.col, row: panel.row }, (v) => setFresh({ room: v.rooms.length - 1 }))}
              />
            )}
            {panel.kind === 'room' && room && !panel.item && (
              <div className="rm-vh-sheet-body">
                <button type="button" className="rm-vh-x" onClick={() => setPanel(null)} aria-label="Close">×</button>
                <h3>{roomDef(room.type).name.toUpperCase()}</h3>
                <p>{roomComplete(room) ? 'FULLY FURNISHED.' : `EACH PIECE COSTS ${furnishCost(room)} PIECES OF LOOT, A DIFFERENT MIX FOR EACH.`}</p>
                <ul className="rm-vh-types">
                  {furnitureOf(room.type).map((f) => {
                    const placed = room.furniture.includes(f.id);
                    return (
                      <li key={f.id}>
                        <button type="button" disabled={placed} onClick={() => setPanel({ ...panel, item: f.id })}>
                          <span>{f.name.toUpperCase()}</span><i>{placed ? 'PLACED' : describeBag(furnishRecipe(vault, panel.idx, f.id) as never).toUpperCase()}</i>
                        </button>
                      </li>
                    );
                  })}
                </ul>
                <div className="rm-vh-row"><button type="button" className="rm-btn rm-btn-ghost" onClick={() => setPanel(null)}>CLOSE</button></div>
              </div>
            )}
            {panel.kind === 'room' && room && panel.item && (
              <RecipeCard
                verb="PLACE IT" what={(furnitureOf(room.type).find((f) => f.id === panel.item)?.name ?? '').toUpperCase()} title={`ADD ${(furnitureOf(room.type).find((f) => f.id === panel.item)?.name ?? '').toUpperCase()}`} recipe={furnishRecipe(vault, panel.idx, panel.item)} have={ownLoot} busy={busy}
                onBack={() => setPanel({ kind: 'room', idx: panel.idx })}
                onPay={() => act({ action: 'furnish', room: panel.idx, item: panel.item as string }, () => setFresh({ room: panel.idx, item: panel.item }))}
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
