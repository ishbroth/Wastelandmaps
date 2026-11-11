// Checks the stairwell rules: a gap between two rooms takes a stairwell (and offers a choice of rooms), the edge allows only a U, and each level takes two down and two up.
//   npx esbuild _tools/stairs.check.ts --bundle --platform=node --format=cjs --outfile=_data/stairs.check.cjs && node _data/stairs.check.cjs
import { newVault, whyNotBuild, applyBuild, applyDemolish, whyNotDemolish, stairOptions, ENTRY_AT, type VaultHome, type VaultRoom } from '../src/lib/vaultHome';

let bad = 0;
const ok = (name: string, cond: boolean) => { if (!cond) bad++; console.log(cond ? 'ok  ' : 'FAIL', name); };
const room = (type: VaultRoom['type'], level: number, col: number, row: number): VaultRoom => ({ type, level, col, row, furniture: [] });
const { col: ec, row: er } = ENTRY_AT;
// the entryway, a decontamination shower in it, and two rooms with a one-cell gap between them (a bedroom to the left, a kitchen to the right) on level 0
const base: VaultHome = { ...newVault(0, 1), rooms: [{ ...room('entry', 0, ec, er), furniture: ['decon'] }, room('living', 0, ec + 1, er), room('kitchen', 0, ec + 3, er), room('bedroom', 0, ec + 1, er + 1), room('bedroom', 0, ec + 2, er + 1), room('bedroom', 0, ec + 3, er + 1)] };
ok('the gap between two rooms offers a stairwell', whyNotBuild(base, 'stairs', 0, ec + 2, er) === null);
ok('the gap offers a choice of rooms to open onto (straight, down)', stairOptions(base, 0, ec + 2, er, 'down', 'straight').length > 1);
ok('building there with a chosen side works', (applyBuild(base, 'stairs', 0, ec + 2, er, 0, 'down', 'straight', 'l') as { ok: boolean }).ok);
// the edge: a room at the left edge column, a stairwell beside it can only be a U
const edge: VaultHome = { ...base, rooms: [...base.rooms, room('living', 0, 1, er), room('kitchen', 0, 2, er), room('bedroom', 0, 3, er), room('bedroom', 0, 4, er)] };
const atEdge = { ...edge, rooms: [...edge.rooms.filter((r) => r.col !== 1 || r.row !== er), room('bathroom', 0, 1, er)] };
ok('straight is refused facing the edge but U is allowed', whyNotBuild(atEdge, 'stairs', 0, 0, er, 'down', 'straight') !== null && whyNotBuild(atEdge, 'stairs', 0, 0, er, 'down', 'u') === null);
ok('the stairwell option is still open at the edge', whyNotBuild(atEdge, 'stairs', 0, 0, er) === null);
// two down from a level, then a third is refused
let v = base;
const first = applyBuild(v, 'stairs', 0, ec + 2, er, 0, 'down', 'straight', 'l'); if (first.ok) v = first.vault;
const second = applyBuild(v, 'stairs', 0, ec + 1, er - 1, 0, 'down', 'u'); if (second.ok) v = second.vault;
ok('a second stairwell down from level 0 is allowed', second.ok);
ok('a third stairwell down from level 0 is refused', whyNotBuild(v, 'stairs', 0, ec + 3, er - 1, 'down', 'u') !== null);
// demolishing from either level: a stairwell with a room built onto its far end cannot go until that room does; then it goes from the lower level too
{
  const s1 = applyBuild(base, 'stairs', 0, ec + 2, er, 0, 'down', 'straight', 'l');
  if (!s1.ok) throw new Error('setup');
  let w = s1.vault;
  const lower = w.rooms.findIndex((r) => r.type === 'stairs' && r.level === 1);
  ok('with nothing built onto it, the lower end can be demolished', whyNotDemolish(w, lower) === null);
  const bed = applyBuild(w, 'bedroom', 1, ec + 3, er, 0);
  if (bed.ok) w = bed.vault;
  ok('a room built onto the lower end is in the way', bed.ok && whyNotDemolish(w, w.rooms.findIndex((r) => r.type === 'stairs' && r.level === 1)) !== null);
  const upper = w.rooms.findIndex((r) => r.type === 'stairs' && r.level === 0);
  ok('and the upper end cannot go either', whyNotDemolish(w, upper) !== null);
  const bedIdx = w.rooms.findIndex((r) => r.type === 'bedroom' && r.level === 1);
  const d1 = applyDemolish(w, bedIdx, 0);
  if (d1.ok) w = d1.vault;
  const d2 = applyDemolish(w, w.rooms.findIndex((r) => r.type === 'stairs' && r.level === 1), 0);
  ok('once the room is gone the stairwell goes from the lower level, both ends', d2.ok && !d2.vault.rooms.some((r) => r.type === 'stairs' && r.col === ec + 2 && r.row === er));
}
process.exit(bad ? 1 : 0);
