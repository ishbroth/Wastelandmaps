// Clip C: the shooting gallery at the Space Needle, then the home vault: settlers walking about and a room's furniture list.
//   node _tools/appclip/clipC.mjs <out.mp4>     (two recordings, joined)
import { spawn } from 'node:child_process';
import { launch, sleep } from './harness.mjs';
import { maskPrivate } from './scenes.mjs';
const out = process.argv[2] ?? process.env.TEMP + '/clipC.mp4';
const FFMPEG = 'C:/Users/appli/AppData/Local/Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-8.1-full_build/bin/ffmpeg.exe';
const tmp = process.env.TEMP;
const BASE = 'http://localhost:5173/';

// ---- part 1: the shooter ----
if (process.env.ONLY2 !== '1') {
  const b = await launch({ geo: { lat: 47.6205, lng: -122.3493 } });
  try {
    await b.grantGeo('http://localhost:5173');
    await b.goto(BASE + '?q=Seattle&look=pipboy', 9000);
    await b.ev('window.__wlmap.setCenter({lat:47.6205,lng:-122.3493}); window.__wlmap.setZoom(16);'); await sleep(6000);
    const p = await b.ev("(()=>{const e=[...document.querySelectorAll('.rm-pin')].find(x=>/space needle/i.test(x.textContent)); const r=e.getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2};})()");
    await b.tap(p.x, p.y); await sleep(1500);
    await b.clickText('view', { tag: 'button' }); await sleep(2000);
    await b.clickText('clear', { tag: '.rm-modal-tabs button' });
    for (let i = 0; i < 40 && !(await b.ev("!!document.querySelector('.rm-raid-left')")); i++) await sleep(250);
    await b.start('C1');
    const t0 = Date.now();
    while (Date.now() - t0 < 12500) {
      const e = JSON.parse((await b.ev("JSON.stringify(window.__game ? window.__game.enemies.filter(e=>e.state!=='dying').map(e=>[e.u,e.v,e.p]) : [])")) || '[]');
      if (e.length) { const [u, v, pp] = e.sort((x, y) => y[1] - x[1])[0]; await b.tap(u * 443, 185 + v * 590 - (40 + 150 * pp) * 0.6, 35); }
      await sleep(230);
    }
    await b.stop(tmp + '/clipC1.mp4');
  } finally { b.close(); }
}

// ---- part 2: the vault ----
{
  const b = await launch({ gpu: true });
  try {
    await b.goto(BASE + '?q=3822 Polaris Dr, La Mesa, CA&look=pipboy', 10000);
    await b.ev('window.__wlmap.setZoom(18);'); await sleep(4000);
    const p = await b.ev("(()=>{const e=[...document.querySelectorAll('.rm-pin')].find(x=>/vault 0?730/i.test(x.textContent)); const r=e.getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2};})()");
    await b.tap(p.x, p.y); await sleep(1500);
    for (let tries = 0; tries < 4; tries++) {
      await b.clickText('enter', { tag: 'button' }); await sleep(6500);
      if (await b.ev("/SETTLERS/i.test(document.body.innerText)")) break;
      await b.clickText('leave', { tag: 'button' }); await sleep(1500);
      const q = await b.ev("(()=>{const e=[...document.querySelectorAll('.rm-pin')].find(x=>/vault 0?730/i.test(x.textContent)); if(!e) return null; const r=e.getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2};})()");
      if (q) { await b.tap(q.x, q.y); await sleep(1500); }
    }
    await maskPrivate(b);
    await b.start('C2');
    await sleep(3500); // the settlers walk about
    await b.shot(process.env.TEMP + '/c2-0.png'); await b.tap(335, 560); await sleep(3200); await b.shot(process.env.TEMP + '/c2-1.png'); // a room, close up: its list of furniture comes up
    await b.clickText('close', { tag: 'button' }); await sleep(1200);
    await sleep(3200); // the whole vault again, the settlers still walking about
    await b.stop(tmp + '/clipC2.mp4');
  } finally { b.close(); }
}

// ---- joined ----
fsWrite();
function fsWrite() {
  import('node:fs').then(({ default: fs }) => {
    const list = tmp + '/clipC.txt';
    fs.writeFileSync(list, `file '${(tmp + '/clipC1.mp4').split(String.fromCharCode(92)).join('/')}'\nfile '${(tmp + '/clipC2.mp4').split(String.fromCharCode(92)).join('/')}'\n`);
    const p = spawn(FFMPEG, ['-y', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', out], { stdio: 'ignore' });
    p.on('exit', (c) => console.log(c === 0 ? 'joined ' + out : 'join failed'));
  });
}
