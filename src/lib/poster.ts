// The poster: what is printed and what is saved from the Share tab. Never the whole page: one Pip-Boy window, WASTELANDMAPS across the top, and the map (or a picture
// from the gallery) filling the screen of it, with none of the page's other panels. The map is drawn here from Google's static map in the same colours as the live one,
// with the places on it, so the saved image and the printed page are the same thing.

import { isNative, saveBlob } from './native';
import { stylesAt, type Look } from './looks';

export interface PosterPin { lat: number; lng: number; /** The icon's svg, as the map draws it. */ svg: string; /** Found: the shapes are filled in solid; otherwise only the outline. */ found: boolean }
export interface MapPosterInput { look: Look; lat: number; lng: number; zoom: number; /** The size the map is on the screen now (CSS pixels): what the poster shows is the same stretch of ground. */ width: number; height: number; title: string; pins: PosterPin[] }

const W = 1080;
const PAD = 30;
const HEAD = 124;
const LIMIT = 640; // the most the static map gives in one direction (doubled by scale=2)

const hex = (c: string): string => `0x${c.replace('#', '').toLowerCase()}`;

/** The look's map styles as the static map's style parameters. */
function styleParams(look: Look, zoom: number): string {
  const out: string[] = [];
  for (const s of stylesAt(look, zoom) as { featureType?: string; elementType?: string; stylers?: Record<string, string | number>[] }[]) {
    const parts = [`feature:${s.featureType ?? 'all'}`, `element:${s.elementType ?? 'all'}`];
    for (const st of s.stylers ?? []) for (const [k, v] of Object.entries(st)) parts.push(`${k}:${k === 'color' || k === 'hue' ? hex(String(v)) : v}`);
    out.push(`style=${encodeURIComponent(parts.join('|'))}`);
  }
  return out.join('&');
}

const worldPx = (lat: number, lng: number, zoom: number): { x: number; y: number } => {
  const world = 256 * 2 ** zoom;
  const sin = Math.sin((lat * Math.PI) / 180);
  return { x: ((lng + 180) / 360) * world, y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * world };
};

const loadImage = (src: string): Promise<HTMLImageElement> => new Promise((resolve, reject) => {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => resolve(img);
  img.onerror = () => reject(new Error('picture would not load'));
  img.src = src;
});

const roundRect = (c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
  c.beginPath();
  c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
};

/** The Pip-Boy: the dark body, WASTELANDMAPS across the top, and an empty window of this height. Returns the window's rectangle. */
async function drawBody(canvas: HTMLCanvasElement, look: Look, windowH: number): Promise<{ x: number; y: number; w: number; h: number; ctx: CanvasRenderingContext2D }> {
  const H = HEAD + windowH + PAD;
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
  ctx.fillStyle = look.id === 'pipboy' ? '#010d05' : '#c9b27a';
  ctx.fillRect(0, 0, W, H);
  // the brand, as the page's own title draws it: bold VT323, WASTELAND bright and MAPS dimmer
  try { await document.fonts.load('bold 96px VT323'); } catch { /* the fallback font will do */ }
  ctx.font = "bold 100px VT323, 'Courier New', monospace";
  ctx.textBaseline = 'alphabetic';
  const gap = 5;
  const wasteland = 'WASTELAND', maps = 'MAPS';
  const widthOf = (t: string) => [...t].reduce((n, ch) => n + ctx.measureText(ch).width + gap, 0);
  let x = (W - widthOf(wasteland) - widthOf(maps) + gap) / 2;
  const draw = (t: string, color: string) => { ctx.fillStyle = color; ctx.shadowColor = look.ink; ctx.shadowBlur = look.id === 'pipboy' ? 16 : 0; for (const ch of t) { ctx.fillText(ch, x, 92); x += ctx.measureText(ch).width + gap; } };
  draw(wasteland, look.ink); draw(maps, look.inkDim);
  ctx.shadowBlur = 0;
  const win = { x: PAD, y: HEAD, w: W - PAD * 2, h: windowH };
  ctx.fillStyle = look.background;
  roundRect(ctx, win.x, win.y, win.w, win.h, 26); ctx.fill();
  return { ...win, ctx };
}

/** The window's frame, and (for the Pip-Boy) its faint scan lines, drawn over whatever is in it. */
function drawFrame(ctx: CanvasRenderingContext2D, look: Look, win: { x: number; y: number; w: number; h: number }) {
  if (look.id === 'pipboy') {
    ctx.save();
    roundRect(ctx, win.x, win.y, win.w, win.h, 26); ctx.clip();
    ctx.fillStyle = 'rgba(0,0,0,0.13)';
    for (let y = win.y; y < win.y + win.h; y += 4) ctx.fillRect(win.x, y, win.w, 1.5);
    ctx.restore();
  }
  ctx.strokeStyle = look.ink; ctx.lineWidth = 5; ctx.shadowColor = look.ink; ctx.shadowBlur = look.id === 'pipboy' ? 14 : 0;
  roundRect(ctx, win.x, win.y, win.w, win.h, 26); ctx.stroke();
  ctx.shadowBlur = 0;
}

const canvasBlob = (canvas: HTMLCanvasElement): Promise<Blob> => new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('no image'))), 'image/png'));

/** An icon of the map as a picture (a page's styling does not reach into an image, so the strokes are set here). */
async function iconImage(pin: PosterPin, look: Look): Promise<HTMLImageElement | null> {
  const style = `<style>svg{color:${look.ink};stroke:${look.ink}} .f,.d,.s{fill:none} ${pin.found ? `.f{fill:${look.ink}} .d{stroke:${look.background};stroke-width:1.5}` : ''}</style>`;
  const svg = pin.svg.replace(/<svg\b([^>]*)>/, (_m, attrs: string) => `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" ${attrs.replace(/\s(width|height)="[^"]*"/g, '')}>${style}`);
  try { return await loadImage(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`); } catch { return null; }
}

/** The map as it is on the screen (same place, same stretch of ground, same colours), in the Pip-Boy window with the places on it. */
export async function renderMapPoster(input: MapPosterInput): Promise<Blob> {
  const { look, lat, lng, width, height } = input;
  // the static map comes in whole zoom levels and at most 640 a side: pick the level and the size that show the same ground as the screen does
  let zr = Math.floor(input.zoom);
  let sw = width * 2 ** (zr - input.zoom), sh = height * 2 ** (zr - input.zoom);
  while ((sw > LIMIT || sh > LIMIT) && zr > 1) { zr -= 1; sw = width * 2 ** (zr - input.zoom); sh = height * 2 ** (zr - input.zoom); }
  sw = Math.max(64, Math.round(sw)); sh = Math.max(64, Math.round(sh));
  const key = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;
  const url = `https://maps.googleapis.com/maps/api/staticmap?center=${lat.toFixed(6)},${lng.toFixed(6)}&zoom=${zr}&size=${sw}x${sh}&scale=2&maptype=roadmap&${styleParams(look, zr)}&key=${key ?? ''}`;
  const map = await loadImage(url);

  const mapW = W - PAD * 2;
  const mapH = Math.max(500, Math.min(1500, Math.round((mapW * height) / width)));
  const canvas = document.createElement('canvas');
  const { x, y, w, h, ctx } = await drawBody(canvas, look, mapH);
  ctx.save();
  roundRect(ctx, x, y, w, h, 26); ctx.clip();
  ctx.drawImage(map, x, y, w, h);
  // the places: each at its true spot on the picture
  const scale = w / sw;
  const centre = worldPx(lat, lng, zr);
  const half = 28;
  for (const pin of input.pins) {
    const p = worldPx(pin.lat, pin.lng, zr);
    const px = x + w / 2 + (p.x - centre.x) * scale, py = y + h / 2 + (p.y - centre.y) * scale;
    if (px < x - half || px > x + w + half || py < y - half || py > y + h + half) continue;
    const icon = await iconImage(pin, look);
    ctx.fillStyle = look.background; ctx.globalAlpha = 0.86; ctx.beginPath(); ctx.arc(px, py, half, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
    ctx.strokeStyle = look.inkDim; ctx.lineWidth = 2; ctx.stroke();
    if (icon) ctx.drawImage(icon, px - 20, py - 20, 40, 40);
  }
  // the name of the region, as it sits on the screen
  if (input.title) {
    ctx.font = "56px VT323, 'Courier New', monospace";
    const label = [...input.title.toUpperCase()].join(String.fromCharCode(8202));
    const tw = Math.min(w - 80, ctx.measureText(label).width + 56);
    ctx.fillStyle = look.background; ctx.globalAlpha = 0.82; ctx.fillRect(x + (w - tw) / 2, y + 24, tw, 70); ctx.globalAlpha = 1;
    ctx.strokeStyle = look.inkDim; ctx.lineWidth = 2; ctx.strokeRect(x + (w - tw) / 2, y + 24, tw, 70);
    ctx.fillStyle = look.ink; ctx.textAlign = 'center'; ctx.shadowColor = look.ink; ctx.shadowBlur = look.id === 'pipboy' ? 10 : 0;
    ctx.fillText(label, x + w / 2, y + 74, tw - 30); ctx.shadowBlur = 0; ctx.textAlign = 'start';
  }
  ctx.restore();
  drawFrame(ctx, look, { x, y, w, h });
  return canvasBlob(canvas);
}

/** A picture from the gallery in the Pip-Boy window, filling the screen of it. */
export async function renderPicturePoster(picture: Blob, look: Look): Promise<Blob> {
  const bitmapUrl = URL.createObjectURL(picture);
  try {
    const img = await loadImage(bitmapUrl);
    const winW = W - PAD * 2;
    const winH = Math.max(560, Math.min(1500, Math.round((winW * img.naturalHeight) / img.naturalWidth)));
    const canvas = document.createElement('canvas');
    const { x, y, w, h, ctx } = await drawBody(canvas, look, winH);
    ctx.save();
    roundRect(ctx, x, y, w, h, 26); ctx.clip();
    const k = Math.min(w / img.naturalWidth, h / img.naturalHeight);
    ctx.drawImage(img, x + (w - img.naturalWidth * k) / 2, y + (h - img.naturalHeight * k) / 2, img.naturalWidth * k, img.naturalHeight * k);
    ctx.restore();
    drawFrame(ctx, look, { x, y, w, h });
    return await canvasBlob(canvas);
  } finally { URL.revokeObjectURL(bitmapUrl); }
}

/** Prints an image on its own: nothing else of the page goes to the printer (see the print rules in index.css). */
export async function printImage(blob: Blob): Promise<void> {
  const url = URL.createObjectURL(blob);
  const sheet = document.createElement('div');
  sheet.id = 'rm-print-sheet';
  const img = document.createElement('img');
  img.alt = '';
  img.src = url;
  sheet.appendChild(img);
  document.body.appendChild(sheet);
  document.body.classList.add('rm-printing-sheet');
  try { await img.decode(); } catch { /* print what there is */ }
  const done = () => { document.body.classList.remove('rm-printing-sheet'); sheet.remove(); URL.revokeObjectURL(url); window.removeEventListener('afterprint', done); };
  window.addEventListener('afterprint', done);
  window.setTimeout(done, 120_000);
  window.print();
}

/** Sends an image to someone: the phone's share sheet (or the browser's), and where there is none it is saved instead. */
export async function shareImage(blob: Blob, filename: string, title: string): Promise<'shared' | 'saved' | 'failed'> {
  try {
    if (isNative()) { await saveBlob(blob, filename, title); return 'shared'; }
    const file = new File([blob], filename, { type: blob.type || 'image/png' });
    if (navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file], title }); return 'shared'; }
    await saveBlob(blob, filename, title);
    return 'saved';
  } catch (e) {
    return (e as Error)?.name === 'AbortError' ? 'shared' : 'failed';
  }
}

/** Saves an image to the phone or computer (in the app, through the share sheet where it can be saved to Photos or Files). */
export async function saveImage(blob: Blob, filename: string, title: string): Promise<void> {
  await saveBlob(blob, filename, title);
}

