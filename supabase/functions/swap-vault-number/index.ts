// Changes a survivor's vault number (their sign-in passcode) and, when their home picture already has the vault door in it, swaps the number painted on that door by editing the
// finished picture (nothing else in it is redrawn), then reads the door back with a small vision model to make sure the new digits are the ones on it. If the edit does not come
// out right twice, the number is still changed but the old picture is left aside: unlocking the photo of the house again (400 caps) makes a new one. The vault's layout and its
// entrance are kept in every case.
//
// POST { number: 1234 }  ->  { ok: true, swapped: boolean, hadPicture: boolean } | { error }
// Deploy: supabase functions deploy swap-vault-number

import { callerId, corsHeaders, reply, serviceClient } from '../_shared/common.ts';
import { vaultPassword } from '../_shared/vaultPassword.ts';
import { decode, encode } from 'npm:fast-png@6.2.0';
import opentype from 'npm:opentype.js@1.3.4';
import { swapDigits, type Box } from '../_shared/doorNumber.ts';
import { digitMaker } from '../_shared/doorFont.ts';

const toBase64 = (bytes: Uint8Array): string => { let t = ''; for (let i = 0; i < bytes.length; i += 0x8000) t += String.fromCharCode(...bytes.subarray(i, i + 0x8000)); return btoa(t); };

/** The picture with only the number on the vault door changed. */
async function editNumber(png: Uint8Array, from: string, to: string): Promise<Uint8Array> {
  const key = Deno.env.get('GEMINI_API_KEY');
  if (!key) throw new Error('image generation is not set up');
  const model = Deno.env.get('GEMINI_MODEL') ?? 'gemini-3-pro-image';
  const prompt = `This picture has a massive round steel vault door with the number ${from} painted on it. Edit the picture so that the number on the vault door reads ${to} instead: the four digits ${to[0]} ${to[1]} ${to[2]} ${to[3]} in the same stencil style, size, color, position, perspective, weathering and wear as the old number. Change NOTHING else: every building, rock, rubble, car, plant, shadow, color and the sky stay pixel-for-pixel as they are, and no other text is added.`;
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST', headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: 'image/png', data: toBase64(png) } }] }], generationConfig: { responseModalities: ['TEXT', 'IMAGE'] } }),
  });
  if (!res.ok) throw new Error(`image model said ${res.status}`);
  const body = await res.json();
  // deno-lint-ignore no-explicit-any
  const part = (body.candidates?.[0]?.content?.parts ?? []).find((p: any) => p.inlineData?.data || p.inline_data?.data);
  const b64: string | undefined = part?.inlineData?.data ?? part?.inline_data?.data;
  if (!b64) throw new Error('the image model returned no image');
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

/** Does the vault door in the picture read exactly these four digits? (A failed check counts as no: the number must be right.) */
async function doorReads(png: Uint8Array, number: string): Promise<boolean> {
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
async function swapOnPixels(png: Uint8Array, to: string): Promise<Uint8Array | null> {
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) });
  if (req.method !== 'POST') return reply(req, { error: 'POST only' }, 405);
  const user = await callerId(req);
  if (!user) return reply(req, { error: 'sign_in' }, 401);
  const { number } = (await req.json().catch(() => ({}))) as { number?: unknown };
  const next = typeof number === 'number' ? number : Number(number);
  if (!Number.isInteger(next) || next < 0 || next > 9999) return reply(req, { error: 'bad_number' }, 400);
  const to = String(next).padStart(4, '0');

  const db = serviceClient();
  const { data: home } = await db.from('user_home').select('place_id,vault_number').eq('user_id', user).maybeSingle();
  if (!home || home.vault_number === null || home.vault_number === undefined) return reply(req, { error: 'no_number' }, 400);
  const old = home.vault_number as number;
  if (old === next) return reply(req, { ok: true, swapped: false, hadPicture: false });
  const from = String(old).padStart(4, '0');

  // their picture of the house with the door in it, if they have unlocked it
  const { data: pic } = await db.from('home_renders').select('*').eq('user_id', user).eq('google_id', home.place_id).maybeSingle();
  const hadPicture = !!pic && pic.status === 'ready' && !!pic.storage_path && pic.vault_number === old;
  let swapped = false;
  if (hadPicture) {
    const path = `home/${user}/${home.place_id}.png`;
    const keep = async (edited: Uint8Array) => {
      const up = await db.storage.from('renders').upload(path, edited, { contentType: 'image/png', upsert: true });
      if (up.error) throw new Error('could not store the image');
      await db.from('home_renders').update({ vault_number: next, storage_path: path, created_at: new Date().toISOString() }).eq('user_id', user).eq('google_id', home.place_id);
      // the unlock is on record under the new number too, so the picture opens without paying again
      await db.from('unlocks').upsert({ user_id: user, place_id: `vault:${home.place_id}:${next}` }, { onConflict: 'user_id,place_id', ignoreDuplicates: true });
      swapped = true;
    };
    try {
      const dl = await db.storage.from('renders').download(pic.storage_path as string);
      if (dl.error || !dl.data) throw new Error('no picture');
      const original = new Uint8Array(await dl.data.arrayBuffer());
      // 1. the cheap way: the digits are found on the pixels and replaced there (no image model draws anything); then a small vision model reads the door back to check
      const quick = await swapOnPixels(original, to);
      if (quick && (await doorReads(quick, to))) await keep(quick);
      // 2. otherwise the image model redraws the number. That costs the server two model calls and nothing is charged for it, so at most 3 redraws a day per person (past that the number
      // still changes, the old picture is left aside and unlocking the photo again makes a new one, as when a redraw does not come out right)
      if (!swapped) {
        const { data: slot } = await db.rpc('vault_swap_slot', { p_user: user, p_max: 3 });
        if (slot === true) {
          for (let attempt = 0; attempt < 2 && !swapped; attempt++) {
            const edited = await editNumber(original, from, to);
            if (!(await doorReads(edited, to))) continue;
            await keep(edited);
          }
        }
      }
    } catch (e) { console.error('door swap failed', e instanceof Error ? e.message : e); }
  }
  const { error } = await db.from('user_home').update({ vault_number: next }).eq('user_id', user);
  if (error) return reply(req, { error: 'server' }, 500);
  const { data: who } = await db.auth.admin.getUserById(user);
  const email = who?.user?.email ?? null;
  let password: string;
  try { password = await vaultPassword(user, email, to); } catch { return reply(req, { error: 'server' }, 500); }
  const pw = await db.auth.admin.updateUserById(user, { password });
  if (pw.error) return reply(req, { error: 'server' }, 500);
  if (email) await db.rpc('vault_login_reset', { p_email: email });
  return reply(req, { ok: true, swapped, hadPicture });
});
