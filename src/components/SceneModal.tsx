import { useEffect, useMemo, useRef, useState } from 'react';
import { sceneFontsReady, startScene } from '../lib/scene';
import { accountsEnabled, PACK, type Account } from '../lib/account';
import { freeRenderFor } from '../lib/renders';
import { downloadImage, shareImage, usePaidRender } from '../lib/usePaidRender';
import { drawSnapshot, findSnapshot, type Snapshot, type SnapshotStyle } from '../lib/snapshot';
import { describeSpot, hashString, type Spot } from '../lib/wasteland';
import type { LookId } from '../lib/looks';

type Tab = 'scene' | 'snapshot' | 'render';

/**
 * A look at one place, wasteland style, in three views: a drawn scene of what the place was (always there); a "survivor snapshot", the real
 * photo run through the wasteland look; and the GAME RENDER, a full post-apocalyptic game-style picture of it. Seven famous landmarks have a
 * render everyone can see; for any other place with a free photo it is unlocked with a credit.
 */
export default function SceneModal({ spot, regionName, look, visited, account, onAccount, onClose }: {
  spot: Spot; regionName: string; look: LookId; visited: boolean; account: Account; onAccount: () => void; onClose: () => void;
}) {
  // a render for everyone, a handful of famous landmarks
  const render = useMemo(() => freeRenderFor(spot.id), [spot.id]);
  const [tab, setTab] = useState<Tab>(render ? 'render' : 'scene');
  // the photo search answers for one place at a time; until it answers for this one, we are still searching (the vault is made up: no photo)
  const [found, setFound] = useState<{ id: string; snapshot: Snapshot | null } | null>(null);
  const snapshot: Snapshot | null | 'searching' = spot.kind === 'vault' ? null : found?.id === spot.id ? found.snapshot : 'searching';
  const photo = snapshot !== null && snapshot !== 'searching' ? snapshot : null;
  const [snapshotError, setSnapshotError] = useState(false);
  const [style, setStyle] = useState<SnapshotStyle>('color');
  const sceneCanvas = useRef<HTMLCanvasElement>(null);
  const photoCanvas = useRef<HTMLCanvasElement>(null);
  const seed = useMemo(() => hashString(spot.id), [spot.id]);
  const journal = useMemo(() => describeSpot(spot, regionName), [spot, regionName]);

  // the paid game-style render: for places with a freely licensed photo listed on Wikidata that are not among the free few
  const canPay = accountsEnabled && !render && spot.id.startsWith('wd:') && !!photo?.listed;
  const paid = usePaidRender(spot.id, spot.oldName ?? spot.name, account, canPay);
  const paidReady = paid.state.kind === 'ready' ? paid.state.render : null;
  const fileName = `${(spot.oldName ?? spot.name).replace(/[^A-Za-z0-9]+/g, '-')}-wastelandmaps.png`;
  const hasRenderTab = !!render || canPay || !!paidReady;
  const teaser = tab === 'render' && canPay && !paidReady;

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

  // look for a free photo of the place (the famous few already come with a render)
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

  // the photo, in the chosen look (also shown, dimmed, behind the offer of the game render)
  const photoShown = (tab === 'snapshot' && !!photo) || teaser;
  useEffect(() => {
    if (!photoShown || !photo || !photoCanvas.current) return;
    let cancelled = false;
    setSnapshotError(false);
    drawSnapshot(photoCanvas.current, photo, look, seed, style).catch(() => {
      if (!cancelled) setSnapshotError(true);
    });
    return () => {
      cancelled = true;
    };
  }, [photoShown, photo, look, seed, style]);

  // an unlocked render opens by itself
  useEffect(() => {
    if (paidReady) setTab('render');
  }, [paidReady]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const shown = render ? { url: render.url, name: render.name, file: `${render.name.replace(/[^A-Za-z0-9]+/g, '-')}-wastelandmaps.png`, credit: { photo: render.photo, author: render.author, license: render.license, page: render.page } }
    : paidReady ? { url: paidReady.url, name: spot.name, file: fileName, credit: paidReady.credit } : null;

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
          {!render && (
            <button
              type="button" role="tab" aria-selected={tab === 'snapshot'} className={tab === 'snapshot' ? 'on' : ''}
              disabled={!photo} onClick={() => setTab('snapshot')}
              title={photo ? 'A real photo, in the wasteland look' : snapshot === 'searching' ? 'Searching the photo archives' : 'No free photo of this place'}
            >
              {snapshot === 'searching' ? 'SNAPSHOT…' : photo ? 'SNAPSHOT' : 'NO SNAPSHOT'}
            </button>
          )}
          {hasRenderTab && (
            <button type="button" role="tab" aria-selected={tab === 'render'} className={`rm-tab-render${tab === 'render' ? ' on' : ''}`} onClick={() => setTab('render')}>
              {shown ? 'GAME RENDER' : 'GAME RENDER ★'}
            </button>
          )}
        </div>

        <div className="rm-modal-view">
          {tab === 'scene' && <canvas ref={sceneCanvas} className="rm-modal-canvas" aria-label={`Illustration of ${spot.name}`} />}
          {tab === 'render' && shown && (
            <>
              <span className="rm-modal-style rm-modal-actions">
                <button type="button" className="rm-btn rm-btn-ghost" onClick={() => void downloadImage(shown.url, shown.file)}>DOWNLOAD</button>
                <button type="button" className="rm-btn rm-btn-ghost" onClick={() => void shareImage(shown.url, shown.file, shown.name)}>SHARE</button>
              </span>
              <img src={shown.url} className="rm-modal-canvas rm-modal-render" alt={`${shown.name} in the wasteland`} />
            </>
          )}
          {photoShown && (
            <>
              {tab === 'snapshot' && (
                <button type="button" className="rm-btn rm-btn-ghost rm-modal-style" onClick={() => setStyle((x) => (x === 'color' ? 'look' : 'color'))}>
                  {style === 'color' ? 'PIP-BOY PRINT' : 'IN COLOR'}
                </button>
              )}
              <canvas ref={photoCanvas} className={`rm-modal-canvas${teaser ? ' rm-dimmed' : ''}`} aria-label={`Photo of ${spot.name} in the wasteland look`} />
              {snapshotError && <p className="rm-modal-error">The photo would not load. Try the scene instead.</p>}
            </>
          )}
          {teaser && (
            <div className="rm-paid-overlay">
              <b>GAME RENDER</b>
              <p>A full post-apocalyptic game-style picture of this place: collapsed, burnt and overgrown. Yours to view, download and share.</p>
              {paid.state.kind === 'error' && <p className="rm-account-note">{paid.state.message}</p>}
              {paid.state.kind === 'working' ? (
                <button type="button" className="rm-btn" disabled>RENDERING… ABOUT 20 SECONDS</button>
              ) : !account.session ? (
                <button type="button" className="rm-btn" onClick={onAccount}>SIGN IN TO UNLOCK · {PACK.credits} RENDERS FOR {PACK.price}</button>
              ) : account.credits === 0 ? (
                <button type="button" className="rm-btn" onClick={onAccount}>BUY {PACK.credits} RENDERS: {PACK.price}</button>
              ) : (
                <button type="button" className="rm-btn" onClick={() => void paid.run()}>UNLOCK FOR 1 CREDIT</button>
              )}
            </div>
          )}
          <div className="rm-modal-crt" aria-hidden="true" />
        </div>

        {tab === 'render' && shown && (
          <p className="rm-modal-credit">
            Game-style render made from “{shown.credit.photo}” by {shown.credit.author}, {shown.credit.license}, via{' '}
            <a href={shown.credit.page} target="_blank" rel="noreferrer">Wikimedia Commons</a>. Shared under the same license.
          </p>
        )}
        {tab === 'snapshot' && photo && (
          <p className="rm-modal-credit">
            “{photo.title}” by {photo.author}, {photo.license}, via{' '}
            <a href={photo.pageUrl} target="_blank" rel="noreferrer">Wikimedia Commons</a>. Stylized adaptation, shared under the same license.
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
