// Screenshots of the card, the scene viewer and a snapshot (fake Google): node _tools/shots.mjs <pipboy|parchment>
import { spawn } from 'node:child_process';
import fs from 'node:fs';
const look = process.argv[2] || 'pipboy';
const CH = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const mock = fs.readFileSync(new URL('./mock-google.js', import.meta.url), 'utf8');
const chrome = spawn(CH, ['--headless=new', '--disable-gpu', '--remote-debugging-port=9446', '--window-size=1400,900', '--user-data-dir=' + process.env.TEMP + '/rm-shots', 'about:blank'], { stdio: 'ignore' });
let tabs;
for (let i = 0; i < 40; i++) { await new Promise((r) => setTimeout(r, 500)); try { tabs = await (await fetch('http://127.0.0.1:9446/json')).json(); if (tabs.some((t) => t.type === 'page')) break; } catch { /* */ } }
const ws = new WebSocket(tabs.find((t) => t.type === 'page').webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0; const pending = new Map();
ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pending.has(d.id)) { pending.get(d.id)(d.result); pending.delete(d.id); } };
const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ev = async (e) => (await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true })).result?.value;
const shot = async (n) => fs.writeFileSync(n, Buffer.from((await send('Page.captureScreenshot', { format: 'png' })).data, 'base64'));
await send('Page.enable'); await send('Runtime.enable');
await send('Page.addScriptToEvaluateOnNewDocument', { source: mock });
await send('Page.navigate', { url: `http://localhost:5174/?q=Boston&look=${look}` });
for (let i = 0; i < 40; i++) { if (await ev("document.querySelectorAll('.rm-row').length > 0")) break; await sleep(300); }
await ev("[...document.querySelectorAll('.rm-row')].find(r=>/formerly Boston Common/.test(r.textContent)).click()");
await sleep(600);
await shot(`_shot-${look}-card.png`);
await ev("[...document.querySelectorAll('.rm-card .rm-btn')].find(b=>b.textContent==='FAST TRAVEL').click()");
await sleep(1200);
await shot(`_shot-${look}-travel.png`);
for (let i = 0; i < 40; i++) { if (await ev("!!document.querySelector('.rm-modal')")) break; await sleep(300); }
await sleep(1200);
await shot(`_shot-${look}-scene.png`);
await ev("document.querySelectorAll('.rm-modal-tabs button')[1].click()");
await sleep(1200);
await shot(`_shot-${look}-snapshot.png`);
ws.close(); chrome.kill(); process.exit(0);
