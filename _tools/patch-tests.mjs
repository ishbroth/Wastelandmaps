import fs from 'fs';

// ---- the fake Google gets a route line, setCenter, and a fake Wikimedia Commons ----
let m = fs.readFileSync('_tools/mock-google.js', 'utf8');
const rm = (a, b) => { if (!m.includes(a)) throw new Error('mock missing: ' + a.slice(0, 60)); m = m.replace(a, () => b); };
rm("    panTo(p) {", "    setCenter(p) { this.center = p; this.redraw(); }\n    panTo(p) {");
rm("  class Circle {", `  class Polyline { constructor(o) { this.o = o; this.removed = false; (window.__polylines ||= []).push(this); } setMap(map) { if (!map) this.removed = true; } }
  class Circle {`);
rm("OverlayView, Circle, importLibrary", "OverlayView, Circle, Polyline, importLibrary");
rm("  // when the app asks for the Google script", `  // a fake photo archive: only Boston Common has a free photo
  const realFetch = window.fetch.bind(window);
  window.fetch = (input, init) => {
    const url = typeof input === 'string' ? input : input.url;
    if (/commons\\.wikimedia\\.org/.test(url)) {
      const [lat, lng] = new URL(url).searchParams.get('ggscoord').split('|').map(Number);
      window.__commonsCalls = (window.__commonsCalls || 0) + 1;
      if (Math.abs(lat - 42.362) < 0.0005 && Math.abs(lng + 71.056) < 0.0005) {
        const c = document.createElement('canvas'); c.width = 1000; c.height = 600;
        const g = c.getContext('2d'); const grad = g.createLinearGradient(0, 0, 1000, 600); grad.addColorStop(0, '#88a'); grad.addColorStop(0.5, '#ccd'); grad.addColorStop(1, '#443'); g.fillStyle = grad; g.fillRect(0, 0, 1000, 600);
        for (let i = 0; i < 40; i++) { g.fillStyle = 'rgb(' + (i * 6) + ',' + (255 - i * 5) + ',' + (i * 3) + ')'; g.fillRect(i * 25, 100 + (i % 7) * 40, 20, 200); }
        const body = { query: { pages: { 1: { title: 'File:Boston Common.jpg', imageinfo: [{ thumburl: c.toDataURL('image/png'), descriptionurl: 'https://commons.wikimedia.org/wiki/File:Boston_Common.jpg', mime: 'image/png', thumbwidth: 1000, extmetadata: { LicenseShortName: { value: 'CC BY-SA 4.0' }, Artist: { value: '<a href="x">Jane Photo</a>' } } }] } } } };
        return Promise.resolve(new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } }));
      }
      return Promise.resolve(new Response(JSON.stringify({ batchcomplete: '' }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    }
    return realFetch(input, init);
  };
  // when the app asks for the Google script`);
fs.writeFileSync('_tools/mock-google.js', m);

// ---- the browser checks ----
let s = fs.readFileSync('_tools/smoke.mjs', 'utf8');
const marker = '// small screen';
if (!s.includes(marker)) throw new Error('smoke marker');
const section = `// ---- fast travel, scenes and snapshots ----
await send('Page.navigate', { url: BASE + '?q=Boston&look=pipboy' });
await waitFor("document.querySelectorAll('.rm-row').length > 0");
check('you start at the vault: the clock reads day 1, 08:00 and RADS 0', /DAY 1\\s+08:00/.test(await ev("document.querySelector('.rm-stats').textContent")) && /RADS 0/.test(await ev("document.querySelector('.rm-stats').textContent")), await ev("document.querySelector('.rm-stats').textContent"));
check('only the vault is found so far', /1\\/13 FOUND/.test(await ev("document.querySelector('.rm-stats').textContent")), await ev("document.querySelector('.rm-stats').textContent"));
check('your marker is on the map', (await ev("document.querySelectorAll('.rm-player').length")) === 1);

await ev("[...document.querySelectorAll('.rm-row')].find(r=>/formerly Boston Common/.test(r.textContent)).click()");
await sleep(500);
check('choosing a place opens its card with the trip cost', (await ev("!!document.querySelector('.rm-card')")) === true && /MIN|HR/.test(await ev("document.querySelector('.rm-card-trip')?.textContent")), await ev("document.querySelector('.rm-card')?.textContent"));
check('the card offers FAST TRAVEL', (await ev("[...document.querySelectorAll('.rm-card .rm-btn')].some(b=>b.textContent==='FAST TRAVEL' && !b.disabled)")) === true);
await ev("[...document.querySelectorAll('.rm-card .rm-btn')].find(b=>b.textContent==='FAST TRAVEL').click()");
await sleep(300);
check('travelling shows the progress bar, draws the route, and locks the search box', (await ev("!!document.querySelector('.rm-traveling')")) === true && (await ev('(window.__polylines||[]).length')) === 1 && (await ev("document.querySelector('#rm-q').disabled")) === true);
await waitFor("!!document.querySelector('.rm-modal')", 9000);
check('arriving shows LOCATION DISCOVERED', /LOCATION DISCOVERED/.test(await ev("document.querySelector('.rm-toast')?.textContent")), await ev("document.querySelector('.rm-toast')?.textContent"));
check('the route line is removed and the search box is free again', (await ev('window.__polylines[0].removed')) === true && (await ev("document.querySelector('#rm-q').disabled")) === false);
const clock1 = await ev("document.querySelector('.rm-stats').textContent");
check('the trip took time on the clock and the place counts as found', !/DAY 1\\s+08:00/.test(clock1) && /2\\/13 FOUND/.test(clock1), clock1);
check('the status line reports the arrival with a bit of travel flavor', /ARRIVED AT/.test(await ev("document.querySelector('.rm-status span').textContent")), await ev("document.querySelector('.rm-status span').textContent"));
check('arriving opens the scene viewer for the place', (await ev("document.querySelector('.rm-modal h2')?.textContent")) !== null && /Formerly Boston Common/.test(await ev("document.querySelector('.rm-modal-text')?.textContent")), await ev("document.querySelector('.rm-modal-text')?.textContent"));
await sleep(700);
const variety = "(()=>{const c=document.querySelector('.rm-modal-canvas');const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;const set=new Set();for(let i=0;i<d.length;i+=4*97)set.add((d[i]>>3)+','+(d[i+1]>>3)+','+(d[i+2]>>3));return set.size})()";
check('the drawn scene is a real picture (many tones, not a blank canvas)', (await ev(variety)) > 40, String(await ev(variety)));
await waitFor("!document.querySelectorAll('.rm-modal-tabs button')[1].disabled", 4000);
check('a free photo was found, so the SNAPSHOT tab is on', (await ev("document.querySelectorAll('.rm-modal-tabs button')[1].textContent")) === 'SNAPSHOT');
await ev("document.querySelectorAll('.rm-modal-tabs button')[1].click()");
await sleep(900);
check('the snapshot is drawn in the wasteland look', (await ev(variety)) > 15, String(await ev(variety)));
const credit = await ev("document.querySelector('.rm-modal-credit')?.textContent");
check('the photographer, license and Wikimedia Commons are credited', /Jane Photo/.test(credit) && /CC BY-SA/.test(credit) && /Wikimedia Commons/.test(credit), credit);
const greenCheck = await ev("(()=>{const c=document.querySelector('.rm-modal-canvas');const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let g=0,r=0;for(let i=0;i<d.length;i+=4*50){g+=d[i+1];r+=d[i];}return g>r*1.5})()");
check('the Pip-Boy snapshot is green', greenCheck === true);
await ev("window.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'}))");
await sleep(300);
check('Escape closes the viewer', (await ev("!document.querySelector('.rm-modal')")) === true);
check('the visited place is ticked on the map and in the list', (await ev("document.querySelectorAll('.rm-pin-visited').length")) >= 1 && (await ev("[...document.querySelectorAll('.rm-row b')].some(b=>b.textContent.includes('✓'))")) === true);

// a place with no photo
await ev("document.querySelectorAll('.rm-row')[2].click()");
await sleep(300);
await ev("[...document.querySelectorAll('.rm-card .rm-btn')].find(b=>b.textContent==='VIEW').click()");
await waitFor("!!document.querySelector('.rm-modal')");
await sleep(900);
check('a place nobody photographed keeps the drawn scene and says so', (await ev("document.querySelectorAll('.rm-modal-tabs button')[1].textContent")) === 'NO SNAPSHOT' && (await ev("document.querySelectorAll('.rm-modal-tabs button')[1].disabled")) === true);
await ev("document.querySelector('.rm-modal-head .rm-btn').click()");
await sleep(200);

// the vault is somewhere you can go too
await ev("document.querySelector('.rm-pin-vault').click()");
await sleep(300);
check('the vault opens a card like any other place', /VAULT \\d{3}/.test(await ev("document.querySelector('.rm-card-title b')?.textContent")), await ev("document.querySelector('.rm-card')?.textContent"));
await ev("[...document.querySelectorAll('.rm-card .rm-btn')].find(b=>b.textContent==='FAST TRAVEL').click()");
await waitFor("!!document.querySelector('.rm-modal')", 9000);
check('travelling home shows the vault door scene, and the clock moved on again', /VAULT \\d{3}/.test(await ev("document.querySelector('.rm-modal h2')?.textContent")) && (await ev("document.querySelector('.rm-stats').textContent")) !== clock1);
check('there is no photo search for the made-up vault', (await ev("document.querySelectorAll('.rm-modal-tabs button')[1].textContent")) === 'NO SNAPSHOT', await ev("document.querySelectorAll('.rm-modal-tabs button')[1].textContent"));
await ev("document.querySelector('.rm-modal-head .rm-btn').click()");
await sleep(200);

`;
s = s.replace(marker, section + marker);
fs.writeFileSync('_tools/smoke.mjs', s);
console.log('patched');
