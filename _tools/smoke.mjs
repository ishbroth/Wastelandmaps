// Drives the app in Chrome against the mock Google (see mock-google.js): node _tools/smoke.mjs  (dev server with a dummy key on :5174)
import { spawn } from 'node:child_process';
import fs from 'node:fs';
const CH = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const mock = fs.readFileSync(new URL('./mock-google.js', import.meta.url), 'utf8');
const BASE = 'http://localhost:5174/';
const chrome = spawn(CH, ['--headless=new', '--disable-gpu', '--remote-debugging-port=9445', '--window-size=1400,900', '--user-data-dir=' + process.env.TEMP + '/rm-smoke', 'about:blank'], { stdio: 'ignore' });
let tabs;
for (let i = 0; i < 40; i++) { await new Promise((r) => setTimeout(r, 500)); try { tabs = await (await fetch('http://127.0.0.1:9445/json')).json(); if (tabs.some((t) => t.type === 'page')) break; } catch { /* not up yet */ } }
const ws = new WebSocket(tabs.find((t) => t.type === 'page').webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0; const pending = new Map(); const errors = [];
ws.onmessage = (m) => {
  const d = JSON.parse(m.data);
  if (d.id && pending.has(d.id)) { pending.get(d.id)(d.result); pending.delete(d.id); }
  else if (d.method === 'Runtime.exceptionThrown') errors.push(d.params.exceptionDetails.exception?.description ?? d.params.exceptionDetails.text);
  else if (d.method === 'Runtime.consoleAPICalled' && d.params.type === 'error') errors.push(d.params.args.map((a) => a.value ?? a.description).join(' '));
};
const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ev = async (expr) => (await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })).result?.value;
const waitFor = async (expr, ms = 12000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await ev(expr)) return true; await sleep(250); } return false; };
const shot = async (name) => fs.writeFileSync(name, Buffer.from((await send('Page.captureScreenshot', { format: 'png' })).data, 'base64'));
let fails = 0;
const check = (name, ok, detail = '') => { if (!ok) fails++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : '  — ' + detail}`); };

await send('Page.enable'); await send('Runtime.enable');
await send('Page.addScriptToEvaluateOnNewDocument', { source: mock });
await send('Page.navigate', { url: BASE });
await waitFor("!!document.querySelector('.rm-map')");

check('page boots with the map ready (no setup notice)', (await ev("!document.querySelector('.rm-setup') && !!document.querySelector('.rm-map')")) === true);
check('starts on the Pip-Boy look with its map style applied', (await ev("document.documentElement.dataset.look")) === 'pipboy' && (await ev("window.__styles.length")) > 5);

// search for a city
await ev("(()=>{const i=document.querySelector('#rm-q');const set=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;set.call(i,'Boston');i.dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('.rm-search form').requestSubmit();})()");
await waitFor("/LOCATIONS DISCOVERED/.test(document.querySelector('.rm-status').textContent)");
check('geocoding places the map: it flies to the city', (await ev("window.__events.includes('fitBounds')")) === true);
check('the region is named as a wasteland', (await ev("document.querySelector('.rm-poster-title')?.textContent")) === 'The Boston Wasteland', await ev("document.querySelector('.rm-poster-title')?.textContent"));
check('the vault and radiation zones are on the map', (await ev("!!document.querySelector('.rm-pin-vault')")) === true && (await ev("document.querySelectorAll('.rm-pin-rad').length")) >= 3 && (await ev("window.__circles.length")) >= 3);
const pins = await ev("document.querySelectorAll('.rm-pin:not(.rm-pin-vault):not(.rm-pin-rad)').length");
check('every nearby place becomes a pin', pins === 12, `pins ${pins}`);
check('five Places lookups for the city', (await ev("window.__nearbyCalls")) === 5, String(await ev("window.__nearbyCalls")));
check('the status line reports the discovery', /12 LOCATIONS DISCOVERED/.test(await ev("document.querySelector('.rm-status').textContent")), await ev("document.querySelector('.rm-status').textContent"));
check('the address bar became a shareable link', /q=Boston/.test(await ev('location.search')) && /look=pipboy/.test(await ev('location.search')), await ev('location.search'));

// places got wasteland names, and the list is sorted by distance
const names = await ev("[...document.querySelectorAll('.rm-row b')].map(b=>b.textContent)");
check('places are renamed (hospital, school, park...) and list all 12', names.length === 12 && !names.some((n) => /Hospital|Police|Library|Market.*Star/i.test(n)), JSON.stringify(names));
check('each row says what the place used to be', (await ev("[...document.querySelectorAll('.rm-row i')].some(i=>i.textContent.includes('Massachusetts General Hospital'))")) === true);
await shot('_shot-boston-pipboy.png');

// selecting a location
await ev("document.querySelectorAll('.rm-row')[0].click()");
await sleep(400);
check('choosing a row highlights its pin and moves the map there', (await ev("document.querySelectorAll('.rm-pin-selected').length")) === 1 && (await ev("window.__events.includes('panTo')")) === true);
check('the map zooms in for the chosen place', (await ev('window.__map.getZoom()')) >= 15);
check('zoomed in, pin labels show', (await ev("document.querySelector('.rm-map').classList.contains('rm-zoomed')")) === true);

// filtering
await ev("[...document.querySelectorAll('.rm-chip')].find(c=>/Medical/.test(c.textContent)).click()");
await sleep(300);
const afterFilter = await ev("document.querySelectorAll('.rm-pin:not(.rm-pin-vault):not(.rm-pin-rad)').length");
check('turning off a category removes its pins and rows', afterFilter === 10 && (await ev("document.querySelectorAll('.rm-row').length")) === 10, `pins ${afterFilter}`);
await ev("[...document.querySelectorAll('.rm-chip')].find(c=>/Medical/.test(c.textContent)).click()");

// tabs
await ev("[...document.querySelectorAll('.rm-tabs button')].find(b=>b.textContent==='DATA').click()");
await sleep(200);
const data = await ev("document.querySelector('.rm-data').textContent");
check('the DATA tab shows region, vault number, zones and locations', /The Boston Wasteland/.test(data) && /VAULT \d{3}/.test(data) && /12/.test(data), data);
await ev("[...document.querySelectorAll('.rm-tabs button')].find(b=>b.textContent==='SHARE').click()");
await sleep(200);
check('the SHARE tab has the link with place and look', /q=Boston/.test(await ev("document.querySelector('.rm-link').value")), await ev("document.querySelector('.rm-link').value"));

// the other look
await ev("[...document.querySelectorAll('.rm-looks button')].find(b=>b.textContent==='Parchment').click()");
await sleep(500);
check('switching to Parchment restyles the map and the page', (await ev('document.documentElement.dataset.look')) === 'parchment' && (await ev("window.__styles[0].stylers[0].color")) === '#dfcb99', await ev("window.__styles[0].stylers[0].color"));
check('the share link follows the look', /look=parchment/.test(await ev('location.search')), await ev('location.search'));
await shot('_shot-boston-parchment.png');
check('radiation zone colors follow the look (re-drawn on the new look)', (await ev("window.__circles[window.__circles.length-1].strokeColor")) === '#a3401f', await ev("window.__circles[window.__circles.length-1].strokeColor"));

// a place that does not exist (back on the locations tab, where the old map's list is visible)
await ev("[...document.querySelectorAll('.rm-tabs button')].find(b=>b.textContent==='LOCATIONS').click()");
await ev("(()=>{const i=document.querySelector('#rm-q');const set=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;set.call(i,'nowhere land');i.dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('.rm-search form').requestSubmit();})()");
await sleep(800);
check('an unknown place shows a terminal error and keeps the old map', /ERROR: NO SUCH PLACE/.test(await ev("document.querySelector('.rm-status').textContent")) && (await ev("document.querySelectorAll('.rm-row').length")) === 12, await ev("document.querySelector('.rm-status').textContent"));

// opening a shared link
await send('Page.navigate', { url: `${BASE}?q=Boston&look=parchment` });
await waitFor("document.querySelectorAll('.rm-row').length > 0");
check('opening a shared link restores the place and the look', (await ev('document.documentElement.dataset.look')) === 'parchment' && (await ev("document.querySelectorAll('.rm-row').length")) === 12, `${await ev('document.documentElement.dataset.look')} ${await ev("document.querySelectorAll('.rm-row').length")}`);
const vault1 = await ev("document.querySelector('.rm-pin-vault b').textContent");
await send('Page.navigate', { url: `${BASE}?q=Boston&look=pipboy` });
await waitFor("document.querySelectorAll('.rm-row').length > 0");
check('the vault number is the same on another visit', (await ev("document.querySelector('.rm-pin-vault b').textContent")) === vault1, `${vault1} vs ${await ev("document.querySelector('.rm-pin-vault b').textContent")}`);

// small screen
await send('Emulation.setDeviceMetricsOverride', { width: 420, height: 860, deviceScaleFactor: 1, mobile: true });
await sleep(600);
check('on a phone the layout is a single column with no sideways scrolling', (await ev('document.documentElement.scrollWidth')) <= 425, String(await ev('document.documentElement.scrollWidth')));
await shot('_shot-boston-phone.png');

check('no errors in the browser console', errors.length === 0, errors.slice(0, 3).join(' | '));
console.log(fails ? `\n${fails} FAILED` : '\nall checks passed');
ws.close(); chrome.kill(); process.exit(fails ? 1 : 0);
