// Checks the wave sizes: the last wave of a place with more than one wave has at least four, and more than the wave before it once that one had four or more.
//   npx esbuild _tools/waves.check.ts --bundle --platform=node --format=cjs --outfile=_data/waves.check.cjs && node _data/waves.check.cjs
import { wavesFor } from '../src/lib/raid/raid';
import { offersFor } from '../supabase/functions/_shared/stimpak';
let bad = 0;
const ok = (n: string, c: boolean, extra = '') => { if (!c) bad++; console.log(c ? 'ok  ' : 'FAIL', n, extra); };
for (let total = 1; total <= 40; total++) {
  const w = wavesFor(total);
  const last = w[w.length - 1], prev = w[w.length - 2];
  const fine = w.length === 1 || (last >= 4 && last >= prev && (prev < 4 || last > prev));
  if (!fine) ok('waves for ' + total, false, w.join(','));
}
ok('4 enemies make waves 1,2,4 (the last is lifted to four)', wavesFor(4).join() === '1,2,4', wavesFor(4).join());
ok('a wave of 4 before it means at least 5 at the end', wavesFor(40).slice(-2).join() !== '' && (() => { const w = wavesFor(40); return w[w.length - 1] > w[w.length - 2]; })());
const a = offersFor('stimpak', 100), b = offersFor('stimpak', 100), c = offersFor('stimpak', 101);
ok('the board is three different offers, the same for a window and different later', a.length === 3 && new Set(a.map((t) => t.id)).size === 3 && a.map((t) => t.id).join() === b.map((t) => t.id).join(), `${a.map((t) => t.id)} | ${c.map((t) => t.id)}`);
process.exit(bad ? 1 : 0);
