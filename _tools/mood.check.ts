// Checks that when crowded settlers leave, happiness starts at its lowest and then climbs back to what the rooms give.
//   npx esbuild _tools/mood.check.ts --bundle --platform=node --format=cjs --outfile=_data/mood.check.cjs && node _data/mood.check.cjs
import { newVault, neglectAt, moodAt, baselineOf, floorOf, LEAVE_AFTER_MS, VISIT_MS, type VaultHome } from '../src/lib/vaultHome';

let bad = 0;
const ok = (name: string, cond: boolean) => { if (!cond) bad++; console.log(cond ? 'ok  ' : 'FAIL', name); };
const t0 = 1_000_000_000_000;
// a vault with two settlers and no rooms to give them (rooms were demolished): crowded since long ago, last seen then
const v: VaultHome = { ...newVault(t0, 1), settlers: [{ id: 1, kind: 'male' }, { id: 2, kind: 'female' }] as VaultHome['settlers'], from: 80, sessionAt: t0, seenAt: t0 + 3 * VISIT_MS };
const later = t0 + 3 * LEAVE_AFTER_MS;
const n = neglectAt(v, later);
ok('crowded settlers leave after a day at the lowest', n.left.length === 2 && n.vault.settlers.length === 0);
const m0 = moodAt(n.vault, later);
ok('happiness is at its lowest the moment they go', m0.value === floorOf(n.vault));
const m1 = moodAt({ ...n.vault, seenAt: later + VISIT_MS / 2 }, later + VISIT_MS / 2);
ok('it is climbing a little later', m1.value > m0.value && m1.trend === 'up');
const m2 = moodAt({ ...n.vault, seenAt: later + VISIT_MS }, later + VISIT_MS);
ok('and gets back to what the rooms give', m2.value === baselineOf(n.vault));
process.exit(bad ? 1 : 0);
