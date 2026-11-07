import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { finishRaid, startRaid, useStimpak, useTime, type Account } from '../lib/account';
import { loadRaidAssets, type RaidAssets } from '../lib/raid/assets';
import { playSound } from '../lib/raid/audio';
import { enemyFiles, hasVoice, playEnemy, preloadSfx } from '../lib/sfx';
import { buzz } from '../lib/haptics';
import { enemyById } from '../lib/raid/enemies';
import { Game, MAX_HITS, SLOW_SECONDS, type Enemy, type Spawns } from '../lib/raid/engine';
import { LOOT_CAP, lootName, type LootBag, type LootId } from '../lib/raid/loot';
import type { RaidPlan } from '../lib/raid/raid';
import { MAGAZINE, WEAPON_CLASSES, WEAPON_CLASS_IDS, weaponAt, type WeaponClass } from '../lib/raid/weapons';

interface Hud {
  hits: number;
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
  const [phase, setPhase] = useState<'loading' | 'fighting' | 'won' | 'lost' | 'error'>('loading');
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

  const ownedGuns = useMemo(() => WEAPON_CLASS_IDS.filter((c) => account.arsenal[c] > 0).map((c) => weaponAt(c, account.arsenal[c] as 1 | 2 | 3 | 4).id), [account.arsenal]);

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
        setMessage(started.error === 'sign_in' ? 'YOU MUST BE SIGNED IN TO LOOT' : started.error === 'locked' ? 'UNLOCK THIS SNAPSHOT FIRST' : started.error === 'cleared' ? 'THIS PLACE IS ALREADY CLEARED' : started.error === 'too_many' ? 'YOU HAVE BEEN FIGHTING A LOT. REST A WHILE' : 'THE RAID COULD NOT START. TRY AGAIN IN A MOMENT');
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
      game.current = new Game({ plan, spawns, arsenal: account.arsenal });
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
      if (g.killed > before) { if (!voicedDeath) playSound('kill', sound); buzz('kill'); }
      if (g.hits > hitsBefore) { playSound('hurt', sound); buzz('hurt'); }
      if (pointer.current.down) shoot();
      draw(c, g, now / 1000);
      if (now - lastHud > 100) {
        lastHud = now;
        const boss = g.enemies.find((e) => e.boss && e.state !== 'dying');
        setHud({
          hits: g.hits, ammo: g.ammo[g.selected] ?? null, mag: g.mag[g.selected] ?? null, reload: g.reloadProgress,
          reserve: g.mag[g.selected] !== undefined && g.ammo[g.selected] !== undefined ? Math.max(0, (g.ammo[g.selected] as number) - (g.mag[g.selected] as number)) : null,
          selected: g.selected, remaining: g.remaining,
          banner: g.bannerT > 0 ? g.banner : '', bossHp: boss ? boss.hp / boss.maxHp : null, bossName: boss?.type.name ?? '', slow: g.slowLeft,
        });
      }
      if (g.outcome !== 'fighting') {
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
        if (weapon?.splash && !weapon.auto) window.setTimeout(() => { playSound('boom', sound); buzz('boom'); }, 120);
      }
    };
    (canvas.current as HTMLCanvasElement & { __shoot?: () => void }).__shoot = shoot;

    const draw = (c: HTMLCanvasElement, g: Game, time: number) => {
      const picture = bg.current as HTMLImageElement;
      const dpr = window.devicePixelRatio || 1;
      const cssW = c.clientWidth, cssH = c.clientHeight;
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
      const vw = picture.naturalWidth * scale, vh = picture.naturalHeight * scale;
      const vx = (cssW - vw) / 2;
      const vy = fitted ? (cssH - vh) / 2 : cssH - vh;
      view.current = { x: vx, y: vy, w: vw, h: vh };

      if (pointer.current.x < 0) { pointer.current.x = cssW * 0.5; pointer.current.y = cssH * 0.55; }
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
      ctx.restore();

      // the gun, bottom of the screen, turning toward where the survivor is aiming
      const weapon = g.weapon;
      const gunArt = weapon ? assets.current.guns[weapon.id] : undefined;
      const gh = Math.min(cssH * 0.34, 330);
      const gw = gunArt ? gh * (gunArt.image.naturalWidth / gunArt.image.naturalHeight) : gh * 0.5;
      // anchored to the bottom right with its edges off screen (the pictures are cut off at their edges), turning a little toward where the survivor aims
      const pivotX = Math.max(gw * 0.5, cssW - gw * 0.44), pivotY = cssH + gh * 0.64;
      const aim = Math.max(-0.12, Math.min(0.12, Math.atan2(pointer.current.x - pivotX, pivotY - pointer.current.y) * 0.3));
      ctx.save();
      // reloading: the gun tips up and away while the magazine (or fuel tank) is swapped by a hand coming up from below the screen
      const reload = g.reloadProgress;
      const tip = reload === null ? 0 : Math.sin(Math.min(1, reload) * Math.PI);
      ctx.translate(pivotX, pivotY + g.recoil * 22 - tip * gh * 0.1);
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

      // the crosshair, where the survivor is aiming (it moves to wherever they tap)
      const cx = pointer.current.x, cy = pointer.current.y, cr = Math.max(16, unit * 0.034) * (1 + g.recoil * 0.25);
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
      setHud((h) => (h ? { ...h, hits: 0 } : h));
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
    if (!g || healing || stims <= 0 || g.hits <= 0) return;
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
    <div className="rm-raid" role="dialog" aria-label="Looting" onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
      <canvas
        ref={canvas}
        className="rm-raid-canvas"
        onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); aimAt(e); pointer.current.down = true; (e.currentTarget as HTMLCanvasElement & { __shoot?: () => void }).__shoot?.(); }}
        onPointerMove={aimAt}
        onPointerUp={() => { pointer.current.down = false; }}
        onPointerCancel={() => { pointer.current.down = false; }}
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
            <div className="rm-raid-strikes" aria-label={`Strikes taken: ${hud.hits} of ${MAX_HITS}`}>
              {Array.from({ length: MAX_HITS }, (_, i) => <i key={i} className={i < hud.hits ? 'hit' : ''} />)}
            </div>
            <span className="rm-raid-left">{hud.remaining} LEFT</span>
            <button type="button" className="rm-btn rm-btn-ghost" onClick={onExit}>RETREAT</button>
          </div>
          {hud.bossHp !== null && (
            <div className="rm-raid-boss"><b>{hud.bossName.toUpperCase()}</b><div><div style={{ width: `${Math.round(hud.bossHp * 100)}%` }} /></div></div>
          )}
          {hud.banner && <div className="rm-raid-banner" key={hud.banner}>{hud.banner}</div>}
          {hud.mag !== null
            ? <div className={`rm-raid-ammo${hud.reload !== null ? ' rm-raid-reloading' : ''}`}>{hud.reload !== null ? 'RELOADING…' : `AMMO ${hud.mag}/${MAGAZINE}`}{hud.reserve !== null && hud.reserve > 0 && <small> +{hud.reserve}</small>}{hud.reload !== null && <span className="rm-raid-reload-bar"><span style={{ width: `${Math.round(hud.reload * 100)}%` }} /></span>}</div>
            : hud.ammo !== null && <div className="rm-raid-ammo">AMMO {hud.ammo}</div>}
          <div className="rm-raid-bar">
            <button type="button" className="rm-btn rm-raid-btn" onClick={openWheel} disabled={wheelOpen || downed}>WEAPONS</button>
            <button type="button" className="rm-btn rm-raid-btn" onClick={() => void heal()} disabled={wheelOpen || downed || healing || stims <= 0 || hud.hits <= 0} title="Take back all your strikes">STIMPAK ×{stims}</button>
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
                const tier = account.arsenal[cls];
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
                <p>You fended off the hordes from afar, but you must actually enter this landmark in your timeline. Once you discover it you will be automatically awarded your loot.</p>
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
          ) : <p>{plan.bossOnly ? 'The guardians of Vault 0 won this time. Come back with better guns and more stimpaks.' : <>The {plan.boss ? enemyById(plan.boss).name.toLowerCase() : enemyById(plan.enemies[0]).plural} won this time. Go back and try again.</>}</p>}
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
