// Clip B: a permanently unlocked landmark blown apart (the Space Needle), then a snapshot unlocked (Columbia Center) and blown apart too.
//   node _tools/appclip/clipB.mjs <out.mp4>
import { launch, sleep } from './harness.mjs';
import { maskPrivate } from './scenes.mjs';
const out = process.argv[2] ?? process.env.TEMP + '/clipB.mp4';
const b = await launch({ geo: { lat: 47.6205, lng: -122.3493 } });
const pinAt = (name) => b.ev(`(()=>{const e=[...document.querySelectorAll('.rm-pin')].find(x=>/${name}/i.test(x.textContent)); if(!e) return null; const r=e.getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2};})()`);
try {
  await b.grantGeo('http://localhost:5173');
  await b.goto('http://localhost:5173/?q=Seattle&look=pipboy', 9000);
  await b.ev('window.__wlmap.setCenter({lat:47.6205,lng:-122.3493}); window.__wlmap.setZoom(16);'); await sleep(6000);
  await maskPrivate(b);
  await b.start('B');
  await sleep(900);
  // the Space Needle is free for everyone: its snapshot comes apart on the spot
  let p = await pinAt('space needle');
  await b.tap(p.x, p.y); await sleep(1500);
  await b.clickText('view', { tag: 'button' }); await sleep(1800);
  await b.clickText('snapshot', { tag: '.rm-modal-tabs button' }); await sleep(9000);
  await b.clickText('close', { tag: 'button' }); await sleep(700);
  // a sealed one: unlock it for caps and watch it come apart
  await b.ev('window.__wlmap.panTo({lat:47.6044,lng:-122.3304}); window.__wlmap.setZoom(16);'); await sleep(2600);
  p = await pinAt('columbia center');
  await b.tap(p.x, p.y); await sleep(1300);
  await b.clickText('view', { tag: 'button' }); await sleep(1500);
  await b.clickText('snapshot', { tag: '.rm-modal-tabs button' }); await sleep(1700);
  await b.clickText('unlock for', { tag: 'button' }); await sleep(1500);
  const confirm = await b.ev("(()=>{const e=[...document.querySelectorAll('.rm-confirm button')].find(x=>/^unlock/i.test(x.textContent.trim())); if(!e) return null; const r=e.getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2};})()");
  if (confirm) { await b.tap(confirm.x, confirm.y); }
  await sleep(11000);
  await b.stop(out, { maxSec: 28.5 });
} finally { b.close(); }
