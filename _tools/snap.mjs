// Opens the app against the REAL Google (key in .env.local) and reports what happens: node _tools/real.mjs [look] [city]
import { spawn } from 'node:child_process';
import fs from 'node:fs';
const look = process.argv[2] || 'pipboy';
const city = process.argv[3] || 'Boston';
const CH = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const chrome = spawn(CH, ['--headless=new', '--disable-gpu', '--remote-debugging-port=9450', '--window-size=1400,900', '--user-data-dir=' + process.env.TEMP + '/rm-snap', 'about:blank'], { stdio: 'ignore' });
let tabs;
for (let i = 0; i < 40; i++) { await new Promise((r) => setTimeout(r, 500)); try { tabs = await (await fetch('http://127.0.0.1:9450/json')).json(); if (tabs.some((t) => t.type === 'page')) break; } catch { /* */ } }
const ws = new WebSocket(tabs.find((t) => t.type === 'page').webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0; const pending = new Map(); const logs = [];
ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pending.has(d.id)) { pending.get(d.id)(d.result); pending.delete(d.id); } else if (d.method === 'Runtime.exceptionThrown') logs.push('EXCEPTION ' + (d.params.exceptionDetails.exception?.description ?? d.params.exceptionDetails.text)); else if (d.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(d.params.type)) logs.push(d.params.type + ': ' + d.params.args.map((a) => a.value ?? a.description).join(' ').slice(0, 300)); };
const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ev = async (e) => (await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true })).result?.value;
const shot = async (n) => fs.writeFileSync(n, Buffer.from((await send('Page.captureScreenshot', { format: 'png' })).data, 'base64'));
await send('Page.enable'); await send('Runtime.enable');
const place = process.argv[3] || 'Paris';
const target = process.argv[4] || 'Eiffel';
await send('Page.navigate', { url: `http://localhost:5173/?q=${encodeURIComponent(place)}&look=pipboy` });
for (let i = 0; i < 60; i++) { await sleep(500); if (await ev("/LOCATIONS MARKED|ERROR/.test(document.querySelector('.rm-status > span')?.textContent || '')")) break; }
await sleep(1500);
console.log('status:', await ev("document.querySelector('.rm-status > span')?.textContent"));
console.log('rows:', await ev("document.querySelectorAll('.rm-row').length"));
console.log('clicked:', await ev(`(() => { const r=[...document.querySelectorAll('.rm-row')].find(x=>x.textContent.includes('${target}')); if(!r) return false; r.click(); return true; })()`));
await sleep(1200);
await ev("[...document.querySelectorAll('.rm-card .rm-btn')].find(b=>b.textContent==='VIEW').click()");
for (let i = 0; i < 30; i++) { await sleep(500); if (await ev("document.querySelectorAll('.rm-modal-tabs button')[1] && !document.querySelectorAll('.rm-modal-tabs button')[1].disabled")) break; }
console.log('tab:', await ev("document.querySelectorAll('.rm-modal-tabs button')[1]?.textContent"));
await ev("document.querySelectorAll('.rm-modal-tabs button')[1].click()");
await sleep(3500);
await shot(`_shot-snap-${target}.png`);
console.log('credit:', await ev("document.querySelector('.rm-modal-credit')?.textContent"));
ws.close(); chrome.kill(); process.exit(0);
