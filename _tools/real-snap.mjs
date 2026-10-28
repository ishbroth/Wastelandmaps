// Tries the first places of a real city for a free Commons photo: node _tools/real-snap.mjs [city]
import { spawn } from 'node:child_process';
import fs from 'node:fs';
const city = process.argv[2] || 'Boston';
const CH = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const chrome = spawn(CH, ['--headless=new', '--disable-gpu', '--remote-debugging-port=9448', '--window-size=1400,900', '--user-data-dir=' + process.env.TEMP + '/rm-snap', 'about:blank'], { stdio: 'ignore' });
let tabs;
for (let i = 0; i < 40; i++) { await new Promise((r) => setTimeout(r, 500)); try { tabs = await (await fetch('http://127.0.0.1:9448/json')).json(); if (tabs.some((t) => t.type === 'page')) break; } catch { /* */ } }
const ws = new WebSocket(tabs.find((t) => t.type === 'page').webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0; const pending = new Map();
ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pending.has(d.id)) { pending.get(d.id)(d.result); pending.delete(d.id); } };
const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ev = async (e) => (await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true })).result?.value;
const shot = async (n) => fs.writeFileSync(n, Buffer.from((await send('Page.captureScreenshot', { format: 'png' })).data, 'base64'));
await send('Page.enable'); await send('Runtime.enable');
await send('Page.navigate', { url: `http://localhost:5173/?q=${encodeURIComponent(city)}&look=pipboy` });
for (let i = 0; i < 60; i++) { await sleep(500); if (await ev("/LOCATIONS MARKED/.test(document.querySelector('.rm-status > span')?.textContent || '')")) break; }
let found = 0;
for (let n = 0; n < 30 && found < 2; n++) {
  await ev(`document.querySelectorAll('.rm-row')[${n}].click()`); await sleep(500);
  await ev("[...document.querySelectorAll('.rm-card .rm-btn')].find(b=>b.textContent==='VIEW').click()"); 
  let tab = 'SNAPSHOT…';
  for (let i = 0; i < 14 && tab === 'SNAPSHOT…'; i++) { await sleep(400); tab = await ev("document.querySelectorAll('.rm-modal-tabs button')[1]?.textContent"); }
  const name = await ev("document.querySelector('.rm-modal h2')?.textContent") + ' (' + (await ev("document.querySelector('.rm-modal-head p')?.textContent")) + ')';
  console.log(`${String(n).padStart(2)} ${tab.padEnd(12)} ${name}`);
  if (tab === 'SNAPSHOT') { found++; await ev("document.querySelectorAll('.rm-modal-tabs button')[1].click()"); await sleep(2500); await shot(`_shot-real-snap-${found}.png`); console.log('   credit:', await ev("document.querySelector('.rm-modal-credit')?.textContent")); }
  await ev("document.querySelector('.rm-modal-head .rm-btn').click()"); await sleep(250);
}
ws.close(); chrome.kill(); process.exit(0);
