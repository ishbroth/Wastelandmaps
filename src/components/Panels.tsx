import { useEffect, useMemo, useRef, useState } from 'react';
import { CATEGORIES, distanceMeters, subtitle, type CategoryId, type Location } from '../lib/wasteland';
import { freeRenderFor } from '../lib/renders';
import { LOOT_CAP } from '../lib/raid/loot';
import { enemiesLine } from '../lib/raid/raid';
import { hapticsAvailable, hapticsEnabled, setHaptics } from '../lib/haptics';
import { purchasesAvailable } from '../lib/native';
import { METRO_COST, PACKS, atlasCount, atlasUnlock, buyPack, craftWeapon, deleteAccount, signOut, type Account, type FoundPlace } from '../lib/account';
import { levelInfo } from '../lib/points';
import { LOOT_TYPES, canAfford, describeBag } from '../lib/raid/loot';
import { WEAPON_CLASS_IDS, WEAPON_CLASSES, nextWeapon, weaponAt } from '../lib/raid/weapons';

import { CATEGORY_ICON, placeIcon } from '../lib/placeIcons';
import { iconHtmlFor } from '../lib/landmarkIcons';
import { buildShareUrl } from '../lib/share';
import type { LookId } from '../lib/looks';
import type { Region } from '../lib/google';

const miles = (m: number) => (m < 160 ? `${Math.round(m * 3.281)} ft` : `${(m / 1609.34).toFixed(1)} mi`);

export function LocationsPanel({ region, locations, hidden, onToggleCategory, selectedId, visited, onSelect }: {
  region: Region | null;
  locations: Location[];
  hidden: Set<CategoryId>;
  onToggleCategory: (id: CategoryId) => void;
  selectedId: string | null;
  visited: Set<string>;
  onSelect: (id: string) => void;
}) {
  const rows = useMemo(() => {
    if (!region) return [];
    return locations
      .filter((l) => !hidden.has(l.category))
      .map((l) => ({ l, d: distanceMeters(region.center, l.position) }))
      .sort((a, b) => a.d - b.d);
  }, [locations, hidden, region]);

  const counts = useMemo(() => {
    const m = new Map<CategoryId, number>();
    locations.forEach((l) => m.set(l.category, (m.get(l.category) ?? 0) + 1));
    return m;
  }, [locations]);

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
      <ul className="rm-list">
        {rows.map(({ l, d }) => (
          <li key={l.id} ref={l.id === selectedId ? selectedRow : null}>
            <button type="button" className={`rm-row ${l.id === selectedId ? 'rm-row-selected' : ''}`} onClick={() => onSelect(l.id)}>
              <span className="rm-row-icon" dangerouslySetInnerHTML={{ __html: iconHtmlFor(l.id, placeIcon(l.icon)) }} />
              <span className="rm-row-text">
                <b>{l.name}{visited.has(l.id) ? ' ✓' : ''}</b>
                <i>{subtitle(l)}</i>
                <small>{enemiesLine(l)}{l.rads > 60 ? ` · ${l.rads} RADS` : ''} · loot: {l.loot}</small>
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

const countryName = (iso: string | null) => {
  if (!iso) return '';
  try { return new Intl.DisplayNames(['en'], { type: 'region' }).of(iso) ?? iso; } catch { return iso; }
};

/** The Data tab: credits, and every place found, grouped by city; a place opens on the map, and an unlocked snapshot opens ready to play. */
export function AccountPanel({ account, found, metro, onChangeHome, onAccount, onGoTo, onSnapshot }: {
  account: Account;
  /** The metro the map is showing, for its address atlas. */
  metro?: { id: string; name: string };
  onChangeHome: () => void;
  found: FoundPlace[];
  onAccount: () => void;
  onGoTo: (place: FoundPlace) => void;
  onSnapshot: (place: FoundPlace) => void;
}) {
  const [open, setOpen] = useState<Set<string>>(new Set());
  const groups = useMemo(() => {
    const byCity = new Map<string, { key: string; title: string; places: FoundPlace[]; latest: string }>();
    for (const p of found) {
      const key = p.metroId ?? `${p.city ?? 'unknown'}|${p.country ?? ''}`;
      const title = [p.city ?? 'Somewhere in the wasteland', p.state, countryName(p.country)].filter(Boolean).join(', ');
      const g = byCity.get(key) ?? { key, title, places: [], latest: '' };
      g.places.push(p);
      if (p.foundAt > g.latest) g.latest = p.foundAt;
      byCity.set(key, g);
    }
    return [...byCity.values()].sort((x, y) => (y.latest > x.latest ? 1 : -1));
  }, [found]);

  if (!account.session) {
    return (
      <div className="rm-acct">
        <p>Sign in to keep your record: the places you have found, the snapshots you have unlocked, your credits and where you left the map. It follows you to any device.</p>
        <button type="button" className="rm-btn" onClick={onAccount}>SIGN IN</button>
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
        <div><b>{account.credits === null ? '…' : account.credits}</b> <span>SNAPSHOT CREDITS</span></div>
      </div>
      <Packs />

      <h3>HOME</h3>
      <div className="rm-acct-credits">
        <div><span>{account.home?.address ? `${account.home.vaultNumber ? `VAULT ${account.home.vaultNumber} · ` : ''}${account.home.address}` : 'Not set'}</span></div>
        <button type="button" className="rm-btn rm-btn-ghost" onClick={onChangeHome}>{account.home?.address ? 'CHANGE' : 'SET HOME'}</button>
      </div>
      {metro && <AtlasBox account={account} metro={metro} />}

      <h3>LOOT</h3>
      <div className="rm-loot">
        {LOOT_TYPES.map((l) => (
          <span key={l.id} className={`rm-loot-item${(account.loot[l.id] ?? 0) === 0 ? ' rm-loot-none' : ''}${(account.loot[l.id] ?? 0) >= LOOT_CAP ? ' rm-loot-full' : ''}`} title={`Storage holds ${LOOT_CAP} of each`}><b>{account.loot[l.id] ?? 0}</b>/{LOOT_CAP} {l.name}</span>
        ))}
      </div>
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
                  onClick={() => { void craftWeapon(cls).then(() => account.refresh()); }}
                  title={next.real}
                >
                  {tier === 0 ? 'UNLOCK' : 'UPGRADE TO'} {next.name.toUpperCase()}: {describeBag(next.recipe)}
                </button>
              )}
            </li>
          );
        })}
      </ul>

      <h3>PLACES YOU HAVE FOUND ({found.length})</h3>
      {groups.length === 0 && <p className="rm-empty">Nothing found yet. Fast travel to a place, or turn on AUTO-DISCOVER and go for a walk.</p>}
      {groups.map((g) => {
        const isOpen = open.has(g.key);
        return (
          <div key={g.key} className="rm-found-city">
            <button
              type="button"
              className="rm-found-head"
              aria-expanded={isOpen}
              onClick={() => setOpen((prev) => { const next = new Set(prev); if (next.has(g.key)) next.delete(g.key); else next.add(g.key); return next; })}
            >
              <span><b>{g.title}</b><small>{g.places.length} found</small></span>
              <span aria-hidden="true">{isOpen ? '▾' : '▸'}</span>
            </button>
            {isOpen && (
              <ul className="rm-found-places">
                {g.places.map((p) => (
                  <li key={p.id} className="rm-found-place">
                    <button type="button" className="rm-found-go" onClick={() => onGoTo(p)}>
                      <b>{p.name}</b>
                      {p.oldName && p.oldName !== p.name && <i>formerly {p.oldName}</i>}
                    </button>
                    {(account.unlocked.has(p.id) || freeRenderFor(p.id)) && (
                      <button type="button" className="rm-found-snap" onClick={() => onSnapshot(p)} title="Open the snapshot" aria-label={`Open the snapshot of ${p.name}`}>
                        <SnapshotIcon />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
      <p className="rm-fine rm-privacy-line"><a href={`${import.meta.env.BASE_URL}privacy.html`} target="_blank" rel="noreferrer">Privacy policy</a></p>
      <DeleteLine />
    </div>
  );
}

export function SharePanel({ query, look, soundOn, onToggleSound }: { query: string; look: LookId; soundOn: boolean; onToggleSound: () => void }) {
  const [copied, setCopied] = useState(false);
  const [haptics, setHapticsState] = useState(hapticsEnabled());
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
        <button type="button" className="rm-btn" onClick={onToggleSound} aria-pressed={soundOn}>SOUND {soundOn ? 'ON' : 'OFF'}</button>
        {hapticsAvailable() && <button type="button" className="rm-btn" onClick={() => { setHaptics(!haptics); setHapticsState(!haptics); }} aria-pressed={haptics}>VIBRATION {haptics ? 'ON' : 'OFF'}</button>}
      </div>
      <p className="rm-fine">
        The poster prints exactly what is on screen (use "Save as PDF" in the print window). Map imagery belongs to Google and is for your own
        use; WastelandMaps is an unofficial fan project and is not affiliated with Bethesda or Microsoft.
      </p>
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
    setNote(result === 'no_credits' ? `You need ${METRO_COST} credits.` : result === 'error' ? 'That did not go through. Nothing was charged.' : '');
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
          <p className="rm-fine">{count === null ? 'Counting…' : count === 0 ? 'No addresses are rendered here yet.' : `${count} address${count === 1 ? '' : 'es'} here have been rendered by other survivors.`} Unlock them all, now and in the future, for {METRO_COST} credits.</p>
          <button type="button" className="rm-btn rm-btn-ghost" disabled={busy || (account.credits ?? 0) < METRO_COST} onClick={() => void unlock()}>
            UNLOCK THE WHOLE METRO · {METRO_COST} CREDITS
          </button>
          {(account.credits ?? 0) < METRO_COST && <p className="rm-fine">You have {account.credits ?? 0}. Buy a pack to get more.</p>}
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
      <p><b>Delete your account?</b> You will lose all your progress: the places you have found, your level and XP, your credits, loot and guns, your home and your own places. This cannot be undone. You can sign up again with the same email, but you will start from the beginning.</p>
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

/** Buying credits: three packs on the website; in the app the stores' own purchase system will be used (not added yet). */
function Packs() {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  if (!purchasesAvailable()) {
    return <p className="rm-fine">Credits cannot be bought inside the app yet. The ones you have, and the free ones from levelling up, work here.</p>;
  }
  const buy = async (pack: string) => {
    setBusy(true);
    const problem = await buyPack(pack);
    if (problem) { setNote(problem); setBusy(false); }
  };
  return (
    <div>
      <div className="rm-packs">
        {PACKS.map((pk) => (
          <button key={pk.id} type="button" className="rm-btn rm-btn-ghost" disabled={busy} onClick={() => void buy(pk.id)}>BUY {pk.credits} CREDITS: {pk.price}</button>
        ))}
      </div>
      <p className="rm-fine">Pay by card, Apple Pay or Google Pay through Stripe. A render that cannot be made gives your credit back.</p>
      {note && <p className="rm-account-note">{note}</p>}
    </div>
  );
}
