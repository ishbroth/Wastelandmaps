// Small Chrome driver for looking at the running app: node _tools/cdp.mjs <url> <out.png> [js to run first] [width] [height]
import { spawn } from 'node:child_process';
import fs from 'node:fs';
const [url, out, js = '', w = '1400', h = '900'] = process.argv.slice(2);
const CH = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const chrome = spawn(CH, ['--headless=new', '--disable-gpu', '--remote-debugging-port=9444', `--window-size=${w},${h}`, '--user-data-dir=' + process.env.TEMP + '/rm-cdp', 'about:blank'], { stdio: 'ignore' });
let tabs;
for (let i = 0; i < 40; i++) { await new Promise((r) => setTimeout(r, 500)); try { tabs = await (await fetch('http://127.0.0.1:9444/json')).json(); if (tabs.some((t) => t.type === 'page')) break; } catch { /* not up yet */ } }
const ws = new WebSocket(tabs.find((t) => t.type === 'page').webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0; const pending = new Map(); const logs = [];
ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pending.has(d.id)) { pending.get(d.id)(d.result); pending.delete(d.id); } else if (d.method === 'Runtime.exceptionThrown') logs.push('EXCEPTION: ' + (d.params.exceptionDetails.exception?.description ?? d.params.exceptionDetails.text))
  else if (d.method === 'Runtime.consoleAPICalled') logs.push(d.params.args.map((a) => a.value ?? a.description).join(' ')); };
const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
await send('Page.enable'); await send('Runtime.enable');
if (process.env.MOCK) await send('Page.addScriptToEvaluateOnNewDocument', { source: fs.readFileSync(new URL('./mock-google.js', import.meta.url), 'utf8') });
await send('Emulation.setDeviceMetricsOverride', { width: Number(w), height: Number(h), deviceScaleFactor: 1, mobile: false });
await send('Page.navigate', { url });
await new Promise((r) => setTimeout(r, 3500));
if (js) { const r = await send('Runtime.evaluate', { expression: js, returnByValue: true, awaitPromise: true }); console.log('js ->', JSON.stringify(r.result?.value)); await new Promise((r) => setTimeout(r, 800)); }
const shot = await send('Page.captureScreenshot', { format: 'png' });
fs.writeFileSync(out, Buffer.from(shot.data, 'base64'));
if (logs.length) console.log('console:', logs.slice(0, 20).join(' | '));
ws.close(); chrome.kill(); process.exit(0);
