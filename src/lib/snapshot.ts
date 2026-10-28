// "Survivor snapshots": a real photo of the place, run through the Fallout look. The photos come only from Wikimedia Commons, which hosts
// freely licensed pictures (CC BY, CC BY-SA, CC0, public domain) that may be adapted as long as the photographer is credited. Google's
// Street View and map imagery are never used here: Google's terms do not allow changing it.
//
// Only landmarks that someone has photographed and shared show up, so many places will have no snapshot and keep the drawn scene.

import { SCENE_H, SCENE_W } from './scene';
import { seeded } from './wasteland';
import type { LatLng } from './wasteland';
import type { LookId } from './looks';

export interface Snapshot {
  imageUrl: string;
  title: string;
  author: string;
  license: string;
  pageUrl: string;
  /** The photo Wikidata lists for the place (as opposed to one found nearby): the paid render can be made from it. */
  listed?: boolean;
}

const SEARCH_RADIUS_METERS = 300;
// licenses we may adapt and show commercially: no NonCommercial, no NoDerivatives
const ALLOWED = /^(CC BY(?!-NC)(?!-ND)|CC BY-SA(?!-NC)|CC0|Public domain|PD)/i;
const CACHE = 'wastelandmaps:snapshot:v2:';

const FILLER = new Set(['the', 'and', 'of', 'at', 'in', 'on', 'a', 'an', 'inc', 'llc', 'ltd', 'co', 'company', 'corp', 'file', 'jpg', 'jpeg', 'png']);

/** The words of a name that tell places apart, lowercased: "Hyatt Regency Boston" becomes hyatt, regency, boston. */
function words(text: string): string[] {
  return text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').split(/[^a-z0-9]+/).filter((w) => w.length >= 3 && !FILLER.has(w));
}

/**
 * Does this photo's title (or description) say it is of this place? A photo only counts if most of the place's name appears in it, so the
 * Commons picture of a shrub that happens to be growing near City Hall Plaza is not offered as City Hall Plaza.
 */
export function photoIsOf(placeName: string, photoText: string): boolean {
  const wanted = words(placeName);
  if (wanted.length === 0) return false;
  const have = new Set(words(photoText));
  const hits = wanted.filter((w) => have.has(w)).length;
  const hasLongHit = wanted.some((w) => w.length >= 5 && have.has(w));
  return hits / wanted.length >= 0.75 && hasLongHit;
}

interface CommonsPage {
  title?: string;
  imageinfo?: {
    thumburl?: string;
    descriptionurl?: string;
    mime?: string;
    thumbwidth?: number;
    extmetadata?: Record<string, { value?: string }>;
  }[];
}

const stripHtml = (s: string) => s.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();

/** The photo Wikidata itself lists for a place (its "image" property), if it is freely licensed. This is the picture Wikipedia uses for it. */
async function wikidataPhoto(entityId: string): Promise<Snapshot | null> {
  try {
    const claims = await (await fetch('https://www.wikidata.org/w/api.php?' + new URLSearchParams({
      action: 'wbgetclaims', entity: entityId, property: 'P18', format: 'json', origin: '*',
    }))).json() as { claims?: { P18?: { mainsnak?: { datavalue?: { value?: string } } }[] } };
    const file = claims.claims?.P18?.[0]?.mainsnak?.datavalue?.value;
    if (!file) return null;
    const data = await (await fetch('https://commons.wikimedia.org/w/api.php?' + new URLSearchParams({
      action: 'query', format: 'json', origin: '*', titles: `File:${file}`, prop: 'imageinfo',
      iiprop: 'url|extmetadata|mime|size', iiurlwidth: '1200',
    }))).json() as { query?: { pages?: Record<string, CommonsPage> } };
    const page = Object.values(data.query?.pages ?? {})[0];
    const info = page?.imageinfo?.[0];
    if (!info?.thumburl || !/^image\/(jpeg|png)$/.test(info.mime ?? '')) return null;
    const meta = info.extmetadata ?? {};
    const license = stripHtml(meta.LicenseShortName?.value ?? '');
    if (!ALLOWED.test(license)) return null;
    return {
      imageUrl: info.thumburl,
      title: stripHtml(file.replace(/\.[a-z]+$/i, '')),
      author: stripHtml(meta.Artist?.value ?? 'Unknown photographer'),
      license,
      pageUrl: info.descriptionurl ?? 'https://commons.wikimedia.org',
      listed: true,
    };
  } catch {
    return null;
  }
}

/** The best freely licensed photo of this place: the one Wikidata lists for it, else one taken close to this spot, or null. */
export async function findSnapshot(position: LatLng, placeName: string, entityId?: string): Promise<Snapshot | null> {
  const key = `${CACHE}${position.lat.toFixed(4)},${position.lng.toFixed(4)}:${placeName.toLowerCase()}`;
  try {
    const cached = sessionStorage.getItem(key);
    if (cached) return cached === 'none' ? null : (JSON.parse(cached) as Snapshot);
  } catch { /* storage unavailable */ }

  if (entityId && /^Q\d+$/.test(entityId)) {
    const listed = await wikidataPhoto(entityId);
    if (listed) {
      try { sessionStorage.setItem(key, JSON.stringify(listed)); } catch { /* full */ }
      return listed;
    }
  }

  const url = 'https://commons.wikimedia.org/w/api.php?' + new URLSearchParams({
    action: 'query', format: 'json', origin: '*', generator: 'geosearch', ggscoord: `${position.lat}|${position.lng}`,
    ggsradius: String(SEARCH_RADIUS_METERS), ggslimit: '30', ggsnamespace: '6', prop: 'imageinfo',
    iiprop: 'url|extmetadata|mime|size', iiurlwidth: '1000',
  });
  let result: Snapshot | null = null;
  try {
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json() as { query?: { pages?: Record<string, CommonsPage> } };
      for (const page of Object.values(data.query?.pages ?? {})) {
        const info = page.imageinfo?.[0];
        if (!info?.thumburl || !/^image\/(jpeg|png)$/.test(info.mime ?? '')) continue;
        if ((info.thumbwidth ?? 0) < 600) continue;
        const meta = info.extmetadata ?? {};
        const license = stripHtml(meta.LicenseShortName?.value ?? '');
        if (!ALLOWED.test(license)) continue;
        const text = `${page.title ?? ''} ${stripHtml(meta.ImageDescription?.value ?? '')} ${stripHtml(meta.ObjectName?.value ?? '')}`;
        if (!photoIsOf(placeName, text)) continue;
        result = {
          imageUrl: info.thumburl,
          title: stripHtml((page.title ?? 'Photo').replace(/^File:/, '').replace(/\.[a-z]+$/i, '')),
          author: stripHtml(meta.Artist?.value ?? 'Unknown photographer'),
          license,
          pageUrl: info.descriptionurl ?? 'https://commons.wikimedia.org',
        };
        break;
      }
    }
  } catch { /* offline or blocked: no snapshot */ }
  try { sessionStorage.setItem(key, result ? JSON.stringify(result) : 'none'); } catch { /* full */ }
  return result;
}

// Ordered dithering: a 4x4 threshold pattern that gives the pictures their old-monitor grain
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

function load(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('photo failed to load'));
    img.src = url;
  });
}

/** 'color' is the game's own look (dusty, desaturated, hazy, weathered); 'look' is the green or sepia print of the chosen Pip-Boy look. */
export type SnapshotStyle = 'color' | 'look';

/** Draws the photo onto the canvas in the chosen look: a green phosphor print, or a sepia ink sketch, with scanlines, dust and cracks. */
export async function drawSnapshot(canvas: HTMLCanvasElement, snapshot: Snapshot, look: LookId, seed: number, style: SnapshotStyle = 'color'): Promise<void> {
  const img = await load(snapshot.imageUrl);
  canvas.width = SCENE_W;
  canvas.height = SCENE_H;
  const ctx = canvas.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D;

  // crop to fill, centered
  const scale = Math.max(SCENE_W / img.width, SCENE_H / img.height);
  const w = img.width * scale;
  const h = img.height * scale;
  ctx.drawImage(img, (SCENE_W - w) / 2, (SCENE_H - h) / 2, w, h);

  if (style === 'color') {
    wastelandColor(ctx, seed);
    return;
  }

  const data = ctx.getImageData(0, 0, SCENE_W, SCENE_H);
  const px = data.data;
  for (let y = 0; y < SCENE_H; y++) {
    for (let x = 0; x < SCENE_W; x++) {
      const i = (y * SCENE_W + x) * 4;
      let lum = (0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2]) / 255;
      lum = Math.min(1, Math.max(0, (lum - 0.5) * 1.35 + 0.5)); // contrast
      const t = (BAYER[(y & 3) * 4 + (x & 3)] + 0.5) / 16;
      const level = Math.floor(Math.min(0.999, lum + (t - 0.5) * 0.28) * 5) / 4; // five dithered tones
      if (look === 'pipboy') {
        px[i] = 6 + level * 70;
        px[i + 1] = 18 + level * 237;
        px[i + 2] = 10 + level * 120;
      } else {
        px[i] = 60 + level * 175;
        px[i + 1] = 42 + level * 168;
        px[i + 2] = 20 + level * 125;
      }
    }
  }
  ctx.putImageData(data, 0, 0);

  // cracks across the print, the same every time for the same place
  const rand = seeded(seed);
  ctx.strokeStyle = look === 'pipboy' ? 'rgba(0,0,0,0.55)' : 'rgba(40,25,10,0.5)';
  for (let c = 0; c < 6; c++) {
    let x = rand() * SCENE_W;
    let y = rand() * SCENE_H * 0.4;
    ctx.lineWidth = 1 + rand() * 1.4;
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let k = 0; k < 9; k++) { x += (rand() - 0.5) * 60; y += 20 + rand() * 40; ctx.lineTo(x, y); }
    ctx.stroke();
  }
  // vignette
  const v = ctx.createRadialGradient(SCENE_W / 2, SCENE_H / 2, SCENE_H * 0.3, SCENE_W / 2, SCENE_H / 2, SCENE_W * 0.65);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, look === 'pipboy' ? 'rgba(0,12,4,0.7)' : 'rgba(60,35,10,0.55)');
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, SCENE_W, SCENE_H);
}

// ---------------------------------------------------------------------------------------------------------------------------------
// The wasteland in color: what the games look like. Washed-out, dusty, a green-teal (or amber, or orange) cast in the shadows, a hazy sky,
// grime and burn damage growing over the photo, soot at the bottom, film grain, cracks. Different places get a different cast, but the
// same place always gets the same one.
// ---------------------------------------------------------------------------------------------------------------------------------

/** Smooth random texture: three layers of value noise, u and v from 0 to 1, result roughly 0..1. */
function makeNoise(seed: number): (u: number, v: number) => number {
  const rand = seeded(seed);
  const layers = [5, 13, 31].map((n) => ({ n, grid: Float32Array.from({ length: (n + 1) * (n + 1) }, () => rand()) }));
  return (u, v) => {
    let sum = 0;
    let total = 0;
    let amp = 0.55;
    for (const { n, grid } of layers) {
      const x = Math.min(u, 0.9999) * n;
      const y = Math.min(v, 0.9999) * n;
      const x0 = Math.floor(x);
      const y0 = Math.floor(y);
      const fx = x - x0;
      const fy = y - y0;
      const sx = fx * fx * (3 - 2 * fx);
      const sy = fy * fy * (3 - 2 * fy);
      const at = (i: number, j: number) => grid[j * (n + 1) + i];
      const top = at(x0, y0) + (at(x0 + 1, y0) - at(x0, y0)) * sx;
      const bottom = at(x0, y0 + 1) + (at(x0 + 1, y0 + 1) - at(x0, y0 + 1)) * sx;
      sum += amp * (top + (bottom - top) * sy);
      total += amp;
      amp *= 0.5;
    }
    return sum / total;
  };
}

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// the casts: shadow tint, highlight tint, haze color. Fallout 3's green-grey, New Vegas's amber, Fallout 4's warm orange.
const CASTS = [
  { shadow: [0.04, 0.12, 0.1], high: [1.04, 1.06, 0.86], haze: [0.62, 0.7, 0.5], name: 'green' },
  { shadow: [0.1, 0.07, 0.03], high: [1.14, 1.0, 0.72], haze: [0.86, 0.68, 0.38], name: 'amber' },
  { shadow: [0.05, 0.09, 0.12], high: [1.12, 0.98, 0.78], haze: [0.9, 0.62, 0.36], name: 'orange' },
];

function wastelandColor(ctx: CanvasRenderingContext2D, seed: number): void {
  const cast = CASTS[seed % CASTS.length];
  const noise = makeNoise(seed ^ 0x9e3779b9);
  const rand = seeded(seed ^ 0x51ed270b);
  const image = ctx.getImageData(0, 0, SCENE_W, SCENE_H);
  const px = image.data;

  for (let y = 0; y < SCENE_H; y++) {
    const v = y / SCENE_H;
    for (let x = 0; x < SCENE_W; x++) {
      const u = x / SCENE_W;
      const i = (y * SCENE_W + x) * 4;
      let r = px[i] / 255;
      let g = px[i + 1] / 255;
      let b = px[i + 2] / 255;
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;

      // wash the color out, flatten it, crush the blacks a little
      const keep = 0.42;
      r = lum + (r - lum) * keep;
      g = lum + (g - lum) * keep;
      b = lum + (b - lum) * keep;
      const contrast = (c: number) => Math.min(1, Math.max(0, (c - 0.5) * 1.12 + 0.5 - 0.04));
      r = contrast(r); g = contrast(g); b = contrast(b);

      // the cast: shadows lean one way, highlights another
      const dark = (1 - lum) * (1 - lum);
      r = r * (1 + (cast.high[0] - 1) * lum) + cast.shadow[0] * dark;
      g = g * (1 + (cast.high[1] - 1) * lum) + cast.shadow[1] * dark;
      b = b * (1 + (cast.high[2] - 1) * lum) + cast.shadow[2] * dark;

      // dusty haze: heavy up where the sky is, light everywhere
      const haze = 0.16 + 0.5 * (1 - smooth(0, 0.55, v));
      r += (cast.haze[0] - r) * haze;
      g += (cast.haze[1] - g) * haze;
      b += (cast.haze[2] - b) * haze;

      // grime and rust spreading over everything, and burn damage in ragged patches
      const n = noise(u, v);
      const grime = smooth(0.5, 0.78, n);
      r *= 1 - 0.4 * grime;
      g *= 1 - 0.46 * grime;
      b *= 1 - 0.55 * grime;
      r += 0.1 * grime * (1 - v);
      const burn = smooth(0.7, 0.76, noise(u * 1.2 + 0.31, v * 1.2 + 0.17));
      const edge = Math.max(Math.abs(u - 0.5), Math.abs(v - 0.5)) * 2; // burns eat in from the edges
      const eaten = burn * smooth(0.35, 0.9, edge);
      r *= 1 - 0.85 * eaten;
      g *= 1 - 0.85 * eaten;
      b *= 1 - 0.85 * eaten;

      // soot rising from the ground
      const soot = smooth(0.78, 1, v) * 0.5;
      r *= 1 - soot;
      g *= 1 - soot;
      b *= 1 - soot;

      // film grain
      const grain = (rand() - 0.5) * 0.09;
      px[i] = Math.min(255, Math.max(0, (r + grain) * 255));
      px[i + 1] = Math.min(255, Math.max(0, (g + grain) * 255));
      px[i + 2] = Math.min(255, Math.max(0, (b + grain) * 255));
    }
  }
  ctx.putImageData(image, 0, 0);

  // drifting ash and dust
  for (let k = 0; k < 140; k++) {
    ctx.fillStyle = `rgba(235,225,200,${0.12 + rand() * 0.22})`;
    const size = 0.8 + rand() * 2.2;
    ctx.fillRect(rand() * SCENE_W, rand() * SCENE_H, size, size);
  }
  // cracks across the print
  ctx.strokeStyle = 'rgba(15,10,5,0.5)';
  for (let c = 0; c < 5; c++) {
    let x = rand() * SCENE_W;
    let y = rand() * SCENE_H * 0.4;
    ctx.lineWidth = 0.8 + rand() * 1.2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let k = 0; k < 9; k++) { x += (rand() - 0.5) * 60; y += 20 + rand() * 40; ctx.lineTo(x, y); }
    ctx.stroke();
  }
  // vignette
  const vignette = ctx.createRadialGradient(SCENE_W / 2, SCENE_H / 2, SCENE_H * 0.32, SCENE_W / 2, SCENE_H / 2, SCENE_W * 0.66);
  vignette.addColorStop(0, 'rgba(0,0,0,0)');
  vignette.addColorStop(1, 'rgba(20,12,4,0.6)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, SCENE_W, SCENE_H);
}
