// Shared bits for the App Store clips: keeping the account's private details off camera, and scrolling the page back to the top.
import { sleep } from './harness.mjs';

/** Replaces the signed-in email and the home address (and the neighbours' addresses) with made-up ones, now and whenever the page changes. */
export async function maskPrivate(b) {
  await b.ev(`(()=>{
    if (window.__masked) return; window.__masked = true;
    const rules = [[/http:[/][/]localhost:5173/g, 'https://wastelandmaps.com'], [/[A-Za-z0-9._+-]+@[A-Za-z0-9-]+[.][A-Za-z.]+/g, 'survivor@vault.net'], [/Polaris Dr/gi, 'Maple Ave'], [/La Mesa, CA 91941, USA/gi, 'Springfield'], [/(San Diego|La Mesa), CA/gi, 'Springfield']];
    const fix = (root) => { const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT); let n; while ((n = w.nextNode())) { let t = n.nodeValue; let u = t; for (const [re, to] of rules) u = u.replace(re, to); if (u !== t) n.nodeValue = u; } };
    fix(document.body);
    setInterval(() => document.querySelectorAll('input').forEach((i) => { if (/localhost:5173/.test(i.value)) i.value = i.value.replace(/http:[/][/]localhost:5173/g, 'https://wastelandmaps.com'); }), 250);
    new MutationObserver(() => fix(document.body)).observe(document.body, { childList: true, subtree: true, characterData: true });
  })()`);
}

/** Back to the top of the page (the title scrolled into view). */
export async function toTop(b) {
  await b.ev("document.querySelector('h1')?.scrollIntoView({ block: 'start' })");
  await sleep(400);
}

/** The panels scrolled up the page with a finger: a swipe from y1 to y2. */
export async function swipe(b, ms = 800, y1 = 840, y2 = 420) {
  await b.drag(220, y1, 220, y2, ms);
  await sleep(300);
}
