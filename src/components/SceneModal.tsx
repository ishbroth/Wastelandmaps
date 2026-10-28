import { useEffect, useMemo, useRef, useState } from 'react';
import { sceneFontsReady, startScene } from '../lib/scene';
import { drawSnapshot, findSnapshot, type Snapshot } from '../lib/snapshot';
import { describeSpot, hashString, type Spot } from '../lib/wasteland';
import type { LookId } from '../lib/looks';

type Tab = 'scene' | 'snapshot';

/**
 * A look at one place, wasteland style: a drawn scene of what the place was (always available), and, when someone has shared a free photo
 * of it, a "survivor snapshot": that photo run through the Fallout look, with the photographer credited.
 */
export default function SceneModal({ spot, regionName, look, visited, onClose }: { spot: Spot; regionName: string; look: LookId; visited: boolean; onClose: () => void }) {
  const [tab, setTab] = useState<Tab>('scene');
  // the photo search answers for one place at a time; until it answers for this one, we are still searching (the vault is made up: no photo)
  const [found, setFound] = useState<{ id: string; snapshot: Snapshot | null } | null>(null);
  const snapshot: Snapshot | null | 'searching' = spot.kind === 'vault' ? null : found?.id === spot.id ? found.snapshot : 'searching';
  const [snapshotError, setSnapshotError] = useState(false);
  const sceneCanvas = useRef<HTMLCanvasElement>(null);
  const photoCanvas = useRef<HTMLCanvasElement>(null);
  const seed = useMemo(() => hashString(spot.id), [spot.id]);
  const journal = useMemo(() => describeSpot(spot, regionName), [spot, regionName]);

  // the drawn scene
  useEffect(() => {
    if (tab !== 'scene') return;
    let stop = () => {};
    let cancelled = false;
    sceneFontsReady().then(() => {
      if (cancelled || !sceneCanvas.current) return;
      stop = startScene(sceneCanvas.current, { kind: spot.kind, seed, look, label: spot.kind === 'vault' ? spot.name : spot.kind === 'market' ? 'MARKET' : undefined });
    });
    return () => {
      cancelled = true;
      stop();
    };
  }, [tab, spot, seed, look]);

  // look for a free photo of the place
  useEffect(() => {
    if (spot.kind === 'vault') return;
    let cancelled = false;
    findSnapshot(spot.position).then((s) => {
      if (!cancelled) setFound({ id: spot.id, snapshot: s });
    });
    return () => {
      cancelled = true;
    };
  }, [spot]);

  // the photo, in the chosen look
  useEffect(() => {
    if (tab !== 'snapshot' || !snapshot || snapshot === 'searching' || !photoCanvas.current) return;
    let cancelled = false;
    setSnapshotError(false);
    drawSnapshot(photoCanvas.current, snapshot, look, seed).catch(() => {
      if (!cancelled) setSnapshotError(true);
    });
    return () => {
      cancelled = true;
    };
  }, [tab, snapshot, look, seed]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const hasPhoto = snapshot !== null && snapshot !== 'searching';

  return (
    <div className="rm-modal" role="dialog" aria-modal="true" aria-label={spot.name} onClick={onClose}>
      <div className="rm-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="rm-modal-head">
          <div>
            <h2>{spot.name}</h2>
            <p>{spot.kind === 'vault' ? 'A sealed vault' : `Formerly ${spot.oldName}`}{visited ? ' · DISCOVERED' : ''}</p>
          </div>
          <button type="button" className="rm-btn rm-btn-ghost" onClick={onClose} aria-label="Close">CLOSE</button>
        </div>

        <div className="rm-modal-tabs" role="tablist">
          <button type="button" role="tab" aria-selected={tab === 'scene'} className={tab === 'scene' ? 'on' : ''} onClick={() => setTab('scene')}>SCENE</button>
          <button
            type="button" role="tab" aria-selected={tab === 'snapshot'} className={tab === 'snapshot' ? 'on' : ''}
            disabled={!hasPhoto} onClick={() => setTab('snapshot')}
            title={hasPhoto ? 'A real photo, in the wasteland look' : snapshot === 'searching' ? 'Searching the photo archives' : 'No free photo of this place'}
          >
            {snapshot === 'searching' ? 'SNAPSHOT…' : hasPhoto ? 'SNAPSHOT' : 'NO SNAPSHOT'}
          </button>
        </div>

        <div className="rm-modal-view">
          {tab === 'scene' && <canvas ref={sceneCanvas} className="rm-modal-canvas" aria-label={`Illustration of ${spot.name}`} />}
          {tab === 'snapshot' && hasPhoto && (
            <>
              <canvas ref={photoCanvas} className="rm-modal-canvas" aria-label={`Photo of ${spot.name} in the wasteland look`} />
              {snapshotError && <p className="rm-modal-error">The photo would not load. Try the scene instead.</p>}
            </>
          )}
          <div className="rm-modal-crt" aria-hidden="true" />
        </div>
        {tab === 'snapshot' && hasPhoto && (
          <p className="rm-modal-credit">
            “{snapshot.title}” by {snapshot.author}, {snapshot.license}, via{' '}
            <a href={snapshot.pageUrl} target="_blank" rel="noreferrer">Wikimedia Commons</a>. Stylized adaptation, shared under the same license.
          </p>
        )}

        <div className="rm-modal-text">
          {journal.map((line, i) => <p key={i}>{line}</p>)}
          <dl>
            <div><dt>THREAT</dt><dd>{spot.threat}</dd></div>
            <div><dt>RADS</dt><dd>{spot.rads}</dd></div>
            <div><dt>LOOT</dt><dd>{spot.loot}</dd></div>
          </dl>
        </div>
      </div>
    </div>
  );
}
