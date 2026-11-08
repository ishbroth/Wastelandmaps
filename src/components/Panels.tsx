import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { CATEGORIES, distanceMeters, subtitle, type CategoryId, type Location } from '../lib/wasteland';
import { freeRenderFor } from '../lib/renders';
import { LOOT_CAP } from '../lib/raid/loot';
import { waitingLine } from '../lib/waitingLoot';
import { enemiesLine, homePlan, lootSummary, planEnemies, planFor, raidFor } from '../lib/raid/raid';
import { personalId } from '../lib/personal';
import { purchasesAvailable } from '../lib/native';
import { faceIdName, forgetFaceId, savedFaceIds } from '../lib/faceid';
import Leaderboard from './Leaderboard';
import Caps, { CapIcon } from './Caps';
import { STIMPAK_TRADES, TIME_TRADES, affordableQty } from '../../supabase/functions/_shared/stimpak';
import ConfirmSpend from './ConfirmSpend';
import BuyCaps from './BuyCaps';
import { METRO_COST, caps, tradeStimpak, tradeTime, atlasCount, atlasUnlock, craftWeapon, deleteAccount, signOut, type Account, type FoundPlace } from '../lib/account';
import { levelInfo } from '../lib/points';
import { LOOT_TYPES, canAfford, describeBag, type LootBag } from '../lib/raid/loot';
import { WEAPON_CLASS_IDS, WEAPON_CLASSES, nextWeapon, weaponAt, type WeaponClass } from '../lib/raid/weapons';

import { CATEGORY_ICON, placeIcon } from '../lib/placeIcons';
import { iconHtmlFor } from '../lib/landmarkIcons';
import { buildShareUrl } from '../lib/share';
import type { LookId } from '../lib/looks';
import type { Region } from '../lib/google';

const miles = (m: number) => (m < 160 ? `${Math.round(m * 3.281)} ft` : `${(m / 1609.34).toFixed(1)} mi`);

export function LocationsPanel({ metro, account, region, locations: everywhere, hidden, onToggleCategory, selectedId, visited, cleared, onSelect }: {
  /** The metro under the map: the list is its places only, and changes as the map moves to another metro (its address atlas sits above the list). */
  metro?: { id?: string; name?: string; lat?: number; lng?: number; radiusKm?: number } | null;
  account: Account;
  region: Region | null;
  locations: Location[];
  hidden: Set<CategoryId>;
  onToggleCategory: (id: CategoryId) => void;
  selectedId: string | null;
  visited: Set<string>;
  /** Places already looted. */
  cleared: Set<string>;
  onSelect: (id: string) => void;
}) {
  // only the places of the metro the map is over (a metro looked at earlier stays loaded on the map, but not in this list)
  const here = metro?.lat !== undefined && metro.lng !== undefined && metro.radiusKm ? { lat: metro.lat, lng: metro.lng, reach: (metro.radiusKm + 3) * 1000 } : null;
  const locations = useMemo(() => (here ? everywhere.filter((l) => distanceMeters(here, l.position) <= here.reach) : everywhere), [everywhere, here?.lat, here?.lng, here?.reach]); // eslint-disable-line react-hooks/exhaustive-deps
  // distances are from where the search landed when that is in this metro, otherwise from the metro's middle
  const from = region && (!here || distanceMeters(here, region.center) <= here.reach) ? region.center : here;
  const rows = useMemo(() => {
    if (!from) return [];
    return locations
      .filter((l) => !hidden.has(l.category))
      .map((l) => ({ l, d: distanceMeters(from, l.position) }))
      .sort((a, b) => a.d - b.d);
  }, [locations, hidden, from?.lat, from?.lng]); // eslint-disable-line react-hooks/exhaustive-deps

  const counts = useMemo(() => {
    const m = new Map<CategoryId, number>();
    locations.forEach((l) => m.set(l.category, (m.get(l.category) ?? 0) + 1));
    return m;
  }, [locations]);

  // The list is a window that always shows ten places and scrolls through the rest: the window keeps its size (the height of the first ten rows)
  // while the Pip-Boy stays where it is.
  const listRef = useRef<HTMLUListElement | null>(null);
  const [listHeight, setListHeight] = useState<number | null>(null);
  useLayoutEffect(() => {
    const ul = listRef.current;
    if (!ul) return;
    const measure = () => {
      const items = Array.from(ul.children).slice(0, 10) as HTMLElement[];
      if (rows.length <= 10 || items.length < 10) { setListHeight(null); return; }
      const h = Math.ceil(items[9].getBoundingClientRect().bottom - items[0].getBoundingClientRect().top);
      setListHeight((prev) => (prev !== null && Math.abs(prev - h) < 2 ? prev : h));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(ul);
    return () => ro.disconnect();
  }, [rows]);

  const selectedRow = useRef<HTMLLIElement | null>(null);
  useEffect(() => {
    // keep the chosen row in view inside the list itself. (scrollIntoView would also scroll the whole page: on a phone, where the list sits below
    // the map, tapping a place on the map threw the page down to the list and the card on the map was left out of sight.)
    const row = selectedRow.current;
    if (!row) return;
    let box: HTMLElement | null = row.parentElement;
    while (box && !(box.scrollHeight > box.clientHeight && /(auto|scroll)/.test(getComputedStyle(box).overflowY))) box = box.parentElement;
    if (!box) return;
    const r = row.getBoundingClientRect();
    const b = box.getBoundingClientRect();
    if (r.top < b.top) box.scrollTop -= b.top - r.top;
    else if (r.bottom > b.bottom) box.scrollTop += r.bottom - b.bottom;
  }, [selectedId]);

  if (!region) return <p className="rm-empty">No locations discovered. Pick a place to scan the wasteland.</p>;

  return (
    <div>
      <p className="rm-foundline"><span>LOCATIONS FOUND</span> <b>{locations.length}</b></p>
      <div className="rm-chips" role="group" aria-label="Filter locations">
        {CATEGORIES.filter((c) => counts.has(c.id)).map((c) => (
          <button key={c.id} type="button" className={`rm-chip ${hidden.has(c.id) ? 'rm-chip-off' : ''}`} onClick={() => onToggleCategory(c.id)} aria-pressed={!hidden.has(c.id)}>
            <span className="rm-chip-icon" dangerouslySetInnerHTML={{ __html: placeIcon(CATEGORY_ICON[c.id]) }} />
            {c.label} <small>{counts.get(c.id)}</small>
          </button>
        ))}
      </div>
      {account.session && metro?.id && <AtlasBox account={account} metro={{ id: metro.id, name: metro.name ?? metro.id }} />}
      <ul className="rm-list" ref={listRef} style={listHeight ? { height: listHeight } : undefined}>
        {rows.map(({ l, d }) => (
          <li key={l.id} ref={l.id === selectedId ? selectedRow : null}>
            <button type="button" className={`rm-row ${l.id === selectedId ? 'rm-row-selected' : ''}`} onClick={() => onSelect(l.id)}>
              <span className={`rm-row-icon${visited.has(l.id) ? ' rm-icon-filled' : ''}`} dangerouslySetInnerHTML={{ __html: iconHtmlFor(l.id, placeIcon(l.icon)) }} />
              <span className="rm-row-text">
                <b>{l.name}{visited.has(l.id) ? ' ✓' : ''}{cleared.has(l.id) ? ' [CLEARED]' : ''}</b>
                <i>{subtitle(l)}</i>
                <small>{enemiesLine(l)}{l.rads > 60 ? ` · ${l.rads} RADS` : ''} · loot: {lootSummary(raidFor(l))}</small>
                {waitingLine(account.waiting.get(l.id)) && <small className="rm-waiting">WAITING FOR YOU: {waitingLine(account.waiting.get(l.id))}</small>}
              </span>
              <span className="rm-row-dist">{miles(d)}</span>
            </button>
          </li>
        ))}
        {rows.length === 0 && <li className="rm-empty">Nothing here. Turn a category back on.</li>}
      </ul>
    </div>
  );
}

/** A camera with a mushroom cloud in it: this place's snapshot is unlocked. */
function SnapshotIcon() {
  return (
    <svg viewBox="0 0 40 34" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2" y="8" width="36" height="24" rx="4" />
      <path d="M13 8 15 3h10l2 5" />
      <ellipse cx="20" cy="16.5" rx="8" ry="4.6" fill="currentColor" />
      <circle cx="13.6" cy="18" r="3" fill="currentColor" />
      <circle cx="26.4" cy="18" r="3" fill="currentColor" />
      <path d="M17.2 21c0 5-1 7-3 8.2h11.6c-2-1.2-3-3.2-3-8.2Z" fill="currentColor" />
    </svg>
  );
}


/** The Data tab: credits, and every place found, newest first; a place opens on the map, and an unlocked snapshot opens ready to play. */
export function AccountPanel({ account, found, iconOf, metroRows, onChangeHome, onAccount, onGoTo, onSnapshot }: {
  account: Account;
  onChangeHome: () => void;
  found: FoundPlace[];
  /** How far along each metro is: the places looted out of the places that count, and whether it is cleared. */
  metroRows: { id: string; name: string; done: number; total: number; cleared: boolean }[];
  /** The icon (as drawn on the map) of a found place. */
  iconOf: (id: string) => string;
  onAccount: () => void;
  onGoTo: (place: FoundPlace) => void;
  onSnapshot: (place: FoundPlace) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  /** The "spend this loot?" question that is open, if any. */
  const [ask, setAsk] = useState<{ kind: 'stimpak' | 'time'; id: string } | { kind: 'gun'; id: WeaponClass } | null>(null);
  // every place found, in the order found, starting with home
  const homeId = account.home?.placeId ? personalId(account.home.placeId) : null;
  const recent = useMemo(() => {
    const oldest = [...found].sort((x, y) => (x.foundAt > y.foundAt ? 1 : x.foundAt < y.foundAt ? -1 : 0));
    if (!homeId || !account.home) return oldest;
    const mine = oldest.find((p) => p.id === homeId) ?? {
      id: homeId, name: account.home.name || account.home.address || 'Home', oldName: null, metroId: null, city: null, state: null, country: null,
      lat: account.home.lat ?? 0, lng: account.home.lng ?? 0, foundAt: '', worth: 10,
    };
    return [mine, ...oldest.filter((p) => p.id !== homeId)];
  }, [found, homeId, account.home]);
  const shown = expanded ? recent : recent.slice(0, 5);

  if (!account.session) {
    return (
      <div className="rm-acct">
        <p>Sign in to keep your record: the places you have found, the snapshots you have unlocked, your credits and where you left the map. It follows you to any device.</p>
        <button type="button" className="rm-btn" onClick={onAccount}>SIGN IN</button>
        <LegalLinks />
      </div>
    );
  }

  const level = levelInfo(account.points);
  return (
    <div className="rm-acct">
      <div className="rm-level">
        <div className="rm-level-head"><b>LEVEL {level.level}</b><span>{level.into} / {level.needed} XP</span></div>
        <div className="rm-level-bar" role="progressbar" aria-valuemin={0} aria-valuemax={level.needed} aria-valuenow={level.into} aria-label={`Progress to level ${level.level + 1}`}>
          <div style={{ width: `${Math.min(100, Math.round((level.into / level.needed) * 100))}%` }} />
        </div>
        <p className="rm-fine">{level.toGo} XP to level {level.level + 1}</p>
      </div>
      <div className="rm-acct-who">
        <span>{account.email}</span>
        <button type="button" className="rm-btn rm-btn-ghost" onClick={() => void signOut()}>SIGN OUT</button>
      </div>
      <ForgetFaceId />
      <div className="rm-acct-credits">
        <div><b className="rm-caps-big"><CapIcon />{account.credits === null ? '…' : caps(account.credits).toLocaleString('en-US')}</b> <span>CAPS</span></div>
      </div>
      <Packs onBought={() => void account.refresh()} />

      <h3>HOME</h3>
      <div className="rm-acct-credits">
        <div><span>{account.home?.address ? `${account.home.vaultNumber !== undefined ? `VAULT ${String(account.home.vaultNumber).padStart(4, '0')} · ` : ''}${account.home.address}` : 'Not set'}</span></div>
        <button type="button" className="rm-btn rm-btn-ghost" onClick={onChangeHome}>{account.home?.address ? 'CHANGE' : 'SET HOME'}</button>
      </div>

      <h3>LOOT</h3>
      <div className="rm-loot">
        {LOOT_TYPES.map((l) => (
          <span key={l.id} className={`rm-loot-item${(account.loot[l.id] ?? 0) === 0 ? ' rm-loot-none' : ''}${(account.loot[l.id] ?? 0) >= LOOT_CAP ? ' rm-loot-full' : ''}`} title={`Storage holds ${LOOT_CAP} of each`}>{l.name} [<b>{account.loot[l.id] ?? 0}</b>]</span>
        ))}
      </div>
      {metroRows.length > 0 && (
        <>
          <h3>METROS CLEARED</h3>
          <ul className="rm-metro-progress">
            {metroRows.map((m) => (
              <li key={m.id} className={m.cleared ? 'rm-metro-done' : ''}>
                <span>{m.name}{m.cleared ? ' [CLEARED]' : ''}</span>
                <b>{m.cleared ? m.total : Math.min(m.done, m.total)}/{m.total}</b>
              </li>
            ))}
          </ul>
        </>
      )}
      <h3>STIMPAKS: {account.stimpaks}</h3>
      <ul className="rm-arsenal">
        {STIMPAK_TRADES.map((t) => (
          <li key={t.id}>
            <button type="button" className="rm-btn rm-btn-ghost rm-arsenal-buy" disabled={affordableQty(account.loot, t.cost) < 1} onClick={() => setAsk({ kind: 'stimpak', id: t.id })}>
              {describeBag(t.cost as LootBag).toUpperCase()} FOR 1 STIMPAK
            </button>
          </li>
        ))}
      </ul>
      <h3>LEGENDARY TIME: {account.legendaryTime}</h3>
      <p className="rm-fine">Slows the enemies for four seconds in the shooting gallery. Tap the stopwatch.</p>
      <ul className="rm-arsenal">
        {TIME_TRADES.map((t) => (
          <li key={t.id}>
            <button type="button" className="rm-btn rm-btn-ghost rm-arsenal-buy" disabled={affordableQty(account.loot, t.cost) < 1} onClick={() => setAsk({ kind: 'time', id: t.id })}>
              {describeBag(t.cost as LootBag).toUpperCase()} FOR 1 LEGENDARY TIME
            </button>
          </li>
        ))}
      </ul>
      <h3>GUNS</h3>
      <ul className="rm-arsenal">
        {WEAPON_CLASS_IDS.map((cls) => {
          const tier = account.arsenal[cls];
          const next = nextWeapon(account.arsenal, cls);
          const owned = tier > 0 ? weaponAt(cls, tier as 1 | 2 | 3 | 4) : null;
          return (
            <li key={cls}>
              <div className="rm-arsenal-head"><span>{WEAPON_CLASSES[cls].label.toUpperCase()}</span><b>{owned ? `${owned.name} (TIER ${tier})` : 'NONE'}</b></div>
              {next && (
                <button
                  type="button"
                  className="rm-btn rm-btn-ghost rm-arsenal-buy"
                  disabled={!canAfford(account.loot, next.recipe)}
                  onClick={() => setAsk({ kind: 'gun', id: cls })}
                  title={next.real}
                >
                  {tier === 0 ? 'UNLOCK' : 'UPGRADE TO'} {next.name.toUpperCase()}: {describeBag(next.recipe)}
                </button>
              )}
            </li>
          );
        })}
      </ul>

      {ask && (() => {
        const failed = (reason?: string) => (reason === 'full' ? 'YOU CAN HOLD AT MOST 99.' : reason === 'loot' ? 'NOT ENOUGH LOOT.' : 'THAT DID NOT GO THROUGH. NOTHING WAS SPENT.');
        if (ask.kind === 'gun') {
          const next = nextWeapon(account.arsenal, ask.id);
          if (!next) return null;
          return (
            <ConfirmSpend
              title={account.arsenal[ask.id] === 0 ? 'UNLOCK A GUN' : 'UPGRADE A GUN'} what={next.name.toUpperCase()} cost={next.recipe} have={account.loot} verb={account.arsenal[ask.id] === 0 ? 'UNLOCK' : 'UPGRADE'}
              onClose={() => setAsk(null)}
              onConfirm={async () => { const r = await craftWeapon(ask.id); await account.refresh(); return r.ok ? null : failed(r.reason); }}
            />
          );
        }
        const trade = (ask.kind === 'time' ? TIME_TRADES : STIMPAK_TRADES).find((t) => t.id === ask.id);
        if (!trade) return null;
        const owned = ask.kind === 'time' ? account.legendaryTime : account.stimpaks;
        return (
          <ConfirmSpend
            title={ask.kind === 'time' ? 'BUY LEGENDARY TIME' : 'BUY STIMPAKS'} what={ask.kind === 'time' ? 'LEGENDARY TIME' : 'STIMPAK'} cost={trade.cost as LootBag} have={account.loot}
            max={Math.min(affordableQty(account.loot, trade.cost), 99 - owned)} owned={owned} counted verb="BUY"
            onClose={() => setAsk(null)}
            onConfirm={async (qty) => { const r = await (ask.kind === 'time' ? tradeTime : tradeStimpak)(trade.id, qty); await account.refresh(); return r.ok ? null : failed(r.reason); }}
          />
        );
      })()}

      <h3>PLACES YOU HAVE FOUND ({recent.length})</h3>
      {recent.length === 0 && <p className="rm-empty">Nothing found yet. Fast travel to a place, or turn on AUTO-DISCOVER and go for a walk.</p>}
      <ul className={`rm-found-places rm-found-recent${expanded ? ' rm-found-window' : ''}`}>
        {shown.map((p) => {
          const unlocked = account.unlocked.has(p.id) || !!freeRenderFor(p.id);
          const plan = p.id === homeId ? homePlan() : planFor(p.id, p.worth ?? 10);
          const cleared = account.cleared.has(p.id);
          return (
            <li key={p.id} className="rm-found-place">
              <span className="rm-found-icon rm-icon-filled" dangerouslySetInnerHTML={{ __html: iconOf(p.id) }} />
              <button type="button" className="rm-found-go" onClick={() => onGoTo(p)}>
                <b>{p.name}</b>
                <i>{unlocked ? '\u{1F513}' : '\u{1F512}'} snapshot · {cleared ? '[CLEARED]' : `${planEnemies(plan)} · ${lootSummary(plan)}`}</i>
              </button>
              {unlocked && (
                <button type="button" className="rm-found-snap" onClick={() => onSnapshot(p)} title="Open the snapshot" aria-label={`Open the snapshot of ${p.name}`}>
                  <SnapshotIcon />
                </button>
              )}
            </li>
          );
        })}
      </ul>
      {recent.length > 5 && (
        <button type="button" className="rm-btn rm-btn-ghost rm-found-more" aria-expanded={expanded} onClick={() => setExpanded((v) => !v)}>
          {expanded ? 'SHOW FEWER' : `SHOW ALL ${recent.length}`}
        </button>
      )}
      <LegalLinks />
      <DeleteLine />
    </div>
  );
}

export function SharePanel({ query, look, account }: { query: string; look: LookId; account: Account }) {
  const [copied, setCopied] = useState(false);
  const link = query ? buildShareUrl({ query, look }) : '';
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      window.prompt('Copy this link:', link);
    }
  };
  return (
    <div className="rm-share">
      <p>Anyone who opens the link sees the same wasteland in the same look.</p>
      <input className="rm-link" readOnly value={link || 'Pick a place first'} onFocus={(e) => e.currentTarget.select()} aria-label="Share link" />
      <div className="rm-row-buttons">
        <button type="button" className="rm-btn" disabled={!link} onClick={copy}>{copied ? 'COPIED' : 'COPY LINK'}</button>
        <button type="button" className="rm-btn" disabled={!link} onClick={() => window.print()}>PRINT POSTER</button>
      </div>
      <p className="rm-fine">
        The poster prints exactly what is on screen (use "Save as PDF" in the print window). Map imagery belongs to Google and is for your own
        use; WastelandMaps is an unofficial fan project and is not affiliated with Bethesda or Microsoft.
      </p>
      <Leaderboard account={account} />
    </div>
  );
}

/** The address atlas of the metro on the map: how many addresses other survivors have rendered here, and the one-time unlock of all of them. */
function AtlasBox({ account, metro }: { account: Account; metro: { id: string; name: string } }) {
  const [count, setCount] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const unlocked = account.metros.has(metro.id);
  useEffect(() => {
    let cancelled = false;
    setCount(null);
    void atlasCount(metro.id).then((r) => { if (!cancelled) setCount(r?.count ?? 0); });
    return () => { cancelled = true; };
  }, [metro.id, unlocked]);
  const unlock = async () => {
    setBusy(true);
    setNote('');
    const result = await atlasUnlock(metro.id);
    setNote(result === 'no_credits' ? `You need ${caps(METRO_COST)} caps.` : result === 'error' ? 'That did not go through. Nothing was charged.' : '');
    setBusy(false);
    await account.refresh();
  };
  return (
    <div className="rm-atlas">
      <h3>ADDRESS ATLAS · {metro.name.toUpperCase()}</h3>
      {unlocked ? (
        <p className="rm-fine">Unlocked. Every address rendered here{count ? ` (${count} so far)` : ''}, including ones added later, is on your map; open one to see it and loot it.</p>
      ) : (
        <>
          <p className="rm-fine">{count === null ? 'Counting…' : count === 0 ? 'No addresses are rendered here yet.' : `${count} address${count === 1 ? '' : 'es'} here have been rendered by other survivors.`} Unlock them all, now and in the future, for <Caps n={caps(METRO_COST)} />.</p>
          <button type="button" className="rm-btn rm-btn-ghost" disabled={busy || (account.credits ?? 0) < METRO_COST} onClick={() => void unlock()}>
            UNLOCK THE WHOLE METRO · <Caps n={caps(METRO_COST)} />
          </button>
          {(account.credits ?? 0) < METRO_COST && <p className="rm-fine">You have <Caps n={caps(account.credits ?? 0)} />. Buy a pack to get more.</p>}
        </>
      )}
      {note && <p className="rm-account-note">{note}</p>}
    </div>
  );
}

/** The last line of the Data tab: delete the account, after a warning and a confirmation. They can sign up again with the same email afterwards. */
function DeleteLine() {
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  if (!asking) {
    return <p className="rm-delete-line"><button type="button" onClick={() => setAsking(true)}>Delete my account</button></p>;
  }
  return (
    <div className="rm-delete-confirm" role="alertdialog" aria-label="Delete my account">
      <p><b>Delete your account?</b> You will lose all your progress: the places you have found, your level and XP, your caps, loot and guns, your home and your own places. This cannot be undone. You can sign up again with the same email, but you will start from the beginning.</p>
      <div className="rm-row-buttons">
        <button
          type="button" className="rm-btn rm-danger" disabled={busy}
          onClick={async () => { setBusy(true); const ok = await deleteAccount(); if (!ok) { setNote('The account could not be deleted. Try again in a moment.'); setBusy(false); } }}
        >
          {busy ? 'DELETING…' : 'YES, DELETE EVERYTHING'}
        </button>
        <button type="button" className="rm-btn rm-btn-ghost" disabled={busy} onClick={() => setAsking(false)}>CANCEL</button>
      </div>
      {note && <p className="rm-account-note">{note}</p>}
    </div>
  );
}

/** The privacy policy and support links: shown on the Data tab signed in or not. */
function LegalLinks() {
  return (
    <p className="rm-fine rm-privacy-line"><a href={`${import.meta.env.BASE_URL}privacy.html`} target="_blank" rel="noreferrer">Privacy policy</a> · <a href="https://wastelandmaps.com/support.html" target="_blank" rel="noopener noreferrer">Support</a> · <a href={`${import.meta.env.BASE_URL}age-rating.html`} target="_blank" rel="noreferrer">Age suitability</a></p>
  );
}

/** In the app: a line to forget the sign-ins saved behind Face ID on this phone (shown only if there are any). */
function ForgetFaceId() {
  const [count, setCount] = useState(savedFaceIds().length);
  const [name, setName] = useState<string | null>(null);
  useEffect(() => { void faceIdName().then(setName); }, []);
  if (!name || count === 0) return null;
  return (
    <p className="rm-fine">
      {name === 'FACE ID' ? 'Face ID' : name === 'TOUCH ID' ? 'Touch ID' : 'Biometric'} sign-in is on for this phone.{' '}
      <button type="button" className="rm-link" onClick={() => void forgetFaceId().then(() => setCount(0))}>Forget it</button>
    </p>
  );
}

/** Buying caps: one button under the balance, which opens the three packs in a popup (the website's payment page, or the App Store's own purchase in the iPhone app). */
function Packs({ onBought }: { onBought: () => void }) {
  const [open, setOpen] = useState(false);
  if (!purchasesAvailable()) {
    return <p className="rm-fine">Caps cannot be bought inside the app yet. The ones you have, and the free ones from levelling up, work here.</p>;
  }
  return (
    <div>
      <button type="button" className="rm-btn rm-btn-ghost rm-trade-money" onClick={() => setOpen(true)}>TRADE PRE-WAR MONEY</button>
      {open && <BuyCaps title="TRADE PRE-WAR MONEY" onClose={() => setOpen(false)} onBought={onBought} />}
    </div>
  );
}
