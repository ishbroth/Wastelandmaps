import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { finishRaid, startRaid, useStimpak, useTime, type Account } from '../lib/account';
import { loadRaidAssets, type RaidAssets } from '../lib/raid/assets';
import { playSound } from '../lib/raid/audio';
import { enemyFiles, hasVoice, playEnemy, preloadSfx } from '../lib/sfx';
import { buzz } from '../lib/haptics';
import { Game, SLOW_SECONDS, type Enemy, type Spawns } from '../lib/raid/engine';
import { LOOT_CAP, describeBag, lootName, type LootBag, type LootId } from '../lib/raid/loot';
import type { RaidPlan } from '../lib/raid/raid';
import { WEAPON_CLASSES, WEAPON_CLASS_IDS, weaponAt, type WeaponClass } from '../lib/raid/weapons';
import { levelInfo } from '../lib/points';
import { analyzeSpawns } from '../lib/raid/analyze';
import { battleArsenal, loadEquipped } from '../lib/raid/equipped';
import { spawnsAreMarked } from '../lib/raid/spawnData';

interface Hud {
  hits: number;
  /** The survivor's health as a share of the bar (1 is full). */
  hp: number;
  /** Rounds in one magazine of the weapon in hand. */
  magSize: number;
  ammo: number | null;
  /** Rounds in the magazine of the weapon in hand (null for a weapon without one), what is left in reserve after it, and how far through a reload it is. */
  mag: number | null;
  reserve: number | null;
  reload: number | null;
  selected: WeaponClass;
  remaining: number;
  banner: string;
  bossHp: number | null;
  bossName: string;
  /** Seconds of Legendary Time left (0 when it is not running). */
  slow: number;
}

/** How far each gun's picture leans to the left of straight up (degrees): they were drawn held across the body, and are turned back toward the screen. */
const GUN_LEAN: Record<string, number> = {
  sw29: 44, m1911: 15, deagle: 45, sw500: 38, uzi: 50, mp5: 33, ak47: -12, m249: 28,
  model70: 50, rem700: 35, svd: 38, m82: 60, flamethrower: 20, m79: 30, missile: 8, fatman: 25,
};

/** Placeholder colors for an enemy whose art is missing. */
const COLORS: Record<string, string> = { raider: '#5a4a3a', ghoul: '#6a7048', radroach: '#4a3220', molerat: '#7a5a4a', bloatfly: '#6a7a3a', radscorpion: '#8a7a5a', mirelurk: '#4a5a3a', supermutant: '#5a6a5a', robot: '#7a6a5a', deathclaw: '#6a4a3a' };

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/**
 * The shooting gallery: the destroyed picture blown up to the whole screen, the place's enemies walking out of the ground in waves, a gun at the bottom
 * and a wheel to switch between the four classes of weapon. Winning pays the loot the server decided; dying sends the survivor back to try again.
 */
export default function RaidScreen({ metroId, plan, placeId, imageUrl, spawns, account, sound, onExit, onSignIn }: {
  /** The metro on the map, kept with the raid so progress toward clearing each metro can be listed. */
  metroId?: string | null;
  plan: RaidPlan;
  placeId: string;
  imageUrl: string;
  spawns: Spawns;
  account: Account;
  sound: boolean;
  onExit: () => void;
  /** Opens the sign-in popup: offered on the "you must be signed in" message. */
  onSignIn?: () => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const game = useRef<Game | null>(null);
  const assets = useRef<RaidAssets>({ enemies: {}, guns: {} });
  const bg = useRef<HTMLImageElement | null>(null);
  const run = useRef<string | null>(null);
  const view = useRef({ x: 0, y: 0, w: 1, h: 1 });
  const pointer = useRef({ down: false, x: -1, y: -1 });
  /** Holding the screen to aim a grenade (the arc shows); letting go lobs it. */
  const aiming = useRef(false);
  /** Looking through the sniper scope: how far zoomed in (1 to 1.5, eased), and which point of the picture (as a share of its width and height) is in the middle of the scope. */
  const scope = useRef({ zoom: 1, pu: 0.5, pv: 0.62, drag: null as null | { x: number; y: number; pu: number; pv: number; moved: boolean } });
  const [phase, setPhase] = useState<'loading' | 'fighting' | 'won' | 'lost' | 'error'>('loading');
  // the size of the screen right now: turning the phone gives the new size a moment late (the viewport units lag behind on some phones), so it is read again a few times after every turn
  const [screenBox, setScreenBox] = useState({ w: window.innerWidth, h: window.innerHeight });
  useEffect(() => {
    const timers: number[] = [];
    const read = () => setScreenBox((b) => { const w = window.visualViewport?.width ?? window.innerWidth, h = window.visualViewport?.height ?? window.innerHeight; return Math.round(b.w) === Math.round(w) && Math.round(b.h) === Math.round(h) ? b : { w, h }; });
    const turned = () => { read(); timers.splice(0).forEach((t) => window.clearTimeout(t)); for (const ms of [60, 200, 450, 900, 1600]) timers.push(window.setTimeout(read, ms)); };
    window.addEventListener('resize', read);
    window.addEventListener('orientationchange', turned);
    window.visualViewport?.addEventListener('resize', read);
    screen.orientation?.addEventListener?.('change', turned);
    return () => {
      timers.forEach((t) => window.clearTimeout(t));
      window.removeEventListener('resize', read);
      window.removeEventListener('orientationchange', turned);
      window.visualViewport?.removeEventListener('resize', read);
      screen.orientation?.removeEventListener?.('change', turned);
    };
  }, []);
  const [message, setMessage] = useState('');
  const [needsSignIn, setNeedsSignIn] = useState(false);
  const [hud, setHud] = useState<Hud | null>(null);
  // what each enemy was doing last frame, so a new strike or a death is heard once
  const lastState = useRef(new Map<number, string>());
  // which classes were reloading last frame, so the two clicks of a reload are heard once
  const wasReloading = useRef<Partial<Record<WeaponClass, boolean>>>({});
  const [wheelOpen, setWheelOpen] = useState(false);
  const [stims, setStims] = useState(account.stimpaks);
  const [times, setTimes] = useState(account.legendaryTime);
  const [timing, setTiming] = useState(false);
  const [healing, setHealing] = useState(false);
  const [downed, setDowned] = useState(false);
  const [loot, setLoot] = useState<LootBag | null>(null);
  const [pending, setPending] = useState(false);
  const [waiting, setWaiting] = useState<LootBag>({});
  const [lost, setLost] = useState<LootBag>({});
  const [xp, setXp] = useState(0);
  const finished = useRef(false);

  // the guns taken into this battle: the tier chosen in each class on the Data tab (never above what is owned)
  const arsenal = useMemo(() => battleArsenal(account.arsenal, loadEquipped(account.session?.user.id)), [account.arsenal, account.session?.user.id]);
  const ownedGuns = useMemo(() => WEAPON_CLASS_IDS.filter((c) => arsenal[c] > 0).map((c) => weaponAt(c, arsenal[c] as 1 | 2 | 3 | 4).id), [arsenal]);

  const end = useCallback(async (won: boolean) => {
    if (finished.current) return;
    finished.current = true;
    const g = game.current;
    if (g) { setPhase(won ? 'won' : 'lost'); buzz(won ? 'victory' : 'defeat'); }
    if (run.current) {
      const result = await finishRaid(run.current, won);
      if (won) { setPending(result.pending === true); setWaiting(result.waiting ?? {}); setLoot(result.won ? (result.loot ?? {}) : {}); setLost(result.lost ?? {}); setXp(result.xp ?? 0); }
      void account.refresh();
    }
  }, [account]);

  // the whole raid: load, start with the server, then the game loop
  useEffect(() => {
    let raf = 0;
    let cancelled = false;
    let lastHud = 0;
    let lastBoom = 0;
    let finishing = -1;
    let last = performance.now();

    const start = async () => {
      preloadSfx(enemyFiles());
      const ids = [...plan.enemies, ...(plan.boss ? [plan.boss] : [])];
      const [picture, art, started] = await Promise.all([
        loadImage(imageUrl),
        loadRaidAssets(ids, ownedGuns),
        startRaid(placeId, plan.worth, plan.total + (plan.boss ? 1 : 0), plan.lootTypes, metroId),
      ]);
      if (cancelled) return;
      if ('error' in started) {
        setNeedsSignIn(started.error === 'sign_in');
        setMessage(started.error === 'sign_in' ? 'YOU MUST BE SIGNED IN TO CLEAR A PLACE' : started.error === 'locked' ? 'UNLOCK THIS SNAPSHOT FIRST' : started.error === 'cleared' ? 'THIS PLACE IS ALREADY CLEARED' : started.error === 'too_many' ? 'YOU HAVE BEEN FIGHTING A LOT. REST A WHILE' : 'THE RAID COULD NOT START. TRY AGAIN IN A MOMENT');
        setPhase('error');
        return;
      }
      if (!picture) {
        setMessage('THE PICTURE WOULD NOT LOAD');
        setPhase('error');
        return;
      }
      bg.current = picture;
      assets.current = art;
      run.current = started.runId;
      // a place nobody marked by hand: the picture is looked at for sensible places to come from (not in the sky), and how far down the horizon is
      const looked = spawnsAreMarked(placeId) ? null : analyzeSpawns(picture, spawns);
      game.current = new Game({ plan, spawns: looked ?? spawns, arsenal, level: levelInfo(account.points).level });
      if (import.meta.env.DEV) (window as unknown as { __game?: Game }).__game = game.current; // for trying things out in development
      setPhase('fighting');
      last = performance.now();
      raf = requestAnimationFrame(loop);
    };

    const ratioOf = (e: Enemy): number => {
      const f = assets.current.enemies[e.type.id]?.frames[0];
      return f ? f.naturalWidth / f.naturalHeight : 0.45;
    };

    const loop = (now: number) => {
      const g = game.current;
      const c = canvas.current;
      if (!g || !c || cancelled) return;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      // the scope eases in and out as the sniper rifle is taken up and put down
      const wantZoom = g.selected === 'sniper' && !!g.weapon && !g.paused ? 1.5 : 1;
      scope.current.zoom += (wantZoom - scope.current.zoom) * Math.min(1, dt * 9);
      if (Math.abs(wantZoom - scope.current.zoom) < 0.002) scope.current.zoom = wantZoom;
      const before = g.killed;
      const hitsBefore = g.hits;
      g.update(dt);
      if (g.downed) setDowned(true);
      // the creatures' own voices: a growl or squeal as one strikes, another as it dies (raiders and robots keep the shot and the crackle)
      let voicedDeath = false;
      for (const e of g.enemies) {
        const was = lastState.current.get(e.id);
        if (e.state !== was) {
          lastState.current.set(e.id, e.state);
          if (e.state === 'striking' && hasVoice(e.type.id)) playEnemy(e.type.id, 'strike', sound);
          if (e.state === 'dying' && hasVoice(e.type.id)) { playEnemy(e.type.id, 'die', sound); voicedDeath = true; }
        }
      }
      for (const cls of WEAPON_CLASS_IDS) {
        const now = (g.reloadLeft[cls] ?? 0) > 0;
        if (now !== !!wasReloading.current[cls]) {
          wasReloading.current[cls] = now;
          if (cls === g.selected) playSound(now ? 'reloadOut' : 'reloadIn', sound);
        }
      }
      if (g.boomed > lastBoom) { lastBoom = g.boomed; playSound('boom', sound); buzz('boom'); }
      if (g.killed > before) { if (!voicedDeath) playSound('kill', sound); buzz('kill'); }
      if (g.hits > hitsBefore) { playSound('hurt', sound); buzz('hurt'); }
      if (pointer.current.down) shoot();
      // turning the phone makes the canvas briefly empty or changes its size under us: one bad frame must never end the loop (it used to stop the whole fight)
      try { draw(c, g, now / 1000); } catch { /* skip this frame */ }
      if (now - lastHud > 100) {
        lastHud = now;
        const boss = g.enemies.find((e) => e.boss && e.state !== 'dying');
        setHud({
          hits: g.hits, hp: g.health / g.maxHealth, magSize: g.capacity(g.selected), ammo: g.ammo[g.selected] ?? null, mag: g.mag[g.selected] ?? null, reload: g.reloadProgress,
          reserve: g.mag[g.selected] !== undefined && g.ammo[g.selected] !== undefined ? Math.max(0, (g.ammo[g.selected] as number) - (g.mag[g.selected] as number)) : null,
          selected: g.selected, remaining: g.remaining,
          banner: g.bannerT > 0 ? g.banner : '', bossHp: boss ? boss.hp / boss.maxHp : null, bossName: boss?.type.name ?? '', slow: g.slowLeft,
        });
      }
      if (g.outcome !== 'fighting') {
        // the blow that ends the fight is allowed to finish (the claw marks, the flash) before the screen says YOU DIED
        if (finishing < 0) finishing = g.outcome === 'lost' ? 1.5 : 0;
        for (const s of g.strikes) s.t += dt;
        g.strikes = g.strikes.filter((s) => s.t < s.life);
        g.hitFlash = Math.max(0, g.hitFlash - dt * 2.5);
        g.shake = Math.max(0, g.shake - dt * 3);
        finishing -= dt;
        if (finishing > 0) { raf = requestAnimationFrame(loop); return; }
        void end(g.outcome === 'won');
        return;
      }
      raf = requestAnimationFrame(loop);
    };

    const shoot = () => {
      const g = game.current;
      const picture = bg.current;
      if (!g || !picture || g.paused) return;
      const v = view.current;
      const u = (pointer.current.x - v.x) / v.w;
      const w = (pointer.current.y - v.y) / v.h;
      const weapon = g.weapon;
      if (g.fire(u, w, picture.naturalWidth / picture.naturalHeight, ratioOf)) {
        if (weapon) playSound(weapon.splash && !weapon.auto ? 'explosive' : weapon.auto && weapon.splash ? 'flame' : (g.selected as 'pistol' | 'automatic' | 'sniper'), sound);
        if (weapon) buzz(weapon.splash && !weapon.auto ? 'explosive' : weapon.auto && weapon.splash ? 'flame' : (g.selected as 'pistol' | 'automatic' | 'sniper'));
      }
    };
    (canvas.current as HTMLCanvasElement & { __shoot?: () => void }).__shoot = shoot;

    const draw = (c: HTMLCanvasElement, g: Game, time: number) => {
      const picture = bg.current as HTMLImageElement;
      const dpr = window.devicePixelRatio || 1;
      const cssW = c.clientWidth, cssH = c.clientHeight;
      if (cssW < 2 || cssH < 2 || !picture.naturalWidth) return; // mid-turn: nothing to draw on yet
      if (c.width !== Math.round(cssW * dpr) || c.height !== Math.round(cssH * dpr)) {
        c.width = Math.round(cssW * dpr);
        c.height = Math.round(cssH * dpr);
      }
      const ctx = c.getContext('2d') as CanvasRenderingContext2D;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, cssW, cssH);
      // the picture fills the screen; but when that would cut off more than a third of it (a tall picture on a wide screen, or the other way round) it is
      // fitted whole instead, with the sides or top dimmed
      const cover = Math.max(cssW / picture.naturalWidth, cssH / picture.naturalHeight);
      const contain = Math.min(cssW / picture.naturalWidth, cssH / picture.naturalHeight);
      const fitted = cover / contain > 1.5;
      const scale = fitted ? contain : cover;
      const baseW = picture.naturalWidth * scale, baseH = picture.naturalHeight * scale;
      const baseX = (cssW - baseW) / 2;
      const baseY = fitted ? (cssH - baseH) / 2 : cssH - baseH;
      // through the scope the picture is bigger (1.5 times) and can be scrolled: the point of it that is in the middle of the scope is kept as a share of the picture, so
      // turning the phone (a different size and shape of screen) keeps the same place in the middle
      const Z = scope.current.zoom;
      const through = (Z - 1) / 0.5; // 0 to 1: how much of the way into the scope
      const vw = baseW * Z, vh = baseH * Z;
      const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
      // (a picture that is smaller than the screen one way can still be moved that way: the middle of the scope can go to any part of the picture)
      const zoomX = vw >= cssW ? clamp(cssW / 2 - scope.current.pu * vw, cssW - vw, 0) : cssW / 2 - scope.current.pu * vw;
      const zoomY = vh >= cssH ? clamp(cssH / 2 - scope.current.pv * vh, cssH - vh, 0) : cssH / 2 - scope.current.pv * vh;
      const vx = baseX + (zoomX - baseX) * through;
      const vy = baseY + (zoomY - baseY) * through;
      view.current = { x: vx, y: vy, w: vw, h: vh };

      if (pointer.current.x < 0) { pointer.current.x = cssW * 0.5; pointer.current.y = cssH * 0.55; }
      // looking through the scope the shot goes where the crosshair is: the middle of the screen
      if (through > 0.5) { pointer.current.x = cssW / 2; pointer.current.y = cssH / 2; }
      const shake = g.shake * 8;
      ctx.save();
      ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
      if (fitted) {
        ctx.fillStyle = '#000';
        ctx.fillRect(-20, -20, cssW + 40, cssH + 40);
        const coverW = picture.naturalWidth * cover, coverH = picture.naturalHeight * cover;
        ctx.globalAlpha = 0.22;
        ctx.drawImage(picture, (cssW - coverW) / 2, (cssH - coverH) / 2, coverW, coverH);
        ctx.globalAlpha = 1;
      }
      ctx.drawImage(picture, vx, vy, vw, vh);

      // enemies, far ones first
      const sorted = [...g.enemies].sort((a, b) => a.v - b.v);
      for (const e of sorted) {
        const sprites = assets.current.enemies[e.type.id];
        const hPx = g.heightOf(e) * vh;
        const bob = e.type.flying ? Math.sin(e.phase + e.t * 4) * 0.045 * hPx - 0.1 * hPx : 0;
        const x = vx + e.u * vw, y = vy + (e.v - e.lift) * vh + bob;
        ctx.save();
        if (e.state === 'dying') ctx.globalAlpha = Math.max(0, Math.min(1, 1.2 - e.t));
        // a shadow on the ground
        ctx.fillStyle = 'rgba(0,0,0,0.28)';
        ctx.beginPath();
        ctx.ellipse(x, vy + e.v * vh, hPx * 0.22, hPx * 0.05, 0, 0, Math.PI * 2);
        ctx.fill();
        if (sprites) {
          const f0 = sprites.frames[0];
          // the two walking poses swap twice a step, in time with the walk (a flier beats its wings on the clock instead)
          const frameIndex = e.state === 'dying' ? 3 : e.state === 'striking' ? 2 : e.type.flying ? Math.floor(e.t * 3.5 + e.id) % 2 : Math.floor(e.gait * 2 + e.id) % 2;
          const frame = sprites.frames[frameIndex] ?? f0;
          const scale = hPx / f0.naturalHeight;
          const dw = frame.naturalWidth * scale, dh = frame.naturalHeight * scale;
          ctx.drawImage(frame, x - dw / 2, y - dh, dw, dh);
          if (e.hurt > 0 && e.state !== 'dying') {
            ctx.globalAlpha = e.hurt * 0.45;
            ctx.globalCompositeOperation = 'lighter';
            ctx.drawImage(frame, x - dw / 2, y - dh, dw, dh);
          }
        } else {
          ctx.fillStyle = COLORS[e.type.id] ?? '#4a4a4a';
          const bw = hPx * 0.42;
          ctx.fillRect(x - bw / 2, y - hPx, bw, hPx);
          ctx.fillStyle = e.hurt > 0 ? '#fff' : '#000';
          ctx.fillRect(x - bw * 0.3, y - hPx * 0.9, bw * 0.6, hPx * 0.08);
        }
        ctx.restore();
        if (!e.boss && e.hp < e.maxHp && e.state !== 'dying' && hPx > 24) {
          const bw = Math.max(18, hPx * 0.3);
          ctx.fillStyle = 'rgba(0,0,0,0.6)';
          ctx.fillRect(x - bw / 2, y - hPx - 8, bw, 4);
          ctx.fillStyle = '#c33';
          ctx.fillRect(x - bw / 2, y - hPx - 8, bw * Math.max(0, e.hp / e.maxHp), 4);
        }
      }

      // blasts, flames and sparks
      for (const fx of g.effects) {
        const p = fx.t / fx.life;
        const fxx = vx + fx.u * vw, fxy = vy + fx.v * vh;
        if (fx.kind === 'explosion') {
          const r = fx.size * vw * (0.35 + 0.75 * p);
          const grad = ctx.createRadialGradient(fxx, fxy, 0, fxx, fxy, r);
          grad.addColorStop(0, `rgba(255,240,170,${1 - p})`);
          grad.addColorStop(0.4, `rgba(255,140,30,${0.9 * (1 - p)})`);
          grad.addColorStop(1, 'rgba(120,30,0,0)');
          ctx.fillStyle = grad;
          ctx.beginPath(); ctx.arc(fxx, fxy, r, 0, Math.PI * 2); ctx.fill();
        } else if (fx.kind === 'flame') {
          for (let i = 0; i < 5; i++) {
            const a = time * 20 + i * 1.7;
            const r = fx.size * vw * (0.35 + 0.25 * Math.sin(a));
            ctx.fillStyle = `rgba(255,${120 + i * 25},40,${0.28 * (1 - p)})`;
            ctx.beginPath(); ctx.arc(fxx + Math.cos(a) * r * 0.5, fxy + Math.sin(a * 1.3) * r * 0.5, r, 0, Math.PI * 2); ctx.fill();
          }
        } else if (fx.kind === 'spark') {
          ctx.fillStyle = `rgba(255,230,150,${1 - p})`;
          ctx.beginPath(); ctx.arc(fxx, fxy, Math.max(2, fx.size * vw * (1 - p * 0.5)), 0, Math.PI * 2); ctx.fill();
        }
      }
      // grenades in the air, and missiles with a smoke trail behind them
      for (const pr of g.projectiles) {
        const k = Math.min(1, pr.t / pr.life);
        const sx0 = vx + pr.u0 * vw, sy0 = vy + pr.v0 * vh, tx = vx + pr.u * vw, ty = vy + pr.v * vh;
        const arc = Math.min(cssH * 0.4, vh * 0.45);
        const at = (kk: number): [number, number] => [sx0 + (tx - sx0) * kk, sy0 + (ty - sy0) * kk - (pr.kind === 'grenade' ? Math.sin(Math.PI * kk) * arc : 0)];
        const [px, py] = at(k);
        const small = 1 - 0.55 * k; // it gets smaller as it goes away from you
        const uu = Math.min(cssW, cssH);
        if (pr.kind === 'missile') {
          for (let i = 14; i >= 1; i--) {
            const kk = k - i * 0.03;
            if (kk < 0) continue;
            const [qx, qy] = at(kk);
            ctx.fillStyle = `rgba(215,215,205,${0.5 * (1 - i / 15)})`;
            ctx.beginPath(); ctx.arc(qx + Math.sin(i * 2.1) * 2, qy + Math.cos(i * 1.7) * 2, uu * (0.008 + i * 0.0012) * (0.6 + small * 0.4), 0, Math.PI * 2); ctx.fill();
          }
          const [bx, by] = at(Math.max(0, k - 0.03));
          const ang = Math.atan2(py - by, px - bx);
          ctx.save(); ctx.translate(px, py); ctx.rotate(ang);
          const len = uu * 0.05 * small;
          ctx.fillStyle = 'rgba(255,180,60,0.95)'; ctx.beginPath(); ctx.arc(-len * 0.55, 0, len * 0.3, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#3a3d38'; ctx.fillRect(-len * 0.5, -len * 0.12, len, len * 0.24);
          ctx.fillStyle = '#b8b0a0'; ctx.beginPath(); ctx.moveTo(len * 0.5, -len * 0.12); ctx.lineTo(len * 0.8, 0); ctx.lineTo(len * 0.5, len * 0.12); ctx.fill();
          ctx.restore();
        } else {
          const r = uu * 0.024 * small;
          ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(sx0 + (tx - sx0) * k, sy0 + (ty - sy0) * k, r, r * 0.4, 0, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#4a5238'; ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = 'rgba(255,255,230,0.55)'; ctx.beginPath(); ctx.arc(px - r * 0.3, py - r * 0.3, r * 0.35, 0, Math.PI * 2); ctx.fill();
        }
      }
      // aiming a grenade: the arc it will fly and a ring where it will land
      if (aiming.current && g.weapon?.id === 'm79') {
        const sx0 = vx + 0.68 * vw, sy0 = vy + 1.06 * vh, tx = pointer.current.x, ty = pointer.current.y;
        const arc = Math.min(cssH * 0.4, vh * 0.45);
        ctx.save();
        ctx.setLineDash([8, 9]); ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,236,150,0.9)';
        ctx.beginPath();
        for (let i = 0; i <= 24; i++) { const kk = i / 24; const x = sx0 + (tx - sx0) * kk, y = sy0 + (ty - sy0) * kk - Math.sin(Math.PI * kk) * arc; if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
        ctx.stroke();
        ctx.setLineDash([]); ctx.strokeStyle = 'rgba(255,120,60,0.9)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.ellipse(tx, ty, (g.weapon?.splash ?? 0.09) * 1.3 * vw, (g.weapon?.splash ?? 0.09) * 1.3 * vw * 0.45, 0, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
      }
      ctx.restore();

      // the gun, bottom of the screen, turning toward where the survivor is aiming
      const weapon = g.weapon;
      const gunArt = weapon ? assets.current.guns[weapon.id] : undefined;
      const gh = Math.min(cssH * 0.34, 330);
      const gw = gunArt ? gh * (gunArt.image.naturalWidth / gunArt.image.naturalHeight) : gh * 0.5;
      // anchored to the bottom right with its edges off screen (the pictures are cut off at their edges), turning a little toward where the survivor aims
      const pivotX = Math.max(gw * 0.5, cssW - gw * 0.44), pivotY = cssH + gh * 0.64;
      // held out toward the screen with a little lean so it can be told what it is: it swings from leaning left, through straight, to leaning right as the aim goes from the left of the screen to the right
      const across = Math.max(-1, Math.min(1, (pointer.current.x - cssW / 2) / (cssW / 2)));
      const lean = ((GUN_LEAN[weapon?.id ?? ''] ?? 30) * Math.PI) / 180;
      const aim = lean * 0.92 + across * 0.4;
      ctx.save();
      // reloading: the gun tips up and away while the magazine (or fuel tank) is swapped by a hand coming up from below the screen
      const reload = g.reloadProgress;
      const tip = reload === null ? 0 : Math.sin(Math.min(1, reload) * Math.PI);
      // the gun turns about a point below the screen; its base is kept where it was, so turning it does not slide it off the side of the screen
      ctx.translate(pivotX - (pivotY - cssH) * Math.sin(aim - tip * 0.16), pivotY + g.recoil * 22 - tip * gh * 0.1);
      ctx.rotate(aim - tip * 0.16);
      if (gunArt) {
        ctx.drawImage(gunArt.image, -gw / 2, -gh, gw, gh);
        if (g.recoil > 0.55) {
          const tx = (gunArt.tipX - 0.5) * gw, ty = -gh + 4;
          const grad = ctx.createRadialGradient(tx, ty, 0, tx, ty, gh * 0.22);
          grad.addColorStop(0, 'rgba(255,250,200,0.95)');
          grad.addColorStop(0.35, 'rgba(255,170,50,0.7)');
          grad.addColorStop(1, 'rgba(255,100,0,0)');
          ctx.fillStyle = grad;
          ctx.beginPath(); ctx.arc(tx, ty, gh * 0.22, 0, Math.PI * 2); ctx.fill();
        }
      } else {
        ctx.fillStyle = '#2a2a2a';
        ctx.fillRect(-18, -gh * 0.6, 36, gh * 0.6);
      }
      if (reload !== null) drawReload(ctx, reload, gw, gh, weapon?.id === 'flamethrower');
      ctx.restore();

      // what the survivor was struck by: a bullet hole, claw marks, or a blast, flashing across the picture
      const unit = Math.min(cssW, cssH);
      for (const st of g.strikes) {
        const q = st.t / st.life;
        const sx = vx + st.u * vw, sy = vy + st.v * vh;
        const fade = q < 0.55 ? 1 : 1 - (q - 0.55) / 0.45;
        const seeded = (n: number) => { const x = Math.sin(st.seed * 12.9898 + n * 78.233) * 43758.5453; return x - Math.floor(x); };
        ctx.save();
        if (st.kind === 'bullet') {
          const r = unit * 0.075;
          if (q < 0.25) { ctx.fillStyle = `rgba(255,240,200,${0.9 * (1 - q / 0.25)})`; ctx.beginPath(); ctx.arc(sx, sy, r * (2.2 - q * 4), 0, Math.PI * 2); ctx.fill(); }
          ctx.globalAlpha = fade;
          ctx.strokeStyle = 'rgba(235,235,235,0.85)';
          ctx.lineWidth = 1.6;
          for (let i = 0; i < 9; i++) {
            const ang = seeded(i) * Math.PI * 2, len = r * (1.6 + seeded(i + 20) * 2.6);
            ctx.beginPath(); ctx.moveTo(sx + Math.cos(ang) * r * 0.8, sy + Math.sin(ang) * r * 0.8);
            ctx.lineTo(sx + Math.cos(ang) * len, sy + Math.sin(ang) * len + (seeded(i + 40) - 0.5) * r * 0.5); ctx.stroke();
          }
          const hole = ctx.createRadialGradient(sx, sy, 0, sx, sy, r);
          hole.addColorStop(0, 'rgba(0,0,0,1)'); hole.addColorStop(0.7, 'rgba(10,6,4,0.95)'); hole.addColorStop(1, 'rgba(10,6,4,0.2)');
          ctx.fillStyle = hole;
          ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI * 2); ctx.fill();
        } else if (st.kind === 'slash') {
          ctx.globalAlpha = fade;
          const reach = Math.min(1, q / 0.22);
          const len = unit * 0.9;
          ctx.lineCap = 'round';
          for (let i = 0; i < 3; i++) {
            const ox = (i - 1) * unit * 0.075, oy = (i - 1) * unit * 0.02;
            const x0 = sx - len * 0.42 + ox, y0 = sy - len * 0.5 + oy, x1 = x0 + len * 0.84 * reach, y1 = y0 + len * 1.0 * reach;
            ctx.strokeStyle = 'rgba(30,0,0,0.85)'; ctx.lineWidth = 20 - i * 3; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo((x0 + x1) / 2 + 14 + seeded(i) * 30, (y0 + y1) / 2 - 10, x1, y1); ctx.stroke();
            ctx.strokeStyle = 'rgba(210,30,20,0.95)'; ctx.lineWidth = 10 - i * 2; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo((x0 + x1) / 2 + 14 + seeded(i) * 30, (y0 + y1) / 2 - 10, x1, y1); ctx.stroke();
            ctx.strokeStyle = 'rgba(255,230,210,0.9)'; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo((x0 + x1) / 2 + 14 + seeded(i) * 30, (y0 + y1) / 2 - 10, x1, y1); ctx.stroke();
          }
        } else {
          const flash = Math.pow(1 - q, 2);
          const grad = ctx.createRadialGradient(sx, sy, 0, sx, sy, Math.max(cssW, cssH) * (0.5 + q * 0.6));
          grad.addColorStop(0, `rgba(255,250,215,${flash})`);
          grad.addColorStop(0.35, `rgba(255,160,50,${flash * 0.85})`);
          grad.addColorStop(1, `rgba(120,30,0,${flash * 0.45})`);
          ctx.fillStyle = grad;
          ctx.fillRect(0, 0, cssW, cssH);
          ctx.fillStyle = `rgba(30,20,12,${Math.max(0, 0.45 * (q - 0.3))})`;
          ctx.fillRect(0, 0, cssW, cssH);
        }
        ctx.restore();
      }
      // blood at the edges for a moment after a strike
      const alpha = g.hitFlash * 0.5;
      if (alpha > 0) {
        const grad = ctx.createRadialGradient(cssW / 2, cssH / 2, Math.min(cssW, cssH) * 0.35, cssW / 2, cssH / 2, Math.max(cssW, cssH) * 0.75);
        grad.addColorStop(0, 'rgba(160,0,0,0)');
        grad.addColorStop(1, `rgba(160,0,0,${alpha})`);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, cssW, cssH);
      }

      // looking through a sniper scope: dark all round the lens, and a fine crosshair with a mark on each arm
      if (through > 0.02) {
        const sx = cssW / 2, sy = cssH / 2, R = Math.min(cssW, cssH) * 0.46;
        ctx.save();
        ctx.globalAlpha = Math.min(1, through * 1.4);
        ctx.fillStyle = 'rgba(0,0,0,0.93)';
        ctx.beginPath(); ctx.rect(-20, -20, cssW + 40, cssH + 40); ctx.arc(sx, sy, R, 0, Math.PI * 2, true); ctx.fill('evenodd');
        ctx.strokeStyle = 'rgba(0,0,0,0.95)'; ctx.lineWidth = Math.max(6, R * 0.03);
        ctx.beginPath(); ctx.arc(sx, sy, R, 0, Math.PI * 2); ctx.stroke();
        ctx.strokeStyle = 'rgba(8,8,8,0.9)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(sx - R, sy); ctx.lineTo(sx + R, sy); ctx.moveTo(sx, sy - R); ctx.lineTo(sx, sy + R); ctx.stroke();
        ctx.strokeStyle = 'rgba(0,0,0,0.95)'; ctx.lineWidth = Math.max(3, R * 0.016);
        const gapC = R * 0.07;
        ctx.beginPath(); ctx.moveTo(sx - R * 0.5, sy); ctx.lineTo(sx - gapC, sy); ctx.moveTo(sx + gapC, sy); ctx.lineTo(sx + R * 0.5, sy); ctx.moveTo(sx, sy - R * 0.5); ctx.lineTo(sx, sy - gapC); ctx.moveTo(sx, sy + gapC); ctx.lineTo(sx, sy + R * 0.5); ctx.stroke();
        ctx.fillStyle = 'rgba(0,0,0,0.95)';
        for (const k of [0.15, 0.25, 0.35, 0.45]) for (const [dx, dy] of [[k, 0], [-k, 0], [0, k], [0, -k]]) { ctx.beginPath(); ctx.arc(sx + dx * R, sy + dy * R, Math.max(2, R * 0.009), 0, Math.PI * 2); ctx.fill(); }
        ctx.fillStyle = 'rgba(255,60,40,0.95)'; ctx.beginPath(); ctx.arc(sx, sy, 2.2, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }
      // the crosshair, where the survivor is aiming (it moves to wherever they tap)
      const cx = pointer.current.x, cy = pointer.current.y, cr = Math.max(16, unit * 0.034) * (1 + g.recoil * 0.25);
      if (through > 0.5) return;
      ctx.save();
      ctx.lineCap = 'round';
      for (const [color, width] of [['rgba(0,0,0,0.75)', 5], ['rgba(255,236,150,0.95)', 2]] as [string, number][]) {
        ctx.strokeStyle = color; ctx.lineWidth = width;
        ctx.beginPath(); ctx.arc(cx, cy, cr, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx - cr * 1.7, cy); ctx.lineTo(cx - cr * 0.55, cy); ctx.moveTo(cx + cr * 0.55, cy); ctx.lineTo(cx + cr * 1.7, cy);
        ctx.moveTo(cx, cy - cr * 1.7); ctx.lineTo(cx, cy - cr * 0.55); ctx.moveTo(cx, cy + cr * 0.55); ctx.lineTo(cx, cy + cr * 1.7);
        ctx.stroke();
      }
      ctx.fillStyle = 'rgba(255,90,60,0.95)';
      ctx.beginPath(); ctx.arc(cx, cy, 2, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    };

    void start();
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      if (run.current && !finished.current) void finishRaid(run.current, false);
    };
    // the raid is set up once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // keys: arrows or 1-4 pick the weapon class (left pistol, right automatic, down sniper, up heavy)
  useEffect(() => {
    const keys: Record<string, WeaponClass> = { ArrowLeft: 'pistol', '1': 'pistol', ArrowRight: 'automatic', '2': 'automatic', ArrowDown: 'sniper', '3': 'sniper', ArrowUp: 'explosive', '4': 'explosive' };
    const onKey = (e: KeyboardEvent) => {
      const cls = keys[e.key];
      if (cls) game.current?.select(cls);
      if (e.key === 'Escape') { if (game.current?.paused) closeWheel(); else onExit(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onExit]);

  const aimAt = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    pointer.current.x = e.clientX - r.left;
    pointer.current.y = e.clientY - r.top;
  };

  useEffect(() => { if (game.current) game.current.canRevive = stims > 0; }, [stims, phase]);
  const reviveYes = async () => {
    const g = game.current;
    if (!g || healing) return;
    setHealing(true);
    const result = await useStimpak();
    if (result.ok) {
      g.heal();
      g.downed = false;
      g.paused = false;
      setStims(result.qty ?? Math.max(0, stims - 1));
      setHud((h) => (h ? { ...h, hits: 0, hp: 1 } : h));
      setDowned(false);
      void account.refresh();
    } else {
      reviveNo();
    }
    setHealing(false);
  };
  function reviveNo() {
    const g = game.current;
    if (!g) return;
    g.downed = false;
    g.paused = false;
    g.outcome = 'lost';
    setDowned(false);
  }
  const openWheel = () => {
    if (!game.current) return;
    game.current.paused = true;
    setWheelOpen(true);
  };
  function closeWheel() {
    if (game.current) game.current.paused = false;
    setWheelOpen(false);
  }
  const pick = (cls: WeaponClass) => {
    if (game.current?.select(cls)) setHud((h) => (h ? { ...h, selected: cls } : h));
    closeWheel();
  };
  // Legendary Time: one is used up (the server takes it), and for four seconds the enemies crawl
  const slowTime = async () => {
    const g = game.current;
    if (!g || timing || g.slowLeft > 0 || times <= 0) return;
    setTiming(true);
    const result = await useTime();
    if (result.ok) {
      g.slow(SLOW_SECONDS);
      setTimes(result.qty ?? Math.max(0, times - 1));
      void account.refresh();
    }
    setTiming(false);
  };
  const heal = async () => {
    const g = game.current;
    if (!g || healing || stims <= 0 || g.health >= g.maxHealth) return;
    setHealing(true);
    const result = await useStimpak();
    if (result.ok) {
      g.heal();
      setStims(result.qty ?? Math.max(0, stims - 1));
      setHud((h) => (h ? { ...h, hits: 0 } : h));
      void account.refresh();
    }
    setHealing(false);
  };

  return createPortal(
    <div className="rm-raid" style={{ width: screenBox.w, height: screenBox.h }} role="dialog" aria-label="Looting" onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
      <canvas
        ref={canvas}
        className="rm-raid-canvas"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          if (scope.current.zoom > 1.25) { scope.current.drag = { x: e.clientX, y: e.clientY, pu: scope.current.pu, pv: scope.current.pv, moved: false }; return; }
          aimAt(e);
          if (game.current?.weapon?.id === 'm79') { aiming.current = true; return; }
          pointer.current.down = true; (e.currentTarget as HTMLCanvasElement & { __shoot?: () => void }).__shoot?.();
        }}
        onPointerMove={(e) => {
          const d = scope.current.drag;
          if (!d) { aimAt(e); return; }
          const dx = e.clientX - d.x, dy = e.clientY - d.y;
          if (!d.moved && Math.hypot(dx, dy) > 8) d.moved = true;
          if (d.moved) { scope.current.pu = Math.max(0, Math.min(1, d.pu - dx / view.current.w)); scope.current.pv = Math.max(0, Math.min(1, d.pv - dy / view.current.h)); }
        }}
        onPointerUp={(e) => {
          const d = scope.current.drag;
          scope.current.drag = null;
          pointer.current.down = false;
          if (aiming.current) { aiming.current = false; aimAt(e); (e.currentTarget as HTMLCanvasElement & { __shoot?: () => void }).__shoot?.(); return; }
          // a tap (not a scroll) through the scope fires at the crosshair, in the middle
          if (d && !d.moved) (e.currentTarget as HTMLCanvasElement & { __shoot?: () => void }).__shoot?.();
        }}
        onPointerCancel={() => { pointer.current.down = false; aiming.current = false; scope.current.drag = null; }}
      />
      {phase === 'loading' && <div className="rm-raid-center">GETTING READY…</div>}
      {phase === 'error' && (
        <div className="rm-raid-center">
          <p>{message}</p>
          {needsSignIn && onSignIn && <button type="button" className="rm-btn" onClick={() => { onExit(); onSignIn(); }}>SIGN IN</button>}
          <button type="button" className="rm-btn rm-btn-ghost" onClick={onExit}>BACK</button>
        </div>
      )}

      {phase === 'fighting' && hud && (
        <>
          <div className="rm-raid-top">
            <div className="rm-raid-hp" role="progressbar" aria-label="Health" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(hud.hp * 100)}>
              <div className="rm-raid-hp-ghost" style={{ width: `${Math.round(hud.hp * 100)}%` }} />
              <div className="rm-raid-hp-fill" style={{ width: `${Math.round(hud.hp * 100)}%` }} />
            </div>
            <button type="button" className="rm-btn rm-btn-ghost" onClick={onExit}>RETREAT</button>
          </div>
          {hud.bossHp !== null && (
            <div className="rm-raid-boss"><b>{hud.bossName.toUpperCase()}</b><div><div style={{ width: `${Math.round(hud.bossHp * 100)}%` }} /></div></div>
          )}
          {hud.banner && <div className="rm-raid-banner" key={hud.banner}>{hud.banner}</div>}
          {hud.mag !== null
            ? <button type="button" className={`rm-raid-ammo${hud.reload !== null ? ' rm-raid-reloading' : ''}`} onClick={() => game.current?.reload()} disabled={wheelOpen || downed} aria-label="Ammo: tap to reload" title="Tap to reload">{hud.reload !== null ? 'RELOADING…' : `AMMO ${hud.mag}/${hud.magSize}`}{hud.reserve !== null && hud.reserve > 0 && <small> +{hud.reserve}</small>}{hud.reload !== null && <span className="rm-raid-reload-bar"><span style={{ width: `${Math.round(hud.reload * 100)}%` }} /></span>}</button>
            : hud.ammo !== null && <div className="rm-raid-ammo">AMMO {hud.ammo}</div>}
          <div className="rm-raid-bar">
            <button type="button" className="rm-btn rm-raid-btn" onClick={openWheel} disabled={wheelOpen || downed}>WEAPONS</button>
            <button type="button" className="rm-btn rm-raid-btn" onClick={() => void heal()} disabled={wheelOpen || downed || healing || stims <= 0 || hud.hp >= 0.999} title="Take back all your health">STIMPAK ×{stims}</button>
            <button
              type="button" className={`rm-btn rm-raid-btn rm-raid-time${hud.slow > 0 ? ' running' : ''}`} onClick={() => void slowTime()}
              disabled={wheelOpen || downed || timing || hud.slow > 0 || times <= 0} title="Legendary Time: slow the enemies for four seconds" aria-label={`Legendary Time, ${times} left`}
            >
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="13.5" r="7.5" /><path d="M12 9.5v4l2.6 1.6M9.5 3h5M12 3v3M18.6 6.4l1.4-1.4" />
              </svg>
              <small>×{times}</small>
            </button>
            {hud.slow > 0 && <div className="rm-raid-slow" aria-live="polite">LEGENDARY TIME {hud.slow.toFixed(1)}</div>}
          </div>
          {downed && (
            <div className="rm-raid-center rm-raid-downed">
              <h2>YOU ARE DOWN</h2>
              <p>Use a stimpak and get back in the fight? You have {stims}.</p>
              <button type="button" className="rm-btn" disabled={healing} onClick={() => void reviveYes()}>USE STIMPAK</button>
              <button type="button" className="rm-btn rm-btn-ghost" disabled={healing} onClick={reviveNo}>GIVE UP</button>
            </div>
          )}
          {wheelOpen && (
            <div className="rm-wheel-overlay" onClick={closeWheel}>
            <div className="rm-raid-wheel" role="group" aria-label="Weapons" onClick={(e) => e.stopPropagation()}>
              {WEAPON_CLASS_IDS.map((cls) => {
                const tier = arsenal[cls];
                const w = tier > 0 ? weaponAt(cls, tier as 1 | 2 | 3 | 4) : null;
                return (
                  <button
                    key={cls}
                    type="button"
                    className={`rm-wheel-slot rm-wheel-${WEAPON_CLASSES[cls].slot}${hud.selected === cls ? ' on' : ''}${w ? '' : ' locked'}`}
                    disabled={!w}
                    onClick={() => pick(cls)}
                    title={w ? w.name : `${WEAPON_CLASSES[cls].label}: not built yet`}
                  >
                    {w ? (
                      <>
                        <GunThumb src={`${import.meta.env.BASE_URL}raid/guns/${w.id}.webp`} />
                        <small>{w.name}</small>
                      </>
                    ) : <span>🔒</span>}
                  </button>
                );
              })}
            </div>
            </div>
          )}
        </>
      )}

      {(phase === 'won' || phase === 'lost') && (
        <div className="rm-raid-center rm-raid-end">
          <h2>{phase === 'won' ? 'AREA CLEARED' : 'YOU DIED'}</h2>
          {phase === 'won' ? (
            loot === null ? <p>COUNTING THE LOOT…</p> : pending ? (
              <>
                <p>You have cleared the enemies from afar, but you must actually visit this location in real life to discover it. Your loot ({describeBag(waiting as never).toUpperCase() || 'NOTHING'}) is waiting and is yours the moment you do.</p>
                <ul className="rm-raid-loot">
                  {(Object.entries(waiting) as [LootId, number][]).map(([id, n]) => <li key={id}><b>+{n}</b> {lootName(id)} <small>WAITING</small></li>)}
                </ul>
              </>
            ) : (
              <ul className="rm-raid-loot">
                {Object.keys(loot).length === 0 && <li>Nothing was recovered.</li>}
                {(Object.entries(loot) as [LootId, number][]).map(([id, n]) => <li key={id}><b>+{n}</b> {lootName(id)}</li>)}
                {(Object.entries(lost) as [LootId, number][]).map(([id, n]) => <li key={`lost-${id}`} className="rm-raid-lost">{lootName(id)} FULL ({LOOT_CAP}): {n} LEFT BEHIND</li>)}
                {xp > 0 && <li><b>+{xp}</b> XP</li>}
              </ul>
            )
          ) : <p>The Wasteland is cruel and unforgiving. Buy weapons and stimpaks and try again.</p>}
          <button type="button" className="rm-btn" onClick={onExit}>{phase === 'won' ? 'CONTINUE' : 'BACK'}</button>
        </div>
      )}
    </div>,
    document.body,
  );
}

/**
 * The reload, drawn over the gun (in the gun's own coordinates, where the picture is cut off by the bottom of the screen): the old magazine (a fuel tank
 * for the flamethrower) drops away out of the bottom, then a gloved hand brings a fresh one up from below and pushes it home with a click.
 */
function drawReload(ctx: CanvasRenderingContext2D, p: number, gw: number, gh: number, tank: boolean) {
  const mw = gw * (tank ? 0.15 : 0.085), mh = gh * (tank ? 0.34 : 0.3);
  const x = gw * 0.03, seat = -gh * 0.86; // where a magazine sits: a little above the bottom edge of the screen, so the top of it and the hand are in view
  const ease = (q: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, q)), 3);
  const magazine = (cx: number, top: number, spin = 0) => {
    ctx.save();
    ctx.translate(cx, top + mh / 2);
    ctx.rotate(spin);
    const grad = ctx.createLinearGradient(-mw / 2, 0, mw / 2, 0);
    if (tank) { grad.addColorStop(0, '#6b3a12'); grad.addColorStop(0.35, '#c9772a'); grad.addColorStop(1, '#5a300e'); } else { grad.addColorStop(0, '#15171a'); grad.addColorStop(0.4, '#4a4f55'); grad.addColorStop(1, '#16181b'); }
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.roundRect(-mw / 2, -mh / 2, mw, mh, mw * 0.18); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.65)'; ctx.lineWidth = 2; ctx.stroke();
    if (tank) { ctx.fillStyle = 'rgba(30,18,6,0.75)'; ctx.fillRect(-mw / 2, -mh * 0.2, mw, mh * 0.08); ctx.fillRect(-mw / 2, mh * 0.12, mw, mh * 0.08); ctx.fillStyle = '#2a2a2a'; ctx.fillRect(-mw * 0.18, -mh / 2 - 5, mw * 0.36, 7); }
    else { ctx.fillStyle = '#c9a24a'; ctx.fillRect(-mw * 0.3, -mh / 2 + 3, mw * 0.6, 4); ctx.fillStyle = 'rgba(255,255,255,0.14)'; ctx.fillRect(-mw * 0.38, -mh / 2 + 10, 3, mh - 18); }
    ctx.restore();
  };
  // 0 to 0.3: the spent one falls away; 0.25 to 0.88: the hand brings the new one up; the rest: it seats
  if (p < 0.32) { const q = p / 0.32; magazine(x + q * gw * 0.04, seat + q * q * gh * 0.7, q * 0.5); }
  if (p > 0.25) {
    const q = ease((p - 0.25) / 0.63);
    const bump = p > 0.88 ? Math.sin(((p - 0.88) / 0.12) * Math.PI) * 4 : 0;
    const top = seat + (1 - q) * gh * 0.7 + bump;
    magazine(x, top);
    // the glove under it: a palm with the fingers curled round the magazine
    const hx = x, hy = top + mh * 0.55, hw = mw * (tank ? 1.9 : 2.7);
    ctx.fillStyle = '#4a3426'; ctx.strokeStyle = '#1d130c'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(hx - hw / 2, hy, hw, gh * 0.4, hw * 0.3); ctx.fill(); ctx.stroke();
    for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.roundRect(hx - hw * 0.42 + i * hw * 0.21, hy - mh * 0.16, hw * 0.19, mh * 0.5, hw * 0.1); ctx.fill(); ctx.stroke(); }
    ctx.fillStyle = 'rgba(255,255,255,0.1)'; ctx.fillRect(hx - hw * 0.34, hy + 4, hw * 0.12, gh * 0.12);
  }
}

/** A gun's picture in a wheel slot (the art may not exist yet). */
function GunThumb({ src }: { src: string }) {
  const [ok, setOk] = useState(true);
  return ok ? <img src={src} alt="" onError={() => setOk(false)} draggable={false} /> : <span>◈</span>;
}
