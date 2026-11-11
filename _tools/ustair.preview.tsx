// Draws the straight stairwell and the U stairwell facing each of the four ways, from the level they go down from (a pit) and from the level they come out on (climbing), to look at.
//   npx esbuild _tools/ustair.preview.tsx --bundle --platform=node --format=cjs --jsx=automatic --external:sharp --outfile=_data/ustair.cjs && node _data/ustair.cjs <out.png>
import { renderToStaticMarkup } from 'react-dom/server';
import sharp from 'sharp';
import { RoomShell, roomRect, BG, P } from '../src/components/vaultIso';
import type { Face } from '../src/lib/vaultHome';

const faces: Face[] = ['b', 'f', 'l', 'r'];
const cases = [
  { u: false, face: 'b' as Face, way: 'down' as const, entry: 0 as const }, { u: false, face: 'b' as Face, way: 'up' as const, entry: 0 as const },
  ...faces.map((face) => ({ u: true, face, way: 'down' as const, entry: 0 as const })),
  ...faces.map((face) => ({ u: true, face, way: 'up' as const, entry: 1 as const })),
];
const out = process.argv[2] ?? 'ustair.png';
const W = 520, H = 440;
async function main() {
  const tiles = await Promise.all(cases.map(async (c) => {
    const room = { type: 'stairs' as const, col: 3, row: 3, face: c.face, ...(c.u ? { shape: 'u' as const, entry: c.entry } : {}) };
    const rect = roomRect(room);
    const [cx, cy] = P(rect.x + rect.w / 2, rect.y + rect.d / 2, 20);
    const svg = renderToStaticMarkup(
      <svg xmlns="http://www.w3.org/2000/svg" width={W} height={H} viewBox={`${cx - 150} ${cy - 128} 300 256`}>
        <rect x={cx - 150} y={cy - 128} width={300} height={256} fill={BG} />
        <RoomShell rect={rect} name="" type="stairs" col={3} row={3} level={0} doorsL={[]} doorsR={[]} face={c.face} way={c.way} shape={c.u ? 'u' : undefined} entry={c.entry} />
        <text x={cx - 144} y={cy - 114} fill="#3dff8a" fontSize="12">{`${c.u ? 'U' : 'straight'}, ${c.way}, opens to the ${{ b: 'back', f: 'front', l: 'left', r: 'right' }[c.face]}`}</text>
      </svg>,
    );
    return sharp(Buffer.from(svg)).png().toBuffer();
  }));
  await sharp({ create: { width: W * 5, height: H * 2, channels: 3, background: '#021a0c' } }).composite(tiles.map((input, i) => ({ input, left: (i % 5) * W, top: Math.floor(i / 5) * H }))).png().toFile(out);
  console.log('wrote', out);
}
void main();
