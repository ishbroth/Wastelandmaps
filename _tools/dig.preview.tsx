// Draws the dig-tools sign (the shovel and pickaxe on a place for a new room) big, to look at.
//   npx esbuild _tools/dig.preview.tsx --bundle --platform=node --format=cjs --jsx=automatic --external:sharp --outfile=_data/dig.cjs && node _data/dig.cjs <out.png>
import { renderToStaticMarkup } from 'react-dom/server';
import sharp from 'sharp';
import { RoomOutline, cellRect, BG } from '../src/components/vaultIso';

async function main() {
  const rect = cellRect(2, 2);
  const svg = renderToStaticMarkup(
    <svg xmlns="http://www.w3.org/2000/svg" width={900} height={600} viewBox="-30 400 60 40" fill="none" stroke="#3dff8a">
      <rect x="-30" y="400" width="60" height="40" fill={BG} />
      <RoomOutline rect={rect} label="" plain={false} />
    </svg>,
  );
  await sharp(Buffer.from(svg)).png().toFile(process.argv[2] ?? 'dig.png');
  console.log('ok');
}
void main();
