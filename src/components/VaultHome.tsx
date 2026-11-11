import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { isNative, saveBlob } from '../lib/native';
import { vaultCall, type Account } from '../lib/account';
import ConfirmSpend from './ConfirmSpend';
import { canAfford, describeBag, lootName, type LootId } from '../lib/raid/loot';
type Bag = Partial<Record<string, number>>;
import {
  COLS, ENTRY_AT, isPassage, MAX_HALLWAYS_PER_LEVEL, hallwaysOn, isDoorCell, LEVELS, ROOMS_FOR_VACATION, roomCount as countRooms, ROOM_DEFS, ROWS, buildRecipe, furnishCost, furnishRecipe, furnitureOf, hasDecon, moodAt, roomAt, roomComplete, roomDef, roomsOn, settlersWaiting, slotsOf,
  whyNotBuild, whyNotDemolish, hasWayDown, hasWayUp, stairDir, openCell, spentOn, INSTRUMENTS, INSTRUMENT_NAMES, slotOf, DECON_REASON, MAX_VACATIONS, vacationRecipe, SETTLER_NAME_MAX, cleanSettlerName,
  type RoomType, type Settler, type SettlerKind, type VaultHome, type VaultRoom,
} from '../lib/vaultHome';
import { Face, SettlerArt } from './vaultArt';
import { type Sim, arrive, begin, finish, freePoint, liveOf, plan } from './vaultSims';
import { CELL, layoutOf, setHallLookup, HallX, HallY, INK, P, PieceIcon, PlacedPiece, RoomOutline, VaultDoor, RoomShell, cellRect, doorsOf, footBox, pieceFits, roomRect, screenBox, unproject, type Rect } from './vaultIso';

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
  /** Twelve rooms are built, so vacation vaults can be made. */
  ready: boolean;
  /** The vacation vaults they have now (one of them can be replaced by a new place when all four are used). */
  mine: { placeId: string; name: string }[];
  unlock: (placeId: string, icon: string, replace?: string) => Promise<string | null>;
}

type Panel = { kind: 'build'; level: number; col: number; row: number; type?: RoomType; /** A stairwell's shape, once chosen. */ shape?: 'straight' | 'u'; /** A stairwell's direction, once chosen. */ dir?: 'up' | 'down' } | { kind: 'room'; idx: number; item?: string; pick?: boolean } | { kind: 'vacation'; pick?: VacationChoice } | { kind: 'settler'; id: number; name: string } | { kind: 'demolish'; idx: number } | null;

// ---- the settlers' wandering ----

/** The settlers' wandering: each one picks a piece of furniture (or just an open spot) and goes to it around everything else in the room (see vaultSims). */
function useSettlers(vault: VaultHome | null): Sim[] {
  const sims = useRef<Sim[]>([]);
  const vref = useRef<VaultHome | null>(vault);
  vref.current = vault;
  const layout = useRef('');
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!vault) return;
    // something was built, moved or demolished: what they were about to do may no longer be there, so they start over
    const sig = JSON.stringify(vault.rooms.map((r) => [r.type, r.level, r.col, r.row, r.furniture, r.put ?? null]));
    if (layout.current && layout.current !== sig) {
      for (const t of sims.current) { t.queue = []; t.cur = null; t.path = []; t.fx = null; t.seat = null; t.exit = null; t.pose = 'stand'; t.lift = 0; t.tilt = 0; t.action = undefined; t.until = 0; }
    }
    layout.current = sig;
    // settlers who have left are gone from the picture
    const here = new Set((vault.settlers as Settler[]).map((st) => st.id));
    sims.current = sims.current.filter((t) => here.has(t.id));
    const have = new Set(sims.current.map((t) => t.id));
    const levels = [...new Set(vault.rooms.map((r) => r.level))];
    for (const st of vault.settlers as Settler[]) {
      if (have.has(st.id)) continue;
      // each settler lives on one level (spread out over the ones that have rooms), and wanders only there
      const level = levels[st.id % levels.length] ?? 0;
      const home = roomsOn(vault, level)[0] ?? vault.rooms[0];
      const at = freePoint(vault, home);
      sims.current.push({ id: st.id, kind: st.kind, level, x: at.x, y: at.y, path: [], face: 1, phase: Math.random(), pose: 'stand', until: 0, lift: 0, tilt: 0, queue: [], cur: null, exit: null, fx: null, seat: null });
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
        for (const t2 of sims.current) {
          if (t2.until > now) continue;
          if (t2.path.length === 0 && t2.pose !== 'walk') {
            // done with the last thing: the next one in the list, or a new one
            if (t2.cur) { t2.cur = null; if (t2.queue.length === 0) finish(t2); }
            if (t2.queue.length === 0) plan(t2, v, sims.current);
            const next = t2.queue.shift();
            if (!next) { t2.pose = 'stand'; t2.until = now + 600; continue; }
            begin(t2, next, v);
            if (t2.path.length === 0) { arrive(t2, now); continue; }
          }
          const wp = t2.path[0];
          if (!wp) { t2.pose = 'stand'; t2.until = now + 600; continue; }
          const dx = wp.x - t2.x;
          const dy = wp.y - t2.y;
          const dist = Math.hypot(dx, dy);
          const speed = t2.kind === 'dog' ? 44 : t2.kind === 'cat' ? 38 : 32;
          if (dist <= speed * dt) {
            t2.x = wp.x; t2.y = wp.y; t2.path.shift();
            if (!t2.path.length) arrive(t2, now);
          } else {
            t2.x += (dx / dist) * speed * dt; t2.y += (dy / dist) * speed * dt;
            const across = dx - dy; // along the screen
            if (Math.abs(across) > 0.5) t2.face = across > 0 ? 1 : -1;
            t2.phase = (t2.phase + dt * 2.2) % 1;
            t2.pose = 'walk';
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
        <button type="button" className="rm-btn rm-vh-can" disabled={busy || short.length > 0} onClick={() => setAsking(true)}>{busy ? 'WORKING…' : verb}</button>
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

/** Names to start from when a settler arrives (the owner can type their own). */
const STARTER_NAMES: Record<SettlerKind, string[]> = {
  male: ['Gus', 'Walt', 'Otis', 'Hank', 'Dale', 'Moe', 'Cliff', 'Ned', 'Rufus', 'Abe'],
  female: ['Dot', 'Edna', 'Lou', 'Peggy', 'Mabel', 'Ruth', 'Ida', 'Josie', 'Vera', 'Pearl'],
  dog: ['Rex', 'Duke', 'Boomer', 'Scrap', 'Dogmeat', 'Rusty', 'Biscuit', 'Bolt', 'Ziggy', 'Tank'],
  cat: ['Whisk', 'Soot', 'Pickles', 'Ash', 'Mittens', 'Fuse', 'Biscuit', 'Gizmo', 'Sparky', 'Pixel'],
};

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
  // a piece of furniture (new, or one picked up again), floating until the owner sets it down: where (u, v of the floor) and whether it is turned
  type Placing = { what: 'piece'; room: number; item: string; isNew: boolean; u: number; v: number; swap: boolean };
  const [placing, setPlacing] = useState<Placing | null>(null);
  const placingRef = useRef<Placing | null>(null);
  placingRef.current = placing;
  const placeDrag = useRef<number | null>(null);
  const hold = useRef<{ x: number; y: number; timer: number; id: number } | null>(null);
  const beginMoveRef = useRef<(idx: number, item: string, pointer: number) => void>(() => undefined);
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!placing) return;
    const id = window.setTimeout(() => setTick((n) => n + 1), 700); // the camera has slid to the room: the buttons find their place
    return () => window.clearTimeout(id);
  }, [placing?.what, placing?.room]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!fresh) return;
    const id = window.setTimeout(() => setFresh(null), 2600);
    return () => window.clearTimeout(id);
  }, [fresh]);
  // a message that flashes for a moment: why something cannot be done yet
  const flashTimer = useRef(0);
  const say = useCallback((text: string, ms = 3600) => {
    setFlash(text.toUpperCase());
    window.clearTimeout(flashTimer.current);
    flashTimer.current = window.setTimeout(() => setFlash(''), ms);
  }, []);
  /** What neglect did while the vault was left alone: settlers who left, and loot that went missing. Each message flashes for a while, one after the other. */
  const report = useCallback((r: { stolen?: string[]; left?: { kind: string; name?: string }[] }) => {
    const lines = [
      ...(r.left ?? []).map((x) => `${x.name ?? x.kind} has left the vault: there were not enough rooms for them`),
      ...(r.stolen ?? []).map((id) => `1 x ${lootName(id as LootId)} has disappeared from your inventory...you suspect one of your settlers, since they have been grumbling lately`),
    ];
    lines.forEach((t, i) => window.setTimeout(() => say(t, 7000), i * 7200));
  }, [say]);
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
  /** Moving the picture with a finger (when a room is blown up and its upgrades are closed): where the touch began, and whether it has moved far enough to be a drag. */
  const drag = useRef<{ x: number; y: number; moved: boolean; id: number } | null>(null);
  const dragged = useRef(false);
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
      if (r.ok) { setVault(r.vault); setError(null); if (r.stolen?.length) void account.refresh(); report(r); } else setError(REASONS[r.reason] ?? 'COULD NOT ENTER THE VAULT');
    };
    void visit();
    const id = window.setInterval(() => { if (!document.hidden) void visit(); }, 30_000);
    return () => { off = true; window.clearInterval(id); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [call, report]);
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const sims = useSettlers(vault);
  const live = liveOf(sims);
  const liveKey = [...live.entries()].map(([k, e]) => `${k}${e.on ? '+' : ''}${(e.pulled ?? []).join('')}`).join('|');

  const act = useCallback(async (body: Parameters<typeof vaultCall>[0], done?: (v: VaultHome, refund?: Record<string, number>) => void) => {
    setBusy(true);
    const r = await call(body);
    setBusy(false);
    if (r.ok) { setVault(r.vault); setError(null); setPanel(null); done?.(r.vault, r.refund); void account.refresh(); report(r); } else setError(REASONS[r.reason] ?? r.reason);
  }, [account, call, report]);

  const mood = vault ? moodAt({ ...vault, seenAt: now }, now) : null;
  // never negative: with more settlers than the rooms provide for (after a demolition) nobody is waiting, and a negative number would count as someone waiting and block every tap
  const waiting = vault ? Math.max(0, settlersWaiting(vault)) : 0;
  // the menu of rooms to build shows six at a time and scrolls inside a window of that size
  const [buildList, setBuildList] = useState<HTMLUListElement | null>(null);
  const [buildHeight, setBuildHeight] = useState<number | null>(null);
  const [buildMore, setBuildMore] = useState(false);
  useLayoutEffect(() => {
    if (!buildList) { setBuildHeight(null); return; }
    const measure = () => {
      const items = Array.from(buildList.children).slice(0, 6) as HTMLElement[];
      if (buildList.children.length <= 6 || items.length < 6) { setBuildHeight(null); return; }
      const h = Math.ceil(items[5].getBoundingClientRect().bottom - items[0].getBoundingClientRect().top);
      setBuildHeight((prev) => (prev !== null && Math.abs(prev - h) < 2 ? prev : h));
    };
    measure();
    const more = () => setBuildMore(buildList.scrollHeight - buildList.scrollTop - buildList.clientHeight > 3);
    more();
    buildList.addEventListener('scroll', more);
    const ro = new ResizeObserver(() => { measure(); more(); });
    ro.observe(buildList);
    return () => { ro.disconnect(); buildList.removeEventListener('scroll', more); };
  }, [buildList]);
  const canUp = !!vault && hasWayUp(vault, level);
  const canDown = !!vault && hasWayDown(vault, level);
  const levelsShown = canUp || canDown;
  /** A new settler whose name is being chosen. */
  const [naming, setNaming] = useState<{ kind: SettlerKind; name: string } | null>(null);

  /** Shares a picture of this level of the vault as it is: the phone's share sheet in the app, the share sheet or a download in a browser. */
  const shareVault = useCallback(async () => {
    const svg = svgRef.current;
    if (!svg || !vault) return;
    try {
      const rects: Rect[] = vault.rooms.filter((r) => r.level === level).map(roomRect);
      if (rects.length === 0) { say('THERE IS NOTHING TO SHOW ON THIS LEVEL YET'); return; }
      const b = screenBox(rects);
      const pad = 18;
      const box = [b.x - pad, b.y - pad, b.w + 2 * pad, b.h + 2 * pad];
      const W = 1600;
      const imgW = W - 120;
      const imgH = Math.round((imgW * box[3]) / box[2]);
      const clone = svg.cloneNode(true) as SVGSVGElement;
      clone.querySelectorAll('.rm-vh-open, .rm-vh-ghosts').forEach((n) => n.remove());
      clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      clone.setAttribute('viewBox', box.map((n) => Math.round(n * 100) / 100).join(' '));
      clone.setAttribute('width', String(imgW));
      clone.setAttribute('height', String(imgH));
      clone.removeAttribute('style');
      const xml = new XMLSerializer().serializeToString(clone);
      const img = new Image();
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(xml);
      await img.decode();
      const head = 150;
      const foot = 100;
      const canvas = document.createElement('canvas');
      canvas.width = W;
      canvas.height = head + imgH + foot;
      const c = canvas.getContext('2d');
      if (!c) return;
      c.fillStyle = '#021a0c';
      c.fillRect(0, 0, canvas.width, canvas.height);
      c.strokeStyle = '#13a550';
      c.lineWidth = 3;
      c.strokeRect(14, 14, canvas.width - 28, canvas.height - 28);
      c.shadowColor = '#3dff8a';
      c.shadowBlur = 10;
      c.drawImage(img, 60, head, imgW, imgH);
      c.shadowBlur = 6;
      c.fillStyle = '#3dff8a';
      c.font = "72px 'VT323', monospace";
      c.textBaseline = 'alphabetic';
      c.fillText(title.toUpperCase(), 60, 96);
      c.font = "40px 'VT323', monospace";
      c.fillStyle = '#13a550';
      c.fillText(`LEVEL ${level + 1} OF ${LEVELS}  ·  ${vault.rooms.filter((r) => !isPassage(r)).length} ROOMS  ·  ${vault.settlers.length} SETTLERS`, 60, 134);
      c.textAlign = 'right';
      c.fillStyle = '#3dff8a';
      c.fillText('WASTELANDMAPS.COM', W - 60, head + imgH + 66);
      const blob: Blob | null = await new Promise((resolve) => canvas.toBlob((x) => resolve(x), 'image/png'));
      if (!blob) return;
      const filename = `${title.replace(/[^A-Za-z0-9]+/g, '-')}-level-${level + 1}-wastelandmaps.png`;
      const file = new File([blob], filename, { type: 'image/png' });
      if (!isNative() && navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: `${title} on WastelandMaps`, text: `My ${title} on WastelandMaps. wastelandmaps.com` });
          return;
        } catch (e) {
          if ((e as Error)?.name === 'AbortError') return;
        }
      }
      await saveBlob(blob, filename, `${title} on WastelandMaps`);
    } catch (e) {
      if ((e as Error)?.name !== 'AbortError') say('COULD NOT MAKE THE PICTURE');
    }
  }, [vault, level, title, say]);

  /** Moves to another level (back to the whole-level view). */
  const goLevel = useCallback((to: number) => { setFocus(null); setPanel(null); setLevel(to); }, []);
  const down = () => { if (canDown) goLevel(level + 1); };

  // ---- putting a piece of furniture down by hand ----
  const lookupFor = (lvl: number) => (c: number, r: number) => (vault ? roomAt(vault, lvl, c, r) : undefined);
  const hasHoleUnder = (room: VaultRoom) => !!vault && room.type !== 'stairs' && roomAt(vault, room.level + 1, room.col, room.row)?.type === 'stairs';
  const toPart = (n: number) => Math.round(Math.max(0, Math.min(1, n)) * 1000) / 1000;
  /** A piece that has just been chosen: it floats in the spot the layout would have given it. */
  const startPlacingNew = (idx: number, item: string) => {
    if (!vault) return;
    const room = vault.rooms[idx];
    if (!room) return;
    const spot = layoutOf({ ...room, furniture: [...room.furniture, item] }, lookupFor(room.level), hasHoleUnder(room)).get(item);
    const rect = roomRect(room);
    const s0 = spot ?? { x: rect.x + rect.w / 2, y: rect.y + rect.d / 2 };
    setPanel(null);
    setFocus(idx);
    setPlacing({ what: 'piece', room: idx, item, isNew: true, u: toPart((s0.x - rect.x) / rect.w), v: toPart((s0.y - rect.y) / rect.d), swap: !!(spot as { swap?: boolean } | undefined)?.swap });
    say('Drag it where you want it, turn it if you like, then tick it into place');
  };
  /** A piece that was set down before, picked up again by holding a finger on it. */
  beginMoveRef.current = (idx: number, item: string, pointer: number) => {
    if (!vault || placingRef.current || panel || waiting > 0) return;
    const room = vault.rooms[idx];
    if (!room || room.type === 'hallway') return;
    const spot = layoutOf(room, lookupFor(room.level), hasHoleUnder(room)).get(item);
    if (!spot) return;
    const rect = roomRect(room);
    setFocus(idx);
    setPlacing({ what: 'piece', room: idx, item, isNew: false, u: toPart((spot.x - rect.x) / rect.w), v: toPart((spot.y - rect.y) / rect.d), swap: !!spot.swap });
    placeDrag.current = pointer;
    svgRef.current?.setPointerCapture?.(pointer);
    say('Drag it to its new place, then tick it down');
  };
  const fitsNow = (): boolean => {
    const p = placing;
    const room = p ? vault?.rooms[p.room] : undefined;
    if (!p || !room) return false;
    const rect = roomRect(room);
    return pieceFits(room, lookupFor(room.level), hasHoleUnder(room), p.item, rect.x + p.u * rect.w, rect.y + p.v * rect.d, p.swap);
  };
  const dragPlaceTo = (clientX: number, clientY: number) => {
    const p = placingRef.current;
    const svg = svgRef.current;
    const room = p ? vault?.rooms[p.room] : undefined;
    const ctm = svg?.getScreenCTM();
    if (!p || !room || !ctm) return;
    const pt = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse());
    const w = unproject(pt.x, pt.y + 12);
    const rect = roomRect(room);
    setPlacing({ ...p, u: toPart((w.x - rect.x) / rect.w), v: toPart((w.y - rect.y) / rect.d) });
  };
  const confirmPlace = () => {
    const p = placing;
    if (!p || busy) return;
    if (!fitsNow()) { say('It does not fit there: it is over something, off the floor, or it would shut a doorway off (leave room to walk around it)'); return; }
    const at = { u: p.u, v: p.v, ...(p.swap ? { swap: true } : {}) };
    if (p.isNew) void act({ action: 'furnish', room: p.room, item: p.item, at }, () => { setPlacing(null); setFresh({ room: p.room, item: p.item }); if (p.item === 'instrument') setPanel({ kind: 'room', idx: p.room, pick: true }); });
    else void act({ action: 'place', room: p.room, item: p.item, at }, () => setPlacing(null));
  };
  const cancelPlace = () => {
    const p = placing;
    setPlacing(null);
    if (!p) return;
    if (p.isNew) setPanel({ kind: 'room', idx: p.room });
  };
  /** Where the buttons under the floating piece go on the screen. */
  const placeBar = (() => {
    const vb = vbRef.current;
    const room = placing && vault ? vault.rooms[placing.room] : undefined;
    if (!placing || !room || !size || !vb) return null;
    const rect = roomRect(room);
    const b = footBox(room, placing.item, rect.x + placing.u * rect.w, rect.y + placing.v * rect.d, placing.swap);
    const corner = { x: b.x + b.w, y: b.y + b.d };
    const [X, Y] = P(corner.x, corner.y, 0);
    const k = size.w / vb[2];
    return { left: Math.max(96, Math.min(size.w - 96, (X - vb[0]) * k)), top: Math.max(8, Math.min(size.h - 64, (Y - vb[1]) * k + 12)) };
  })();

  // the drawing needs to know which cells have a room (a hallway runs the way its neighbors are)
  setHallLookup(vault ? (l, c, r) => !!roomAt(vault, l, c, r) : null);

  // the cells where a room could be built: next to a room of this level
  const openCells = useMemo<[number, number][]>(() => {
    if (!vault) return [];
    const out: [number, number][] = [];
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        if (roomAt(vault, level, col, row) || isDoorCell(vault, level, col, row)) continue;
        const touches = [[-1, 0], [1, 0], [0, -1], [0, 1]].some(([dc, dr]) => {
          const o = roomAt(vault, level, col + dc, row + dr);
          if (!o) return false;
          const oc = openCell(o); // a stairwell is a dead end: only its open end leads on
          return !oc || (oc[0] === col && oc[1] === row);
        });
        if (touches) out.push([col, row]);
      }
    }
    return out;
  }, [vault, level]);

  // the part of the picture that only changes when the vault does: the rooms and the places for more, back to front, each room with the halls that join it to the ones behind it
  const scene = useMemo(() => {
    if (!vault) return null;
    const at = (c: number, r: number) => roomAt(vault, level, c, r);
    const tapRoom = (e: React.MouseEvent, idx: number) => {
      e.stopPropagation();
      if (dragged.current || placingRef.current) return; // the finger moved the picture, or something is being put down: it is not a tap
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
            <RoomShell rect={me} name={def.name.toUpperCase()} type={room.type} col={room.col} row={room.row} level={room.level} labelFront={[at(room.col - 1, room.row), ...Array.from({ length: slots }, (_, k) => at(room.col + k, room.row - 1))].some((n) => n?.type === 'hallway')} doorsL={doorsL} doorsR={doorsR} hole={room.type !== 'stairs' && roomAt(vault, level + 1, room.col, room.row)?.type === 'stairs'} face={room.face} way={stairDir(vault, room) ?? 'down'} shape={room.shape} entry={room.entry} furniture={room.furniture} />
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
            <RoomOutline rect={cellRect(col, row)} label="CLEAR & BUILD" near={roomAt(vault, level, col - 1, row) ? 'left' : roomAt(vault, level, col, row - 1) ? 'back' : roomAt(vault, level, col + 1, row) ? 'right' : roomAt(vault, level, col, row + 1) ? 'front' : undefined} />
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

  // the furniture of each room, with where it stands (so it can be painted among the settlers, back to front); the piece being moved is drawn floating instead
  const movingKey = placing && placing.what === 'piece' && !placing.isNew ? `${placing.room}:${placing.item}` : '';
  const pieces = useMemo(() => {
    const out = new Map<number, { key: string; depth: number; el: React.ReactElement }[]>();
    if (!vault) return out;
    vault.rooms.forEach((room, idx) => {
      if (room.level !== level) return;
      const lay = layoutOf(room, (c, r) => roomAt(vault, level, c, r), room.type !== 'stairs' && roomAt(vault, level + 1, room.col, room.row)?.type === 'stairs');
      out.set(idx, room.furniture.flatMap((id) => {
        const at = lay.get(id);
        if (!at || (movingKey === `${idx}:${id}`)) return [];
        return [{
          key: `f${idx}-${id}`, depth: at.x + at.y,
          el: (
            <g key={`f${idx}-${id}`}
              onPointerDown={(e) => { if (placingRef.current || room.type === 'hallway') return; const pid = e.pointerId; hold.current = { x: e.clientX, y: e.clientY, id: pid, timer: window.setTimeout(() => { hold.current = null; beginMoveRef.current(idx, id, pid); }, 550) }; }}>
              <PlacedPiece room={room} id={id} pos={at} fresh={!!fresh && fresh.room === idx && fresh.item === id} live={live.get(`${idx}:${id}`)} />
            </g>
          ),
        }];
      }));
    });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vault, level, fresh, movingKey, liveKey]);

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
    if (rects.length === 0) for (const [c, r] of openCells) rects.push(cellRect(c, r));
    if (rects.length === 0) rects.push(cellRect(ENTRY_AT.col, ENTRY_AT.row));
    // the window is the rooms plus a little around them: the next places to build show only their edge (scroll to see the rest)
    const half = CELL * 0.18;
    const b = screenBox(rects.map((r) => ({ x: r.x - half, y: r.y - half, w: r.w + 2 * half, d: r.d + 2 * half })));
    const pad = 4;
    const sc = Math.min(size.w / (b.w + 2 * pad), size.h / (b.h + 2 * pad), 3.6);
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
  const rooms = vault ? countRooms(vault) : 0;

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
          {mood.trend && <i className={`rm-vh-trend ${mood.trend}`} title={mood.trend === 'up' ? 'Going up' : 'Going down'} aria-label={mood.trend === 'up' ? 'Happiness is going up' : 'Happiness is going down'}>{mood.trend === 'up' ? '▲' : '▼'}</i>}
          <em>{mood.word}</em>
        </div>
      )}
      {error && <p className="rm-vh-error" onClick={() => setError(null)}>{error}</p>}
      {flash && <p className="rm-vh-flash" role="status">{flash}</p>}
      <div className="rm-vh-viewwrap">
      <div className={`rm-vh-view${focus !== null ? ' focused' : ''}`} ref={viewRef}>
        {!vault && !error && <p className="rm-vh-wait">ENTERING THE VAULT…</p>}
        {placing && placeBar && (
          <div className="rm-vh-place" style={{ left: placeBar.left, top: placeBar.top }} onPointerDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
            <button type="button" className="rm-vh-place-x" onClick={cancelPlace} disabled={busy} aria-label="Cancel: nothing is spent" title="Cancel (nothing is spent)">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5l14 14M19 5L5 19" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" /></svg>
            </button>
            {(
              <button type="button" className="rm-vh-place-turn" onClick={() => setPlacing({ ...placing, swap: !placing.swap })} disabled={busy} aria-label="Turn it" title="Turn it">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 12a7 7 0 1 1-2.2-5.1M19 4v4.5h-4.5" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </button>
            )}
            <button type="button" className={`rm-vh-place-ok${fitsNow() ? '' : ' blocked'}`} onClick={confirmPlace} disabled={busy} aria-label="Set it down" title="Set it down">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4.5 12.5l5 5 10-11" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
          </div>
        )}
        {vault && size && scene && (() => {
          // each settler is painted with the room it is in (or, in a hall, with the front-most one), back to front among that room's furniture
          const rooms = scene.layers.filter((l) => l.room);
          const frontIdx = rooms.length ? (rooms[rooms.length - 1].room as { idx: number }).idx : -1;
          const ownerOf = (x: number, y: number): number => rooms.find((l) => { const r = roomRect((l.room as { room: VaultRoom }).room); return x >= r.x - 5 && x <= r.x + r.w + 5 && y >= r.y - 5 && y <= r.y + r.d + 5; })?.room?.idx ?? frontIdx;
          const settlers = sims.filter((s) => s.level === level).map((s) => ({ owner: ownerOf(s.x, s.y), key: `s${s.id}`, depth: s.x + s.y + 0.5, el: (() => {
            const [X, Y] = P(s.x, s.y, 0);
            const name = (vault.settlers as Settler[]).find((st) => st.id === s.id)?.name ?? '';
            const top = (s.pose === 'lie' ? 16 : s.pose === 'sit' ? 38 : 47) * SETTLER_SCALE;
            return (
              <g key={`s${s.id}`} transform={`translate(${X} ${Y - s.lift * SETTLER_SCALE})`} style={{ cursor: 'pointer' }} onClick={(e) => { e.stopPropagation(); setPanel({ kind: 'settler', id: s.id, name }); }}>
                <g transform={`rotate(${s.tilt}) scale(${s.face * SETTLER_SCALE} ${SETTLER_SCALE})`}><SettlerArt kind={s.kind} pose={s.pose} phase={s.phase} action={s.action} /></g>
                <rect x={-14} y={-top - 12} width={28} height={top + 12} fill="transparent" stroke="none" />
                {name && (
                  <g transform={`translate(0 ${-top - 2})`}>
                    <rect x={-(name.length * 2.1 + 3)} y={-8} width={name.length * 4.2 + 6} height={8.4} rx={2} fill="rgba(2,26,12,0.8)" stroke={INK} strokeWidth={0.5} />
                    <text y={-1.8} fontSize="7" textAnchor="middle" fill={INK} stroke="none" fontFamily="'VT323', monospace" letterSpacing="0.4">{name}</text>
                  </g>
                )}
              </g>
            );
          })() }));
          return (
            <svg ref={svgRef} className="rm-vh-svg" style={{ width: size.w, height: size.h, touchAction: focus !== null ? 'none' : undefined }} fill="none" stroke={INK} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"
              onPointerDown={(e) => { if (placingRef.current) { placeDrag.current = e.pointerId; (e.currentTarget as SVGSVGElement).setPointerCapture?.(e.pointerId); dragPlaceTo(e.clientX, e.clientY); return; } if (focus !== null && !animating.current) drag.current = { x: e.clientX, y: e.clientY, moved: false, id: e.pointerId }; }}
              onPointerMove={(e) => {
                if (placeDrag.current !== null) { dragPlaceTo(e.clientX, e.clientY); return; }
                if (hold.current && Math.hypot(e.clientX - hold.current.x, e.clientY - hold.current.y) > 10) { window.clearTimeout(hold.current.timer); hold.current = null; }
                const d = drag.current;
                const vb = vbRef.current;
                if (!d || !vb || !size) return;
                const dx = e.clientX - d.x;
                const dy = e.clientY - d.y;
                if (!d.moved && Math.hypot(dx, dy) < 8) return;
                if (!d.moved) { d.moved = true; (e.currentTarget as SVGSVGElement).setPointerCapture?.(d.id); }
                const k = vb[2] / size.w;
                setWindow([vb[0] - dx * k, vb[1] - dy * k, vb[2], vb[3]]);
                d.x = e.clientX;
                d.y = e.clientY;
              }}
              onPointerUp={() => { placeDrag.current = null; if (hold.current) { window.clearTimeout(hold.current.timer); hold.current = null; } const d = drag.current; drag.current = null; if (d?.moved) { dragged.current = true; window.setTimeout(() => { dragged.current = false; }, 60); } }}
              onPointerCancel={() => { drag.current = null; placeDrag.current = null; if (hold.current) { window.clearTimeout(hold.current.timer); hold.current = null; } }}
              onClick={() => { if (dragged.current || placingRef.current) return; if (focus !== null) { if (panel) setPanel(null); else setFocus(null); } }}>
              <g className="rm-vh-ghosts">{scene.ghosts}</g>
              {scene.layers.map((l) => {
                const here = l.room;
                const things = here ? [...(pieces.get(here.idx) ?? []), ...settlers.filter((t) => t.owner === here.idx)].sort((x, y) => x.depth - y.depth) : [];
                return <g key={l.key} onClick={here ? (e) => scene.tapRoom(e, here.idx) : undefined}>{l.el}{things.map((t) => t.el)}</g>;
              })}
              {placing && (() => {
                const room = vault.rooms[placing.room];
                if (!room) return null;
                const rect = roomRect(room);
                const ok = fitsNow();
                const edge = ok ? INK : '#ff5a5a';
                const fill = ok ? 'rgba(61,255,138,0.16)' : 'rgba(255,90,90,0.22)';
                const outline = (b: Rect) => [[b.x, b.y], [b.x + b.w, b.y], [b.x + b.w, b.y + b.d], [b.x, b.y + b.d]].map(([a, c]) => P(a, c, 0).map((n) => Math.round(n * 10) / 10).join(',')).join(' ');
                const x = rect.x + placing.u * rect.w, y = rect.y + placing.v * rect.d;
                return (
                  <g pointerEvents="none">
                    <polygon points={outline(footBox(room, placing.item, x, y, placing.swap))} fill={fill} stroke={edge} strokeWidth={1.8} strokeDasharray="5 3" />
                    <g transform="translate(0 -9)" opacity={0.93}><PlacedPiece room={room} id={placing.item} pos={{ x, y, swap: placing.swap }} /></g>
                  </g>
                );
              })()}
              {scene.entry && <VaultDoor rect={roomRect(scene.entry)} onTap={onExit} />}
            </svg>
          );
        })()}
      </div>
        {vault && (
          <div className="rm-vh-roster" aria-label="Settlers">
            <span>SETTLERS:</span>
            {vault.settlers.length === 0 ? <em>None</em> : <ol>{vault.settlers.map((st) => <li key={st.id}>{st.name ?? st.kind.charAt(0).toUpperCase() + st.kind.slice(1)}</li>)}</ol>}
          </div>
        )}
        {vault && vault.rooms.length > 0 && (
          <button type="button" className={`rm-vh-share${levelsShown ? '' : ' alone'}`} onClick={() => void shareVault()} aria-label="Share a picture of your vault" title="Share your vault">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12M7 8l5-5 5 5M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
        )}
        {vault && !placing && levelsShown && (
          <div className="rm-vh-levels" role="group" aria-label="Levels">
            {canUp && <button type="button" className="rm-vh-lv" onClick={() => goLevel(level - 1)} aria-label="Up one level">▲</button>}
            <span>LEVEL {level + 1}<i>OF {LEVELS}</i></span>
            {canDown && <button type="button" className="rm-vh-lv" onClick={down} aria-label="Down one level">▼</button>}
          </div>
        )}
      </div>
      {focus !== null && !panel && !waiting && !placing && <button type="button" className="rm-btn rm-vh-fab" onClick={() => setPanel({ kind: 'room', idx: focus })}>UPGRADES</button>}

      {vault && panel && !waiting && (
        <div className={`rm-vh-sheet${panel.kind === 'room' ? ' dock' : ''}`} onClick={(e) => { if (e.target === e.currentTarget) setPanel(null); }}>
          <div className="rm-vh-sheet-card">
            {panel.kind === 'room' && panel.pick && room && (
              <div className="rm-vh-sheet-body">
                <h3>CHOOSE THE INSTRUMENT</h3>
                <p>WHICH ONE DOES THE STUDY GET? A GUITAR HANGS ON THE WALL.</p>
                <ul className="rm-vh-types">
                  {INSTRUMENTS.map((id) => (
                    <li key={id}>
                      <button type="button" className="can" disabled={busy} onClick={() => void act({ action: 'instrument', room: panel.idx, choice: id })}>
                        <span>{INSTRUMENT_NAMES[id].toUpperCase()}</span><i>FREE: ALREADY PAID FOR</i>
                      </button>
                    </li>
                  ))}
                </ul>
                <div className="rm-vh-row"><button type="button" className="rm-btn rm-btn-ghost" onClick={() => setPanel({ kind: 'room', idx: panel.idx })}>LATER</button></div>
              </div>
            )}
            {panel.kind === 'demolish' && vault.rooms[panel.idx] && (() => {
              const target = vault.rooms[panel.idx];
              const spent = Object.values(spentOn(vault, panel.idx)).reduce<number>((n, q) => n + (q ?? 0), 0);
              return (
                <div className="rm-vh-sheet-body">
                  <h3>DEMOLISH THE {roomDef(target.type).name.toUpperCase()}?</h3>
                  <p>THE ROOM{target.furniture.length ? ' AND EVERYTHING IN IT GO' : ' GOES'}, AND IT IS A SHADOWY OUTLINE AGAIN, TO BUILD FROM SCRATCH. HALF THE LOOT IT COST COMES BACK, PICKED AT RANDOM: {Math.floor(spent / 2)} OF {spent} PIECES.</p>
                  <div className="rm-vh-row">
                    <button type="button" className="rm-btn rm-btn-ghost" onClick={() => setPanel({ kind: 'room', idx: panel.idx })}>KEEP IT</button>
                    <button type="button" className="rm-btn" disabled={busy} onClick={() => void act({ action: 'demolish', room: panel.idx }, (_v, back) => { setFocus(null); const text = back ? describeBag(back as never) : ''; say(text ? 'DEMOLISHED. LOOT BACK: ' + text : 'DEMOLISHED. NOTHING CAME BACK'); })}>DEMOLISH</button>
                  </div>
                </div>
              );
            })()}
            {panel.kind === 'settler' && (
              <div className="rm-vh-sheet-body">
                <h3>RENAME</h3>
                <p>{(vault.settlers as Settler[]).find((st) => st.id === panel.id)?.name ? 'WHAT SHOULD THEY BE CALLED NOW?' : 'GIVE THEM A NAME.'} ({SETTLER_NAME_MAX} CHARACTERS AT MOST)</p>
                <div className="rm-vh-name">
                  <input value={panel.name} maxLength={SETTLER_NAME_MAX} autoFocus autoComplete="off" spellCheck={false} aria-label="Name"
                    onChange={(e) => setPanel({ ...panel, name: e.target.value })}
                    onKeyDown={(e) => { if (e.key === 'Enter' && cleanSettlerName(panel.name)) void act({ action: 'rename', id: panel.id, name: cleanSettlerName(panel.name) as string }); }} />
                </div>
                <div className="rm-vh-row">
                  <button type="button" className="rm-btn rm-btn-ghost" onClick={() => setPanel(null)}>CANCEL</button>
                  <button type="button" className="rm-btn" disabled={busy || !cleanSettlerName(panel.name)} onClick={() => void act({ action: 'rename', id: panel.id, name: cleanSettlerName(panel.name) as string })}>SAVE</button>
                </div>
              </div>
            )}
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
                <h3>CLEAR & BUILD</h3>
                <ul className="rm-vh-types rm-vh-types-window" ref={setBuildList} style={buildHeight ? { height: buildHeight } : undefined}>
                  {ROOM_DEFS.filter((d) => d.buildable !== false).map((d) => {
                    const why = whyNotBuild(vault, d.id, panel.level, panel.col, panel.row);
                    const mix = describeBag(buildRecipe(vault, d.id) as never).toUpperCase();
                    return (
                      <li key={d.id}>
                        <button type="button" className={!why && canAfford(ownLoot as never, buildRecipe(vault, d.id) as never) ? 'can' : undefined} disabled={!!why} onClick={() => setPanel({ ...panel, type: d.id })}>
                          <span>{d.name.toUpperCase()}{d.slots === 2 ? ' (2 SLOTS)' : ''}{d.id === 'hallway' ? ` (${hallwaysOn(vault, panel.level)} OF ${MAX_HALLWAYS_PER_LEVEL} HERE)` : ''}</span>
                          <i>{why ? why.toUpperCase() : mix}</i>
                        </button>
                      </li>
                    );
                  })}
                </ul>
                <div className="rm-vh-row rm-vh-row-more"><button type="button" className="rm-btn rm-btn-ghost" onClick={() => setPanel(null)}>CANCEL</button><span className={`rm-vh-more${buildMore ? ' on' : ''}`} aria-hidden="true">▼</span></div>
              </div>
            )}
            {panel.kind === 'build' && panel.type === 'stairs' && !panel.shape && (
              <div className="rm-vh-sheet-body">
                <h3>WHICH KIND OF STAIRWELL?</h3>
                <p>A STRAIGHT ONE IS A SINGLE FLIGHT. A U-SHAPED ONE GOES AWAY FROM THE ROOM, TURNS ON A LANDING AND COMES BACK THE WAY YOU CAME ON THE NEXT LEVEL. AT THE VERY EDGE OF THE VAULT IT HAS TO BE A U.</p>
                <ul className="rm-vh-types">
                  {([['straight', 'STRAIGHT', 'ONE FLIGHT, ONE CELL'], ['u', 'U-SHAPED', 'TWO FLIGHTS AND A LANDING, TURNS BACK']] as const).map(([id, name, note]) => {
                    const why = whyNotBuild(vault, 'stairs', panel.level, panel.col, panel.row, undefined, id);
                    return (
                      <li key={id}>
                        <button type="button" className={!why ? 'can' : undefined} disabled={!!why} onClick={() => setPanel({ ...panel, shape: id })}>
                          <span>{name}</span><i>{why ? why.toUpperCase() : note}</i>
                        </button>
                      </li>
                    );
                  })}
                </ul>
                <div className="rm-vh-row"><button type="button" className="rm-btn rm-btn-ghost" onClick={() => setPanel({ kind: 'build', level: panel.level, col: panel.col, row: panel.row })}>BACK</button></div>
              </div>
            )}
            {panel.kind === 'build' && panel.type === 'stairs' && panel.shape && !panel.dir && (
              <div className="rm-vh-sheet-body">
                <h3>WHICH WAY DOES IT GO?</h3>
                <p>A STAIRWELL MAKES ITS OTHER END ON THE LEVEL IT GOES TO. TO CHANGE YOUR MIND LATER, YOU HAVE TO DEMOLISH IT.</p>
                <div className="rm-vh-dirs">
                  {(['up', 'down'] as const).map((d) => {
                    const why = whyNotBuild(vault, 'stairs', panel.level, panel.col, panel.row, d, panel.shape);
                    return (
                      <button key={d} type="button" className={!why ? 'can' : undefined} disabled={!!why} onClick={() => setPanel({ ...panel, dir: d })}>
                        <b>{d === 'up' ? '▲' : '▼'}</b><span>{d === 'up' ? 'UP' : 'DOWN'}</span><i>{why ? why.toUpperCase() : `LEVEL ${panel.level + (d === 'up' ? 0 : 2)}`}</i>
                      </button>
                    );
                  })}
                </div>
                <div className="rm-vh-row"><button type="button" className="rm-btn rm-btn-ghost" onClick={() => setPanel({ ...panel, shape: undefined })}>BACK</button></div>
              </div>
            )}
            {panel.kind === 'build' && panel.type && (panel.type !== 'stairs' || panel.dir) && (
              <RecipeCard
                verb="BUILD" what={roomDef(panel.type).name.toUpperCase()} title={panel.type === 'stairs' ? `BUILD A ${panel.shape === 'u' ? 'U-SHAPED ' : ''}STAIRWELL ${panel.dir === 'up' ? 'UP' : 'DOWN'}` : `BUILD A ${roomDef(panel.type).name.toUpperCase()}`} recipe={buildRecipe(vault, panel.type)} have={ownLoot} busy={busy}
                onBack={() => setPanel(panel.type === 'stairs' ? { ...panel, dir: undefined } : { kind: 'build', level: panel.level, col: panel.col, row: panel.row })}
                onPay={() => act({ action: 'build', type: panel.type as string, level: panel.level, col: panel.col, row: panel.row, ...(panel.type === 'stairs' ? { dir: panel.dir, shape: panel.shape } : {}) }, (v) => setFresh({ room: panel.type === 'stairs' ? v.rooms.length - 2 : v.rooms.length - 1 }))}
              />
            )}
            {panel.kind === 'room' && room && !panel.item && !panel.pick && (
              <div className="rm-vh-sheet-body">
                {room.type !== 'stairs' && (
                  <>
                <button type="button" className="rm-vh-x" onClick={() => setPanel(null)} aria-label="Close">×</button>
                <h3>{roomDef(room.type).name.toUpperCase()}</h3>
                <p>{room.type === 'hallway' ? (room.furniture.length ? 'ONE PIECE IN A HALLWAY, AND IT IS HERE.' : `A HALLWAY HOLDS ONE PIECE: CHOOSE WELL. IT COSTS ${furnishCost(room)} PIECES OF LOOT.`) : roomComplete(room) ? 'FULLY FURNISHED.' : `EACH PIECE COSTS ${furnishCost(room)} PIECES OF LOOT, A DIFFERENT MIX FOR EACH.`}</p>
                <ul className="rm-vh-types">
                  {furnitureOf(room.type).map((f) => {
                    const placed = room.furniture.some((x) => slotOf(x) === f.id) || (room.type === 'hallway' && room.furniture.length >= 1);
                    const here = room.furniture.some((x) => slotOf(x) === f.id);
                    const waitingPick = f.id === 'instrument' && room.furniture.includes('instrument');
                    return (
                      <li key={f.id}>
                        <button type="button" className={waitingPick || (!placed && canAfford(ownLoot as never, furnishRecipe(vault, panel.idx, f.id) as never)) ? 'can' : undefined} disabled={placed && !waitingPick} onClick={() => (waitingPick ? setPanel({ kind: 'room', idx: panel.idx, pick: true }) : setPanel({ ...panel, item: f.id }))}>
                          <span className="rm-vh-name"><PieceIcon id={f.id} />{f.name.toUpperCase()}</span><i>{waitingPick ? 'CHOOSE WHICH' : placed ? (here ? (f.id === 'instrument' ? (INSTRUMENT_NAMES[room.furniture.find((x) => slotOf(x) === 'instrument') ?? ''] ?? 'PLACED').toUpperCase() : 'PLACED') : 'ONE PIECE ONLY') : describeBag(furnishRecipe(vault, panel.idx, f.id) as never).toUpperCase()}</i>
                        </button>
                      </li>
                    );
                  })}
                </ul>
                  </>
                )}
                <div className="rm-vh-row rm-vh-row-split">
                  {room.type !== 'entry' && <button type="button" className="rm-btn rm-btn-ghost rm-vh-demo" onClick={() => { const why = whyNotDemolish(vault, panel.idx); if (why) say(why); else setPanel({ kind: 'demolish', idx: panel.idx }); }}>DEMOLISH</button>}
                  <button type="button" className="rm-btn rm-btn-ghost" onClick={() => setPanel(null)}>CLOSE</button>
                </div>
              </div>
            )}
            {panel.kind === 'room' && room && panel.item && (
              <RecipeCard
                verb="PLACE IT" what={(furnitureOf(room.type).find((f) => f.id === panel.item)?.name ?? '').toUpperCase()} title={`ADD ${(furnitureOf(room.type).find((f) => f.id === panel.item)?.name ?? '').toUpperCase()}`} recipe={furnishRecipe(vault, panel.idx, panel.item)} have={ownLoot} busy={busy}
                onBack={() => setPanel({ kind: 'room', idx: panel.idx })}
                onPay={async () => { if (room.type !== 'hallway') { startPlacingNew(panel.idx, panel.item as string); return; } await act({ action: 'furnish', room: panel.idx, item: panel.item as string }, () => { setFresh({ room: panel.idx, item: panel.item }); if (panel.item === 'instrument') setPanel({ kind: 'room', idx: panel.idx, pick: true }); }); }}
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
              {!naming ? (
                <>
                  <p>THEY HAVE MOVED INTO YOUR VAULT. WHO ARE THEY?</p>
                  <div className="rm-vh-kinds">
                    {(['male', 'female', 'dog', 'cat'] as SettlerKind[]).map((k) => (
                      <button key={k} type="button" disabled={busy} onClick={() => setNaming({ kind: k, name: STARTER_NAMES[k][Math.floor(Math.random() * STARTER_NAMES[k].length)] })}><SettlerPreview kind={k} /><span>{k === 'male' ? 'MAN' : k === 'female' ? 'WOMAN' : k.toUpperCase()}</span></button>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <p>WHAT IS THEIR NAME? ({SETTLER_NAME_MAX} CHARACTERS AT MOST)</p>
                  <div className="rm-vh-name">
                    <SettlerPreview kind={naming.kind} />
                    <input value={naming.name} maxLength={SETTLER_NAME_MAX} autoFocus autoComplete="off" spellCheck={false} aria-label="Name"
                      onChange={(e) => setNaming({ ...naming, name: e.target.value })}
                      onKeyDown={(e) => { if (e.key === 'Enter' && cleanSettlerName(naming.name)) void act({ action: 'settler', kind: naming.kind, name: cleanSettlerName(naming.name) as string }, () => setNaming(null)); }} />
                  </div>
                  <div className="rm-vh-row">
                    <button type="button" className="rm-btn rm-btn-ghost" disabled={busy} onClick={() => setNaming(null)}>BACK</button>
                    <button type="button" className="rm-btn" disabled={busy || !cleanSettlerName(naming.name)} onClick={() => void act({ action: 'settler', kind: naming.kind, name: cleanSettlerName(naming.name) as string }, () => setNaming(null))}>MOVE IN</button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
      <div className="rm-vh-scan" aria-hidden="true" />
    </div>,
    document.body,
  );
}
