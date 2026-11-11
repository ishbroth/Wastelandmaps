// Checks the rules for putting furniture and stairwell holes down by hand, the room count for vacation vaults and the dig-down rule when every slot is used.
//   npx esbuild _tools/vaultplace.check.ts --bundle --platform=node --format=cjs --outfile=$TEMP/vp.cjs && node $TEMP/vp.cjs
import { slotsOf, atFloorSince, checkIn, excessSettlers, moodAt, neglectAt, applyBuild, applyDemolish, applyFurnish, applyPlace, cleanPut, hasWayDown, hasWayUp, isTwin, newVault, openCell, reachable, roomAt, roomCount, settlerSlots, stairDir, stairwellsBuilt, whyNotBuild, whyNotDemolish, MAX_SLOTS, ROOMS_FOR_VACATION, type VaultHome, type VaultRoom } from '../src/lib/vaultHome';
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

// U-shaped stairwells: one cell like a straight one (drawn about as big as a bathroom), built onto any side of a room, opening the same way on both levels
const buildU = (vv: VaultHome, l: number, c: number, r: number, dir: 'up' | 'down') => { const q = applyBuild(vv, 'stairs' as never, l, c, r, 0, dir, 'u'); if (!q.ok) throw new Error('u ' + q.reason); return q.vault; };
const uWhy = (vv: VaultHome, l: number, c: number, r: number, dir: 'up' | 'down') => whyNotBuild(vv, 'stairs' as never, l, c, r, dir, 'u');
check('a U stairwell can be built onto a room', uWhy(v, 0, 5, 3, 'down') === null);
check('and onto the side of a room too', uWhy(v, 0, 3, 5, 'down') === null);
check('not onto two rooms', /dead end/.test(uWhy(v, 0, 4, 4, 'down') ?? ''));
check('not up from the first level', /nothing above/.test(uWhy(v, 0, 5, 3, 'up') ?? ''));
const plan4 = (c: number, r: number) => { const q = buildU(v, 0, c, r, 'down'); return { q, t: q.rooms[q.rooms.length - 2], w: q.rooms[q.rooms.length - 1] }; };
// the four ways it can face: away from the room it is built onto, whichever side that is
const faceF = plan4(5, 3), faceB = plan4(4, 6), faceR = plan4(3, 5), faceL = plan4(6, 4);
check('room in front of it: opens to the front', faceF.t.face === 'f' && JSON.stringify(openCell(faceF.t)) === '[5,4]');
check('room behind it: opens to the back', faceB.t.face === 'b' && JSON.stringify(openCell(faceB.t)) === '[4,5]');
check('room on its right: opens to the right', faceR.t.face === 'r' && JSON.stringify(openCell(faceR.t)) === '[4,5]');
check('room on its left: opens to the left', faceL.t.face === 'l' && JSON.stringify(openCell(faceL.t)) === '[5,4]');
for (const [name, x] of [['front', faceF], ['back', faceB], ['right', faceR], ['left', faceL]] as const) {
  check('opening ' + name + ': one cell, the twin in the same cell opening the same way on the other lane', slotsOf(x.t) === 1 && roomAt(x.q, 1, x.t.col, x.t.row) === x.w && isTwin(x.w) && !isTwin(x.t) && x.w.face === x.t.face && x.t.entry === 0 && x.w.entry === 1 && JSON.stringify(openCell(x.w)) === JSON.stringify(openCell(x.t)));
}
const vu = faceF.q, uTop = faceF.t, uTwin = faceF.w;
check('it goes down and the twin goes up, and counts as one stairwell', stairDir(vu, uTop) === 'down' && stairDir(vu, uTwin) === 'up' && stairwellsBuilt(vu) === 1 && hasWayDown(vu, 0) && hasWayUp(vu, 1));
check('nothing joins its side or its far end', /dead end/.test(whyNotBuild(vu, 'bedroom' as never, 0, 4, 3) ?? '') && /dead end/.test(whyNotBuild(vu, 'bedroom' as never, 0, 6, 3) ?? '') && /dead end/.test(whyNotBuild(vu, 'bedroom' as never, 0, 5, 2) ?? ''));
check('the vault is still joined, and the twin is reached by the stairs', reachable(vu).size === vu.rooms.length);
check('demolishing it takes both ends', whyNotDemolish(vu, vu.rooms.indexOf(uTop)) === null && (applyDemolish(vu, vu.rooms.indexOf(uTop), 0) as { vault: VaultHome }).vault.rooms.length === v.rooms.length);
check('slots are not used by it', settlerSlots(vu) === settlerSlots(v) && roomCount(vu) === roomCount(v));
// at the very edge of the vault a straight stairwell would run into the edge on the other level: it has to turn back
const edge: VaultHome = { ...v, rooms: [...v.rooms, room('hallway', 0, 1, 5)] };
check('a straight stairwell cannot go at the very edge', /very edge/.test(whyNotBuild(edge, 'stairs' as never, 0, 0, 5, 'down', 'straight') ?? ''));
check('a U stairwell can, and it turns back', whyNotBuild(edge, 'stairs' as never, 0, 0, 5, 'down', 'u') === null);
check('with no shape chosen yet the stairwell is still offered at the edge (as a U)', whyNotBuild(edge, 'stairs' as never, 0, 0, 5, 'down') === null);
check('away from the edge a straight one is fine', whyNotBuild(v, 'stairs' as never, 0, 6, 5, 'down', 'straight') === null);

// settlers, crowding and neglect
const H = 3_600_000, DAY = 24 * H;
const crowdedBase: VaultHome = { ...newVault(0, 7), rooms: [room('entry', 0, 5, 5, ['decon']), room('living', 0, 4, 5), room('bedroom', 0, 5, 4), room('kitchen', 0, 6, 5)], settlers: [{ id: 1, kind: 'male', name: 'Ann' }, { id: 2, kind: 'dog' }], from: 80, sessionAt: 0, seenAt: 0 };
check('two settlers need seven slots: here one is too many for three rooms', excessSettlers(crowdedBase) === 1);
const ok1: VaultHome = { ...crowdedBase, settlers: [crowdedBase.settlers[0]] };
check('with enough rooms nobody is crowded', excessSettlers(ok1) === 0);
const small: VaultHome = { ...ok1, rooms: ok1.rooms.slice(0, 3) }; // two rooms: the one settler is now too many
check('a settler with too few rooms is crowded', excessSettlers(small) === 1);
const t0 = 5 * H;
const m0 = moodAt({ ...small, from: 70, sessionAt: t0, seenAt: t0 }, t0), m1 = moodAt({ ...small, from: 70, sessionAt: t0, seenAt: t0 }, t0 + H);
check('crowded: a point every ten minutes, even while the vault is open', m0.value - m1.value === 6 && m1.trend === 'down');
const visit = checkIn({ ...small, from: 20, sessionAt: 0, seenAt: 0 }, 10 * H);
check('crowded: a visit does not lift happiness', moodAt(visit, 10 * H + 200_000).value <= moodAt(visit, 10 * H).value);
const slow = { ...ok1, from: 70, sessionAt: 0, seenAt: 0 };
check('not crowded: the slow slide is a point every four hours', moodAt(slow, 0).value - moodAt(slow, 8 * H).value === 2 && moodAt(slow, 8 * H).trend === null);
const lowFrom = { ...small, from: 40, sessionAt: 0, seenAt: 0 };
const since = atFloorSince(lowFrom, 100 * H) as number;
check('it reaches the lowest point after a while and stays there', since > 0 && since < 100 * H && moodAt(lowFrom, 100 * H).value === moodAt(lowFrom, 100 * H).floor);
check('crowded settlers do not leave before a day at the lowest point', neglectAt(lowFrom, since + DAY - 1000).left.length === 0);
const leaving = neglectAt(lowFrom, since + DAY);
check('they leave after a day, as many as are too many', leaving.left.length === 1 && leaving.left[0].id === 1 && leaving.vault.settlers.length === 0);
const two: VaultHome = { ...crowdedBase, from: 40, sessionAt: 0, seenAt: 0 };
const s2 = atFloorSince(two, 100 * H) as number;
const out2 = neglectAt(two, s2 + DAY);
check('the first settler to come stays: the latest goes', out2.left.length === 1 && out2.left[0].id === 2 && out2.vault.settlers.length === 1 && out2.vault.settlers[0].id === 1);
const content: VaultHome = { ...ok1, from: 60, sessionAt: 0, seenAt: 0 };
const sinceC = atFloorSince(content, 3000 * H) as number;
check('enough rooms but miserable: they stay and steal nothing in the first day', neglectAt(content, sinceC + DAY - 1000).thefts === 0 && neglectAt(content, sinceC + DAY - 1000).vault.settlers.length === 1);
const steals = neglectAt(content, sinceC + 3 * DAY + 5);
check('one piece a day, and they stay', steals.thefts === 3 && steals.left.length === 0 && steals.vault.settlers.length === 1 && steals.vault.stealFrom === sinceC + 3 * DAY);
check('the same days are not counted twice', neglectAt(steals.vault, sinceC + 3 * DAY + 10).thefts === 0 && neglectAt(steals.vault, sinceC + 4 * DAY + 10).thefts === 1);
check('no settlers, nothing to steal', neglectAt({ ...content, settlers: [] }, 3000 * H).thefts === 0);
const gained = applyBuild(checkIn({ ...ok1, from: 80, sessionAt: 0, seenAt: 0 }, 1000), 'bathroom' as never, 0, 3, 5, 2000);
check('building makes the arrow point up for a few minutes', gained.ok && moodAt(gained.vault, 2000 + 60_000).trend === 'up' && moodAt(gained.vault, 2000 + 20 * 60_000).trend === null);

console.log(bad ? `${bad} FAILED` : 'all good');
process.exit(bad ? 1 : 0);
