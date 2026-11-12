// Checks that settlers walk only where there is a way: two areas on one level that do not touch are joined only by going down a stairwell and back up another.
//   npx esbuild _tools/route.check.ts --bundle --platform=node --format=cjs --jsx=automatic --external:sharp --outfile=_data/route.check.cjs && node _data/route.check.cjs
import { newVault, type VaultHome, type VaultRoom } from '../src/lib/vaultHome';
import { walkTo, freePoint } from '../src/components/vaultSims';

let bad = 0;
const ok = (name: string, cond: boolean) => { if (!cond) bad++; console.log(cond ? 'ok  ' : 'FAIL', name); };
const room = (type: VaultRoom['type'], level: number, col: number, row: number, extra: Partial<VaultRoom> = {}): VaultRoom => ({ type, level, col, row, furniture: [], ...extra });

// level 0: entry, living, a stairwell down (opens to the living room) ... and, beyond a gap, a bedroom D that nothing on this level touches
// level 1: the other end of that stairwell (opens east), two rooms, and a stairwell up (opens west from the last room) whose other end is by D on level 0
const rooms: VaultRoom[] = [
  room('entry', 0, 2, 5), room('living', 0, 3, 5), room('stairs', 0, 4, 5, { face: 'l' }),
  room('stairs', 1, 4, 5, { face: 'r', twin: true }), room('bedroom', 1, 5, 5), room('bedroom', 1, 6, 5), room('stairs', 1, 7, 5, { face: 'l' }),
  room('stairs', 0, 7, 5, { face: 'r', twin: true }), room('bedroom', 0, 8, 5),
];
const v: VaultHome = { ...newVault(0, 1), rooms };
const living = rooms[1], far = rooms[8];
const a = freePoint(v, living), d = freePoint(v, far);

const path = walkTo(v, 0, a, 0, d);
ok('there is a way from the living room to the far bedroom, by the stairwells', path !== null);
const levels = (path ?? []).filter((p) => p.lv !== undefined).map((p) => p.lv);
ok('it goes down to level 1 and back up to level 0, in that order', levels.length === 2 && levels[0] === 1 && levels[1] === 0);

// the same vault with no way back up: the far bedroom cannot be walked to, across the empty ground or any other way
const without: VaultHome = { ...v, rooms: rooms.filter((r) => !(r.type === 'stairs' && r.col === 7)) };
ok('without the stairwell back up there is no way, and no straight line through the walls', walkTo(without, 0, a, 0, d) === null);
process.exit(bad ? 1 : 0);
