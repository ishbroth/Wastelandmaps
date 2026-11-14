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
const { placeIcon } = await import('../src/lib/placeIcons.ts'); // the map's own icons
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
/** Chicago from higher up (about ten kilometres from top to bottom of the header): Lake Michigan, the river and its branches, the expressways and main roads (OpenStreetMap, saved in
 *  resources/header-chicago-map.json), and a trip along the expressways with two turns, drawn the way the app draws a trip: the roads green, the route bright, an arrow where it starts and a ring where it ends. */
const CHI = JSON.parse(fs.readFileSync(path.join(ROOT, 'resources', 'header-chicago-map.json'), 'utf8'));
const MAP_MID = [41.878, -87.65], MAP_X = 0.2, MAP_KM = 10.4;
const COS = Math.cos((MAP_MID[0] * Math.PI) / 180);
const project = (W, H) => (p) => [MAP_X * W + ((p[1] - MAP_MID[1]) * 111320 * COS) / ((MAP_KM * 1000) / H), 0.5 * H - ((p[0] - MAP_MID[0]) * 111320) / ((MAP_KM * 1000) / H)];
const keyOf = (p) => p[0] + ',' + p[1];
const metres = (p, q) => Math.hypot((q[0] - p[0]) * 111320, (q[1] - p[1]) * 111320 * COS);
const MAJOR = /^(motorway|trunk|primary|motorway_link|trunk_link|primary_link)$/;
const GRAPH = (() => {
  const adj = new Map(), at = new Map();
  for (const r of CHI.roads) {
    if (!MAJOR.test(r.hw)) continue;
    for (let i = 0; i + 1 < r.pts.length; i++) {
      const p = r.pts[i], q = r.pts[i + 1], kp = keyOf(p), kq = keyOf(q), d = metres(p, q);
      at.set(kp, p); at.set(kq, q);
      if (!adj.has(kp)) adj.set(kp, []); if (!adj.has(kq)) adj.set(kq, []);
      adj.get(kp).push([kq, d]); adj.get(kq).push([kp, d]);
    }
  }
  return { adj, at };
})();
/** The route for a header size: from the expressway point nearest a spot low in the picture (under the tags) to the one nearest a spot high in it (beside the badge), so the marks never sit on the writing. */
const routeFor = (W, H) => {
  const px = project(W, H), { adj, at } = GRAPH;
  const pick = (tx, ty, box) => { let best = null, bd = 1e12; for (const [k, p] of at) { const [x, y] = px(p); if (x < box[0] * W || x > box[1] * W || y < box[2] * H || y > box[3] * H) continue; const d = Math.hypot(x - tx * W, y - ty * H); if (d < bd) { bd = d; best = k; } } return best; };
  const from = pick(0.3, 0.9, [0.04, 0.45, 0.82, 0.95]), to = pick(0.2, 0.1, [0.04, 0.45, 0.05, 0.18]);
  const dist = new Map([[from, 0]]), prev = new Map(), todo = new Set([from]);
  while (todo.size) {
    let cur = null, cd = 1e12;
    for (const k of todo) if (dist.get(k) < cd) { cd = dist.get(k); cur = k; }
    todo.delete(cur);
    if (cur === to) break;
    for (const [k, d] of adj.get(cur) ?? []) if (cd + d < (dist.get(k) ?? 1e12)) { dist.set(k, cd + d); prev.set(k, cur); todo.add(k); }
  }
  const out = [];
  for (let k = to; k; k = prev.get(k)) { out.push(at.get(k)); if (k === from) break; }
  return out.reverse();
};
/** The shore of the lake as one line, south to north (its pieces joined end to end). */
const SHORE = (() => {
  const pieces = CHI.shore.map((l) => ({ l, used: false }));
  const same = (p, q) => p[0] === q[0] && p[1] === q[1];
  let chain = [], cur = pieces.reduce((m, x) => (Math.min(x.l[0][0], x.l[x.l.length - 1][0]) < Math.min(m.l[0][0], m.l[m.l.length - 1][0]) ? x : m));
  cur.used = true; chain = cur.l[0][0] <= cur.l[cur.l.length - 1][0] ? [...cur.l] : [...cur.l].reverse();
  for (let guard = 0; guard < 80; guard++) {
    const end = chain[chain.length - 1];
    const next = pieces.find((x) => !x.used && (same(x.l[0], end) || same(x.l[x.l.length - 1], end)));
    if (!next) break;
    next.used = true; chain.push(...(same(next.l[0], end) ? next.l : [...next.l].reverse()).slice(1));
  }
  return chain;
})();
const PINS = [
  { name: 'John Hancock Center', at: [41.8989, -87.6232], icon: 'glasstower', found: true },
  { name: 'Navy Pier', at: [41.8917, -87.6086], icon: 'anchor' },
  { name: 'Chicago History Museum', at: [41.9119, -87.632], icon: 'column', found: true },
  { name: 'North Avenue Beach', at: [41.9164, -87.6301], icon: 'palm' },
  { name: 'Lincoln Park Zoo', at: [41.9212, -87.6341], icon: 'leafytree', found: true },
  { name: 'Bridgeport', at: [41.8378, -87.649], icon: 'houses' },
  { name: 'Water Tower', at: [41.8977, -87.6244], icon: 'tower', found: true },
  { name: 'Holy Name Cathedral', at: [41.896, -87.6272], icon: 'cathedral' },
  { name: 'Oak Street Beach', at: [41.9025, -87.6256], icon: 'palm' },
  { name: 'Newberry Library', at: [41.8996, -87.6318], icon: 'book', found: true },
  { name: 'Chinatown', at: [41.8528, -87.6339], icon: 'temple' },
  { name: 'McCormick Place', at: [41.8512, -87.6171], icon: 'mall', found: true },
  { name: 'Willis Tower', at: [41.8789, -87.6359], icon: 'skyscraper', found: true },
];
const streetsSvg = (W, H) => {
  const u = H / 100, px = project(W, H);
  const d = (pts) => pts.map((p, i) => { const [x, y] = px(p); return `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`; }).join('');
  const vis = (pts) => pts.some((p) => { const [x, y] = px(p); return x > -80 && x < 0.62 * W && y > -80 && y < H + 80; });
  // the lake: water to the east of the shore line (to the edge of the picture), with a bright shore
  const shore = SHORE.map((p) => px(p));
  const lake = `M${shore.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join('L')}L${W} ${shore[shore.length - 1][1]}L${W} ${shore[0][1]}Z`;
  // the river and its long branches only (the short side cuts, boat slips and stubs would show as thin teeth on the land)
  const rivers = CHI.rivers.filter((r) => r.pts.length >= 8 && vis(r.pts)).map((r) => ({ w: r.w, d: d(r.pts) }));
  // only the water that is a whole closed shape (the open pieces of a big water body would be closed up into thin slivers on the land)
  const ponds = CHI.lakes.filter((l) => l.length > 24 && vis(l) && l[0][0] === l[l.length - 1][0] && l[0][1] === l[l.length - 1][1]).map((l) => d(l) + 'Z');
  const rivers0 = rivers.filter((r) => r.w !== 'canal').map((r) => r.d).join(''), canals0 = rivers.filter((r) => r.w === 'canal').map((r) => r.d).join('');
  const groups = {};
  for (const r of CHI.roads) { if (!MAJOR.test(r.hw) || !vis(r.pts)) continue; const k = /link/.test(r.hw) ? 0.55 : r.hw === 'motorway' ? 1.35 : 1.0; (groups[k] ??= []).push(d(r.pts)); }
  const bands = Object.entries(groups).map(([wd, ds]) => `<path d="${ds.join('')}" stroke="#0e5a2a" stroke-opacity="0.6" stroke-width="${u * Number(wd) * 1.5}"/><path d="${ds.join('')}" stroke="#3dff8a" stroke-opacity="0.34" stroke-width="${u * Number(wd) * 0.3}"/>`).join('');
  const route = routeFor(W, H), rd = d(route), start = px(route[0]), end = px(route[route.length - 1]);
  const next = px(route[Math.min(route.length - 1, 8)]), heading = (Math.atan2(next[1] - start[1], next[0] - start[0]) * 180) / Math.PI + 90;
  return `<svg class="streets" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" fill="none" stroke-linecap="round" stroke-linejoin="round">
    <defs><filter id="rg" x="-5%" y="-5%" width="110%" height="110%"><feGaussianBlur stdDeviation="${u * 0.6}" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
    <rect width="${W}" height="${H}" fill="#3dff8a" fill-opacity="0.045" stroke="none"/>
    <g opacity="0.9"><path d="${lake}" fill="#00120a" fill-opacity="0.82" stroke="none"/><path d="${d(SHORE)}" stroke="#3dff8a" stroke-opacity="0.5" stroke-width="${u * 0.4}"/>
    <path d="${rivers0}" stroke="#3dff8a" stroke-opacity="0.3" stroke-width="${u * 2.5}"/><path d="${canals0}" stroke="#3dff8a" stroke-opacity="0.3" stroke-width="${u * 1.5}"/>
    <path d="${ponds.join('')}" fill="#3dff8a" fill-opacity="0.0" stroke="#3dff8a" stroke-opacity="0.3" stroke-width="${u * 0.4}"/>
    <path d="${rivers0}" stroke="#00120a" stroke-opacity="0.9" stroke-width="${u * 1.8}"/><path d="${canals0}" stroke="#00120a" stroke-opacity="0.9" stroke-width="${u * 0.9}"/>
    <path d="${ponds.join('')}" fill="#00120a" fill-opacity="0.85" stroke="none"/></g>
    <g opacity="0.75">${bands}</g>
    <g filter="url(#rg)" opacity="0.5"><path d="${rd}" stroke="#3dff8a" stroke-opacity="0.6" stroke-width="${u * 1.7}"/><path d="${rd}" stroke="#d9ffe8" stroke-opacity="0.75" stroke-width="${u * 0.5}"/></g>
    <g transform="translate(${start[0]} ${start[1]}) rotate(${heading})"><circle r="${u * 2.4}" fill="#021a0c" fill-opacity="0.8" stroke="#3dff8a" stroke-opacity="0.85" stroke-width="${u * 0.35}"/><path d="M0 ${-u * 1.5}L${u * 1.1} ${u * 1.2}L0 ${u * 0.5}L${-u * 1.1} ${u * 1.2}Z" fill="#3dff8a" fill-opacity="0.95" stroke="none"/></g>
    <circle cx="${end[0]}" cy="${end[1]}" r="${u * 2.8}" stroke="#d9ffe8" stroke-opacity="0.75" stroke-width="${u * 0.5}"/><circle cx="${end[0]}" cy="${end[1]}" r="${u * 1.1}" fill="#d9ffe8" fill-opacity="0.85" stroke="none"/>
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
.streets{position:absolute;left:0;top:0;-webkit-mask-image:linear-gradient(90deg,#000 0,#000 38%,transparent 50%);mask-image:linear-gradient(90deg,#000 0,#000 30%,transparent 47%)}
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
  const rectsJson = (await send('Runtime.evaluate', { expression: "JSON.stringify(['.cog', 'h1', '.text p', '.tags'].map((q) => { const r = document.querySelector(q).getBoundingClientRect(); return [r.left, r.top, r.right, r.bottom]; }))", returnByValue: true })).result.value;
  const texts = JSON.parse(rectsJson);
  const u = H / 100, px = project(W, H), route = routeFor(W, H);
  const marks = [px(route[0]), px(route[route.length - 1])];
  const placed = [];
  const SIZE = u * 4.6;
  for (const p of PINS) {
    if (placed.length >= 6) break;
    const [x, y] = px(p.at);
    const box = [x - SIZE / 2 - u * 0.8, y - SIZE / 2 - u * 0.8, x + SIZE / 2 + u * 0.8, y + SIZE / 2 + u * 0.8];
    if (x < 0.07 * W || x > 0.44 * W || y < 0.06 * H || y > 0.94 * H) continue; // inside the frame, and where the map is still strong
    if (texts.some((t) => box[0] < t[2] + u * 1.0 && box[2] > t[0] - u * 1.0 && box[1] < t[3] + u * 1.0 && box[3] > t[1] - u * 1.0)) continue; // not over the writing, the badge or the tags
    if (marks.some((m) => Math.hypot(m[0] - x, m[1] - y) < u * 9)) continue; // nor on the start arrow or the end ring
    if (placed.some((q) => Math.hypot(q.x - x, q.y - y) < u * 5.5)) continue; // spread out
    placed.push({ x, y, ...p });
  }
  console.log(W + 'x' + H, 'pins:', placed.map((p) => p.name).join(', '));
  const pinsHtml = placed.map((p) => `<div class="pin${p.found ? ' found' : ''}" style="left:${p.x - SIZE / 2}px;top:${p.y - SIZE / 2}px;width:${SIZE}px;height:${SIZE}px">${placeIcon(p.icon)}</div>`).join('');
  await send('Runtime.evaluate', { expression: `(() => { const s = document.createElement('style'); s.textContent = ${JSON.stringify(`.pin{position:absolute;color:#3dff8a;opacity:0.88;filter:drop-shadow(0 0 ${u * 0.12}px #000) drop-shadow(0 0 ${u * 0.9}px rgba(61,255,138,0.75))}.pin svg{width:100%;height:100%}.pin svg .f,.pin svg .d,.pin svg .s{fill:none}.pin:not(.found){opacity:0.62}.pin.found svg{stroke:#021a0c;stroke-width:0.9}.pin.found svg .f{fill:currentColor}.pin.found svg .d{stroke:#021a0c;stroke-width:1.5}`)}; document.head.appendChild(s); document.querySelector('.scan').insertAdjacentHTML('beforebegin', ${JSON.stringify(pinsHtml)}); })()` });
  await new Promise((r) => setTimeout(r, 300));
  const shot = await send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: W, height: H, scale: 1 } });
  const file = path.join(OUT, `WastelandMaps-header-${W}x${H}.png`);
  fs.writeFileSync(file, Buffer.from(shot.data, 'base64'));
  console.log('saved', file);
}
chrome.kill(); process.exit(0);
