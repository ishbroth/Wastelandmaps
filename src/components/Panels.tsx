import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { distanceMeters, subtitle, type CategoryId, type Location } from '../lib/wasteland';
import { freeRenderFor } from '../lib/renders';
import { LOOT_CAP } from '../lib/raid/loot';
import { waitingLine } from '../lib/waitingLoot';
import { enemiesLine, lootSummary, raidFor } from '../lib/raid/raid';
import LockIcon from './LockIcon';
import VacationCog from './VacationCog';
import type { VacationChoice, VacationOffer } from './VaultHome';
import { personalId, personalLocation } from '../lib/personal';
import { purchasesAvailable } from '../lib/native';
import Leaderboard from './Leaderboard';
import Caps, { CapIcon } from './Caps';
import { StimpakIcon, StopwatchIcon } from './ItemIcons';
import { STIMPAK_TRADES, TIME_TRADES, offersFor, tradeWindow, tradeWindowEnds } from '../../supabase/functions/_shared/stimpak';
import ConfirmSpend from './ConfirmSpend';
import BuyCaps from './BuyCaps';
import { METRO_COST, caps, loadTradesBought, tradeStimpak, tradeTime, atlasCount, atlasUnlock, craftWeapon, deleteAccount, signOut, type Account, type FoundPlace } from '../lib/account';
import { levelInfo } from '../lib/points';
import { LOOT_TYPES, canAfford, describeBag, type LootBag } from '../lib/raid/loot';
import { WEAPON_CLASS_IDS, WEAPON_CLASSES, magazineOf, nextWeapon, weaponAt, type Weapon, type WeaponClass } from '../lib/raid/weapons';
import { loadEquipped, saveEquipped, type Equipped } from '../lib/raid/equipped';

import { placeIcon } from '../lib/placeIcons';
import CategoryChips from './CategoryChips';
import { iconHtmlFor } from '../lib/landmarkIcons';
import { buildShareUrl } from '../lib/share';
import { LOOKS, type LookId } from '../lib/looks';
import Gallery, { type GalleryNow } from './Gallery';
import { printImage, renderMapPoster, renderPicturePoster, saveImage, type MapPosterInput } from '../lib/poster';
import type { Region } from '../lib/google';

/** Is this place's snapshot unlocked? The same test the snapshot button uses: a free landmark, a place unlocked with a credit, or your home (unlocked under its vault key). */
function snapshotUnlocked(account: Account, id: string): boolean {
  // a cleared place was unlocked: the raid is refused on the server until it is (so a cleared one never shows as locked, whichever way it was unlocked: one at a time, or the whole metro's atlas)
  if (account.unlocked.has(id) || account.cleared.has(id) || freeRenderFor(id)) return true;
  if (id.startsWith('me:')) {
    const place = id.slice(3);
    for (const key of account.unlocked) if (key.startsWith(`vault:${place}:`)) return true;
  }
  return false;
}

const miles = (m: number) => (m < 160 ? `${Math.round(m * 3.281)} ft` : `${(m / 1609.34).toFixed(1)} mi`);

export function LocationsPanel({ metro, account, region, locations: everywhere, hidden, onToggleCategory, personalOn, onTogglePersonal, selectedId, visited, cleared, onSelect, vacation, onVacation }: {
  /** Vacation vaults: a cog beside [CLEARED] on a cleared place outside the home metro. */
  vacation?: VacationOffer;
  onVacation?: (choice: VacationChoice) => void;
  /** The metro under the map: the list is its places only, and changes as the map moves to another metro (its Project: Atlas sits above the list). */
  metro?: { id?: string; name?: string; lat?: number; lng?: number; radiusKm?: number } | null;
  account: Account;
  region: Region | null;
  locations: Location[];
  hidden: Set<CategoryId>;
  onToggleCategory: (id: CategoryId) => void;
  /** The person's own places (addresses they unlocked) are shown, and the switch for that. */
  personalOn: boolean;
  onTogglePersonal: () => void;
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
      .filter((l) => !hidden.has(l.category) && (personalOn || !l.personal))
      .map((l) => ({ l, d: distanceMeters(from, l.position) }))
      .sort((a, b) => a.d - b.d);
  }, [locations, hidden, personalOn, from?.lat, from?.lng]); // eslint-disable-line react-hooks/exhaustive-deps

  const counts = useMemo(() => {
    const m = new Map<CategoryId, number>();
    locations.forEach((l) => m.set(l.category, (m.get(l.category) ?? 0) + 1));
    return m;
  }, [locations]);
  const personalCount = useMemo(() => locations.filter((l) => l.personal).length, [locations]);

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
      <CategoryChips counts={counts} hidden={hidden} onToggle={onToggleCategory} personal={{ count: personalCount, on: personalOn, onToggle: onTogglePersonal }} />
      {account.session && metro?.id && <AtlasBox account={account} metro={{ id: metro.id, name: metro.name ?? metro.id }} />}
      <ul className="rm-list" ref={listRef} style={listHeight ? { height: listHeight } : undefined}>
        {rows.map(({ l, d }) => (
          <li key={l.id} ref={l.id === selectedId ? selectedRow : null} className="rm-row-li">
            <button type="button" className={`rm-row ${l.id === selectedId ? 'rm-row-selected' : ''}`} onClick={() => onSelect(l.id)}>
              <span className={`rm-row-icon${visited.has(l.id) ? ' rm-icon-filled' : ''}`} dangerouslySetInnerHTML={{ __html: iconHtmlFor(l.id, placeIcon(l.icon)) }} />
              <span className="rm-row-text">
                <b>{l.name}{visited.has(l.id) ? ' ✓' : ''}</b>
                <i>{subtitle(l)}</i>
                <small>{cleared.has(l.id) ? '[CLEARED]' : <>{enemiesLine(l)}{l.rads > 60 ? ` · ${l.rads} RADS` : ''} · loot: {lootSummary(raidFor(l))}</>}</small>
                {waitingLine(account.waiting.get(l.id)) && <small className="rm-waiting">WAITING FOR YOU: {waitingLine(account.waiting.get(l.id))}</small>}
              </span>
              <span className="rm-row-dist">{miles(d)}</span>
            </button>
            {onVacation && vacation?.ready && cleared.has(l.id) && vacation.choices.find((c) => c.placeId === l.id) && (
              <VacationCog name={l.name} onClick={() => onVacation(vacation.choices.find((c) => c.placeId === l.id) as VacationChoice)} />
            )}
          </li>
        ))}
        {rows.length === 0 && <li className="rm-empty">Nothing here. Turn a category back on.</li>}
      </ul>
    </div>
  );
}

/** A list that shows this many rows at a time and scrolls through the rest (the window keeps the height of its first rows). */
function useRowWindow(count: number, max: number) {
  const ref = useRef<HTMLUListElement | null>(null);
  const [height, setHeight] = useState<number | null>(null);
  useLayoutEffect(() => {
    const ul = ref.current;
    if (!ul) return;
    const measure = () => {
      const items = Array.from(ul.children).slice(0, max) as HTMLElement[];
      if (count <= max || items.length < max) { setHeight(null); return; }
      const h = Math.ceil(items[max - 1].getBoundingClientRect().bottom - items[0].getBoundingClientRect().top);
      setHeight((prev) => (prev !== null && Math.abs(prev - h) < 2 ? prev : h));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(ul);
    return () => ro.disconnect();
  }, [count, max]);
  return { ref, style: height ? { height } : undefined };
}

/** The Data tab: credits, and every place found, newest first; a place opens on the map, and an unlocked snapshot opens ready to play. */
export function AccountPanel({ account, found, iconOf, locationOf, metroRows, onChangeHome, onAccount, onGoTo, vacation, onVacation }: {
  /** The place itself (what is there: enemies and loot), when it is known. */
  locationOf: (id: string) => Location | undefined;
  vacation?: VacationOffer;
  onVacation?: (choice: VacationChoice) => void;
  account: Account;
  onChangeHome: () => void;
  found: FoundPlace[];
  /** How far along each metro is: the places looted out of the places that count, and whether it is cleared. */
  metroRows: { id: string; name: string; done: number; total: number; cleared: boolean }[];
  /** The icon (as drawn on the map) of a found place. */
  iconOf: (id: string) => string;
  onAccount: () => void;
  onGoTo: (place: FoundPlace) => void;
  onSnapshot?: (place: FoundPlace) => void;
}) {
  /** How the discovered places are ordered: by distance from home, or the newest first. */
  const [sort, setSort] = useState<'dist' | 'time'>('dist');
  /** The "spend this loot?" question that is open, if any. */
  const [ask, setAsk] = useState<{ kind: 'stimpak' | 'time'; id: string } | { kind: 'gun'; id: WeaponClass } | null>(null);
  // the trade board: three offers each for stimpaks and Legendary Time, each bought once, the board changing every four hours
  const [clock, setClock] = useState(() => Date.now());
  useEffect(() => { const id = window.setInterval(() => setClock(Date.now()), 30_000); return () => window.clearInterval(id); }, []);
  const board = tradeWindow(clock);
  const [bought, setBought] = useState<Set<string>>(new Set());
  const refreshBought = () => { if (account.session) void loadTradesBought(board).then(setBought); };
  useEffect(refreshBought, [board, account.session?.user.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const hoursLeft = Math.max(1, Math.ceil((tradeWindowEnds(clock) - clock) / 3_600_000));
  // the tier of each class of gun to take into battle (chosen by scrolling the gun's bubble)
  const who = account.session?.user.id;
  const [equipped, setEquipped] = useState<Equipped>(() => loadEquipped(who));
  useEffect(() => { setEquipped(loadEquipped(who)); }, [who]);
  const equip = (cls: WeaponClass, tier: 1 | 2 | 3 | 4) => { const next = { ...equipped, [cls]: tier }; setEquipped(next); saveEquipped(who, next); };
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
  const homeAt = account.home?.lat !== undefined && account.home?.lng !== undefined ? { lat: account.home.lat, lng: account.home.lng } : null;
  const places = useMemo(() => {
    const rows = recent.map((p) => ({ p, d: homeAt ? distanceMeters(homeAt, { lat: p.lat, lng: p.lng }) : 0 }));
    rows.sort(sort === 'dist' ? (x, y) => x.d - y.d : (x, y) => (x.p.foundAt < y.p.foundAt ? 1 : x.p.foundAt > y.p.foundAt ? -1 : 0));
    return rows;
  }, [recent, sort, homeAt?.lat, homeAt?.lng]); // eslint-disable-line react-hooks/exhaustive-deps

  // the addresses whose snapshot was paid for but that have not been visited yet, nearest to home first
  const foundIds = new Set(found.map((f) => f.id));
  const waitingPlaces = account.personal
    .filter((q) => { const id = personalId(q.placeId); return id !== homeId && !foundIds.has(id) && snapshotUnlocked(account, id); })
    .map((q) => ({ q, loc: personalLocation(q, true), d: homeAt ? distanceMeters(homeAt, { lat: q.lat, lng: q.lng }) : 0 }))
    .sort((x, y) => x.d - y.d);
  const foundWindow = useRowWindow(places.length, 6);
  const waitingWindow = useRowWindow(waitingPlaces.length, 6);

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
      <div className="rm-acct-credits">
        <div><b className="rm-caps-big"><CapIcon />{account.credits === null ? '…' : caps(account.credits).toLocaleString('en-US')}</b> <span>CAPS</span></div>
      </div>
      <Packs onBought={() => void account.refresh()} />

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
        {offersFor('stimpak', board).filter((t) => !bought.has(`stimpak:${t.id}`)).map((t) => (
          <li key={t.id} className="rm-trade-row">
            <span className="rm-trade-icon"><StimpakIcon /></span>
            <button type="button" className={`rm-btn rm-btn-ghost rm-arsenal-buy${bought.has(`stimpak:${t.id}`) ? ' spent' : ''}`} disabled={bought.has(`stimpak:${t.id}`) || !canAfford(account.loot, t.cost as LootBag)} onClick={() => setAsk({ kind: 'stimpak', id: t.id })}>
              {describeBag(t.cost as LootBag).toUpperCase()}
            </button>
          </li>
        ))}
      </ul>
      <h3>LEGENDARY TIME: {account.legendaryTime}</h3>
      <ul className="rm-arsenal">
        {offersFor('time', board).filter((t) => !bought.has(`time:${t.id}`)).map((t) => (
          <li key={t.id} className="rm-trade-row">
            <span className="rm-trade-icon"><StopwatchIcon /></span>
            <button type="button" className={`rm-btn rm-btn-ghost rm-arsenal-buy${bought.has(`time:${t.id}`) ? ' spent' : ''}`} disabled={bought.has(`time:${t.id}`) || !canAfford(account.loot, t.cost as LootBag)} onClick={() => setAsk({ kind: 'time', id: t.id })}>
              {describeBag(t.cost as LootBag).toUpperCase()}
            </button>
          </li>
        ))}
      </ul>
      <h3>GUNS</h3>
      <ul className="rm-arsenal">
        {WEAPON_CLASS_IDS.map((cls) => (
          <li key={cls}>
            <div className="rm-arsenal-head"><span>{WEAPON_CLASSES[cls].label.toUpperCase()}</span></div>
            <GunPicker cls={cls} owned={account.arsenal[cls]} chosen={equipped[cls]} loot={account.loot} onEquip={(t) => equip(cls, t)} onUnlock={() => setAsk({ kind: 'gun', id: cls })} />
          </li>
        ))}
      </ul>

      <h3>HOME</h3>
      <div className="rm-acct-credits">
        <div><span>{account.home?.address ? `${account.home.vaultNumber !== undefined ? `VAULT ${String(account.home.vaultNumber).padStart(4, '0')} · ` : ''}${account.home.address}` : 'Not set'}</span></div>
        <button type="button" className="rm-btn rm-btn-ghost" onClick={onChangeHome}>{account.home?.address ? 'CHANGE' : 'SET HOME'}</button>
      </div>

      {ask && (() => {
        const failed = (reason?: string) => (reason === 'bought' ? 'THAT TRADE IS SPENT UNTIL THE BOARD CHANGES.' : reason === 'full' ? 'YOU CAN HOLD AT MOST 99.' : reason === 'loot' ? 'NOT ENOUGH LOOT.' : 'THAT DID NOT GO THROUGH. NOTHING WAS SPENT.');
        if (ask.kind === 'gun') {
          const next = nextWeapon(account.arsenal, ask.id);
          if (!next) return null;
          return (
            <ConfirmSpend
              title={account.arsenal[ask.id] === 0 ? 'UNLOCK A GUN' : 'UPGRADE A GUN'} what={next.name.toUpperCase()} cost={next.recipe} have={account.loot} verb={account.arsenal[ask.id] === 0 ? 'UNLOCK' : 'UPGRADE'}
              onClose={() => setAsk(null)}
              onConfirm={async () => { const r = await craftWeapon(ask.id); if (r.ok && r.tier) equip(ask.id, r.tier as 1 | 2 | 3 | 4); await account.refresh(); return r.ok ? null : failed(r.reason); }}
            />
          );
        }
        const trade = (ask.kind === 'time' ? TIME_TRADES : STIMPAK_TRADES).find((t) => t.id === ask.id);
        if (!trade) return null;
        const owned = ask.kind === 'time' ? account.legendaryTime : account.stimpaks;
        return (
          <ConfirmSpend
            title={ask.kind === 'time' ? 'BUY LEGENDARY TIME' : 'BUY A STIMPAK'} what={ask.kind === 'time' ? 'LEGENDARY TIME' : 'STIMPAK'} cost={trade.cost as LootBag} have={account.loot}
            max={1} owned={owned} verb="BUY"
            onClose={() => setAsk(null)}
            onConfirm={async (qty) => { const r = await (ask.kind === 'time' ? tradeTime : tradeStimpak)(trade.id, qty); await account.refresh(); refreshBought(); return r.ok ? null : failed(r.reason); }}
          />
        );
      })()}

      <h3>DISCOVERED LOCATIONS ({recent.length})</h3>
      {recent.length === 0 && <p className="rm-empty">Nothing found yet. Fast travel to a place, or turn on AUTO-DISCOVER and go for a walk.</p>}
      {recent.length > 1 && (
        <div className="rm-sort-toggle" role="group" aria-label="Order of the discovered locations">
          <button type="button" className={sort === 'dist' ? 'on' : ''} aria-pressed={sort === 'dist'} onClick={() => setSort('dist')}>DIST</button>
          <button type="button" className={sort === 'time' ? 'on' : ''} aria-pressed={sort === 'time'} onClick={() => setSort('time')}>TIME</button>
        </div>
      )}
      <ul className="rm-list rm-found-list" ref={foundWindow.ref} style={foundWindow.style}>
        {places.map(({ p, d }) => {
          const unlocked = snapshotUnlocked(account, p.id);
          const cleared = account.cleared.has(p.id);
          const loc = locationOf(p.id);
          const waiting = waitingLine(account.waiting.get(p.id));
          const choice = vacation?.ready ? vacation.choices.find((c) => c.placeId === p.id) : undefined;
          return (
            <li key={p.id} className="rm-row-li">
              <button type="button" className="rm-row" onClick={() => onGoTo(p)}>
                <span className="rm-row-icon rm-icon-filled" dangerouslySetInnerHTML={{ __html: iconOf(p.id) }} />
                <span className="rm-row-text">
                  <b>{p.name}</b>
                  {p.city && <i>{[p.city, p.state].filter(Boolean).join(', ')}</i>}
                  {cleared
                    ? <small>[CLEARED]</small>
                    : (
                      <>
                        {loc && <small>{enemiesLine(loc)}{loc.rads > 60 ? ` · ${loc.rads} RADS` : ''} · loot: {lootSummary(raidFor(loc))}</small>}
                        <small><LockIcon open={unlocked} /> SNAPSHOT {unlocked ? 'UNLOCKED' : 'LOCKED'}</small>
                      </>
                    )}
                  {waiting && <small className="rm-waiting">WAITING FOR YOU: {waiting}</small>}
                </span>
                {homeAt && <span className="rm-row-dist">{miles(d)}</span>}
              </button>
              {choice && onVacation && <VacationCog name={p.name} onClick={() => onVacation(choice)} />}
            </li>
          );
        })}
      </ul>

      {waitingPlaces.length > 0 && (
        <>
          <h3>WAITING ({waitingPlaces.length})</h3>
          <p className="rm-fine">Snapshots you have unlocked of places you have not been to yet, nearest to home first.</p>
          <ul className="rm-list rm-found-list" ref={waitingWindow.ref} style={waitingWindow.style}>
            {waitingPlaces.map(({ q, loc, d }) => {
              const cleared = account.cleared.has(loc.id);
              const waiting = waitingLine(account.waiting.get(loc.id));
              const place: FoundPlace = { id: loc.id, name: q.name, oldName: null, metroId: null, city: null, state: null, country: null, lat: q.lat, lng: q.lng, foundAt: '', worth: 0 };
              return (
                <li key={loc.id} className="rm-row-li">
                  <button type="button" className="rm-row" onClick={() => onGoTo(place)}>
                    <span className="rm-row-icon" dangerouslySetInnerHTML={{ __html: iconHtmlFor(loc.id, placeIcon(loc.icon)) }} />
                    <span className="rm-row-text">
                      <b>{q.name}</b>
                      <i>{q.address}</i>
                      {cleared
                        ? <small>{waiting ? <span className="rm-waiting">WAITING FOR YOU: {waiting}</span> : '[CLEARED]'}</small>
                        : <small>{enemiesLine(loc)} · loot: {lootSummary(raidFor(loc))}</small>}
                    </span>
                    {homeAt && <span className="rm-row-dist">{miles(d)}</span>}
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}
      <LegalLinks />
      <DeleteLine />
    </div>
  );
}

export function SharePanel({ query, look, account, mapPoster }: { query: string; look: LookId; account: Account; mapPoster: () => MapPosterInput | null }) {
  const [copied, setCopied] = useState(false);
  // the picture on show in the gallery (when it is open): the link, copy, print and save then belong to it; otherwise to the map
  const [now, setNow] = useState<GalleryNow | null>(null);
  const [working, setWorking] = useState(false);
  const [note, setNote] = useState('');
  const mapLink = query ? buildShareUrl({ query, look }) : '';
  const picLink = now ? buildShareUrl({ query: '', look, ...(now.item.lat !== null && now.item.lng !== null ? { view: { lat: now.item.lat, lng: now.item.lng, zoom: now.item.kind === 'place' ? 17 : 18 } } : {}), ...(now.item.kind === 'place' ? { place: now.item.id } : {}) }) : '';
  const link = now ? picLink : mapLink;
  const say = (text: string) => { setNote(text); window.setTimeout(() => setNote(''), 3000); };
  /** The finished picture on show, as a file. */
  const picture = async (): Promise<Blob | null> => { if (!now?.url) return null; try { return await (await fetch(now.url)).blob(); } catch { return null; } };
  const fileName = now ? `${now.item.name.replace(/[^A-Za-z0-9]+/g, '-')}-wastelandmaps.png` : `${(query || 'wasteland').split(',')[0].replace(/[^A-Za-z0-9]+/g, '-')}-wastelandmaps.png`;
  const save = async () => {
    setWorking(true);
    try {
      if (now) { const blob = await picture(); if (!blob) { say('That picture is not ready yet'); return; } await saveImage(blob, fileName, now.item.name); }
      else { const input = mapPoster(); if (!input) { say('Move the map a little first'); return; } await saveImage(await renderMapPoster(input), fileName, query); }
    } catch { say('That could not be saved'); } finally { setWorking(false); }
  };
  const print = async () => {
    setWorking(true);
    try {
      if (now) { const blob = await picture(); if (!blob) { say('That picture is not ready yet'); return; } await printImage(await renderPicturePoster(blob, LOOKS[look])); }
      else { const input = mapPoster(); if (!input) { say('Move the map a little first'); return; } await printImage(await renderMapPoster(input)); }
    } catch { say('That could not be printed'); } finally { setWorking(false); }
  };
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
      <input className="rm-link" readOnly value={link || 'Pick a place first'} onFocus={(e) => e.currentTarget.select()} aria-label="Share link" />
      <div className="rm-row-buttons">
        <button type="button" className="rm-btn" disabled={!link} onClick={copy}>{copied ? 'COPIED' : 'COPY'}</button>
        <button type="button" className="rm-btn" disabled={!link || working} onClick={() => void print()}>PRINT</button>
        <button type="button" className="rm-btn" disabled={!link || working} onClick={() => void save()}>{working ? 'WORKING…' : 'SAVE'}</button>
      </div>
      {note && <p className="rm-fine" role="status">{note}</p>}
      <Gallery account={account} onNow={setNow} />
      <p className="rm-fine">
        Map imagery belongs to Google and is for your own use; WastelandMaps is an unofficial fan project and is not affiliated with any game publisher or developer.
      </p>
      <Leaderboard account={account} />
    </div>
  );
}

/** Project: Atlas of the metro on the map: how many addresses other survivors have rendered here, and the one-time unlock of all of them. */
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
      <h3>PROJECT: ATLAS · {metro.name.toUpperCase()}</h3>
      {unlocked ? (
        <p className="rm-fine">Unlocked. Every address and snapshot unlocked by every user in this metro is now on the map and available for you to view and loot.</p>
      ) : (
        <>
          <p className="rm-fine">{count === null ? 'Counting…' : count === 0 ? 'No addresses are rendered here yet.' : `${count} address${count === 1 ? '' : 'es'} here have been rendered by other survivors.`} Unlock them all, now and in the future, for <Caps n={caps(METRO_COST)} />.</p>
          <button type="button" className={`rm-btn rm-btn-ghost${(account.credits ?? 0) >= METRO_COST ? ' rm-can' : ''}`} disabled={busy || (account.credits ?? 0) < METRO_COST} onClick={() => void unlock()}>
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

/** What a gun's number says in the bubble: how hard it hits, and how many rounds before it has to be reloaded (or its whole supply, for the launchers). */
const ammoOf = (w: Weapon): number => magazineOf(w) || w.ammo || 0;

/**
 * One class of gun, as a single bubble with an up and a down arrow beside it. The gun in it is the one that goes into the next battle; arrow up brings up the next
 * better gun in the class and arrow down the one before it. A gun that is owned is chosen as soon as it is shown; one that is not shows what it costs (bright if
 * there is enough loot, dim if not) with a button to unlock it. A gun cannot be unlocked before the one under it.
 */
/** The small hand-free picture of a gun, at the right of its card (nothing if there is none for it). */
function GunIcon({ id, dim }: { id: string; dim: boolean }) {
  const [ok, setOk] = useState(true);
  return ok ? <img className={`rm-gun-img${dim ? ' dim' : ''}`} src={`${import.meta.env.BASE_URL}raid/gunicons/${id}.webp`} alt="" draggable={false} onError={() => setOk(false)} /> : null;
}
function GunPicker({ cls, owned, chosen, loot, onEquip, onUnlock }: { cls: WeaponClass; owned: number; chosen?: number; loot: Account['loot']; onEquip: (tier: 1 | 2 | 3 | 4) => void; onUnlock: () => void }) {
  const best = Math.max(1, owned);
  const [shown, setShown] = useState<number>(Math.max(1, Math.min(chosen ?? best, best)));
  // a gun that has just been unlocked is shown
  const lastOwned = useRef(owned);
  useEffect(() => { if (owned > lastOwned.current) setShown(owned); lastOwned.current = owned; }, [owned]);
  const w = weaponAt(cls, shown as 1 | 2 | 3 | 4);
  const have = shown <= owned;
  const go = (to: number) => {
    const t = Math.max(1, Math.min(4, to));
    if (t === shown) return;
    setShown(t);
    if (t <= owned) onEquip(t as 1 | 2 | 3 | 4);
  };
  const next = shown === owned + 1;
  const affordable = canAfford(loot, w.recipe);
  const swipe = useRef<number | null>(null);
  return (
    <div className="rm-gun" role="group" aria-label={`${WEAPON_CLASSES[cls].label}: ${w.name}`}>
      <div
        className={`rm-gun-card${have ? ' have' : affordable && next ? ' can' : ' dim'}`}
        onPointerDown={(e) => { swipe.current = e.clientY; }}
        onPointerUp={(e) => { const y0 = swipe.current; swipe.current = null; if (y0 === null) return; const d = e.clientY - y0; if (Math.abs(d) > 28) go(shown + (d < 0 ? 1 : -1)); }}
        title={w.real}
      >
        <div className="rm-gun-main">
          <div className="rm-gun-name"><b>{w.name.toUpperCase()}</b>{have && shown === (chosen ?? best) ? <span>EQUIPPED</span> : null}</div>
          <div className="rm-gun-stats"><span>DAM <b>{w.damage}</b></span><span>AMMO <b>{ammoOf(w)}</b></span><span>TIER <b>{shown}</b></span></div>
          {!have && (
            <div className="rm-gun-cost">
              <span>{describeBag(w.recipe).toUpperCase()}</span>
              {next
                ? <button type="button" className="rm-btn rm-btn-ghost rm-arsenal-buy" disabled={!affordable} onClick={onUnlock}>{owned === 0 ? 'UNLOCK' : 'UPGRADE'}</button>
                : <small>UNLOCK {weaponAt(cls, (shown - 1) as 1 | 2 | 3).name.toUpperCase()} FIRST</small>}
            </div>
          )}
        </div>
        <GunIcon id={w.id} dim={!have} />
      </div>
      <div className="rm-gun-arrows">
        <button type="button" aria-label="Next gun up" disabled={shown >= 4} onClick={() => go(shown + 1)}>▲</button>
        <button type="button" aria-label="Gun below" disabled={shown <= 1} onClick={() => go(shown - 1)}>▼</button>
      </div>
    </div>
  );
}
