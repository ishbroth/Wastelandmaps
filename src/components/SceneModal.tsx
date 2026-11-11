import { useEffect, useMemo, useRef, useState } from 'react';
import Caps from './Caps';
import CogSpinner from './CogSpinner';
import LockIcon from './LockIcon';
import BuyCaps from './BuyCaps';
import { accountsEnabled, caps, checkAddress, vacationPicture, type Account } from '../lib/account';
import { waitingLine } from '../lib/waitingLoot';
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
import ProjectorDown from './ProjectorDown';
import { buzz } from '../lib/haptics';
import VaultHome, { type VacationChoice, type VacationOffer } from './VaultHome';
import VacationCog from './VacationCog';
import { spawnsForSpot } from '../lib/raid/spawnData';
import { lootSummary, planEnemies, type RaidPlan } from '../lib/raid/raid';
import { lootName } from '../lib/raid/loot';

type Tab = 'scene' | 'snapshot';

/**
 * A look at one place, wasteland style: a drawn scene of what the place was (always there), and the SNAPSHOT: the real photograph of the place,
 * blown apart to reveal it destroyed, game-style. Seven famous landmarks have a snapshot everyone can see. For any other place with a free
 * photo it is locked until someone spends a credit; the real photo stays hidden until then.
 */
export default function SceneModal({ vacation, onVacation, zones = [], startOn = 'scene', startRaid = false, spot, regionName, visited, account, plan, raid, sound, metroId, onAccount, onClose }: {
  /** What the home vault needs to offer vacation vaults. */
  vacation?: VacationOffer;
  /** The cog beside CLEARED was pressed: ask about making this place a vacation vault. */
  onVacation?: (choice: VacationChoice) => void;
  /** The metro the map is showing: an address rendered here belongs to its atlas. */
  metroId?: string | null;
  /** The radiation clouds on the map. */
  zones?: { position: { lat: number; lng: number }; radiusMeters: number }[];
  /** Which tab opens first: the scene (the place's info), unless they asked for its snapshot (from the Data tab). */
  startOn?: 'scene' | 'snapshot';
  /** Go straight to the fight once the place's picture is ready ("clear the area now"). */
  startRaid?: boolean;
  spot: Spot; regionName: string; look: LookId; visited: boolean; account: Account; /** Who lives there now and what can be looted. */ plan?: PlaceInhabitants; /** The full raid on it (worth, waves, loot), when it can be raided. */ raid?: RaidPlan; level: number; sound: boolean; onAccount: () => void; onClose: () => void; /** Kept for callers; the message is shown over the picture now. */ onNeedDiscover?: () => void;
}) {
  const render = useMemo(() => freeRenderFor(spot.id), [spot.id]);
  const [tab, setTab] = useState<Tab>(startOn === 'snapshot' ? 'snapshot' : 'scene');
  const [raiding, setRaiding] = useState(false);
  const [entering, setEntering] = useState(false);
  /** The loot waiting at this cleared place (for the CLEARED button), and whether it is being shown. */
  const [showWaiting, setShowWaiting] = useState(false);
  const waitingText = waitingLine(account.waiting.get(spot.id));
  const [buying, setBuying] = useState(false);
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
  const canPay = accountsEnabled && !render && ((spot.id.startsWith('wd:') && !!photo?.listed) || !!supplied || (personal && (streetState === 'yes' || !!rendered?.exists || homeOwned || (streetState === 'no' && !spot.personal?.home))));
  const paid = usePaidRender(spot.id, spot.oldName ?? spot.name, account, canPay, personal ? { kind: spot.personal?.kind, metroId, home: !!spot.personal?.home, flooded, irradiated } : { flooded, irradiated, vault: spot.vault?.number, category: spot.kind }, !!rendered?.owned || homeOwned);
  const paidReady = paid.state.kind === 'ready' ? paid.state.render : null;
  const fileName = `${(spot.oldName ?? spot.name).replace(/[^A-Za-z0-9]+/g, '-')}-wastelandmaps.png`;
  // a vacation vault: its picture is the place with a vault door in it (made when it was unlocked)
  const vacationPlace = account.vacations.some((v) => v.placeId === spot.id);
  const [vacationUrl, setVacationUrl] = useState<{ id: string; url: string } | null>(null);
  useEffect(() => {
    if (!vacationPlace) return;
    let off = false;
    void vacationPicture(spot.id).then((url) => { if (!off && url) setVacationUrl({ id: spot.id, url }); });
    return () => { off = true; };
  }, [vacationPlace, spot.id]);
  const vacationReveal = vacationPlace && vacationUrl?.id === spot.id ? { before: vacationUrl.url, after: vacationUrl.url, name: spot.name, file: `${spot.name.replace(/[^A-Za-z0-9]+/g, '-')}-vault-wastelandmaps.png`, pristine: true, credit: null } : null;
  const locked = canPay && !paidReady && !vacationPlace;
  // unlocked before: opening it again only fetches the picture, so there is no sealed notice, just the cog and the message
  const ownedAlready = !!rendered?.owned || homeOwned || account.unlocked.has(spot.id);
  // whether it is theirs is not known until the account's unlocks have loaded and (for an address) the check of it has answered: until then nothing says SEALED or offers to unlock
  // (it used to flash up for a snapshot that was paid for already, and then turn into the film being fetched)
  const ownershipKnown = !account.session || (account.credits !== null && (!personal || rendered !== null));

  // what the reveal plays between: the real photo, and the finished picture
  const reveal = vacationReveal ?? (paidReady?.rubble && personal ? { before: paidReady.url, after: paidReady.url, name: spot.name, file: fileName, pristine: true, credit: null } : render
    ? { before: render.before, after: render.url, name: render.name, file: `${render.name.replace(/[^A-Za-z0-9]+/g, '-')}-wastelandmaps.png`, pristine: !!render.pristine, credit: render.pristine ? null : { photo: render.photo, author: render.author, license: render.license, page: render.page } }
    : paidReady && personal ? (beforeStreet?.id === spot.id ? { before: beforeStreet.url ?? '', after: paidReady.url, name: spot.name, file: fileName, pristine: false, credit: paidReady.credit } : null)
    : paidReady && (photo || supplied) ? { before: photo?.imageUrl ?? supplied ?? '', after: paidReady.url, name: spot.name, file: fileName, pristine: false, credit: paidReady.credit } : null);

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

  // "clear the area now": the fight starts by itself as soon as the picture it is played over is ready
  const autoRaided = useRef(false);
  useEffect(() => {
    if (startRaid && reveal && raid && !autoRaided.current && !account.cleared.has(spot.id)) { autoRaided.current = true; setRaiding(true); }
  }, [startRaid, reveal, raid, account.cleared, spot.id]);

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

  const snapshotAvailable = !!render || canPay || !!paidReady || !!vacationReveal;

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
          <button type="button" role="tab" aria-selected={tab === 'scene'} className={tab === 'scene' ? 'on' : ''} onClick={() => { buzz('tick'); setTab('scene'); }}>SCENE</button>
          <button
            type="button" role="tab" aria-selected={tab === 'snapshot'} className={`rm-tab-render${tab === 'snapshot' ? ' on' : ''}`}
            disabled={!snapshotAvailable} onClick={() => { buzz('tick'); setTab('snapshot'); }}
            title={snapshotAvailable ? 'The place as it is now' : searching ? 'Looking for a picture of the place' : personal ? 'No Street View picture of this place' : 'No free photo of this place to make a snapshot from'}
          >
            {!render && searching ? 'SNAPSHOT…' : snapshotAvailable ? <>SNAPSHOT <LockIcon open={!locked} /></> : 'NO SNAPSHOT'}
          </button>
          {onVacation && vacation?.ready && vacation.choices.find((c) => c.placeId === spot.id) && (
            <VacationCog name={spot.name} onClick={() => onVacation(vacation.choices.find((c) => c.placeId === spot.id) as VacationChoice)} />
          )}
          {reveal && raid && (
            <button type="button" className={`rm-tab-loot${!home && account.cleared.has(spot.id) && waitingText ? ' waiting' : ''}`} disabled={account.cleared.has(spot.id) && !home && !waitingText} onClick={() => (home && account.cleared.has(spot.id) ? setEntering(true) : account.cleared.has(spot.id) ? setShowWaiting((x) => !x) : setRaiding(true))} title={home && account.cleared.has(spot.id) ? 'Go into your home vault' : account.cleared.has(spot.id) ? (waitingText ? 'Cleared: see the loot waiting for you' : 'Already cleared') : 'Clear out what lives there (the loot is yours once you have discovered the place)'}>{home && account.cleared.has(spot.id) ? 'ENTER' : account.cleared.has(spot.id) ? 'CLEARED' : 'CLEAR'}</button>
          )}
        </div>

        {showWaiting && waitingText && <p className="rm-waiting rm-waiting-panel">LOOT WAITING FOR YOU: {waitingText}. DISCOVER THIS PLACE IN PERSON TO PICK IT UP.</p>}

        {/* the scene tab is the story, the enemies and the loot: the picture belongs to the snapshot tab */}
        <div className={`rm-modal-view${tab === 'scene' ? ' rm-modal-view-hidden' : ''}`}>
          {tab === 'snapshot' && reveal && (
            <BlowApart sound={sound} pristine={reveal.pristine} key={reveal.after} beforeUrl={reveal.before} afterUrl={reveal.after} name={reveal.name} file={reveal.file} seed={seed} seenId={spot.id} seenUser={account.session?.user.id} />
          )}
          {tab === 'snapshot' && locked && (
            <div className="rm-locked">
              {ownershipKnown && !ownedAlready && <b>SNAPSHOT SEALED</b>}
              {!ownershipKnown || (ownedAlready && paid.state.kind !== 'error') ? null : home
                ? <p>Blow up your own home. The Street View picture of your address is turned into the ruin it would be: rubble, with your vault door in the ground and your number on it. Made just for you, yours to download and share.</p>
                : personal
                ? (streetState === 'no'
                  ? <p>No Street View picture of this place can be found, so no pre-war footage exists. Unlock it anyway and you get the aftermath alone: a crater or a heap of burnt rubble, nothing recognizable. 300 caps come back.</p>
                  : <p>Unlock it and the Street View picture of this place is turned into what it looks like now: collapsed, burnt and overgrown. Made just for you, yours to download and share.</p>)
                : <p>Unlock it and the photograph of this place is blown apart before your eyes, leaving it as it is now: collapsed, burnt and overgrown. Yours to download and share.</p>}
              {paid.state.kind === 'error' && (paid.state.resetsAt ? <ProjectorDown resetsAt={paid.state.resetsAt} /> : <p className="rm-account-note">{paid.state.message}</p>)}
              {!ownershipKnown ? (
                <button type="button" className="rm-btn rm-developing" disabled><CogSpinner /> CHECKING YOUR FILM…</button>
              ) : paid.state.kind === 'working' || (ownedAlready && paid.state.kind !== 'error') ? (
                <button type="button" className="rm-btn rm-developing" disabled><CogSpinner /> RETRIEVING FILM… 20 SECONDS</button>
              ) : (
                <button type="button" className="rm-btn" onClick={() => (!account.session ? onAccount() : (account.credits ?? 0) < cost ? setBuying(true) : void paid.run())}>{home ? 'BLOW UP MY HOME' : 'UNLOCK'} FOR <Caps n={account.session ? `${caps(cost)}/${caps(account.credits ?? 0).toLocaleString('en-US')}` : caps(cost)} /></button>
              )}
            </div>
          )}
          <div className="rm-modal-crt" aria-hidden="true" />
        </div>

        {tab === 'snapshot' && paidReady?.rubble && (
          <p className="rm-modal-credit rm-rubble-note">Sorry, no pre-war footage of this location can be found, only the aftermath.{paidReady.refunded && paid.state.kind === 'ready' && paid.state.fresh ? ` ${paidReady.refunded * 100} caps refunded.` : ''}</p>
        )}
        {tab === 'snapshot' && reveal && personal && !paidReady?.rubble && (
          <p className="rm-modal-credit">{home ? 'Made from Google Street View imagery. The original is shown straight from Google and is not kept by us; only this render is kept, and only you can open it.' : 'Made from Google Street View imagery. The original is shown straight from Google and is not kept by us. This render is part of the public atlas: everyone who unlocks this address sees the same picture, and it has a page of its own on the site.'}</p>
        )}
        {tab === 'snapshot' && reveal?.pristine && <p className="rm-modal-credit">Made for WastelandMaps. Nothing has ever touched this door.</p>}
        {tab === 'snapshot' && reveal && !personal && reveal.credit && (
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
      {buying && <BuyCaps onClose={() => setBuying(false)} onBought={() => void account.refresh()} />}
      {entering && home && <VaultHome title={spot.name} account={account} onExit={() => setEntering(false)} vacation={vacation} />}
      {raiding && reveal && raid && (
        <RaidScreen metroId={metroId} plan={raid} placeId={spot.id} imageUrl={reveal.after} spawns={spawnsForSpot(spot)} account={account} sound={sound} onExit={() => setRaiding(false)} onSignIn={onAccount} />
      )}
    </div>
  );
}
