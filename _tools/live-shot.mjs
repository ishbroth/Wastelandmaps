// Screenshots the LIVE site in headless Chrome (real Google tiles), to measure colors.   node _tools/live-shot.mjs <out.png> <url> [w] [h] [wait ms] [js to run after load]
import { spawn } from 'node:child_process';
import fs from 'node:fs';
const [,, out, url, w = '1400', h = '900', wait = '14000', action = ''] = process.argv;
const CH = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const port = 9500 + Math.floor(Math.random() * 30);
const chrome = spawn(CH, ['--headless=new', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', `--remote-debugging-port=${port}`, '--user-data-dir=' + process.env.TEMP + '/rm-live-' + port, 'about:blank'], { stdio: 'ignore' });
let tabs;
for (let i = 0; i < 40; i++) { await new Promise((r) => setTimeout(r, 400)); try { tabs = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); if (tabs.some((t) => t.type === 'page')) break; } catch { /* */ } }
const ws = new WebSocket(tabs.find((t) => t.type === 'page').webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0; const pending = new Map();
ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pending.has(d.id)) { pending.get(d.id)(d.result); pending.delete(d.id); } };
const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (e) => (await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true })).result?.value;
await send('Page.enable'); await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: +w, height: +h, deviceScaleFactor: 1, mobile: false });
await send('Page.navigate', { url });
await new Promise((r) => setTimeout(r, +wait));
// "wheel:x,y,dy,count" scrolls the mouse wheel over the page (zooming the map there); several steps can be joined with ;
for (const step of action.split('@@').filter(Boolean)) {
  const i0 = step.indexOf(':'); const kind = step.slice(0, i0), rest = step.slice(i0 + 1);
  if (kind === 'js') { console.log(await ev(rest)); await new Promise((r) => setTimeout(r, 7000)); }
  if (kind === 'wheel') { const [x, y, dy, count] = rest.split(',').map(Number); for (let i = 0; i < count; i++) { await send('Input.dispatchMouseEvent', { type: 'mouseWheel', x, y, deltaX: 0, deltaY: dy }); await new Promise((r) => setTimeout(r, 350)); } await new Promise((r) => setTimeout(r, 5000)); }
}
fs.writeFileSync(out, Buffer.from((await send('Page.captureScreenshot', { format: 'png' })).data, 'base64'));
console.log('saved', out);
chrome.kill();
process.exit(0);
