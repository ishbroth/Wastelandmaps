import { useEffect, useMemo, useRef, useState } from 'react';
import { sceneFontsReady, startScene } from '../lib/scene';
import { accountsEnabled, PACK, type Account } from '../lib/account';
import { freeRenderFor } from '../lib/renders';
import { usePaidRender } from '../lib/usePaidRender';
import { findSnapshot, type Snapshot } from '../lib/snapshot';
import { describeSpot, hashString, subtitle, type Spot } from '../lib/wasteland';
import type { LookId } from '../lib/looks';
import BlowApart from './BlowApart';

type Tab = 'scene' | 'snapshot';

/**
 * A look at one place, wasteland style: a drawn scene of what the place was (always there), and the SNAPSHOT: the real photograph of the place,
 * blown apart to reveal it destroyed, game-style. Seven famous landmarks have a snapshot everyone can see. For any other place with a free
 * photo it is locked until someone spends a credit; the real photo stays hidden until then.
 */
export default function SceneModal({ spot, regionName, look, visited, account, onAccount, onClose }: {
  spot: Spot; regionName: string; look: LookId; visited: boolean; account: Account; onAccount: () => void; onClose: () => void;
}) {
  const render = useMemo(() => freeRenderFor(spot.id), [spot.id]);
  const [tab, setTab] = useState<Tab>(render ? 'snapshot' : 'scene');
  // the photo search answers for one place at a time; until it answers for this one, we are still searching (the vault is made up: no photo)
  const [found, setFound] = useState<{ id: string; snapshot: Snapshot | null } | null>(null);
  const snapshot: Snapshot | null | 'searching' = spot.kind === 'vault' ? null : found?.id === spot.id ? found.snapshot : 'searching';
  const photo = snapshot !== null && snapshot !== 'searching' ? snapshot : null;
  const sceneCanvas = useRef<HTMLCanvasElement>(null);
  const seed = useMemo(() => hashString(spot.id), [spot.id]);
  const journal = useMemo(() => describeSpot(spot, regionName), [spot, regionName]);

  // the paid snapshot: for places with a freely licensed photo listed on Wikidata that are not among the free few
  const canPay = accountsEnabled && !render && spot.id.startsWith('wd:') && !!photo?.listed;
  const paid = usePaidRender(spot.id, spot.oldName ?? spot.name, account, canPay);
  const paidReady = paid.state.kind === 'ready' ? paid.state.render : null;
  const fileName = `${(spot.oldName ?? spot.name).replace(/[^A-Za-z0-9]+/g, '-')}-wastelandmaps.png`;
  const locked = canPay && !paidReady;

  // what the reveal plays between: the real photo, and the finished picture
  const reveal = render
    ? { before: render.before, after: render.url, name: render.name, file: `${render.name.replace(/[^A-Za-z0-9]+/g, '-')}-wastelandmaps.png`, credit: { photo: render.photo, author: render.author, license: render.license, page: render.page } }
    : paidReady && photo ? { before: photo.imageUrl, after: paidReady.url, name: spot.name, file: fileName, credit: paidReady.credit } : null;

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

  // look for the photo of the place (the famous few already come with their snapshot)
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

  // a snapshot that has just been unlocked opens by itself
  useEffect(() => {
    if (paidReady) setTab('snapshot');
  }, [paidReady]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const snapshotAvailable = !!render || canPay || !!paidReady;

  return (
    <div className="rm-modal" role="dialog" aria-modal="true" aria-label={spot.name} onClick={onClose}>
      <div className={`rm-modal-card${tab === 'snapshot' ? ' rm-modal-wide' : ''}`} onClick={(e) => e.stopPropagation()}>
        <div className="rm-modal-head">
          <div>
            <h2>{spot.name}</h2>
            <p>{spot.kind === 'vault' ? 'A sealed vault' : subtitle(spot)}{visited ? ' · DISCOVERED' : ''}</p>
          </div>
          <button type="button" className="rm-btn rm-btn-ghost" onClick={onClose} aria-label="Close">CLOSE</button>
        </div>

        <div className="rm-modal-tabs" role="tablist">
          <button type="button" role="tab" aria-selected={tab === 'scene'} className={tab === 'scene' ? 'on' : ''} onClick={() => setTab('scene')}>SCENE</button>
          <button
            type="button" role="tab" aria-selected={tab === 'snapshot'} className={`rm-tab-render${tab === 'snapshot' ? ' on' : ''}`}
            disabled={!snapshotAvailable} onClick={() => setTab('snapshot')}
            title={snapshotAvailable ? 'The place as it is now' : snapshot === 'searching' ? 'Searching the photo archives' : 'No free photo of this place to make a snapshot from'}
          >
            {!render && snapshot === 'searching' ? 'SNAPSHOT…' : snapshotAvailable ? (locked ? 'SNAPSHOT ★' : 'SNAPSHOT') : 'NO SNAPSHOT'}
          </button>
        </div>

        <div className="rm-modal-view">
          {tab === 'scene' && <canvas ref={sceneCanvas} className="rm-modal-canvas" aria-label={`Illustration of ${spot.name}`} />}
          {tab === 'snapshot' && reveal && (
            <BlowApart key={reveal.after} beforeUrl={reveal.before} afterUrl={reveal.after} name={reveal.name} file={reveal.file} seed={seed} />
          )}
          {tab === 'snapshot' && locked && (
            <div className="rm-locked">
              <b>SNAPSHOT SEALED</b>
              <p>Unlock it and the photograph of this place is blown apart before your eyes, leaving it as it is now: collapsed, burnt and overgrown. Yours to download and share.</p>
              {paid.state.kind === 'error' && <p className="rm-account-note">{paid.state.message}</p>}
              {paid.state.kind === 'working' ? (
                <button type="button" className="rm-btn" disabled>DEVELOPING… ABOUT 20 SECONDS</button>
              ) : !account.session ? (
                <button type="button" className="rm-btn" onClick={onAccount}>SIGN IN TO UNLOCK · {PACK.credits} SNAPSHOTS FOR {PACK.price}</button>
              ) : account.credits === 0 ? (
                <button type="button" className="rm-btn" onClick={onAccount}>BUY {PACK.credits} SNAPSHOTS: {PACK.price}</button>
              ) : (
                <button type="button" className="rm-btn" onClick={() => void paid.run()}>UNLOCK FOR 1 CREDIT</button>
              )}
            </div>
          )}
          <div className="rm-modal-crt" aria-hidden="true" />
        </div>

        {tab === 'snapshot' && reveal && (
          <p className="rm-modal-credit">
            Made from “{reveal.credit.photo}” by {reveal.credit.author}, {reveal.credit.license}, via{' '}
            <a href={reveal.credit.page} target="_blank" rel="noreferrer">Wikimedia Commons</a>. Shared under the same license.
          </p>
        )}

        {tab === 'scene' && (
        <div className="rm-modal-text">
          {journal.map((line, i) => <p key={i}>{line}</p>)}
          <dl>
            <div><dt>THREAT</dt><dd>{spot.threat}</dd></div>
            <div><dt>RADS</dt><dd>{spot.rads}</dd></div>
            <div><dt>LOOT</dt><dd>{spot.loot}</dd></div>
          </dl>
        </div>
        )}
      </div>
    </div>
  );
}
