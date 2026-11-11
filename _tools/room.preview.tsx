// Draws a few rooms with settlers using the furniture (poses, the stand-by screen, pulled-out chairs, bare floors, posters) to a picture, to look at.
//   npx esbuild _tools/room.preview.tsx --bundle --platform=node --format=cjs --jsx=automatic --external:sharp --outfile=_data/room.cjs && node _data/room.cjs <out.png>
import { renderToStaticMarkup } from 'react-dom/server';
import sharp from 'sharp';
import { RoomShell, roomRect, BG, P, PlacedPiece, USES, layoutOf, useAt } from '../src/components/vaultIso';
import { SettlerArt } from '../src/components/vaultArt';
import type { RoomType, VaultRoom } from '../src/lib/vaultHome';

const R = (type: RoomType, col: number, row: number, furniture: string[]): VaultRoom => ({ type, level: 0, col, row, furniture });
const rooms: VaultRoom[] = [R('living', 1, 1, ['couch', 'tv', 'armchair']), R('dining', 3, 1, ['table']), R('bedroom', 1, 3, ['bed']), R('study', 3, 3, ['piano']), R('kitchen', 5, 1, ['stove', 'fridge']), R('entertainment', 5, 3, ['seating', 'screen']), R('game', 1, 5, ['pooltable', 'bar'])];
// who does what: room index, piece, use number, what the arms do
const who: { r: number; id: string; i: number; kind?: 'male' | 'female' | 'dog' }[] = [
  { r: 0, id: 'couch', i: 1 }, { r: 0, id: 'tv', i: 0, kind: 'female' }, { r: 1, id: 'table', i: 0 }, { r: 1, id: 'table', i: 3, kind: 'female' }, { r: 2, id: 'bed', i: 0 }, { r: 3, id: 'piano', i: 0 },
  { r: 4, id: 'stove', i: 0 }, { r: 4, id: 'fridge', i: 0, kind: 'female' }, { r: 5, id: 'seating', i: 1 }, { r: 5, id: 'seating', i: 2, kind: 'dog' }, { r: 6, id: 'pooltable', i: 0 }, { r: 6, id: 'bar', i: 1, kind: 'female' },
];
async function main() {
  const rects = rooms.map((r) => roomRect(r));
  const pts = rects.flatMap((r) => [P(r.x, r.y, 60), P(r.x + r.w, r.y + r.d, -10), P(r.x + r.w, r.y, 0), P(r.x, r.y + r.d, 0)]);
  const x0 = Math.min(...pts.map((p) => p[0])) - 20, x1 = Math.max(...pts.map((p) => p[0])) + 20, y0 = Math.min(...pts.map((p) => p[1])) - 20, y1 = Math.max(...pts.map((p) => p[1])) + 20;
  const order = rooms.map((r, i) => ({ r, i })).sort((a, b) => a.r.col + a.r.row - (b.r.col + b.r.row));
  const at = () => undefined;
  const live = (ri: number, id: string) => {
    const mine = who.filter((w) => w.r === ri);
    if (id === 'tv' || id === 'screen') return { on: mine.some((w) => w.id === 'tv' || w.id === 'seating') };
    if (id === 'table') return { pulled: mine.filter((w) => w.id === 'table').map((w) => USES.table[w.i].chair as number) };
    return undefined;
  };
  const svg = renderToStaticMarkup(
    <svg xmlns="http://www.w3.org/2000/svg" width={2200} height={Math.round(2200 * (y1 - y0) / (x1 - x0))} viewBox={`${x0} ${y0} ${x1 - x0} ${y1 - y0}`} fill="none" stroke="#3dff8a" strokeWidth="1.4">
      <rect x={x0} y={y0} width={x1 - x0} height={y1 - y0} fill={BG} />
      {order.map(({ r, i }) => {
        const lay = layoutOf(r, at, false);
        const items = [
          ...r.furniture.map((f) => ({ depth: (lay.get(f)?.x ?? 0) + (lay.get(f)?.y ?? 0), el: <PlacedPiece key={f} room={r} id={f} pos={lay.get(f)} live={live(i, f)} /> })),
          ...who.filter((w) => w.r === i).map((w, k) => {
            const sp = lay.get(w.id) as { x: number; y: number; swap?: boolean };
            const u = USES[w.id][w.i];
            const a = useAt(r, sp, u);
            const [X, Y] = P(a.x, a.y, 0);
            const pet = w.kind === 'dog';
            const pose = pet && u.pose !== 'stand' ? 'lie' : u.pose;
            return { depth: a.x + a.y + 0.5, el: <g key={`w${k}`} transform={`translate(${X} ${Y - u.lift * 0.95})`}><g transform={`rotate(${a.tilt}) scale(${a.face * 0.95} 0.95)`}><SettlerArt kind={w.kind ?? 'male'} pose={pose} phase={0.25} action={pet ? undefined : u.action} /></g></g> };
          }),
        ].sort((p, q) => p.depth - q.depth);
        return <g key={i}><RoomShell rect={roomRect(r)} name="" type={r.type} col={r.col} row={r.row} level={0} doorsL={[]} doorsR={[]} />{items.map((t) => t.el)}</g>;
      })}
    </svg>,
  );
  await sharp(Buffer.from(svg)).png().toFile(process.argv[2] ?? 'room.png');
  console.log('ok');
}
void main();
