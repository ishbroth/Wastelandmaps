const fs = require('fs');
const edit = (p, fn) => { const raw = fs.readFileSync(p, 'utf8'); const crlf = raw.includes('\r\n'); const s = fn(raw.replace(/\r\n/g, '\n')); fs.writeFileSync(p, crlf ? s.replace(/\n/g, '\r\n') : s); };
const rep = (s, a, b, l) => { if (!s.includes(a)) throw new Error('missing: ' + l); return s.replace(a, () => b); };

// the stand-by screen stays up for at least two seconds from the start of the app
edit('src/lib/native.ts', (s) => {
  s = rep(s, "  try { await SplashScreen.hide({ fadeOutDuration: 250 }); } catch { /* already hidden */ }", "  // the stand-by screen plays for two seconds from the moment the app starts, however fast the page was\n  const shown = typeof performance !== 'undefined' ? performance.now() : 0;\n  if (shown < SPLASH_MS) await new Promise((r) => window.setTimeout(r, SPLASH_MS - shown));\n  try { await SplashScreen.hide({ fadeOutDuration: 250 }); } catch { /* already hidden */ }", 'hide');
  s = rep(s, "/** The app's first moments:", "/** How long the stand-by splash screen stays up at the least. */\nconst SPLASH_MS = 2000;\n\n/** The app's first moments:", 'const');
  return s;
});

fs.writeFileSync('src/components/CogSpinner.tsx', String.raw`/** A small spinning vault cogwheel: the loading mark for anything being developed, loaded or rendered. It takes the colour of the text around it. */
const TEETH = 8;
const point = (r: number, deg: number): string => {
  const t = ((deg - 90) * Math.PI) / 180;
  return (12 + Math.cos(t) * r).toFixed(2) + ' ' + (12 + Math.sin(t) * r).toFixed(2);
};
const GEAR = (() => {
  let d = '';
  for (let i = 0; i < TEETH; i++) {
    const mid = (i * 360) / TEETH;
    d += (d ? 'L' : 'M') + point(8.4, mid - 13) + 'L' + point(11, mid - 5.2) + 'L' + point(11, mid + 5.2) + 'L' + point(8.4, mid + 13);
    d += 'A8.4 8.4 0 0 1 ' + point(8.4, mid + 360 / TEETH - 13);
  }
  return d + 'Z';
})();
// the round window in the middle, cut out
const HOLE = 'M12 6.3a5.7 5.7 0 1 0 0 11.4 5.7 5.7 0 0 0 0-11.4Z';

export default function CogSpinner({ big = false, label = 'Loading' }: { big?: boolean; label?: string }) {
  return (
    <svg className={'rm-cog' + (big ? ' rm-cog-big' : '')} viewBox="0 0 24 24" role="img" aria-label={label}>
      <path d={GEAR + HOLE} fill="currentColor" fillRule="evenodd" />
    </svg>
  );
}
`);

edit('src/components/SceneModal.tsx', (s) => {
  s = rep(s, '<button type="button" className="rm-btn" disabled>DEVELOPING… ABOUT 20 SECONDS</button>', '<button type="button" className="rm-btn" disabled><CogSpinner /> DEVELOPING… ABOUT 20 SECONDS</button>', 'developing');
  s = rep(s, "import Caps from './Caps';", "import Caps from './Caps';\nimport CogSpinner from './CogSpinner';", 'imp');
  return s;
});

edit('src/components/BlowApart.tsx', (s) => {
  s = rep(s, "import ScrollRow from './ScrollRow';", "import ScrollRow from './ScrollRow';\nimport CogSpinner from './CogSpinner';", 'imp');
  // the picture, with the cog over it while it loads or the replay is being made ready
  s = rep(s, "      {state === 'plain'\n        ? <img", "      <div className=\"rm-render-wrap\">\n      {state === 'plain'\n        ? <img", 'wrap open');
  s = rep(s, "      {big && (\n        <div className=\"rm-lightbox\"", "      {state === 'loading' && <div className=\"rm-render-loading\" role=\"status\"><CogSpinner big label=\"Loading the picture\" /><span>LOADING…</span></div>}\n      </div>\n      {big && (\n        <div className=\"rm-lightbox\"", 'wrap close');
  s = rep(s, "{recording ? 'RECORDING…' : 'SAVE VIDEO'}", "{recording ? <><CogSpinner /> RECORDING…</> : 'SAVE VIDEO'}", 'recording');
  return s;
});

fs.appendFileSync('src/index.css', `
/* the spinning vault cogwheel: shown wherever a picture is being developed, loaded or recorded */
.rm-cog { display: inline-block; width: 1.15em; height: 1.15em; vertical-align: -0.2em; margin-right: 0.35em; animation: rm-cog-spin 1.6s linear infinite; filter: drop-shadow(0 0 4px var(--glow)); }
.rm-cog-big { width: 64px; height: 64px; margin: 0; }
@keyframes rm-cog-spin { to { transform: rotate(360deg); } }
.rm-render-wrap { position: relative; }
.rm-render-loading { position: absolute; inset: 0; z-index: 3; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; background: color-mix(in srgb, var(--panel) 72%, transparent); color: var(--ink); font-family: var(--font-display); letter-spacing: 3px; font-size: 20px; text-shadow: 0 0 8px var(--glow); pointer-events: none; }
@media (prefers-reduced-motion: reduce) { .rm-cog { animation-duration: 4s; } }
`);
console.log('ok');
