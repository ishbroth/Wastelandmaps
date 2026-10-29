import { useEffect, useMemo, useRef, useState } from 'react';
import { CATEGORIES, categoryById, distanceMeters, formatCoords, subtitle, type CategoryId, type Location, type Wasteland } from '../lib/wasteland';

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
                <small>{l.threat}{l.rads > 60 ? ` · ${l.rads} RADS` : ''} · loot: {l.loot}</small>
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

export function DataPanel({ region, wasteland, locations }: { region: Region | null; wasteland: Wasteland | null; locations: Location[] }) {
  if (!region || !wasteland) return <p className="rm-empty">No data. Pick a place to begin.</p>;
  const hot = wasteland.zones.reduce((n, z) => Math.max(n, z.rads), 0);
  const byCat = new Map<CategoryId, number>();
  locations.forEach((l) => byCat.set(l.category, (byCat.get(l.category) ?? 0) + 1));
  return (
    <dl className="rm-data">
      <dt>REGION</dt><dd>{wasteland.regionName}</dd>
      <dt>OLD WORLD NAME</dt><dd>{region.address}</dd>
      <dt>COORDINATES</dt><dd>{formatCoords(region.center)}</dd>
      <dt>NEAREST VAULT</dt><dd>VAULT {wasteland.vault.number}</dd>
      <dt>IRRADIATED ZONES</dt><dd>{wasteland.zones.length} (worst: {hot} RADS)</dd>
      <dt>LOCATIONS FOUND</dt><dd>{locations.length}</dd>
      <dt>BREAKDOWN</dt>
      <dd>{[...byCat.entries()].sort((a, b) => b[1] - a[1]).map(([id, n]) => `${categoryById(id).label} ${n}`).join(' · ') || 'none'}</dd>
      <dt>YEAR</dt><dd>2287. The bombs fell 210 years ago.</dd>
    </dl>
  );
}

export function SharePanel({ query, look, soundOn, onToggleSound }: { query: string; look: LookId; soundOn: boolean; onToggleSound: () => void }) {
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
        <button type="button" className="rm-btn" onClick={onToggleSound} aria-pressed={soundOn}>SOUND {soundOn ? 'ON' : 'OFF'}</button>
      </div>
      <p className="rm-fine">
        The poster prints exactly what is on screen (use "Save as PDF" in the print window). Map imagery belongs to Google and is for your own
        use; WastelandMaps is an unofficial fan project and is not affiliated with Bethesda or Microsoft.
      </p>
    </div>
  );
}
