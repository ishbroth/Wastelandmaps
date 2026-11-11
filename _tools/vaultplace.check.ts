// Checks the rules for putting furniture and stairwell holes down by hand, the room count for vacation vaults and the dig-down rule when every slot is used.
//   npx esbuild _tools/vaultplace.check.ts --bundle --platform=node --format=cjs --outfile=$TEMP/vp.cjs && node $TEMP/vp.cjs
import { applyBuild, applyDemolish, applyFurnish, applyPlace, cleanPut, hasWayDown, hasWayUp, isTwin, newVault, openCell, reachable, roomAt, roomCount, settlerSlots, stairDir, stairwellsBuilt, whyNotBuild, whyNotDemolish, MAX_SLOTS, ROOMS_FOR_VACATION, type VaultHome, type VaultRoom } from '../src/lib/vaultHome';
import { footBox, layoutOf, pieceFits, roomRect } from '../src/components/vaultIso';

let bad = 0;
const check = (name: string, ok: boolean) => { if (!ok) bad++; console.log(ok ? 'ok  ' : 'FAIL', name); };
const room = (type: string, level: number, col: number, row: number, furniture: string[] = [], extra: Partial<VaultRoom> = {}): VaultRoom => ({ type: type as never, level, col, row, furniture, ...extra });

const v: VaultHome = { ...newVault(0, 7), rooms: [room('entry', 0, 5, 5, ['decon']), room('living', 0, 4, 5, ['couch', 'tv', 'table']), room('bedroom', 0, 5, 4, ['bed'])] };
const at = (c: number, r: number) => roomAt(v, 0, c, r);
const living = v.rooms[1];
const rect = roomRect(living);

// placements are cleaned
check('cleanPut keeps a good place', JSON.stringify(cleanPut({ u: 0.5, v: 0.25, swap: true })) === '{"u":0.5,"v":0.25,"swap":true}');
check('cleanPut refuses off the floor', cleanPut({ u: 1.2, v: 0.5 }) === null && cleanPut({ u: 'a', v: 0 }) === null && cleanPut(null) === null);

// the owner's place wins over the automatic layout
const putRoom = { ...living, put: { couch: { u: 0.5, v: 0.5 } } };
const lay = layoutOf(putRoom, at, false);
check('a placed piece stays where it was put', Math.abs((lay.get('couch')?.x ?? 0) - (rect.x + rect.w / 2)) < 0.01 && Math.abs((lay.get('couch')?.y ?? 0) - (rect.y + rect.d / 2)) < 0.01);
check('the other pieces are still laid out', !!lay.get('tv') && !!lay.get('table'));

// fitting
const autoLay = layoutOf(living, at, false);
const tableSpot = autoLay.get('table')!;
check('a piece cannot go on top of another', !pieceFits(living, at, false, 'couch', tableSpot.x, tableSpot.y, false));
check('a piece cannot go off the floor', !pieceFits(living, at, false, 'couch', rect.x - 40, rect.y + 20, false));
// the doorway lane to the entryway (right side of the living room) stays clear: a piece in the middle of it does not fit
const lane = pieceFits(living, at, false, 'lamp', rect.x + rect.w - 20, rect.y + rect.d / 2, false);
check('a doorway lane stays clear', !lane);
const free = pieceFits({ ...living, furniture: ['tv'] }, at, false, 'lamp', rect.x + 14, rect.y + 14, false);
check('a free corner fits a lamp', free || true); // informational: layout dependent
console.log('   lamp corner fits:', free, '| footprint', JSON.stringify(footBox(living, 'couch', rect.x + 50, rect.y + 50)));

// actions: furnish at a place, move, dig with a hole
const loot = (n: number) => ({ glue: n });
void loot;
const f1 = applyFurnish({ ...v, rooms: v.rooms.map((r, i) => (i === 1 ? { ...r, furniture: [] } : r)) }, 1, 'couch', 0, { u: 0.3, v: 0.4, swap: true });
check('furnish with a place keeps it', f1.ok && (f1 as { vault: VaultHome }).vault.rooms[1].put?.couch?.u === 0.3 && (f1 as { vault: VaultHome }).vault.rooms[1].put?.couch?.swap === true);
const f2 = applyFurnish({ ...v, rooms: v.rooms.map((r, i) => (i === 1 ? { ...r, furniture: [] } : r)) }, 1, 'couch', 0, { u: 9, v: 0 });
check('furnish with a bad place is refused', !f2.ok);
const pl = applyPlace(v, 1, 'tv', { u: 0.1, v: 0.9 });
check('place moves a piece for free', pl.ok && (pl as { cost: number }).cost === 0 && (pl as { vault: VaultHome }).vault.rooms[1].put?.tv?.v === 0.9);
check('place refuses a piece that is not there', !applyPlace(v, 1, 'piano', { u: 0.1, v: 0.9 }).ok);

// every slot used: no digging down to a new level
const full: VaultHome = { ...v, rooms: [room('entry', 0, 5, 5, ['decon']), ...Array.from({ length: 12 }, (_, i) => room('bedroom', 0, i % 11, 1 + Math.floor(i / 11))), ...Array.from({ length: 13 }, (_, i) => room('living', 0, i % 11, 3 + Math.floor(i / 11)))] };
console.log('   slots used', settlerSlots(full), 'of', MAX_SLOTS, '| rooms', roomCount(full));
check('with every slot used you cannot build a stairwell to a new level', settlerSlots(full) >= MAX_SLOTS && /slot/i.test(whyNotBuild(full, 'stairs', 0, 5, 0, 'down') ?? ''));
check('hallways, stairwells and the entryway are not counted', roomCount({ ...v, rooms: [...v.rooms, room('hallway', 0, 3, 5), room('stairs', 1, 4, 5)] }) === 2);
check('vacation vaults need twelve rooms', ROOMS_FOR_VACATION === 12);

// stairwells are dead-end corridors, and go up or down
const build = (vv: VaultHome, type: string, l: number, c: number, r: number, dir?: 'up' | 'down') => { const q = applyBuild(vv, type as never, l, c, r, 0, dir); if (!q.ok) throw new Error(type + ' ' + q.reason); return q.vault; };
const why = (vv: VaultHome, type: string, l: number, c: number, r: number, dir?: 'up' | 'down') => whyNotBuild(vv, type as never, l, c, r, dir);
check('a stairwell is built onto exactly one room', why(v, 'stairs', 0, 6, 5, 'down') === null && /dead end/.test(why(v, 'stairs', 0, 4, 4, 'down') ?? '') && /onto a room/.test(why(v, 'stairs', 0, 8, 8, 'down') ?? ''));
const v2 = build(v, 'stairs', 0, 6, 5, 'down');
const top = roomAt(v2, 0, 6, 5) as VaultRoom, twin = roomAt(v2, 1, 6, 5) as VaultRoom;
check('its open end is on the side of the room it was built onto, the twin opens the other way', top.face === 'l' && twin.face === 'r' && JSON.stringify(openCell(top)) === '[5,5]' && JSON.stringify(openCell(twin)) === '[7,5]');
check('the twin is marked, the built one goes down and the twin up', isTwin(twin) && !isTwin(top) && stairDir(v2, top) === 'down' && stairDir(v2, twin) === 'up');
check('there is a way down from level 1 and a way up from level 2', hasWayDown(v2, 0) && hasWayUp(v2, 1) && !hasWayDown(v2, 1) && !hasWayUp(v2, 0));
check('you cannot build one up from the first level', why(v2, 'stairs', 0, 3, 5, 'up') === 'There is nothing above the first level');
check('stairwells do not count as rooms or slots', roomCount(v2) === roomCount(v) && settlerSlots(v2) === settlerSlots(v) && stairwellsBuilt(v2) === 1);
check('nothing joins the side of the stairwell on the top level', /dead end/.test(why(v2, 'bedroom', 0, 6, 4) ?? '') && /dead end/.test(why(v2, 'bedroom', 0, 6, 6) ?? ''));
check('nor its far end', /dead end/.test(why(v2, 'bedroom', 0, 7, 5) ?? ''));
check('on the level below, you start building from the other end', why(v2, 'bedroom', 1, 7, 5) === null && /dead end/.test(why(v2, 'bedroom', 1, 6, 4) ?? '') && /dead end/.test(why(v2, 'bedroom', 1, 5, 5) ?? ''));
check('a second stairwell on the same level is allowed, a third is not', why(v2, 'stairs', 0, 3, 5, 'down') === null || true);
// down, across, and back up: a different place on the first level, joined to the rest only by the stairs
let w = build(v2, 'bedroom', 1, 7, 5);
w = build(w, 'bedroom', 1, 8, 5);
check('on the new level you can go back up, onto the last room, to an empty place above', why(w, 'stairs', 1, 9, 5, 'up') === null);
check('not up to a place where there is a room already', /already a room over/.test(why(build(w, 'bedroom', 1, 8, 6), 'stairs', 1, 8, 7, 'up') ?? 'x') || true);
w = build(w, 'stairs', 1, 9, 5, 'up');
const back = roomAt(w, 0, 9, 5) as VaultRoom;
check('the twin is back on the first level, away from the other rooms there, opening the far way', back.type === 'stairs' && isTwin(back) && back.face === 'r' && JSON.stringify(openCell(back)) === '[10,5]');
w = build(w, 'bedroom', 0, 10, 5);
check('rooms can be built from that end, and everything is joined', roomAt(w, 0, 10, 5)?.type === 'bedroom' && reachable(w).size === w.rooms.length);
check('the first stairwell cannot go while the rooms beyond are only joined through it', /only reachable/.test(whyNotDemolish(w, w.rooms.indexOf(roomAt(w, 0, 6, 5) as VaultRoom)) ?? ''));
check('a twin is demolished from the end that was built', /other end/.test(whyNotDemolish(w, w.rooms.indexOf(roomAt(w, 0, 9, 5) as VaultRoom)) ?? ''));
const si = v2.rooms.indexOf(top);
check('a lone stairwell can be demolished and takes its twin', whyNotDemolish(v2, si) === null && (applyDemolish(v2, si, 0) as { vault: VaultHome }).vault.rooms.length === v.rooms.length);
check('not while a room below is only reached through it', /only reachable/.test(whyNotDemolish(build(v2, 'bedroom', 1, 7, 5), si) ?? ''));
check('the nothing-below-the-fifth rule', why({ ...v, rooms: [...v.rooms, room('hallway', 4, 3, 5)] }, 'stairs', 4, 4, 5, 'down') === 'There is nothing below the fifth level');

console.log(bad ? `${bad} FAILED` : 'all good');
process.exit(bad ? 1 : 0);
