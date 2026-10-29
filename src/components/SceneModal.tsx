import { useEffect, useMemo, useRef, useState } from 'react';
import { sceneFontsReady, startScene } from '../lib/scene';
import { accountsEnabled, PACK, type Account } from '../lib/account';
import { freeRenderFor } from '../lib/renders';
import { downloadImage, shareImage, usePaidRender } from '../lib/usePaidRender';
import { drawSnapshot, findSnapshot, type Snapshot, type SnapshotStyle } from '../lib/snapshot';
import { describeSpot, hashString, type Spot } from '../lib/wasteland';
import type { LookId } from '../lib/looks';

type Tab = 'scene' | 'snapshot';

/**
 * A look at one place, wasteland style: a drawn scene of what the place was (always available), and, when someone has shared a free photo
 * of it, a "survivor snapshot": that photo run through the Fallout look, with the photographer credited.
 */
export default function SceneModal({ spot, regionName, look, visited, account, onAccount, onClose }: {
  spot: Spot; regionName: string; look: LookId; visited: boolean; account: Account; onAccount: () => void; onClose: () => void;
}) {
  const [tab, setTab] = useState<Tab>('scene');
  // the photo search answers for one place at a time; until it answers for this one, we are still searching (the vault is made up: no photo)
  const [found, setFound] = useState<{ id: string; snapshot: Snapshot | null } | null>(null);
  const snapshot: Snapshot | null | 'searching' = spot.kind === 'vault' ? null : found?.id === spot.id ? found.snapshot : 'searching';
  const [snapshotError, setSnapshotError] = useState(false);
  const [style, setStyle] = useState<SnapshotStyle>('color');
  const sceneCanvas = useRef<HTMLCanvasElement>(null);
  const photoCanvas = useRef<HTMLCanvasElement>(null);
  const seed = useMemo(() => hashString(spot.id), [spot.id]);
  // a handful of famous landmarks come with a full game-style render that everyone can see
  const render = useMemo(() => freeRenderFor(spot.id), [spot.id]);
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
    if (spot.kind === 'vault' || !spot.oldName || render) return;
    let cancelled = false;
    findSnapshot(spot.position, spot.oldName, spot.id.startsWith('wd:') ? spot.id.slice(3) : undefined).then((s) => {
      if (!cancelled) setFound({ id: spot.id, snapshot: s });
    });
    return () => {
      cancelled = true;
    };
  }, [spot, render]);

  // the photo, in the chosen look
  useEffect(() => {
    if (tab !== 'snapshot' || !snapshot || snapshot === 'searching' || !photoCanvas.current) return;
    let cancelled = false;
    setSnapshotError(false);
    drawSnapshot(photoCanvas.current, snapshot, look, seed, style).catch(() => {
      if (!cancelled) setSnapshotError(true);
    });
    return () => {
      cancelled = true;
    };
  }, [tab, snapshot, look, seed, style]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const hasPhoto = !!render || (snapshot !== null && snapshot !== 'searching');
  // the paid game-style render: for places with a freely licensed photo listed on Wikidata that are not among the free few
  const canPay = accountsEnabled && !render && spot.id.startsWith('wd:') && snapshot !== null && snapshot !== 'searching' && !!snapshot.listed;
  const paid = usePaidRender(spot.id, spot.oldName ?? spot.name, account, canPay);
  const paidReady = paid.state.kind === 'ready' ? paid.state.render : null;
  const fileName = `${(spot.oldName ?? spot.name).replace(/[^A-Za-z0-9]+/g, '-')}-wastelandmaps.png`;

  return (
    <div className="rm-modal" role="dialog" aria-modal="true" aria-label={spot.name} onClick={onClose}>
      <div className="rm-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="rm-modal-head">
          <div>
            <h2>{spot.name}</h2>
            <p>{spot.kind === 'vault' ? 'A sealed vault' : (spot.name === spot.oldName ? 'Old World landmark' : `Formerly ${spot.oldName}`)}{visited ? ' · DISCOVERED' : ''}</p>
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
            {!render && snapshot === 'searching' ? 'SNAPSHOT…' : hasPhoto ? 'SNAPSHOT' : 'NO SNAPSHOT'}
          </button>
        </div>

        <div className="rm-modal-view">
          {tab === 'scene' && <canvas ref={sceneCanvas} className="rm-modal-canvas" aria-label={`Illustration of ${spot.name}`} />}
          {tab === 'snapshot' && render && (
            <>
              <span className="rm-modal-style rm-modal-actions">
                <a className="rm-btn rm-btn-ghost" href={render.url} download={`${render.name.replace(/[^A-Za-z0-9]+/g, '-')}-wastelandmaps.png`}>DOWNLOAD</a>
                <button type="button" className="rm-btn rm-btn-ghost" onClick={() => void shareImage(render.url, `${render.name.replace(/[^A-Za-z0-9]+/g, '-')}-wastelandmaps.png`, render.name)}>SHARE</button>
              </span>
              <img src={render.url} className="rm-modal-canvas rm-modal-render" alt={`${render.name} in the wasteland`} />
            </>
          )}
          {tab === 'snapshot' && paidReady && (
            <>
              <span className="rm-modal-style rm-modal-actions">
                <button type="button" className="rm-btn rm-btn-ghost" onClick={() => void downloadImage(paidReady.url, fileName)}>DOWNLOAD</button>
                <button type="button" className="rm-btn rm-btn-ghost" onClick={() => void shareImage(paidReady.url, fileName, spot.name)}>SHARE</button>
              </span>
              <img src={paidReady.url} className="rm-modal-canvas rm-modal-render" alt={`${spot.name} in the wasteland`} />
            </>
          )}
          {tab === 'snapshot' && !render && !paidReady && hasPhoto && (
            <>
              <button type="button" className="rm-btn rm-btn-ghost rm-modal-style" onClick={() => setStyle((x) => (x === 'color' ? 'look' : 'color'))}>
                {style === 'color' ? 'PIP-BOY PRINT' : 'IN COLOR'}
              </button>
              <canvas ref={photoCanvas} className="rm-modal-canvas" aria-label={`Photo of ${spot.name} in the wasteland look`} />
              {snapshotError && <p className="rm-modal-error">The photo would not load. Try the scene instead.</p>}
            </>
          )}
          <div className="rm-modal-crt" aria-hidden="true" />
        </div>
        {tab === 'snapshot' && render && (
          <p className="rm-modal-credit">
            Game-style render made from “{render.photo}” by {render.author}, {render.license}, via{' '}
            <a href={render.page} target="_blank" rel="noreferrer">Wikimedia Commons</a>. Shared under the same license.
          </p>
        )}
        {tab === 'snapshot' && paidReady && (
          <p className="rm-modal-credit">
            Game-style render made from “{paidReady.credit.photo}” by {paidReady.credit.author}, {paidReady.credit.license}, via{' '}
            <a href={paidReady.credit.page} target="_blank" rel="noreferrer">Wikimedia Commons</a>. Shared under the same license.
          </p>
        )}
        {tab === 'snapshot' && canPay && !paidReady && (
          <div className="rm-paid">
            <p>Want the real thing? A full post-apocalyptic game-style render of this place, yours to view, download and share.</p>
            {paid.state.kind === 'error' && <p className="rm-account-note">{paid.state.message}</p>}
            {paid.state.kind === 'working' ? (
              <button type="button" className="rm-btn" disabled>RENDERING… ABOUT 20 SECONDS</button>
            ) : !account.session ? (
              <button type="button" className="rm-btn" onClick={onAccount}>SIGN IN TO UNLOCK THE GAME-STYLE RENDER</button>
            ) : account.credits === 0 ? (
              <button type="button" className="rm-btn" onClick={onAccount}>BUY {PACK.credits} RENDERS: {PACK.price}</button>
            ) : (
              <button type="button" className="rm-btn" onClick={() => void paid.run()}>UNLOCK THE GAME-STYLE RENDER · 1 CREDIT</button>
            )}
          </div>
        )}
        {tab === 'snapshot' && !render && !paidReady && hasPhoto && snapshot !== null && snapshot !== 'searching' && (
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
