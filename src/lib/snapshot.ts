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
}

const SEARCH_RADIUS_METERS = 300;
// licenses we may adapt and show commercially: no NonCommercial, no NoDerivatives
const ALLOWED = /^(CC BY(?!-NC)(?!-ND)|CC BY-SA(?!-NC)|CC0|Public domain|PD)/i;
const CACHE = 'radmaps:snapshot:v2:';

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

/** The best freely licensed photo taken close to this spot, or null. */
export async function findSnapshot(position: LatLng, placeName: string): Promise<Snapshot | null> {
  const key = `${CACHE}${position.lat.toFixed(4)},${position.lng.toFixed(4)}:${placeName.toLowerCase()}`;
  try {
    const cached = sessionStorage.getItem(key);
    if (cached) return cached === 'none' ? null : (JSON.parse(cached) as Snapshot);
  } catch { /* storage unavailable */ }

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

/** Draws the photo onto the canvas in the chosen look: a green phosphor print, or a sepia ink sketch, with scanlines, dust and cracks. */
export async function drawSnapshot(canvas: HTMLCanvasElement, snapshot: Snapshot, look: LookId, seed: number): Promise<void> {
  const img = await load(snapshot.imageUrl);
  canvas.width = SCENE_W;
  canvas.height = SCENE_H;
  const ctx = canvas.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D;

  // crop to fill, centered
  const scale = Math.max(SCENE_W / img.width, SCENE_H / img.height);
  const w = img.width * scale;
  const h = img.height * scale;
  ctx.drawImage(img, (SCENE_W - w) / 2, (SCENE_H - h) / 2, w, h);

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
