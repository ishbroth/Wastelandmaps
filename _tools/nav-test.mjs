// Drives the fast travel / navigation flow in a real browser with the fake Google and a fake GPS: node _tools/nav-test.mjs <width> <height> <outPrefix>
import { spawn } from 'node:child_process';
import fs from 'node:fs';
const [,, w = '390', h = '844', outPrefix = '_nav'] = process.argv;
const CH = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const mock = fs.readFileSync(new URL('./mock-google.js', import.meta.url), 'utf8');
const port = 9500 + Math.floor(Math.random() * 40);
const chrome = spawn(CH, ['--headless=new', '--disable-gpu', `--remote-debugging-port=${port}`, '--user-data-dir=' + process.env.TEMP + '/rm-nav-' + port, 'about:blank'], { stdio: 'ignore' });
let tabs;
for (let i = 0; i < 40; i++) { await new Promise((r) => setTimeout(r, 400)); try { tabs = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); if (tabs.some((t) => t.type === 'page')) break; } catch { /* */ } }
const ws = new WebSocket(tabs.find((t) => t.type === 'page').webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0; const pending = new Map(); const logs = [];
ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pending.has(d.id)) { pending.get(d.id)(d.result); pending.delete(d.id); } else if (d.method === 'Runtime.exceptionThrown') logs.push(d.params.exceptionDetails.exception?.description?.slice(0, 300)); };
const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ev = async (e) => (await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true })).result?.value;
const shot = async (name) => fs.writeFileSync(`${outPrefix}-${name}.png`, Buffer.from((await send('Page.captureScreenshot', { format: 'png' })).data, 'base64'));
const at = (lat, lng) => send('Emulation.setGeolocationOverride', { latitude: lat, longitude: lng, accuracy: 10 });
await send('Page.enable'); await send('Runtime.enable');
await send('Browser.grantPermissions', { permissions: ['geolocation'], origin: 'http://localhost:5176' }).catch(() => {});
await send('Page.addScriptToEvaluateOnNewDocument', { source: mock });
await send('Emulation.setDeviceMetricsOverride', { width: +w, height: +h, deviceScaleFactor: 1, mobile: +w < 700 });
await at(42.355, -71.065); // Boston Common
await send('Page.navigate', { url: 'http://localhost:5176/?q=Boston&look=pipboy' });
for (let i = 0; i < 80; i++) { if (await ev("document.querySelectorAll('.rm-row').length > 0")) break; await sleep(400); }
await sleep(800);
const openCard = () => ev("(()=>{const r=[...document.querySelectorAll('.rm-row')].find(r=>/Faneuil|Common|Freedom|Hancock/i.test(r.textContent))||document.querySelector('.rm-row');r.click();return r.textContent.slice(0,40)})()");
console.log('card for', await openCard());
await sleep(900);

// 1. AUTO-DISCOVER off: fast travel only flashes a message
await ev("[...document.querySelectorAll('.rm-card .rm-btn')].find(b=>/FAST TRAVEL/.test(b.textContent)).click()");
await sleep(500);
console.log('OFF  ->', await ev("JSON.stringify({ toast: document.querySelector('.rm-toast')?.textContent, flash: !!document.querySelector('.rm-toast-flash'), nav: !!document.querySelector('.rm-nav') })"));
await shot('1-off');

// 2. AUTO-DISCOVER on: navigation starts
await ev("document.querySelector('.rm-track').click()");
await sleep(2500);
console.log('card again for', await openCard());
await sleep(900);
await ev("[...document.querySelectorAll('.rm-card .rm-btn')].find(b=>/FAST TRAVEL/.test(b.textContent)).click()");
await sleep(2500);
console.log('ON   ->', await ev("JSON.stringify({ banner: document.querySelector('.rm-nav')?.innerText, routeCalls: window.__routeCalls })"));
await shot('2-driving');

// 3. a little further along the road: the next turn is nearer
const target = await ev("JSON.stringify(window.__wlmap && window.__wlmap.getCenter ? { c: window.__wlmap.getCenter().toJSON() } : {})");
console.log('map center', target);
await at(42.3585, -71.062);
await sleep(2500);
console.log('MOVED->', await ev("document.querySelector('.rm-nav')?.innerText"));
await shot('3-moved');

// 4. END
await ev("document.querySelector('.rm-nav .rm-btn').click()");
await sleep(500);
console.log('END  ->', await ev("!!document.querySelector('.rm-nav')"));

// 5. overseas: a device in Tokyo asking for a place in Boston: flights
await at(35.68, 139.69);
await sleep(300);
await ev("window.__opened = []; window.open = (u) => { window.__opened.push(u); return {}; }");
console.log('toggle before:', await ev("document.querySelector('.rm-track').textContent")); await ev("document.querySelector('.rm-track').click()"); await sleep(500); await ev("document.querySelector('.rm-track').click()"); console.log('toggle after:', await ev("document.querySelector('.rm-track').textContent"));
await sleep(2500);
console.log('card for', await openCard());
await sleep(900);
await ev("[...document.querySelectorAll('.rm-card .rm-btn')].find(b=>/FAST TRAVEL/.test(b.textContent)).click()");
await sleep(2500);
console.log('FLY  ->', await ev("JSON.stringify({ opened: window.__opened, toast: document.querySelector('.rm-toast')?.textContent })"));
await shot('5-flights');
console.log(logs.length ? 'EXC ' + logs.join(' | ') : 'no exceptions');
chrome.kill(); process.exit(0);
