// The pictures the shooting gallery draws: sprite sheets for each enemy (four poses: walk, walk, attack, dead) and a first-person view of each gun, all
// made by the image model in the games' style and cut out by _tools/process-raid-art.mjs. A missing one is drawn as a plain silhouette instead.

export interface EnemySprites {
  /** walk, walk, attack, dead */
  frames: HTMLImageElement[];
}
export interface GunSprite {
  image: HTMLImageElement;
  /** Where the muzzle is, as a share of the picture's width along its top edge. */
  tipX: number;
}
export interface RaidAssets {
  enemies: Record<string, EnemySprites>;
  guns: Record<string, GunSprite>;
}

interface Manifest {
  enemies: Record<string, { frames: { file: string; w: number; h: number }[] }>;
  guns: Record<string, { file: string; w: number; h: number; tipX?: number }>;
}

const base = `${import.meta.env.BASE_URL}raid/`;
let manifest: Promise<Manifest | null> | null = null;
const cache = new Map<string, Promise<HTMLImageElement | null>>();

function image(file: string): Promise<HTMLImageElement | null> {
  if (!cache.has(file)) {
    cache.set(file, new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = base + file;
    }));
  }
  return cache.get(file) as Promise<HTMLImageElement | null>;
}

/** Loads the art for these enemies and guns (whatever exists). */
export async function loadRaidAssets(enemyIds: string[], gunIds: string[]): Promise<RaidAssets> {
  manifest ??= fetch(`${base}manifest.json`).then((r) => (r.ok ? (r.json() as Promise<Manifest>) : null)).catch(() => null);
  const m = await manifest;
  const out: RaidAssets = { enemies: {}, guns: {} };
  if (!m) return out;
  await Promise.all([
    ...enemyIds.map(async (id) => {
      const entry = m.enemies[id];
      if (!entry) return;
      const frames = await Promise.all(entry.frames.map((f) => image(f.file)));
      if (frames.every(Boolean)) out.enemies[id] = { frames: frames as HTMLImageElement[] };
    }),
    ...gunIds.map(async (id) => {
      const entry = m.guns[id];
      if (!entry) return;
      const img = await image(entry.file);
      if (img) out.guns[id] = { image: img, tipX: entry.tipX ?? 0.6 };
    }),
  ]);
  return out;
}
