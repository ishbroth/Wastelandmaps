import { useEffect, useMemo, useState } from 'react';
import Caps from './Caps';
import BuyCaps from './BuyCaps';
import { accountsEnabled, caps, checkAddress, type Account } from '../lib/account';
import { freeRenderFor } from '../lib/renders';
import { usePaidRender } from '../lib/usePaidRender';
import { findSnapshot, type Snapshot } from '../lib/snapshot';
import { sourceLabel } from '../../supabase/functions/_shared/photoSources';
import { streetViewAvailable, streetViewPictureUrl } from '../lib/addressSearch';
import { isFlooded, loadFlood } from '../lib/flood';
import { isIrradiated } from '../lib/zones';
import { manualBefore } from '../lib/manualSources';
import { describeSpot, hashString, subtitle, type PlaceInhabitants, type Spot } from '../lib/wasteland';
import type { LookId } from '../lib/looks';
import BlowApart from './BlowApart';
import RaidScreen from './RaidScreen';
import { spawnsFor } from '../lib/raid/spawnData';
import { lootSummary, planEnemies, type RaidPlan } from '../lib/raid/raid';
import { lootName } from '../lib/raid/loot';

type Tab = 'scene' | 'snapshot';

/**
 * A look at one place, wasteland style: a drawn scene of what the place was (always there), and the SNAPSHOT: the real photograph of the place,
 * blown apart to reveal it destroyed, game-style. Seven famous landmarks have a snapshot everyone can see. For any other place with a free
 * photo it is locked until someone spends a credit; the real photo stays hidden until then.
 */
export default function SceneModal({ zones = [], startOn = 'scene', spot, regionName, visited, account, plan, raid, sound, metroId, onAccount, onClose }: {
  /** The metro the map is showing: an address rendered here belongs to its atlas. */
  metroId?: string | null;
  /** The radiation clouds on the map. */
  zones?: { position: { lat: number; lng: number }; radiusMeters: number }[];
  /** Which tab opens first: the scene (the place's info), unless they asked for its snapshot (from the Data tab). */
  startOn?: 'scene' | 'snapshot';
  spot: Spot; regionName: string; look: LookId; visited: boolean; account: Account; /** Who lives there now and what can be looted. */ plan?: PlaceInhabitants; /** The full raid on it (worth, waves, loot), when it can be raided. */ raid?: RaidPlan; level: number; sound: boolean; onAccount: () => void; onClose: () => void; /** Kept for callers; the message is shown over the picture now. */ onNeedDiscover?: () => void;
}) {
  const render = useMemo(() => freeRenderFor(spot.id), [spot.id]);
  const [tab, setTab] = useState<Tab>(startOn === 'snapshot' ? 'snapshot' : 'scene');
  const [raiding, setRaiding] = useState(false);
  const [buying, setBuying] = useState(false);
  // the reason the LOOT button will not work yet, flashed over the picture
  const [needDiscover, setNeedDiscover] = useState(0);
  useEffect(() => {
    if (!needDiscover) return;
    const t = window.setTimeout(() => setNeedDiscover(0), 3800);
    return () => window.clearTimeout(t);
  }, [needDiscover]);
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
  const [beforeStreet, setBeforeStreet] = useState<{ id: string; url: string | null } | null>(null);
  useEffect(() => {
    if (!spot.personal) return;
    let cancelled = false;
    void streetViewPictureUrl(spot.position).then((url) => { if (!cancelled) setBeforeStreet({ id: spot.id, url }); });
    return () => { cancelled = true; };
  }, [spot]);
  // has anyone rendered this address already (then only the unlock is paid for), and is it theirs to see?
  const [address, setAddress] = useState<{ id: string; exists: boolean; owned: boolean } | null>(null);
  useEffect(() => {
    if (!spot.personal || !account.session) return;
    let cancelled = false;
    void checkAddress(spot.id.slice(3), !!spot.personal?.home).then((r) => { if (!cancelled) setAddress({ id: spot.id, ...r }); });
    return () => { cancelled = true; };
  }, [spot, account.session]);
  const rendered = address?.id === spot.id ? address : null;
  const homeOwned = !!spot.personal?.home && [...account.unlocked].some((k) => k.startsWith(`vault:${spot.id.slice(3)}:`));
  const streetState = !personal ? null : street?.id === spot.id ? (street.ok ? 'yes' : 'no') : 'checking';
  const searching = personal ? streetState === 'checking' : snapshot === 'searching';
  const cost = personal ? 4 : 1;
  const home = !!spot.personal?.home;
  const seed = useMemo(() => hashString(spot.id), [spot.id]);
  const journal = useMemo(() => describeSpot(spot, regionName, plan), [spot, regionName, plan]);

  // the paid snapshot: for places with a freely licensed photo listed on Wikidata that are not among the free few
  // standing over one of the flooded patches: the render shows the flooding too
  const [floodedAt, setFloodedAt] = useState<{ id: string; flooded: boolean } | null>(null);
  useEffect(() => {
    let cancelled = false;
    void loadFlood().then((byMetro) => { if (!cancelled) setFloodedAt({ id: spot.id, flooded: isFlooded(spot.position, Object.values(byMetro).flat()) }); });
    return () => { cancelled = true; };
  }, [spot]);
  const flooded = floodedAt?.id === spot.id && floodedAt.flooded;
  // standing under one of the radiation clouds: the render has the fallout haze and acid rain
  const irradiated = isIrradiated(spot.position, zones);
  const supplied = manualBefore(spot.id);
  const canPay = accountsEnabled && !render && ((spot.id.startsWith('wd:') && !!photo?.listed) || !!supplied || (personal && (streetState === 'yes' || !!rendered?.exists || homeOwned)));
  const paid = usePaidRender(spot.id, spot.oldName ?? spot.name, account, canPay, personal ? { kind: spot.personal?.kind, metroId, home: !!spot.personal?.home, flooded, irradiated } : { flooded, irradiated }, !!rendered?.owned || homeOwned);
  const paidReady = paid.state.kind === 'ready' ? paid.state.render : null;
  const fileName = `${(spot.oldName ?? spot.name).replace(/[^A-Za-z0-9]+/g, '-')}-wastelandmaps.png`;
  const locked = canPay && !paidReady;

  // what the reveal plays between: the real photo, and the finished picture
  const reveal = render
    ? { before: render.before, after: render.url, name: render.name, file: `${render.name.replace(/[^A-Za-z0-9]+/g, '-')}-wastelandmaps.png`, credit: { photo: render.photo, author: render.author, license: render.license, page: render.page } }
    : paidReady && personal ? (beforeStreet?.id === spot.id ? { before: beforeStreet.url ?? '', after: paidReady.url, name: spot.name, file: fileName, credit: paidReady.credit } : null)
    : paidReady && (photo || supplied) ? { before: photo?.imageUrl ?? supplied ?? '', after: paidReady.url, name: spot.name, file: fileName, credit: paidReady.credit } : null;

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
    // only a snapshot that has just been paid for opens by itself; one that was already theirs waits for the SNAPSHOT button
    if (paidReady && paid.state.kind === 'ready' && paid.state.fresh) setTab('snapshot');
  }, [paidReady, paid.state]);

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
      <div className={`rm-modal-card${tab === 'snapshot' ? ' rm-modal-wide' : tab === 'scene' ? ' rm-modal-scene' : ''}`} onClick={(e) => e.stopPropagation()}>
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
            <button type="button" className={`rm-tab-loot${visited || render || spot.personal ? '' : ' rm-tab-loot-faded'}`} disabled={account.cleared.has(spot.id)} onClick={() => (visited || render || spot.personal ? setRaiding(true) : setNeedDiscover(Date.now()))} title={account.cleared.has(spot.id) ? 'Already cleared' : 'Fight what lives there and loot it'}>{account.cleared.has(spot.id) ? 'CLEARED' : 'LOOT'}</button>
          )}
        </div>

        {/* the scene tab is the story, the enemies and the loot: the picture belongs to the snapshot tab */}
        <div className={`rm-modal-view${tab === 'scene' ? ' rm-modal-view-hidden' : ''}`}>
          {tab === 'snapshot' && reveal && (
            <BlowApart key={reveal.after} beforeUrl={reveal.before} afterUrl={reveal.after} name={reveal.name} file={reveal.file} seed={seed} seenId={personal ? spot.id : undefined} />
          )}
          {tab === 'snapshot' && locked && (
            <div className="rm-locked">
              <b>SNAPSHOT SEALED</b>
              {home
                ? <p>Blow up your own home. The Street View picture of your address is turned into the ruin it would be: rubble, with your vault door in the ground and your number on it. Made just for you, yours to download and share. It costs <Caps n={caps(cost)} />.</p>
                : personal
                ? <p>Unlock it and the Street View picture of this place is turned into what it looks like now: collapsed, burnt and overgrown. Made just for you, yours to download and share. It costs <Caps n={caps(cost)} />.</p>
                : <p>Unlock it and the photograph of this place is blown apart before your eyes, leaving it as it is now: collapsed, burnt and overgrown. Yours to download and share.</p>}
              {paid.state.kind === 'error' && <p className="rm-account-note">{paid.state.message}</p>}
              {paid.state.kind === 'working' ? (
                <button type="button" className="rm-btn" disabled>DEVELOPING… ABOUT 20 SECONDS</button>
              ) : (
                <button type="button" className="rm-btn" onClick={() => (!account.session ? onAccount() : (account.credits ?? 0) < cost ? setBuying(true) : void paid.run())}>{home ? 'BLOW UP MY HOME' : 'UNLOCK'} FOR <Caps n={caps(cost)} /></button>
              )}
            </div>
          )}
          <div className="rm-modal-crt" aria-hidden="true" />
        </div>
        {needDiscover > 0 && <div className="rm-modal-flash" key={needDiscover} role="alert">YOU MUST DISCOVER THIS LOCATION FIRST. GO THERE, OR FAST TRAVEL TO IT, THEN COME BACK TO LOOT IT.</div>}

        {tab === 'snapshot' && reveal && personal && (
          <p className="rm-modal-credit">{home ? 'Made from Google Street View imagery. The original is shown straight from Google and is not kept by us; only this render is kept, and only you can open it.' : 'Made from Google Street View imagery. The original is shown straight from Google and is not kept by us. This render is part of the public atlas: everyone who unlocks this address sees the same picture, and it has a page of its own on the site.'}</p>
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
            <div><dt>LOOT</dt><dd>{raid ? lootSummary(raid) : plan ? plan.lootTypes.map(lootName).join(', ') : spot.loot}</dd></div>
          </dl>
        </div>
        )}
      </div>
      {buying && <BuyCaps onClose={() => setBuying(false)} />}
      {raiding && reveal && raid && (
        <RaidScreen plan={raid} placeId={spot.id} imageUrl={reveal.after} spawns={spawnsFor(spot.id)} account={account} sound={sound} onExit={() => setRaiding(false)} />
      )}
    </div>
  );
}
