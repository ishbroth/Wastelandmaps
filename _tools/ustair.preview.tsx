// Draws the U stairwell facing each of the four ways, from the level it goes down from (a pit) and from the level it comes out on (climbing), to a picture, to look at.
//   npx esbuild _tools/ustair.preview.tsx --bundle --platform=node --format=cjs --jsx=automatic --external:sharp --outfile=_data/ustair.cjs && node _data/ustair.cjs <out.png>
import { renderToStaticMarkup } from 'react-dom/server';
import sharp from 'sharp';
import { RoomShell, roomRect, BG, P } from '../src/components/vaultIso';
import type { Face } from '../src/lib/vaultHome';

const faces: Face[] = ['b', 'f', 'l', 'r'];
const cases = [
  ...faces.map((face) => ({ face, way: 'down' as const, entry: 0 as const })),
  ...faces.map((face) => ({ face, way: 'up' as const, entry: 1 as const })),
];
const out = process.argv[2] ?? 'ustair.png';
const W = 520, H = 440;
async function main() {
  const tiles = await Promise.all(cases.map(async (c) => {
    const room = { type: 'stairs' as const, col: 3, row: 3, face: c.face, shape: 'u' as const, entry: c.entry };
    const rect = roomRect(room);
    const [cx, cy] = P(rect.x + rect.w / 2, rect.y + rect.d / 2, 20);
    const svg = renderToStaticMarkup(
      <svg xmlns="http://www.w3.org/2000/svg" width={W} height={H} viewBox={`${cx - 130} ${cy - 110} 260 220`}>
        <rect x={cx - 130} y={cy - 110} width={260} height={220} fill={BG} />
        <RoomShell rect={rect} name="" type="stairs" col={3} row={3} level={0} doorsL={[]} doorsR={[]} face={c.face} way={c.way} shape="u" entry={c.entry} />
        <text x={cx - 124} y={cy - 96} fill="#3dff8a" fontSize="11">{`${c.way}, opens to the ${{ b: 'back', f: 'front', l: 'left', r: 'right' }[c.face]}`}</text>
      </svg>,
    );
    return sharp(Buffer.from(svg)).png().toBuffer();
  }));
  await sharp({ create: { width: W * 4, height: H * 2, channels: 3, background: '#021a0c' } }).composite(tiles.map((input, i) => ({ input, left: (i % 4) * W, top: Math.floor(i / 4) * H }))).png().toFile(out);
  console.log('wrote', out);
}
void main();
