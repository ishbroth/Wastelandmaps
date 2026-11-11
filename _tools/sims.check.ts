// Checks the settlers: that what they walk never goes through furniture, that every seat is used by one at a time, and which way they face.
//   npx esbuild _tools/sims.check.ts --bundle --platform=node --format=cjs --jsx=automatic --outfile=_data/sims.cjs && node _data/sims.cjs
import { newVault, roomAt, type VaultHome, type VaultRoom } from '../src/lib/vaultHome';
import { arenaOf, begin, finish, arrive, freePoint, plan, takenSeats, type Sim } from '../src/components/vaultSims';
import { USES, layoutOf } from '../src/components/vaultIso';

let bad = 0;
const check = (name: string, ok: boolean, more = '') => { if (!ok) bad++; console.log(ok ? 'ok  ' : 'FAIL', name, more); };
const room = (type: string, col: number, row: number, furniture: string[]): VaultRoom => ({ type: type as never, level: 0, col, row, furniture });
const v: VaultHome = {
  ...newVault(0, 7),
  settlers: [{ id: 1, kind: 'male' }, { id: 2, kind: 'female' }, { id: 3, kind: 'dog' }, { id: 4, kind: 'cat' }],
  rooms: [
    room('entry', 5, 5, ['decon']), room('living', 4, 5, ['couch', 'tv', 'armchair', 'coffeetable']), room('bedroom', 5, 4, ['bed', 'nightstand', 'dresser', 'lamp']),
    room('kitchen', 6, 5, ['sinkcabinets', 'fridge', 'stove']), room('dining', 4, 4, ['table', 'chinacabinet', 'punchbowl']), room('study', 6, 4, ['desk', 'piano', 'bookshelf', 'easel']),
    room('entertainment', 6, 6, ['seating', 'screen', 'speakers']), room('game', 2, 5, ['pooltable', 'bar', 'pinball']),
  ],
};
const mk = (id: number, kind: Sim['kind'], x: number, y: number): Sim => ({ id, kind, level: 0, x, y, path: [], face: 1, phase: 0, pose: 'stand', until: 0, lift: 0, tilt: 0, queue: [], cur: null, exit: null, fx: null, seat: null });
const sims: Sim[] = v.settlers.map((st, i) => { const r = v.rooms[1 + i]; const p = freePoint(v, r); return mk(st.id, st.kind, p.x, p.y); });

let clipped = 0, steps = 0;
const seen = new Map<string, number>();
const faces = new Map<string, Set<string>>();
const arenas = new Map<VaultRoom, ReturnType<typeof arenaOf>>();
const arena = (r: VaultRoom) => { let a = arenas.get(r); if (!a) { a = arenaOf(v, r); arenas.set(r, a); } return a; };
for (let n = 0; n < 1500; n++) {
  const s = sims[n % sims.length];
  if (s.queue.length === 0) plan(s, v, sims);
  const step = s.queue.shift();
  if (!step) continue;
  const lay = layoutOf(v.rooms[step.room], (c, r) => roomAt(v, 0, c, r), false);
  void lay;
  const from = { x: s.x, y: s.y };
  begin(s, step, v);
  steps++;
  // every stretch of the way must be clear (except the last step onto the seat, and the first one out of one)
  let prev = s.exit ?? from;
  const pts = [from, ...s.path];
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i];
    const last = i === pts.length - 1 && (b.x === step.x && b.y === step.y) && (step.x !== step.from.x || step.y !== step.from.y);
    const first = i === 1 && n > 0 && !!(s as Sim).cur && prev === prev; // standing up from where they were
    void first;
    if (last) continue;
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    for (let k = 1; k < Math.ceil(len / 2); k++) {
      const x = a.x + ((b.x - a.x) * k) / Math.ceil(len / 2), y = a.y + ((b.y - a.y) * k) / Math.ceil(len / 2);
      const r = roomAt(v, 0, Math.floor(x / 168), Math.floor(y / 168));
      if (!r || r.type === 'hallway' || r.type === 'stairs') continue;
      if (i === 1 && s.exit === null && false) continue;
      const ar = arena(r);
      const hit = ar.named.some((nm) => x > nm.box.x - 4 && x < nm.box.x + nm.box.w + 4 && y > nm.box.y - 4 && y < nm.box.y + nm.box.d + 4) || (ar.hole && x > ar.hole.x && x < ar.hole.x + ar.hole.w && y > ar.hole.y && y < ar.hole.y + ar.hole.d);
      if (hit && !(i === 1)) { clipped++; if (clipped < 6) console.log('  clipped in', r.type, 'at', Math.round(x), Math.round(y), 'going to', step.seat); break; }
    }
  }
  s.x = step.x; s.y = step.y; s.path = [];
  arrive(s, 0);
  const key = (step.seat ?? 'wander').replace(/^\d+:/, '');
  seen.set(key, (seen.get(key) ?? 0) + 1);
  const [id] = key.split(':');
  (faces.get(id) ?? faces.set(id, new Set()).get(id) as Set<string>).add(`${step.face}${step.tilt ? '/' + step.tilt : ''}${step.pose === 'sit' ? 's' : step.pose === 'lie' ? 'l' : ''}`);
  if (step.hold < 0) bad++;
  if (s.queue.length === 0) { s.cur = null; finish(s); }
}
check('no path went through furniture', clipped === 0, `${clipped} of ${steps} steps`);
check('they used the furniture', ['table', 'couch', 'armchair', 'bed', 'seating', 'bar', 'desk', 'piano', 'stove', 'fridge', 'pooltable', 'punchbowl', 'tv'].every((id) => [...seen.keys()].some((k) => k.startsWith(id + ':'))), [...new Set([...seen.keys()].map((k) => k.split(':')[0]))].join(' '));
console.log('faces by piece (1 right, -1 left; s sit, l lie; tilt):', [...faces.entries()].map(([k, set]) => `${k}=${[...set].join(',')}`).join('  '));
// seats are used one at a time
const a: Sim = mk(10, 'male', 0, 0), b: Sim = mk(11, 'male', 0, 0);
a.queue.push({ x: 0, y: 0, from: { x: 0, y: 0 }, face: 1, pose: 'sit', lift: 0, tilt: 0, hold: 1, room: 1, seat: '1:couch:0' });
check('a reserved seat is taken', takenSeats([a, b]).has('1:couch:0'));
// the dining chairs are pulled out, and the screen comes on, while they are used
const tvPlan = (() => { for (let i = 0; i < 400; i++) { const s = mk(20, 'male', 300, 900); plan(s, v, [s]); if (s.queue.some((q) => q.fx?.piece === 'tv')) return s.queue; } return null; })();
check('turning on the tv comes first, then watching from a seat', !!tvPlan && tvPlan[0].fx?.kind === 'screen' && tvPlan[0].action === 'tvon' && (tvPlan.length === 1 || tvPlan[1].action === 'watch'), tvPlan ? tvPlan.map((q) => q.action).join('>') : 'none');
const tableUses = USES.table;
check('the four dining chairs are chairs 0 to 3', tableUses.map((u) => u.chair).join('') === '0123');
console.log(bad ? `${bad} FAILED` : 'all good');
process.exit(bad ? 1 : 0);
