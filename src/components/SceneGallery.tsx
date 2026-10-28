import { useEffect, useRef } from 'react';
import { sceneFontsReady, startScene, type SceneKind } from '../lib/scene';
import type { LookId } from '../lib/looks';

const KINDS: SceneKind[] = ['vault', 'medical', 'school', 'market', 'fuel', 'park', 'guard', 'cantina', 'chapel', 'transit', 'arena', 'lodging', 'other'];

function Tile({ kind, look }: { kind: SceneKind; look: LookId }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let stop = () => {};
    let cancelled = false;
    sceneFontsReady().then(() => {
      if (cancelled || !ref.current) return;
      stop = startScene(ref.current, { kind, look, seed: 12345 + kind.length * 77, label: kind === 'vault' ? 'VAULT 067' : kind === 'market' ? 'MARKET' : undefined }, false);
    });
    return () => {
      cancelled = true;
      stop();
    };
  }, [kind, look]);
  return (
    <figure style={{ margin: 0 }}>
      <canvas ref={ref} style={{ width: '100%', display: 'block', border: '1px solid #333' }} />
      <figcaption style={{ fontSize: 12, opacity: 0.7 }}>{kind}</figcaption>
    </figure>
  );
}

/** Every wasteland scene at once, for checking the artwork: open the app with ?gallery=pipboy or ?gallery=parchment. */
export default function SceneGallery({ look }: { look: LookId }) {
  return (
    <div style={{ padding: 16, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, background: look === 'pipboy' ? '#010804' : '#2a2114', color: '#ccc', fontFamily: 'monospace' }}>
      {KINDS.map((k) => <Tile key={k} kind={k} look={look} />)}
    </div>
  );
}
