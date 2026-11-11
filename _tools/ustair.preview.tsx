// Draws the U stairwell in its four situations (open end at the back or the front, going down or up) to a picture, to look at it.
//   npx esbuild _tools/ustair.preview.tsx --bundle --platform=node --format=cjs --jsx=automatic --outfile=$TEMP/ustair.cjs && node $TEMP/ustair.cjs <out.png>
import { renderToStaticMarkup } from 'react-dom/server';
import sharp from 'sharp';
import { RoomShell, roomRect, CELL, BG, P } from '../src/components/vaultIso';

const cases: { face: 'b' | 'f'; way: 'up' | 'down'; entry: 0 | 1 }[] = [
  { face: 'b', way: 'down', entry: 0 }, { face: 'f', way: 'down', entry: 0 }, { face: 'b', way: 'up', entry: 1 }, { face: 'f', way: 'up', entry: 1 },
  { face: 'b', way: 'down', entry: 1 }, { face: 'f', way: 'down', entry: 1 }, { face: 'b', way: 'up', entry: 0 }, { face: 'f', way: 'up', entry: 0 },
];
const out = process.argv[2] ?? 'ustair.png';
const W = 640, H = 520;
async function main() {
const tiles = await Promise.all(cases.map(async (c) => {
  const room = { type: 'stairs' as const, col: 3, row: 3, face: c.face, shape: 'u' as const, entry: c.entry };
  const rect = roomRect(room);
  const [cx, cy] = P(rect.x + rect.w / 2, rect.y + rect.d / 2, 0);
  const svg = renderToStaticMarkup(
    <svg xmlns="http://www.w3.org/2000/svg" width={W} height={H} viewBox={`${cx - 320} ${cy - 220} ${W} ${H}`}>
      <rect x={cx - 320} y={cy - 220} width={W} height={H} fill={BG} />
      <RoomShell rect={rect} name="" type="stairs" col={3} row={3} level={0} doorsL={[]} doorsR={[]} face={c.face} way={c.way} shape="u" entry={c.entry} />
      <text x={cx - 310} y={cy - 196} fill="#3dff8a" fontSize="18">{`${c.way} open:${c.face} entry:${c.entry}`}</text>
    </svg>,
  );
  void CELL;
  return sharp(Buffer.from(svg)).png().toBuffer();
}));
await sharp({ create: { width: W * 4, height: H * 2, channels: 3, background: '#021a0c' } }).composite(tiles.map((input, i) => ({ input, left: (i % 4) * W, top: Math.floor(i / 4) * H }))).png().toFile(out);
console.log('wrote', out);
}
void main();
