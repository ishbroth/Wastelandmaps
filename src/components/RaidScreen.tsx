import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { finishRaid, startRaid, type Account } from '../lib/account';
import { loadRaidAssets, type RaidAssets } from '../lib/raid/assets';
import { playSound } from '../lib/raid/audio';
import { enemyById } from '../lib/raid/enemies';
import { Game, type Enemy, type Spawns } from '../lib/raid/engine';
import { lootName, type LootBag, type LootId } from '../lib/raid/loot';
import { maxHealth, type RaidPlan } from '../lib/raid/raid';
import { WEAPON_CLASSES, WEAPON_CLASS_IDS, weaponAt, type WeaponClass } from '../lib/raid/weapons';

interface Hud {
  health: number;
  max: number;
  ammo: number | null;
  selected: WeaponClass;
  remaining: number;
  banner: string;
  bossHp: number | null;
  bossName: string;
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
export default function RaidScreen({ plan, placeId, imageUrl, spawns, account, level, sound, onExit }: {
  plan: RaidPlan;
  placeId: string;
  imageUrl: string;
  spawns: Spawns;
  account: Account;
  level: number;
  sound: boolean;
  onExit: () => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const game = useRef<Game | null>(null);
  const assets = useRef<RaidAssets>({ enemies: {}, guns: {} });
  const bg = useRef<HTMLImageElement | null>(null);
  const run = useRef<string | null>(null);
  const view = useRef({ x: 0, y: 0, w: 1, h: 1 });
  const pointer = useRef({ down: false, x: 0, y: 0 });
  const [phase, setPhase] = useState<'loading' | 'fighting' | 'won' | 'lost' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const [hud, setHud] = useState<Hud | null>(null);
  const [loot, setLoot] = useState<LootBag | null>(null);
  const finished = useRef(false);

  const ownedGuns = useMemo(() => WEAPON_CLASS_IDS.filter((c) => account.arsenal[c] > 0).map((c) => weaponAt(c, account.arsenal[c] as 1 | 2 | 3 | 4).id), [account.arsenal]);

  const end = useCallback(async (won: boolean) => {
    if (finished.current) return;
    finished.current = true;
    const g = game.current;
    if (g) setPhase(won ? 'won' : 'lost');
    if (run.current) {
      const result = await finishRaid(run.current, won);
      if (won) setLoot(result.won ? (result.loot ?? {}) : {});
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
      const ids = [...plan.enemies, ...(plan.boss ? [plan.boss] : [])];
      const [picture, art, started] = await Promise.all([
        loadImage(imageUrl),
        loadRaidAssets(ids, ownedGuns),
        startRaid(placeId, plan.worth, plan.total + (plan.boss ? 1 : 0), plan.lootTypes),
      ]);
      if (cancelled) return;
      if ('error' in started) {
        setMessage(started.error === 'sign_in' ? 'SIGN IN TO LOOT' : started.error === 'locked' ? 'UNLOCK THIS SNAPSHOT FIRST' : started.error === 'too_many' ? 'YOU HAVE BEEN FIGHTING A LOT. REST A WHILE' : 'THE RAID COULD NOT START. TRY AGAIN IN A MOMENT');
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
      game.current = new Game({ plan, spawns, arsenal: account.arsenal, maxHealth: maxHealth(level) });
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
      g.update(dt);
      if (g.killed > before) playSound('kill', sound);
      const hurtBefore = g.hitFlash;
      void hurtBefore;
      if (pointer.current.down) shoot();
      draw(c, g, now / 1000);
      if (now - lastHud > 100) {
        lastHud = now;
        const boss = g.enemies.find((e) => e.boss && e.state !== 'dying');
        setHud({
          health: g.health, max: g.maxHealth, ammo: g.ammo[g.selected] ?? null, selected: g.selected, remaining: g.totalEnemies - g.killed,
          banner: g.bannerT > 0 ? g.banner : '', bossHp: boss ? boss.hp / boss.maxHp : null, bossName: boss?.type.name ?? '',
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
      if (!g || !picture) return;
      const v = view.current;
      const u = (pointer.current.x - v.x) / v.w;
      const w = (pointer.current.y - v.y) / v.h;
      const weapon = g.weapon;
      if (g.fire(u, w, picture.naturalWidth / picture.naturalHeight, ratioOf)) {
        if (weapon) playSound(weapon.splash && !weapon.auto ? 'explosive' : weapon.auto && weapon.splash ? 'flame' : (g.selected as 'pistol' | 'automatic' | 'sniper'), sound);
        if (weapon?.splash && !weapon.auto) window.setTimeout(() => playSound('boom', sound), 120);
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
        const bob = e.type.flying ? Math.sin(e.phase + e.t * 4) * 0.015 * vh - 0.1 * hPx : 0;
        const x = vx + e.u * vw, y = vy + e.v * vh + bob;
        ctx.save();
        if (e.state === 'dying') ctx.globalAlpha = Math.max(0, Math.min(1, 1.2 - e.t));
        // a shadow on the ground
        ctx.fillStyle = 'rgba(0,0,0,0.28)';
        ctx.beginPath();
        ctx.ellipse(x, vy + e.v * vh, hPx * 0.22, hPx * 0.05, 0, 0, Math.PI * 2);
        ctx.fill();
        if (sprites) {
          const f0 = sprites.frames[0];
          const frameIndex = e.state === 'dying' ? 3 : e.state === 'attacking' ? (e.t < 0.28 ? 2 : 0) : Math.floor(e.t * 3.5 + e.id) % 2;
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
        if (!e.boss && e.hp < e.maxHp && e.state !== 'dying') {
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
      const gh = Math.min(cssH * 0.46, 440);
      const gw = gunArt ? gh * (gunArt.image.naturalWidth / gunArt.image.naturalHeight) : gh * 0.5;
      // anchored to the bottom right with its edges off screen (the pictures are cut off at their edges), turning a little toward where the survivor aims
      const pivotX = Math.max(gw * 0.5, cssW - gw * 0.44), pivotY = cssH + gh * 0.1;
      const aim = Math.max(-0.12, Math.min(0.12, Math.atan2(pointer.current.x - pivotX, pivotY - pointer.current.y) * 0.3));
      ctx.save();
      ctx.translate(pivotX, pivotY + g.recoil * 22);
      ctx.rotate(aim);
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
      ctx.restore();

      // blood at the edges when hurt, and when nearly dead
      const alpha = Math.max(g.hitFlash * 0.55, g.health / g.maxHealth < 0.25 ? 0.18 + 0.1 * Math.sin(time * 6) : 0);
      if (alpha > 0) {
        const grad = ctx.createRadialGradient(cssW / 2, cssH / 2, Math.min(cssW, cssH) * 0.35, cssW / 2, cssH / 2, Math.max(cssW, cssH) * 0.75);
        grad.addColorStop(0, 'rgba(160,0,0,0)');
        grad.addColorStop(1, `rgba(160,0,0,${alpha})`);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, cssW, cssH);
      }
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
      if (e.key === 'Escape') onExit();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onExit]);

  const aimAt = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    pointer.current.x = e.clientX - r.left;
    pointer.current.y = e.clientY - r.top;
  };

  const pick = (cls: WeaponClass) => {
    if (game.current?.select(cls)) setHud((h) => (h ? { ...h, selected: cls } : h));
  };

  return (
    <div className="rm-raid" role="dialog" aria-label="Looting">
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
          <button type="button" className="rm-btn" onClick={onExit}>BACK</button>
        </div>
      )}

      {phase === 'fighting' && hud && (
        <>
          <div className="rm-raid-top">
            <div className="rm-raid-health" aria-label="Health">
              <div style={{ width: `${Math.max(0, Math.round((hud.health / hud.max) * 100))}%` }} />
              <span>HP {Math.ceil(hud.health)} / {hud.max}</span>
            </div>
            <span className="rm-raid-left">{hud.remaining} LEFT</span>
            <button type="button" className="rm-btn rm-btn-ghost" onClick={onExit}>RETREAT</button>
          </div>
          {hud.bossHp !== null && (
            <div className="rm-raid-boss"><b>{hud.bossName.toUpperCase()}</b><div><div style={{ width: `${Math.round(hud.bossHp * 100)}%` }} /></div></div>
          )}
          {hud.banner && <div className="rm-raid-banner" key={hud.banner}>{hud.banner}</div>}
          {hud.ammo !== null && <div className="rm-raid-ammo">AMMO {hud.ammo}</div>}
          <div className="rm-raid-wheel" role="group" aria-label="Weapons">
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
        </>
      )}

      {(phase === 'won' || phase === 'lost') && (
        <div className="rm-raid-center rm-raid-end">
          <h2>{phase === 'won' ? 'AREA CLEARED' : 'YOU DIED'}</h2>
          {phase === 'won' ? (
            loot === null ? <p>COUNTING THE LOOT…</p> : (
              <ul className="rm-raid-loot">
                {Object.keys(loot).length === 0 && <li>Nothing was recovered.</li>}
                {(Object.entries(loot) as [LootId, number][]).map(([id, n]) => <li key={id}><b>+{n}</b> {lootName(id)}</li>)}
              </ul>
            )
          ) : <p>The {plan.boss ? enemyById(plan.boss).name.toLowerCase() : enemyById(plan.enemies[0]).plural} won this time. Go back and try again.</p>}
          <button type="button" className="rm-btn" onClick={onExit}>{phase === 'won' ? 'CONTINUE' : 'BACK'}</button>
        </div>
      )}
    </div>
  );
}

/** A gun's picture in a wheel slot (the art may not exist yet). */
function GunThumb({ src }: { src: string }) {
  const [ok, setOk] = useState(true);
  return ok ? <img src={src} alt="" onError={() => setOk(false)} draggable={false} /> : <span>◈</span>;
}
