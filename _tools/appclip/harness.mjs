// Records the app as an App Store preview video: real Chrome (headless) at a phone's size, driven like a finger, with the screen recorded frame by frame and put together by ffmpeg.
// A signed-in profile is kept between runs (_data/clip-profile), so the account is signed in once, off camera.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const FFMPEG = 'C:/Users/appli/AppData/Local/Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-8.1-full_build/bin/ffmpeg.exe';
const BS = String.fromCharCode(92);
const NL = String.fromCharCode(10);
const fwd = (p) => p.split(BS).join('/');
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function launch({ w = 443, h = 960, dsf = 2, profile = 'clip-profile', geo = null, gpu = false, mobile = true, port = 9700 + Math.floor(Math.random() * 90) } = {}) {
  const dir = path.join(ROOT, '_data', profile);
  fs.mkdirSync(dir, { recursive: true });
  const chrome = spawn(CHROME, ['--headless=new', ...(gpu ? ['--enable-gpu', '--ignore-gpu-blocklist'] : ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']), '--autoplay-policy=no-user-gesture-required', '--hide-scrollbars', `--remote-debugging-port=${port}`, '--user-data-dir=' + dir, `--window-size=${w},${h}`, 'about:blank'], { stdio: 'ignore' });
  let tabs;
  for (let i = 0; i < 60; i++) { await sleep(400); try { tabs = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); if (tabs.some((t) => t.type === 'page')) break; } catch { /* */ } }
  const mk = async (url) => {
    const ws = new WebSocket(url);
    await new Promise((r) => (ws.onopen = r));
    let id = 0; const pending = new Map(); const listeners = [];
    ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pending.has(d.id)) { pending.get(d.id)(d.result ?? d.error); pending.delete(d.id); } else if (d.method) for (const l of listeners) l(d); };
    const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
    return { send, on: (f) => listeners.push(f), ws };
  };
  const page = await mk(tabs.find((t) => t.type === 'page').webSocketDebuggerUrl);
  const version = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json();
  const browser = await mk(version.webSocketDebuggerUrl);
  const { send } = page;
  await send('Page.enable'); await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: dsf, mobile, screenWidth: w, screenHeight: h });
  await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  await send('Emulation.setUserAgentOverride', { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1' });
  if (geo) await send('Emulation.setGeolocationOverride', { latitude: geo.lat, longitude: geo.lng, accuracy: 10 });
  const ev = async (e) => (await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true })).result?.value;
  const api = {
    send, ev, chrome, w, h, dsf, browser, on: page.on,
    async grantGeo(origin) { await browser.send('Browser.grantPermissions', { origin, permissions: ['geolocation'] }); },
    async goto(url, waitMs = 6000) { await send('Page.navigate', { url }); await sleep(waitMs); },
    async setGeo(lat, lng) { await send('Emulation.setGeolocationOverride', { latitude: lat, longitude: lng, accuracy: 8 }); },
    // fingers
    async tap(x, y, hold = 60) {
      await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] }); await sleep(hold);
      await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    },
    async drag(x1, y1, x2, y2, ms = 600) {
      await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x1, y: y1 }] });
      const steps = Math.max(6, Math.round(ms / 16));
      for (let i = 1; i <= steps; i++) { const t = i / steps; const e = t * t * (3 - 2 * t); await send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x1 + (x2 - x1) * e, y: y1 + (y2 - y1) * e }] }); await sleep(ms / steps); }
      await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    },
    async centerOf(sel, index = 0) {
      return ev(`(()=>{const e=[...document.querySelectorAll(${JSON.stringify(sel)})][${index}]; if(!e) return null; e.scrollIntoView({block:'center'}); const r=e.getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2};})()`);
    },
    async clickSel(sel, { index = 0, hold = 60 } = {}) {
      const box = await api.centerOf(sel, index);
      if (!box) throw new Error('no element ' + sel);
      await api.tap(box.x, box.y, hold); return box;
    },
    async clickText(text, { tag = 'button, a, li, div, span', hold = 60 } = {}) {
      const box = await ev(`(()=>{const t=${JSON.stringify(text)}.toLowerCase(); const e=[...document.querySelectorAll(${JSON.stringify(tag)})].filter(x=>(x.textContent||'').trim().toLowerCase().startsWith(t) && x.getBoundingClientRect().width>0).sort((a,b)=>(a.textContent.length-b.textContent.length))[0]; if(!e) return null; const r=e.getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2};})()`);
      if (!box) throw new Error('no text ' + text);
      await api.tap(box.x, box.y, hold); return box;
    },
    async type(selector, text) { await ev(`document.querySelector(${JSON.stringify(selector)}).focus()`); await send('Input.insertText', { text }); },
    async shot(file) { fs.writeFileSync(file, Buffer.from((await send('Page.captureScreenshot', { format: 'png' })).data, 'base64')); },
    // the recording: every change of the screen is kept with its time, then put together at a steady 30 frames a second
    rec: null,
    async start(name) {
      const frames = path.join(ROOT, '_data', 'clip-frames', name);
      fs.rmSync(frames, { recursive: true, force: true }); fs.mkdirSync(frames, { recursive: true });
      const list = []; let n = 0;
      page.on((d) => {
        if (d.method !== 'Page.screencastFrame') return;
        const file = path.join(frames, `f${String(n++).padStart(6, '0')}.jpg`);
        fs.writeFileSync(file, Buffer.from(d.params.data, 'base64'));
        list.push({ file, t: d.params.metadata.timestamp });
        send('Page.screencastFrameAck', { sessionId: d.params.sessionId });
      });
      await send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: w * dsf, maxHeight: h * dsf, everyNthFrame: 1 });
      api.rec = { frames, list, name };
    },
    async stop(outFile, { fps = 30, tail = 0.6, maxSec = 0 } = {}) {
      await send('Page.stopScreencast');
      await sleep(300);
      const { list, frames } = api.rec;
      if (!list.length) throw new Error('no frames');
      const raw = list[list.length - 1].t - list[0].t + tail;
      const speed = maxSec && raw > maxSec ? raw / maxSec : 1; // a little faster when it would run over the limit
      const lines = [];
      for (let i = 0; i < list.length; i++) {
        const next = i + 1 < list.length ? list[i + 1].t : list[i].t + tail;
        lines.push(`file '${fwd(list[i].file)}'`, `duration ${Math.max(0.01, next - list[i].t).toFixed(4)}`);
      }
      lines.push(`file '${fwd(list[list.length - 1].file)}'`);
      const txt = path.join(frames, 'list.txt');
      fs.writeFileSync(txt, lines.join(NL));
      await new Promise((res, rej) => {
        const p = spawn(FFMPEG, ['-y', '-f', 'concat', '-safe', '0', '-i', txt, '-vf', `${speed > 1 ? `setpts=PTS/${speed.toFixed(4)},` : ''}fps=${fps},scale=${w * dsf}:${h * dsf}:flags=lanczos,format=yuv420p`, '-c:v', 'libx264', '-preset', 'slow', '-crf', '17', '-movflags', '+faststart', outFile], { stdio: 'ignore' });
        p.on('exit', (c) => (c === 0 ? res() : rej(new Error('ffmpeg ' + c))));
      });
      const dur = (list[list.length - 1].t - list[0].t + tail) / (speed || 1);
      console.log(`saved ${outFile} (${list.length} frames, ${dur.toFixed(1)} s)`);
    },
    close() { try { chrome.kill(); } catch { /* */ } },
  };
  return api;
}
