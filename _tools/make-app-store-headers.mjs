// The App Store header images (wide banners): a strip of the game's own rendered ruins under a dark green gradient, the cog, the WASTELANDMAPS wordmark (set exactly as the site's header sets it)
// and the tagline. Made at the two sizes the store asks for (5244 x 2950 and 3840 x 1646) by drawing a web page in headless Chrome.
//   node _tools/make-app-store-headers.mjs <output folder>
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const OUT = process.argv[2];
if (!OUT) { console.log('usage: node _tools/make-app-store-headers.mjs <output folder>'); process.exit(1); }
fs.mkdirSync(OUT, { recursive: true });
const ROOT = path.resolve(import.meta.dirname, '..');
const CH = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const b64 = (file) => fs.readFileSync(file).toString('base64');
const TILES = ['Q133274', 'Q12506', 'Q180376', 'Q243', 'Q41225'].map((q) => `data:image/png;base64,${b64(path.join(ROOT, 'public', 'renders', `${q}.png`))}`);
const COG = `data:image/png;base64,${b64(path.join(ROOT, 'resources', 'icon-badge-nowords.png'))}`; // the icon picture without its lettering (the wordmark is set beside it)

const css = await (await fetch('https://fonts.googleapis.com/css2?family=VT323', { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36' } })).text();
const latin = css.split('/* ').find((part) => part.startsWith('latin */')) ?? css;
const fontUrl = /https:[^) ]+woff2/.exec(latin)?.[0];
if (!fontUrl) throw new Error('no font url');
const font = Buffer.from(await (await fetch(fontUrl)).arrayBuffer()).toString('base64');

/** One header: everything is sized from the height (u = 1% of the height), and the writing stays inside the middle of the picture where the store does not crop it. */
const page = (W, H) => `<!doctype html><meta charset="utf-8"><style>
@font-face{font-family:'VT323';src:url(data:font/woff2;base64,${font}) format('woff2');font-display:block}
:root{--u:${H / 100}px;--ink:#3dff8a;--dim:#13a550}
html,body{margin:0;background:#000}
.f{position:relative;width:${W}px;height:${H}px;overflow:hidden;background:#000a04;font-family:'VT323','Courier New',monospace}
.tiles{position:absolute;inset:0}
.tiles div{position:absolute;top:0;bottom:0;width:38%;background-size:cover;background-position:center;filter:saturate(1.05) contrast(1.05);-webkit-mask-image:linear-gradient(90deg,transparent,#000 24%,#000 76%,transparent);mask-image:linear-gradient(90deg,transparent,#000 24%,#000 76%,transparent)}
.shade{position:absolute;inset:0;background:linear-gradient(90deg,rgba(0,10,4,0.97) 0%,rgba(0,10,4,0.88) 26%,rgba(0,10,4,0.45) 44%,rgba(0,10,4,0.04) 62%,rgba(0,10,4,0.2) 100%)}
.tint{position:absolute;inset:0;background:radial-gradient(ellipse at 28% 50%,rgba(61,255,138,0.16),rgba(0,0,0,0) 60%);mix-blend-mode:screen}
.scan{position:absolute;inset:0;background:repeating-linear-gradient(0deg,rgba(0,0,0,0.22) 0,rgba(0,0,0,0.22) calc(var(--u)*0.12),rgba(0,0,0,0) calc(var(--u)*0.12),rgba(0,0,0,0) calc(var(--u)*0.34));pointer-events:none}
.vig{position:absolute;inset:0;background:radial-gradient(ellipse at 50% 50%,rgba(0,0,0,0) 55%,rgba(0,0,0,0.55) 100%)}
.frame{position:absolute;inset:calc(var(--u)*3.2);border:calc(var(--u)*0.45) solid rgba(61,255,138,0.75);border-radius:calc(var(--u)*3);box-shadow:0 0 calc(var(--u)*3) rgba(61,255,138,0.45),inset 0 0 calc(var(--u)*3) rgba(61,255,138,0.25)}
.text{position:absolute;left:calc(var(--u)*11);top:50%;transform:translateY(-52%)}
.cog{width:calc(var(--u)*19);height:calc(var(--u)*19);border-radius:calc(var(--u)*4.2);box-shadow:0 0 calc(var(--u)*3.5) rgba(61,255,138,0.65);display:block;margin-bottom:calc(var(--u)*3.2)}
h1{margin:0;font-size:calc(var(--u)*18);line-height:0.9;letter-spacing:calc(var(--u)*1.2);font-weight:bold;color:var(--ink);text-shadow:0 0 calc(var(--u)*3.2) rgba(61,255,138,0.75);white-space:nowrap}
h1 span{color:var(--dim)}
p{margin:calc(var(--u)*2.6) 0 0;font-size:calc(var(--u)*5.4);letter-spacing:calc(var(--u)*0.9);color:#9dffc4;text-shadow:0 0 calc(var(--u)*2) rgba(61,255,138,0.6);white-space:nowrap}
.tags{margin-top:calc(var(--u)*3.8);display:flex;gap:calc(var(--u)*2.2)}
.tags b{font-weight:normal;font-size:calc(var(--u)*4);letter-spacing:calc(var(--u)*0.7);color:var(--ink);border:calc(var(--u)*0.3) solid rgba(61,255,138,0.75);padding:calc(var(--u)*0.6) calc(var(--u)*2.2);border-radius:calc(var(--u)*1);background:rgba(0,10,4,0.55)}
</style><div class="f">
<div class="tiles">${TILES.map((t, i) => `<div style="left:${i * 15.5}%;background-image:url(${t})"></div>`).join('')}</div>
<div class="shade"></div><div class="tint"></div><div class="scan"></div><div class="vig"></div><div class="frame"></div>
<div class="text"><img class="cog" src="${COG}"><h1>WASTELAND<span>MAPS</span></h1><p>SEE WHERE YOU LIVE AFTER THE BOMBS FELL</p><div class="tags"><b>DISCOVER</b><b>UNLOCK</b><b>CLEAR</b><b>SURVIVE</b></div></div>
</div>`;

const port = 9600 + Math.floor(Math.random() * 30);
const chrome = spawn(CH, ['--headless=new', '--disable-gpu', '--hide-scrollbars', `--remote-debugging-port=${port}`, '--user-data-dir=' + process.env.TEMP + '/rm-hdr-' + port, 'about:blank'], { stdio: 'ignore' });
let tabs;
for (let i = 0; i < 40; i++) { await new Promise((r) => setTimeout(r, 400)); try { tabs = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); if (tabs.some((t) => t.type === 'page')) break; } catch { /* */ } }
const ws = new WebSocket(tabs.find((t) => t.type === 'page').webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0; const pending = new Map();
ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pending.has(d.id)) { pending.get(d.id)(d.result); pending.delete(d.id); } };
const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
await send('Page.enable'); await send('Runtime.enable');
for (const [W, H] of [[5244, 2950], [3840, 1646]]) {
  await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false });
  const tmp = path.join(process.env.TEMP, 'wm-header.html');
  fs.writeFileSync(tmp, page(W, H));
  await send('Page.navigate', { url: 'file:///' + tmp.split(String.fromCharCode(92)).join('/') });
  await new Promise((r) => setTimeout(r, 2500));
  await send('Runtime.evaluate', { expression: "document.fonts.load('bold 100px VT323').then(() => document.fonts.ready)", awaitPromise: true });
  await new Promise((r) => setTimeout(r, 500));
  const shot = await send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: W, height: H, scale: 1 } });
  const file = path.join(OUT, `WastelandMaps-header-${W}x${H}.png`);
  fs.writeFileSync(file, Buffer.from(shot.data, 'base64'));
  console.log('saved', file);
}
chrome.kill(); process.exit(0);
