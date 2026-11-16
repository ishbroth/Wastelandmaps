import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { atlasContributors, atlasRenderedCounts, type Contributor } from '../lib/account';
import { loadIndex, type MetroEntry } from '../lib/metros';

/** What the map is looking at, for the breakdown: the country, the US state and the metro under the middle of the map. */
export interface AtlasFocus { country: string | null; countryName: string | null; state: string | null; stateName: string | null; metroId: string | null }

const WINDOW = 5;

/** A share of the world with enough digits to show it: 0.00027%, 0.021%, 3.7%, 18.4%. */
function share(p: number): string {
  if (p <= 0) return '0%';
  if (p >= 1) return `${p.toFixed(1)}%`;
  return `${p.toFixed(Math.min(8, 1 - Math.floor(Math.log10(p)))).replace(/0+$/, '')}%`;
}

/** A list that shows five rows and scrolls through the rest, like the other long lists on the Pip-Boy. */
function Window({ rows, label }: { rows: Contributor[]; label: string }) {
  const ref = useRef<HTMLUListElement | null>(null);
  const [height, setHeight] = useState<number | null>(null);
  useLayoutEffect(() => {
    const ul = ref.current;
    if (!ul) return;
    const measure = () => {
      const items = Array.from(ul.children).slice(0, WINDOW) as HTMLElement[];
      if (items.length < WINDOW || rows.length <= WINDOW) { setHeight(null); return; }
      const h = Math.ceil(items[WINDOW - 1].getBoundingClientRect().bottom - items[0].getBoundingClientRect().top);
      setHeight((prev) => (prev !== null && Math.abs(prev - h) < 2 ? prev : h));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(ul);
    return () => ro.disconnect();
  }, [rows]);
  if (rows.length === 0) return <p className="rm-empty">Nobody yet.</p>;
  return (
    <ul className="rm-list rm-board-list" ref={ref} style={height ? { height } : undefined} aria-label={label}>
      {rows.map((r, i) => (
        <li key={`${i}-${r.callsign}`} className="rm-board-row">
          <span className="rm-board-rank">{i + 1}</span>
          <b>{r.callsign}</b>
          <span className="rm-board-lv" />
          <span className="rm-board-places">{r.n} {r.n === 1 ? 'PLACE' : 'PLACES'}</span>
        </li>
      ))}
    </ul>
  );
}

/**
 * Progress: Atlas, under the leaderboard: how much of the world's pre-plotted places have a finished render, for the earth, the country, the state and the metro
 * the map is looking at, then the top discoverers of the world and of that metro (by callsign; only survivors on the leaderboard appear).
 */
export default function AtlasProgress({ focus }: { focus: AtlasFocus | null }) {
  const [index, setIndex] = useState<MetroEntry[] | null>(null);
  const [rendered, setRendered] = useState<Map<string, number> | null>(null);
  const [world, setWorld] = useState<Contributor[] | null>(null);
  const [metroList, setMetroList] = useState<Contributor[] | null>(null);
  useEffect(() => {
    let off = false;
    void loadIndex().then((i) => { if (!off) setIndex(i); });
    void atlasRenderedCounts().then((m) => { if (!off) setRendered(m); });
    void atlasContributors(null).then((l) => { if (!off) setWorld(l); });
    return () => { off = true; };
  }, []);
  const metroId = focus?.metroId ?? null;
  useEffect(() => {
    let off = false;
    setMetroList(null);
    if (metroId) void atlasContributors(metroId).then((l) => { if (!off) setMetroList(l); });
    return () => { off = true; };
  }, [metroId]);

  const rows = useMemo(() => {
    if (!index || !rendered) return [];
    const part = (match: (m: MetroEntry) => boolean) => {
      let total = 0, done = 0;
      for (const m of index) if (match(m)) { total += m.places; done += Math.min(rendered.get(m.id) ?? 0, m.places); }
      return total > 0 ? (done / total) * 100 : 0;
    };
    const out: { label: string; pct: number }[] = [{ label: 'Earth Rendered', pct: part(() => true) }];
    if (focus?.country && focus.countryName) out.push({ label: focus.countryName, pct: part((m) => m.country === focus.country) });
    if (focus?.state && focus.stateName) out.push({ label: focus.stateName, pct: part((m) => m.country === 'US' && m.id.split('-')[1]?.toUpperCase() === focus.state) });
    const metro = metroId ? index.find((m) => m.id === metroId) : null;
    if (metro) out.push({ label: metro.name, pct: part((m) => m.id === metro.id) });
    return out;
  }, [index, rendered, focus, metroId]);
  const metroName = metroId && index ? index.find((m) => m.id === metroId)?.name : null;

  return (
    <div className="rm-atlas-progress">
      <h3>PROGRESS: ATLAS</h3>
      {rows.length === 0 ? <p className="rm-fine">Counting…</p> : (
        <ul className="rm-atlas-rows">
          {rows.map((r) => <li key={r.label}><span>{r.label}:</span> <b>{share(r.pct)}</b></li>)}
        </ul>
      )}
      <h4>TOP CONTRIBUTORS</h4>
      {world === null ? <p className="rm-fine">Loading…</p> : <Window rows={world} label="Top contributors in the world" />}
      {metroName && (
        <>
          <h4>TOP CONTRIBUTORS: {metroName.toUpperCase()}</h4>
          {metroList === null ? <p className="rm-fine">Loading…</p> : <Window rows={metroList} label={`Top contributors in ${metroName}`} />}
        </>
      )}
    </div>
  );
}
