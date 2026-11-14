// The App Store header images (wide banners): a strip of the game's own rendered ruins under a dark green gradient, the cog, the WASTELANDMAPS wordmark (set exactly as the site's header sets it)
// and the tagline. Made at the two sizes the store asks for (5244 x 2950 and 3840 x 1646) by drawing a web page in headless Chrome.
//   node _tools/make-app-store-headers.mjs <output folder>
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const OUT = process.argv[2];
if (!OUT) { console.log('usage: node _tools/make-app-store-headers.mjs <output folder>'); process.exit(1); }
fs.mkdirSync(OUT, { recursive: true });
const ROOT = path.resolve(import.meta.dirname, '..');
const CH = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const b64 = (file) => fs.readFileSync(file).toString('base64');
const TILES = ['Q133274', 'Q12506', 'Q180376', 'Q243', 'Q41225'].map((q) => `data:image/png;base64,${b64(path.join(ROOT, 'public', 'renders', `${q}.png`))}`);
const COG = `data:image/png;base64,${b64(path.join(ROOT, 'resources', 'icon-badge-nowords.png'))}`; // the icon picture without its lettering (the wordmark is set beside it)

/** The vault door with the question mark, its magenta cut out (and the margin trimmed), as a picture to place in the rubble. */
const doorKeyed = await (async () => {
  const { data, info } = await sharp(path.join(ROOT, 'resources', 'question-door.png')).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let x0 = info.width, y0 = info.height, x1 = 0, y1 = 0;
  for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
    const i = (y * info.width + x) * 4, r = data[i], g = data[i + 1], b = data[i + 2], m = Math.min(r, b) - g;
    if (m > 6 && m <= 70) { const sub = m * 0.85; data[i] = Math.max(0, r - sub); data[i + 2] = Math.max(0, b - sub); }
    if (m > 70) data[i + 3] = 0; else if (m > 35) data[i + 3] = Math.round(255 * (1 - (m - 35) / 35));
    if (data[i + 3] > 40) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  const png = await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).extract({ left: x0, top: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 }).png().toBuffer();
  return `data:image/png;base64,${png.toString('base64')}`;
})();
const SPRITE = (name) => `data:image/webp;base64,${b64(path.join(ROOT, 'public', 'street', name))}`;
const RUBBLE_FRONT = [SPRITE('flat2.webp'), SPRITE('rubble3.webp')];
const BEN = await sharp(path.join(ROOT, 'public', 'renders', 'Q41225.png')).metadata(); // the picture the door goes into (the fallen Big Ben)
/** Where the door goes in the header: a spot in the rubble below the fallen tower (as a share of that picture), worked out through the way the picture is fitted into its strip. */
const doorAt = (W, H) => {
  const tileW = 0.38 * W, tileLeft = 4 * 0.155 * W, scale = Math.max(tileW / BEN.width, H / BEN.height);
  const offX = (tileW - BEN.width * scale) / 2, offY = (H - BEN.height * scale) / 2;
  return { x: tileLeft + offX + 0.561 * BEN.width * scale, y: offY + 0.736 * BEN.height * scale, size: 0.085 * BEN.width * scale };
};

const css = await (await fetch('https://fonts.googleapis.com/css2?family=VT323', { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36' } })).text();
const latin = css.split('/* ').find((part) => part.startsWith('latin */')) ?? css;
const fontUrl = /https:[^) ]+woff2/.exec(latin)?.[0];
if (!fontUrl) throw new Error('no font url');
const font = Buffer.from(await (await fetch(fontUrl)).arrayBuffer()).toString('base64');

/** One header: everything is sized from the height (u = 1% of the height), and the writing stays inside the middle of the picture where the store does not crop it. */
/** A faint street map for the dark left side: a city grid turned a little, its blocks broken up at random (always the same ones), two curving avenues across it, and a route with its marks. */
const streetsSvg = (W, H) => {
  const u = H / 100;
  let seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const minor = [], major = [];
  const ang = (-17 * Math.PI) / 180, dirA = [Math.cos(ang), Math.sin(ang)], dirB = [-dirA[1], dirA[0]];
  const cx = 0.3 * W, cy = 0.5 * H, reach = 1.2 * W;
  for (const [d, n] of [[dirA, dirB], [dirB, dirA]]) {
    let off = -reach;
    while (off < reach) {
      off += (6 + rnd() * 6.5) * u;
      // one street, in pieces (a block or three long), with gaps between
      let t = -reach;
      while (t < reach) {
        const len = (14 + rnd() * 34) * u, gap = rnd() < 0.5 ? 0 : (2 + rnd() * 6) * u;
        const x0 = cx + n[0] * off + d[0] * t, y0 = cy + n[1] * off + d[1] * t, x1 = x0 + d[0] * len, y1 = y0 + d[1] * len;
        minor.push(`M${x0.toFixed(1)} ${y0.toFixed(1)}L${x1.toFixed(1)} ${y1.toFixed(1)}`);
        t += len + gap;
      }
    }
  }
  const curve = (pts) => `M${pts[0][0] * W} ${pts[0][1] * H}C${pts[1][0] * W} ${pts[1][1] * H} ${pts[2][0] * W} ${pts[2][1] * H} ${pts[3][0] * W} ${pts[3][1] * H}`;
  major.push(curve([[-0.02, 0.86], [0.18, 0.62], [0.3, 0.7], [0.62, 0.3]]), curve([[0.02, 0.1], [0.2, 0.3], [0.4, 0.2], [0.66, 0.22]]), curve([[0.3, 1.02], [0.34, 0.7], [0.5, 0.45], [0.6, 0.0]]));
  // the route: along the grid, turning at the corners
  const route = [[0.05, 0.9]];
  let [px, py] = [0.05 * W, 0.9 * H];
  const legs = [[dirA, 24], [dirB, -16], [dirA, 22], [dirB, -14], [dirA, 20]];
  const pts = [[px, py]];
  for (const [d, len] of legs) { px += d[0] * len * u; py += d[1] * len * u; pts.push([px, py]); }
  void route;
  const end = pts[pts.length - 1], start = pts[0];
  const path = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join('');
  return `<svg class="streets" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" fill="none" stroke-linecap="round" stroke-linejoin="round">
    <path d="${minor.join('')}" stroke="#3dff8a" stroke-opacity="0.11" stroke-width="${u * 0.55}"/>
    <path d="${major.join('')}" stroke="#3dff8a" stroke-opacity="0.15" stroke-width="${u * 1.5}"/>
    <path d="${major.join('')}" stroke="#3dff8a" stroke-opacity="0.12" stroke-width="${u * 0.25}"/>
    <path d="${path}" stroke="#9dffc4" stroke-opacity="0.38" stroke-width="${u * 0.95}" stroke-dasharray="${u * 2.4} ${u * 1.8}"/>
    <circle cx="${start[0]}" cy="${start[1]}" r="${u * 1.7}" fill="#3dff8a" fill-opacity="0.34"/>
    <circle cx="${end[0]}" cy="${end[1]}" r="${u * 2.6}" stroke="#9dffc4" stroke-opacity="0.45" stroke-width="${u * 0.5}"/><circle cx="${end[0]}" cy="${end[1]}" r="${u * 0.9}" fill="#9dffc4" fill-opacity="0.5"/>
  </svg>`;
};

const page = (W, H) => `<!doctype html><meta charset="utf-8"><style>
@font-face{font-family:'VT323';src:url(data:font/woff2;base64,${font}) format('woff2');font-display:block}
:root{--u:${H / 100}px;--ink:#3dff8a;--dim:#13a550}
html,body{margin:0;background:#000}
.f{position:relative;width:${W}px;height:${H}px;overflow:hidden;background:#000a04;font-family:'VT323','Courier New',monospace}
.tiles{position:absolute;inset:0}
.tiles div{position:absolute;top:0;bottom:0;width:38%;background-size:cover;background-position:center;filter:saturate(1.05) contrast(1.05);-webkit-mask-image:linear-gradient(90deg,transparent,#000 24%,#000 76%,transparent);mask-image:linear-gradient(90deg,transparent,#000 24%,#000 76%,transparent)}
.shade{position:absolute;inset:0;background:linear-gradient(90deg,rgba(0,10,4,0.97) 0%,rgba(0,10,4,0.92) 30%,rgba(0,10,4,0.78) 48%,rgba(0,10,4,0.5) 62%,rgba(0,10,4,0.1) 80%,rgba(0,10,4,0.2) 100%)}
.tint{position:absolute;inset:0;background:radial-gradient(ellipse at 28% 50%,rgba(61,255,138,0.16),rgba(0,0,0,0) 60%);mix-blend-mode:screen}
.streets{position:absolute;left:0;top:0;-webkit-mask-image:linear-gradient(90deg,#000 0,#000 34%,transparent 66%);mask-image:linear-gradient(90deg,#000 0,#000 34%,transparent 66%)}
.door{position:absolute;transform-origin:50% 50%;filter:brightness(0.82) saturate(0.85) contrast(1.05);-webkit-mask-image:linear-gradient(180deg,#000 72%,rgba(0,0,0,0.0) 99%);mask-image:linear-gradient(180deg,#000 72%,rgba(0,0,0,0.0) 99%)}
.rubf{position:absolute;filter:brightness(0.66) saturate(0.7) sepia(0.4)}
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
<div class="shade"></div><div class="tint"></div>${streetsSvg(W, H)}${(() => { const d = doorAt(W, H); return `<img class="door" src="${doorKeyed}" style="left:${d.x - d.size / 2}px;top:${d.y - d.size / 2}px;width:${d.size}px;transform:rotate(-9deg)">` + `<img class="rubf" src="${RUBBLE_FRONT[0]}" style="left:${d.x - d.size * 0.95}px;top:${d.y + d.size * 0.12}px;width:${d.size * 1.9}px">` + `<img class="rubf" src="${RUBBLE_FRONT[1]}" style="left:${d.x - d.size * 0.15}px;top:${d.y + d.size * 0.02}px;width:${d.size * 0.8}px">`; })()}<div class="scan"></div><div class="vig"></div><div class="frame"></div>
<div class="text"><img class="cog" src="${COG}"><h1>WASTELAND<span>MAPS</span></h1><p>SEE WHERE YOU LIVE AFTER THE BOMBS FELL</p><div class="tags"><b>NAVIGATE</b><b>DISCOVER</b><b>LOOT</b><b>SURVIVE</b></div></div>
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
