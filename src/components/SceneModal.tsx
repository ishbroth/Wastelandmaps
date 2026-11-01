import { useEffect, useMemo, useRef, useState } from 'react';
import { sceneFontsReady, startScene } from '../lib/scene';
import { accountsEnabled, checkAddress, PACK, type Account } from '../lib/account';
import { freeRenderFor } from '../lib/renders';
import { usePaidRender } from '../lib/usePaidRender';
import { findSnapshot, type Snapshot } from '../lib/snapshot';
import { sourceLabel } from '../../supabase/functions/_shared/photoSources';
import { streetViewAvailable } from '../lib/addressSearch';
import { describeSpot, hashString, subtitle, type PlaceInhabitants, type Spot } from '../lib/wasteland';
import type { LookId } from '../lib/looks';
import BlowApart from './BlowApart';
import RaidScreen from './RaidScreen';
import { spawnsFor } from '../lib/raid/spawnData';
import { planEnemies, type RaidPlan } from '../lib/raid/raid';

type Tab = 'scene' | 'snapshot';

/**
 * A look at one place, wasteland style: a drawn scene of what the place was (always there), and the SNAPSHOT: the real photograph of the place,
 * blown apart to reveal it destroyed, game-style. Seven famous landmarks have a snapshot everyone can see. For any other place with a free
 * photo it is locked until someone spends a credit; the real photo stays hidden until then.
 */
export default function SceneModal({ spot, regionName, look, visited, account, plan, raid, level, sound, metroId, onAccount, onClose }: {
  /** The metro the map is showing: an address rendered here belongs to its atlas. */
  metroId?: string | null;
  spot: Spot; regionName: string; look: LookId; visited: boolean; account: Account; /** Who lives there now and what can be looted. */ plan?: PlaceInhabitants; /** The full raid on it (worth, waves, loot), when it can be raided. */ raid?: RaidPlan; level: number; sound: boolean; onAccount: () => void; onClose: () => void;
}) {
  const render = useMemo(() => freeRenderFor(spot.id), [spot.id]);
  const [tab, setTab] = useState<Tab>(render ? 'snapshot' : 'scene');
  const [raiding, setRaiding] = useState(false);
  // the photo search answers for one place at a time; until it answers for this one, we are still searching (the vault is made up: no photo)
  const [found, setFound] = useState<{ id: string; snapshot: Snapshot | null } | null>(null);
  const snapshot: Snapshot | null | 'searching' = spot.kind === 'vault' ? null : found?.id === spot.id ? found.snapshot : 'searching';
  const photo = snapshot !== null && snapshot !== 'searching' ? snapshot : null;
  // one of their own places: its snapshot is made from Street View, when there is a picture of it (asking is free)
  const personal = !!spot.personal;
  const [street, setStreet] = useState<{ id: string; ok: boolean } | null>(null);
  useEffect(() => {
    if (!spot.personal) return;
    let cancelled = false;
    void streetViewAvailable(spot.position).then((ok) => { if (!cancelled) setStreet({ id: spot.id, ok }); });
    return () => { cancelled = true; };
  }, [spot]);
  // has anyone rendered this address already (then only the unlock is paid for), and is it theirs to see?
  const [address, setAddress] = useState<{ id: string; exists: boolean; owned: boolean } | null>(null);
  useEffect(() => {
    if (!spot.personal || !account.session) return;
    let cancelled = false;
    void checkAddress(spot.id.slice(3)).then((r) => { if (!cancelled) setAddress({ id: spot.id, ...r }); });
    return () => { cancelled = true; };
  }, [spot, account.session]);
  const rendered = address?.id === spot.id ? address : null;
  const streetState = !personal ? null : street?.id === spot.id ? (street.ok ? 'yes' : 'no') : 'checking';
  const searching = personal ? streetState === 'checking' : snapshot === 'searching';
  const cost = personal ? 4 : 1;
  const sceneCanvas = useRef<HTMLCanvasElement>(null);
  const seed = useMemo(() => hashString(spot.id), [spot.id]);
  const journal = useMemo(() => describeSpot(spot, regionName, plan), [spot, regionName, plan]);

  // the paid snapshot: for places with a freely licensed photo listed on Wikidata that are not among the free few
  const canPay = accountsEnabled && !render && ((spot.id.startsWith('wd:') && !!photo?.listed) || (personal && (streetState === 'yes' || !!rendered?.exists)));
  const paid = usePaidRender(spot.id, spot.oldName ?? spot.name, account, canPay, personal ? { kind: spot.personal?.kind, metroId } : undefined, !!rendered?.owned);
  const paidReady = paid.state.kind === 'ready' ? paid.state.render : null;
  const fileName = `${(spot.oldName ?? spot.name).replace(/[^A-Za-z0-9]+/g, '-')}-wastelandmaps.png`;
  const locked = canPay && !paidReady;

  // what the reveal plays between: the real photo, and the finished picture
  const reveal = render
    ? { before: render.before, after: render.url, name: render.name, file: `${render.name.replace(/[^A-Za-z0-9]+/g, '-')}-wastelandmaps.png`, credit: { photo: render.photo, author: render.author, license: render.license, page: render.page } }
    : paidReady && personal ? { before: '', after: paidReady.url, name: spot.name, file: fileName, credit: paidReady.credit }
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
    if (spot.kind === 'vault' || !spot.oldName || render || spot.personal) return;
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
            <p>{spot.kind === 'vault' ? 'A sealed vault' : spot.personal ? spot.personal.address : subtitle(spot)}{visited || spot.personal?.saved ? ' · DISCOVERED' : ''}</p>
          </div>
          <button type="button" className="rm-btn rm-btn-ghost" onClick={onClose} aria-label="Close">CLOSE</button>
        </div>

        <div className="rm-modal-tabs" role="tablist">
          <button type="button" role="tab" aria-selected={tab === 'scene'} className={tab === 'scene' ? 'on' : ''} onClick={() => setTab('scene')}>SCENE</button>
          <button
            type="button" role="tab" aria-selected={tab === 'snapshot'} className={`rm-tab-render${tab === 'snapshot' ? ' on' : ''}`}
            disabled={!snapshotAvailable} onClick={() => setTab('snapshot')}
            title={snapshotAvailable ? 'The place as it is now' : searching ? 'Looking for a picture of the place' : personal ? 'No Street View picture of this place' : 'No free photo of this place to make a snapshot from'}
          >
            {!render && searching ? 'SNAPSHOT…' : snapshotAvailable ? (locked ? 'SNAPSHOT ★' : 'SNAPSHOT') : 'NO SNAPSHOT'}
          </button>
          {reveal && raid && (
            <button type="button" className="rm-tab-loot" disabled={account.cleared.has(spot.id)} onClick={() => setRaiding(true)} title={account.cleared.has(spot.id) ? 'Already cleared' : 'Fight what lives there and loot it'}>{account.cleared.has(spot.id) ? 'CLEARED' : 'LOOT'}</button>
          )}
        </div>

        <div className="rm-modal-view">
          {tab === 'scene' && <canvas ref={sceneCanvas} className="rm-modal-canvas" aria-label={`Illustration of ${spot.name}`} />}
          {tab === 'snapshot' && reveal && (
            <BlowApart key={reveal.after} beforeUrl={reveal.before} afterUrl={reveal.after} name={reveal.name} file={reveal.file} seed={seed} />
          )}
          {tab === 'snapshot' && locked && (
            <div className="rm-locked">
              <b>SNAPSHOT SEALED</b>
              {personal
                ? <p>Unlock it and the Street View picture of this place is turned into what it looks like now: collapsed, burnt and overgrown. Made just for you, yours to download and share. It costs {cost} credits.</p>
                : <p>Unlock it and the photograph of this place is blown apart before your eyes, leaving it as it is now: collapsed, burnt and overgrown. Yours to download and share.</p>}
              {paid.state.kind === 'error' && <p className="rm-account-note">{paid.state.message}</p>}
              {paid.state.kind === 'working' ? (
                <button type="button" className="rm-btn" disabled>DEVELOPING… ABOUT 20 SECONDS</button>
              ) : !account.session ? (
                <button type="button" className="rm-btn" onClick={onAccount}>SIGN IN TO UNLOCK · {PACK.credits} SNAPSHOTS FOR {PACK.price}</button>
              ) : (account.credits ?? 0) < cost ? (
                <button type="button" className="rm-btn" onClick={onAccount}>{personal ? `YOU NEED ${cost} CREDITS · ` : ''}BUY {PACK.credits} SNAPSHOTS: {PACK.price}</button>
              ) : (
                <button type="button" className="rm-btn" onClick={() => void paid.run()}>UNLOCK FOR {cost} CREDIT{cost > 1 ? 'S' : ''}</button>
              )}
            </div>
          )}
          <div className="rm-modal-crt" aria-hidden="true" />
        </div>

        {tab === 'snapshot' && reveal && personal && (
          <p className="rm-modal-credit">Made from Google Street View imagery. The original picture is not kept; only this render is, and only you can open it.</p>
        )}
        {tab === 'snapshot' && reveal && !personal && (
          <p className="rm-modal-credit">
            Made from “{reveal.credit.photo}” by {reveal.credit.author}, {reveal.credit.license}, via{' '}
            <a href={reveal.credit.page} target="_blank" rel="noreferrer">{sourceLabel(reveal.credit.page)}</a>. Shared under the same license.
          </p>
        )}

        {tab === 'scene' && (
        <div className="rm-modal-text">
          {journal.map((line, i) => <p key={i}>{line}</p>)}
          <dl>
            <div><dt>ENEMIES</dt><dd>{plan ? planEnemies(plan) : spot.kind === 'vault' ? 'None' : spot.threat}</dd></div>
            <div><dt>RADS</dt><dd>{spot.rads}</dd></div>
            <div><dt>LOOT</dt><dd>{spot.loot}</dd></div>
          </dl>
        </div>
        )}
      </div>
      {raiding && reveal && raid && (
        <RaidScreen plan={raid} placeId={spot.id} imageUrl={reveal.after} spawns={spawnsFor(spot.id)} account={account} level={level} sound={sound} onExit={() => setRaiding(false)} />
      )}
    </div>
  );
}
