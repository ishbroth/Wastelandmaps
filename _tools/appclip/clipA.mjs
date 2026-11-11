// Clip A: looking around a few metros, navigating, an icon's info card, the list of locations, the Pip-Boy DATA tab and the share links.
//   node _tools/appclip/clipA.mjs <out.mp4>
import { launch, sleep } from './harness.mjs';
import { maskPrivate, toTop, swipe } from './scenes.mjs';
const out = process.argv[2] ?? process.env.TEMP + '/clipA.mp4';
const BASE = 'http://localhost:5173/';
const b = await launch({ geo: { lat: 42.3601, lng: -71.0589 } });
const tab = (name) => b.clickText(name, { tag: 'button, [role=tab]' });
try {
  await b.grantGeo('http://localhost:5173');
  await b.goto(BASE + '?q=Boston&look=pipboy', 11000);
  await maskPrivate(b);
  await b.start('A');
  await sleep(900);
  // look around the map with a finger
  await b.drag(330, 420, 150, 540, 800); await sleep(200);
  await b.drag(170, 600, 320, 400, 800); await sleep(200);
  await b.clickSel('button[aria-label="Zoom in"]'); await sleep(800);
  // tap an icon: its info card
  const pin = await b.ev("(()=>{const es=[...document.querySelectorAll('.rm-pin')].filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&r.y>150&&r.y<540&&r.x>40&&r.x<390;}); const e=es[Math.floor(es.length/2)]; if(!e) return null; const r=e.getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2};})()");
  if (pin) { await b.tap(pin.x, pin.y); await sleep(1800); }
  // other metros: the first chips on the TRY row
  await toTop(b);
  const chips = await b.ev("(()=>{const row=[...document.querySelectorAll('div,section')].find(d=>/^TRY/i.test((d.firstElementChild?.textContent||'').trim())&&d.querySelectorAll('button').length>3); return row?[...row.querySelectorAll('button')].filter(x=>{const r=x.getBoundingClientRect();return r.width>0&&r.right<420;}).map(x=>x.textContent.trim()):[];})()");
  console.log('chips', chips);
  if (chips[1]) { await b.clickText(chips[1], { tag: 'button' }); await sleep(3200); }
    if (chips[3]) { await b.clickText(chips[3], { tag: 'button' }); await sleep(3200); }
  // the locations list, scrolled
  await b.ev("document.querySelector('.rm-tabs, [role=tablist]')?.scrollIntoView({ block: 'start' })"); await sleep(500);
  await swipe(b, 800, 800, 380); await sleep(300);
  // your data on the Pip-Boy
  await toTop(b); await b.ev("document.querySelector('.rm-tabs, [role=tablist]')?.scrollIntoView({ block: 'start' })"); await sleep(300);
  await tab('data'); await sleep(1100);
  await swipe(b, 900, 800, 500); await sleep(500);
  // share links
  await toTop(b); await b.ev("document.querySelector('.rm-tabs, [role=tablist]')?.scrollIntoView({ block: 'start' })"); await sleep(300);
  await tab('share'); await sleep(1500);
  await b.stop(out, { maxSec: 28.5 });
} finally { b.close(); }
