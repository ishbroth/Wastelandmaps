// The gallery: the finished pictures this person has unlocked (never the original photo, the bomb or the video), flipped through left and right, whether or not they have
// ever been to the place. Collapsed until opened. It tells the Share tab which picture is showing so the link above it, and the copy, print and save buttons, follow it.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { galleryUrl, loadGallery, type Account, type GalleryItem } from '../lib/account';
import { distanceMeters } from '../lib/wasteland';
import { loadIndex, metroAt } from '../lib/metros';
import { shareImage } from '../lib/poster';

export interface GalleryNow { item: GalleryItem; city: string | null; url: string | null }

export default function Gallery({ account, onNow }: { account: Account; onNow: (now: GalleryNow | null) => void }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<GalleryItem[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [sort, setSort] = useState<'dist' | 'time'>('time');
  const [urls, setUrls] = useState<Record<string, string | 'none'>>({});
  const [cities, setCities] = useState<Record<string, string>>({});
  const [index, setIndex] = useState(0);
  const [note, setNote] = useState('');
  const track = useRef<HTMLDivElement>(null);
  const asked = useRef(new Set<string>());

  // the list is asked for when the gallery is first opened
  useEffect(() => {
    if (!open || items !== null || !account.session) return;
    let cancelled = false;
    void loadGallery().then((r) => { if (cancelled) return; if (r) setItems(r); else setFailed(true); });
    return () => { cancelled = true; };
  }, [open, items, account.session]);

  const homeAt = account.home?.lat !== undefined && account.home?.lng !== undefined ? { lat: account.home.lat, lng: account.home.lng } : null;
  const shown = useMemo(() => {
    const rows = (items ?? []).map((it) => ({ it, d: homeAt && it.lat !== null && it.lng !== null ? distanceMeters(homeAt, { lat: it.lat, lng: it.lng }) : Number.POSITIVE_INFINITY }));
    rows.sort(sort === 'dist' ? (a, b) => a.d - b.d : (a, b) => (a.it.at < b.it.at ? 1 : a.it.at > b.it.at ? -1 : 0));
    return rows.map((r) => r.it);
  }, [items, sort, homeAt?.lat, homeAt?.lng]); // eslint-disable-line react-hooks/exhaustive-deps

  // the city of each one: what the server knew, or the metro it is in
  useEffect(() => {
    if (!shown.length) return;
    let cancelled = false;
    void loadIndex().then((metros) => {
      if (cancelled) return;
      const next: Record<string, string> = {};
      for (const it of shown) {
        if (it.city) next[it.id] = it.city;
        else if (it.lat !== null && it.lng !== null) { const m = metroAt(metros, { lat: it.lat, lng: it.lng }, 120); if (m) next[it.id] = m.name; }
      }
      setCities(next);
    });
    return () => { cancelled = true; };
  }, [shown]);

  // the picture on show and the ones either side of it are fetched (a link for each, good for an hour)
  const want = useCallback((it: GalleryItem | undefined) => {
    if (!it || asked.current.has(it.id)) return;
    asked.current.add(it.id);
    void galleryUrl(it.id).then((u) => setUrls((prev) => ({ ...prev, [it.id]: u ?? 'none' })));
  }, []);
  useEffect(() => { if (open) for (const k of [index, index + 1, index - 1]) want(shown[k]); }, [open, index, shown, want]);

  const current = open ? shown[index] : undefined;
  const currentUrl = current ? (urls[current.id] && urls[current.id] !== 'none' ? urls[current.id] : null) : null;
  useEffect(() => { onNow(current ? { item: current, city: cities[current.id] ?? current.city, url: currentUrl } : null); }, [current, currentUrl, cities]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => onNow(null), []); // eslint-disable-line react-hooks/exhaustive-deps

  // the order changed: back to the first picture
  useEffect(() => { setIndex(0); track.current?.scrollTo({ left: 0 }); }, [sort]);
  const onScroll = () => {
    const el = track.current;
    if (!el || !el.clientWidth) return;
    const i = Math.round(el.scrollLeft / el.clientWidth);
    if (i !== index) setIndex(Math.max(0, Math.min(shown.length - 1, i)));
  };

  const share = async (it: GalleryItem) => {
    const url = urls[it.id];
    if (!url || url === 'none') return;
    try {
      const blob = await (await fetch(url)).blob();
      const name = `${it.name.replace(/[^A-Za-z0-9]+/g, '-')}-wastelandmaps.png`;
      const how = await shareImage(blob, name, `${it.name} after the bombs`);
      setNote(how === 'saved' ? 'Saved to your device' : how === 'failed' ? 'That could not be shared' : '');
      if (how !== 'shared') window.setTimeout(() => setNote(''), 2600);
    } catch { setNote('That could not be shared'); window.setTimeout(() => setNote(''), 2600); }
  };

  return (
    <section className="rm-gallery" aria-label="Gallery">
      <button type="button" className="rm-gallery-head" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <h3>GALLERY</h3><span aria-hidden="true">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="rm-gallery-body">
          {!account.session && <p className="rm-empty">Sign in to see the pictures you have unlocked.</p>}
          {account.session && items === null && !failed && <p className="rm-empty">Loading your pictures…</p>}
          {failed && <p className="rm-empty">The gallery could not be reached. Try again in a moment.</p>}
          {items !== null && items.length === 0 && <p className="rm-empty">Nothing unlocked yet. Open a place&apos;s snapshot and unlock it, and its picture will be kept here.</p>}
          {shown.length > 1 && (
            <div className="rm-sort-toggle" role="group" aria-label="Order of the pictures">
              <button type="button" className={sort === 'dist' ? 'on' : ''} aria-pressed={sort === 'dist'} onClick={() => setSort('dist')}>DIST</button>
              <button type="button" className={sort === 'time' ? 'on' : ''} aria-pressed={sort === 'time'} onClick={() => setSort('time')}>TIME</button>
            </div>
          )}
          {shown.length > 0 && (
            <>
              <div className="rm-gallery-track" ref={track} onScroll={onScroll}>
                {shown.map((it) => {
                  const url = urls[it.id];
                  return (
                    <figure className="rm-gallery-slide" key={it.id}>
                      <div className="rm-gallery-frame">
                        {url && url !== 'none' ? <img src={url} alt={it.name} draggable={false} /> : <div className="rm-gallery-wait">{url === 'none' ? 'THIS PICTURE IS NOT AVAILABLE RIGHT NOW' : 'LOADING…'}</div>}
                        {url && url !== 'none' && (
                          <button type="button" className="rm-gallery-share" onClick={() => void share(it)} aria-label={`Share the picture of ${it.name}`} title="Share this picture">
                            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12M7 8l5-5 5 5M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                          </button>
                        )}
                      </div>
                      <figcaption><b>{it.name}</b>{cities[it.id] ? <i>{cities[it.id]}</i> : null}</figcaption>
                    </figure>
                  );
                })}
              </div>
              <p className="rm-gallery-count" aria-live="polite">{Math.min(index + 1, shown.length)} OF {shown.length}{note ? ` · ${note}` : ''}</p>
            </>
          )}
        </div>
      )}
    </section>
  );
}
