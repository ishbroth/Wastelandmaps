// Puts the WASTELANDMAPS wordmark along the bottom of a square picture, rendered exactly as the site's header renders it (the h1 of the page: bold VT323, WASTELAND bright,
// MAPS dimmer, letter-spacing and glow in the header's proportions), scaled so the letters themselves run from the very left edge to the very right edge, just above the bottom.
//   node _tools/wordmark.mjs <in.png> <out.png> [gap from the bottom in px, default 8]
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const [,, inFile, outFile, gapArg = '8'] = process.argv;
const GAP = Number(gapArg);
const MARGIN = Number(process.env.WM_MARGIN ?? 0); // space left clear at each side, so the first and last letters are not at the very edge
const SIZE = 1024;
const CH = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const img = fs.readFileSync(inFile).toString('base64');
const css = await (await fetch('https://fonts.googleapis.com/css2?family=VT323', { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36' } })).text();
const latin = css.split('/* ').find((part) => part.startsWith('latin */')) ?? css;
const fontUrl = /https:[^) ]+woff2/.exec(latin)?.[0];
if (!fontUrl) throw new Error('no font url');
const font = Buffer.from(await (await fetch(fontUrl)).arrayBuffer()).toString('base64');

// the header's own CSS (index.css .rm-title h1): VT323, 52px, letter-spacing 3px, color var(--ink), text-shadow 0 0 12px var(--glow); the h1 is bold by default; its span is --ink-dim
const page = (px, left, bottom, withImage) => `<!doctype html><meta charset="utf-8"><style>
@font-face{font-family:'VT323';src:url(data:font/woff2;base64,${font}) format('woff2');font-display:block}
html,body{margin:0;background:#000}
.f{position:relative;width:${SIZE}px;height:${SIZE}px;overflow:hidden;${withImage ? `background:url(data:image/png;base64,${img}) 0 0/${SIZE}px ${SIZE}px` : 'background:#000'}}
h1{position:absolute;left:${left}px;bottom:${bottom}px;margin:0;white-space:nowrap;font-family:'VT323','Courier New',monospace;font-size:${px}px;font-weight:${process.env.WEIGHT || 'bold'};line-height:1;letter-spacing:${(px * 3 / 52).toFixed(3)}px;color:#3dff8a;text-shadow:0 0 ${(px * 12 / 52).toFixed(2)}px rgba(61,255,138,0.5)}
h1 span{color:#13a550}
</style><div class="f"><h1>WASTELAND<span>MAPS</span></h1></div>`;

const port = 9560 + Math.floor(Math.random() * 30);
const chrome = spawn(CH, ['--headless=new', '--disable-gpu', `--remote-debugging-port=${port}`, '--user-data-dir=' + process.env.TEMP + '/rm-wm-' + port, 'about:blank'], { stdio: 'ignore' });
let tabs;
for (let i = 0; i < 40; i++) { await new Promise((r) => setTimeout(r, 400)); try { tabs = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); if (tabs.some((t) => t.type === 'page')) break; } catch { /* */ } }
const ws = new WebSocket(tabs.find((t) => t.type === 'page').webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0; const pending = new Map();
ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pending.has(d.id)) { pending.get(d.id)(d.result); pending.delete(d.id); } };
const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
await send('Page.enable'); await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: SIZE, height: SIZE, deviceScaleFactor: 1, mobile: false });
const tmp = path.join(process.env.TEMP, 'wordmark.html');
const shoot = async (px, left, bottom, withImage) => {
  fs.writeFileSync(tmp, page(px, left, bottom, withImage));
  await send('Page.navigate', { url: 'file:///' + tmp.split(String.fromCharCode(92)).join('/') });
  await new Promise((r) => setTimeout(r, 1500));
  await send('Runtime.evaluate', { expression: "document.fonts.load('bold 100px VT323').then(() => document.fonts.ready)", awaitPromise: true });
  await new Promise((r) => setTimeout(r, 400));
  if (process.env.DEBUG) console.log(JSON.stringify((await send('Runtime.evaluate', { expression: "[...document.fonts].map(f => f.family + ' ' + f.weight + ' ' + f.status).join(' | ')", returnByValue: true })).result?.value));
  return Buffer.from((await send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: SIZE, height: SIZE, scale: 1 } })).data, 'base64');
};
/** Where the letters themselves are (the glow does not count): the brightest pixels. */
const inkOf = async (buf) => {
  const { data, info } = await sharp(buf).raw().toBuffer({ resolveWithObject: true });
  let x0 = info.width, x1 = -1, y0 = info.height, y1 = -1;
  for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) { const g = data[(y * info.width + x) * info.channels + 1]; if (g > 120) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } }
  return { x0, x1, y0, y1 };
};

// 1. measure the letters at a trial size, 2. scale so they are exactly the width of the picture (twice over, to settle), 3. put them just above the bottom, 4. the same on the picture
let px = 100, left = 200, bottom = 300;
let ink = await inkOf(await shoot(px, left, bottom, false));
for (let i = 0; i < 3; i++) {
  const scale = (SIZE - 2 * MARGIN) / (ink.x1 - ink.x0 + 1);
  const bearing = ink.x0 - left; // the space before the first letter, at the size just measured
  px *= scale;
  left = MARGIN - bearing * scale; // so the first letter starts at the left margin
  ink = await inkOf(await shoot(px, left, bottom, false));
}
left -= ink.x0 - MARGIN; // any last pixel
ink = await inkOf(await shoot(px, left, bottom, false));
bottom -= (SIZE - GAP - 1) - ink.y1; // the letters' bottom edge just above the bottom of the picture
ink = await inkOf(await shoot(px, left, bottom, false));
console.log('letters run from', ink.x0, 'to', ink.x1, 'of', SIZE, '; bottom edge at', ink.y1, '; font size', px.toFixed(1));
fs.writeFileSync(outFile, await shoot(px, left, bottom, true));
console.log('saved', outFile);
chrome.kill(); process.exit(0);
