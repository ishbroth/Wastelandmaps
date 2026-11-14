// The WASTELANDMAPS wordmark as a picture for the emails (mail programs do not load web fonts): set exactly as the site's header sets it (VT323 bold, WASTELAND bright, MAPS dimmer, glow),
// on the emails' dark green, saved as public/email/wordmark.png (2x size).     node _tools/make-email-wordmark.mjs
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
const ROOT = path.resolve(import.meta.dirname, '..');
const CH = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const css = await (await fetch('https://fonts.googleapis.com/css2?family=VT323', { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36' } })).text();
const fontUrl = /https:[^) ]+woff2/.exec((css.split('/* ').find((p) => p.startsWith('latin */')) ?? css))?.[0];
const font = Buffer.from(await (await fetch(fontUrl)).arrayBuffer()).toString('base64');
const W = 1040, H = 170;
const page = `<!doctype html><meta charset="utf-8"><style>@font-face{font-family:'VT323';src:url(data:font/woff2;base64,${font}) format('woff2')}
html,body{margin:0;background:#101a13}.f{width:${W}px;height:${H}px;display:flex;align-items:center;justify-content:center;background:#101a13}
h1{margin:0;font-family:'VT323',monospace;font-size:132px;font-weight:bold;line-height:1;letter-spacing:6px;color:#3dff8a;text-shadow:0 0 24px rgba(61,255,138,0.65);white-space:nowrap}h1 span{color:#13a550}</style><div class="f"><h1>WASTELAND<span>MAPS</span></h1></div>`;
const port = 9640 + Math.floor(Math.random() * 30);
const chrome = spawn(CH, ['--headless=new', '--disable-gpu', `--remote-debugging-port=${port}`, '--user-data-dir=' + process.env.TEMP + '/rm-em-' + port, 'about:blank'], { stdio: 'ignore' });
let tabs;
for (let i = 0; i < 40; i++) { await new Promise((r) => setTimeout(r, 400)); try { tabs = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); if (tabs.some((t) => t.type === 'page')) break; } catch { /* */ } }
const ws = new WebSocket(tabs.find((t) => t.type === 'page').webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0; const pending = new Map();
ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pending.has(d.id)) { pending.get(d.id)(d.result); pending.delete(d.id); } };
const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
await send('Page.enable'); await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false });
const tmp = path.join(process.env.TEMP, 'wm-email.html'); fs.writeFileSync(tmp, page);
await send('Page.navigate', { url: 'file:///' + tmp.split(String.fromCharCode(92)).join('/') });
await new Promise((r) => setTimeout(r, 1500));
await send('Runtime.evaluate', { expression: "document.fonts.load('bold 100px VT323').then(() => document.fonts.ready)", awaitPromise: true });
await new Promise((r) => setTimeout(r, 400));
const shot = await send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: W, height: H, scale: 1 } });
fs.mkdirSync(path.join(ROOT, 'public', 'email'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'public', 'email', 'wordmark.png'), Buffer.from(shot.data, 'base64'));
console.log('saved public/email/wordmark.png');
chrome.kill(); process.exit(0);
