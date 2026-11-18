// Changing the number on a vault door in a finished picture, shared by the functions that need it (swap-vault-number: someone changes their own number; unlock-streetview: a second
// resident of a building gets the same picture with their own number). The digits are found, measured and replaced on the pixels (see doorNumber.ts): no image model draws anything.

import { decode, encode } from 'npm:fast-png@6.2.0';
import opentype from 'npm:opentype.js@1.3.4';
import { swapDigits, type Box } from './doorNumber.ts';
import { digitMaker } from './doorFont.ts';

export const toBase64 = (bytes: Uint8Array): string => { let t = ''; for (let i = 0; i < bytes.length; i += 0x8000) t += String.fromCharCode(...bytes.subarray(i, i + 0x8000)); return btoa(t); };

/** Does the vault door in the picture read exactly these four digits? (A failed check counts as no: the number must be right.) */
export async function doorReads(png: Uint8Array, number: string): Promise<boolean> {
  const key = Deno.env.get('GEMINI_API_KEY');
  if (!key) return false;
  const model = Deno.env.get('GEMINI_TEXT_MODEL') ?? 'gemini-flash-latest';
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST', headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [
          { text: 'Read the four-digit number painted on the round vault door in this picture. Reply in exactly this form and nothing else: NUMBER: dddd (the four digits, or NONE if you cannot read four digits on a door).' },
          { inline_data: { mime_type: 'image/png', data: toBase64(png) } },
        ] }],
        generationConfig: { temperature: 0, maxOutputTokens: 100, thinkingConfig: { thinkingBudget: 0 } },
      }),
    });
    if (!res.ok) return false;
    const body = await res.json();
    const text = String(body.candidates?.[0]?.content?.parts?.[0]?.text ?? '');
    return new RegExp(`NUMBER:\\s*${number}\\b`, 'i').test(text);
  } catch { return false; }
}

const SITE = Deno.env.get('SITE_URL') ?? 'https://wastelandmaps.com';
// deno-lint-ignore no-explicit-any
let fontPromise: Promise<any> | null = null;
/** The font the new digits are drawn in (kept on the site; fetched once per warm server). */
// deno-lint-ignore no-explicit-any
const loadFont = (): Promise<any> => (fontPromise ??= fetch(`${SITE}/fonts/vault-digits.ttf`).then(async (r) => { if (!r.ok) throw new Error('font'); return opentype.parse(await r.arrayBuffer()); }).catch((e) => { fontPromise = null; throw e; }));

/** Roughly where the four digits are on the door, in pixels (the vision model only points; the exact measuring is done on the pixels). Null if it cannot say. */
async function locateDigits(png: Uint8Array, width: number, height: number): Promise<Box | null> {
  const key = Deno.env.get('GEMINI_API_KEY');
  if (!key) return null;
  try {
    const model = Deno.env.get('GEMINI_TEXT_MODEL') ?? 'gemini-flash-latest';
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST', headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [
          { text: 'This picture has a round vault door with a four-digit number painted on it. Find that number. Reply with JSON only: {"box_2d":[ymin,xmin,ymax,xmax]}, coordinates normalized to 0-1000, as tight as you can around the four digits (not the whole door).' },
          { inline_data: { mime_type: 'image/png', data: toBase64(png) } },
        ] }],
        generationConfig: { temperature: 0, responseMimeType: 'application/json', thinkingConfig: { thinkingBudget: 0 } },
      }),
    });
    if (!res.ok) return null;
    const body = await res.json();
    const box = JSON.parse(String(body.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}')).box_2d as number[] | undefined;
    if (!Array.isArray(box) || box.length !== 4 || box.some((v) => typeof v !== 'number')) return null;
    const [y0, x0, y1, x1] = box;
    if (y1 <= y0 || x1 <= x0) return null;
    return { x: (x0 / 1000) * width, y: (y0 / 1000) * height, w: ((x1 - x0) / 1000) * width, h: ((y1 - y0) / 1000) * height };
  } catch { return null; }
}

/** The picture with only the number on the door changed, done on the pixels themselves (no image model draws anything): the old digits are measured and painted out and the new ones
 *  drawn in the same place, size, tilt and colour. Null when the digits cannot be found cleanly; the caller then falls back to asking the image model. */
export async function swapOnPixels(png: Uint8Array, to: string): Promise<Uint8Array | null> {
  try {
    const img = decode(png);
    if (img.depth !== 8 || (img.channels !== 3 && img.channels !== 4)) return null;
    let data: Uint8Array;
    if (img.channels === 4) data = img.data as Uint8Array;
    else {
      data = new Uint8Array(img.width * img.height * 4);
      const src = img.data as Uint8Array;
      for (let i = 0, j = 0; i < src.length; i += 3, j += 4) { data[j] = src[i]; data[j + 1] = src[i + 1]; data[j + 2] = src[i + 2]; data[j + 3] = 255; }
    }
    const rough = await locateDigits(png, img.width, img.height);
    if (!rough) return null;
    const done = swapDigits({ width: img.width, height: img.height, data }, rough, to, digitMaker(await loadFont()));
    if (!done) return null;
    return encode({ width: img.width, height: img.height, data: done.out.data as Uint8Array, channels: 4, depth: 8 });
  } catch (e) { console.error('pixel swap failed', e instanceof Error ? e.message : e); return null; }
}
