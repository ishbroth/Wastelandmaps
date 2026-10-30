// Screenshots of the app in a real browser with the fake Google, at any screen size.
//   node _tools/ui-shot.mjs <out.png> <width> <height> [js to run after Boston has loaded] [full]
import { spawn } from 'node:child_process';
import fs from 'node:fs';
const [,, out, w, h, action = '', full = ''] = process.argv;
const CH = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const mock = fs.readFileSync(new URL('./mock-google.js', import.meta.url), 'utf8');
const port = 9460 + Math.floor(Math.random() * 30);
const chrome = spawn(CH, ['--headless=new', '--disable-gpu', `--remote-debugging-port=${port}`, '--user-data-dir=' + process.env.TEMP + '/rm-ui-' + port, 'about:blank'], { stdio: 'ignore' });
let tabs;
for (let i = 0; i < 40; i++) { await new Promise((r) => setTimeout(r, 400)); try { tabs = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); if (tabs.some((t) => t.type === 'page')) break; } catch { /* */ } }
const ws = new WebSocket(tabs.find((t) => t.type === 'page').webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0; const pending = new Map(); const logs = [];
ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pending.has(d.id)) { pending.get(d.id)(d.result); pending.delete(d.id); } else if (d.method === 'Runtime.exceptionThrown') logs.push(d.params.exceptionDetails.exception?.description?.slice(0, 300)); };
const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ev = async (e) => (await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true })).result?.value;
await send('Page.enable'); await send('Runtime.enable');
await send('Page.addScriptToEvaluateOnNewDocument', { source: mock });
await send('Emulation.setDeviceMetricsOverride', { width: +w, height: +h, deviceScaleFactor: 1, mobile: +w < 700 || +h < 500 });
await send('Page.navigate', { url: 'http://localhost:5176/?q=' + (process.env.Q || 'Boston') + '&look=pipboy' });
for (let i = 0; i < 60; i++) { if (await ev("document.querySelectorAll('.rm-row').length > 0")) break; await sleep(400); }
await sleep(800);
if (action) { await ev(action); await sleep(1200); }
const info = await ev('JSON.stringify({ sw: document.documentElement.scrollWidth, iw: innerWidth, ih: innerHeight })');
console.log(info, logs.length ? 'EXC ' + logs.join(' | ') : '');
let clip;
if (full) { const m = await send('Page.getLayoutMetrics'); clip = { x: 0, y: 0, width: +w, height: Math.min(3000, m.cssContentSize.height), scale: 1 }; }
fs.writeFileSync(out, Buffer.from((await send('Page.captureScreenshot', { format: 'png', ...(clip ? { clip, captureBeyondViewport: true } : {}) })).data, 'base64'));
chrome.kill(); process.exit(0);
