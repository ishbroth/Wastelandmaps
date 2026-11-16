import { useEffect, useState } from 'react';
import { dueToRate, markAsked, rated, USE_BEFORE_ASK } from '../lib/rateApp';

/**
 * "Enjoying WastelandMaps? Rate it" with five stars, in the store apps only: it appears after a few minutes of use (never while navigating or with another
 * window open), once, then again every week until a star is tapped. Tapping a star opens the store's review and ends the asking; NOT NOW waits for next week.
 */
export default function RatePrompt({ quiet }: { /** Something else has the screen (navigation, a window): wait. */ quiet: boolean }) {
  const [open, setOpen] = useState(false);
  const [used, setUsed] = useState(0);
  const [lit, setLit] = useState(0);

  // counts the seconds the app is open and in front
  useEffect(() => {
    if (!dueToRate()) return;
    const t = window.setInterval(() => { if (document.visibilityState === 'visible') setUsed((n) => n + 5); }, 5000);
    return () => window.clearInterval(t);
  }, []);
  useEffect(() => {
    if (open || quiet || used < USE_BEFORE_ASK || !dueToRate()) return;
    markAsked();
    setOpen(true);
  }, [used, quiet, open]);

  if (!open) return null;
  const close = () => setOpen(false);
  const pick = (n: number) => { setLit(n); void rated().then(() => window.setTimeout(close, 400)); };
  return (
    <div className="rm-modal" role="dialog" aria-modal="true" aria-label="Rate WastelandMaps">
      <div className="rm-modal-card rm-account rm-rate" onClick={(e) => e.stopPropagation()}>
        <div className="rm-modal-head"><div><h2>ENJOYING WASTELANDMAPS?</h2><p>A rating helps other survivors find it</p></div></div>
        <div className="rm-account-body">
          <div className="rm-stars" role="group" aria-label="Rate from one to five stars">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} type="button" className={`rm-star${n <= lit ? ' on' : ''}`} aria-label={`${n} ${n === 1 ? 'star' : 'stars'}`} onMouseEnter={() => setLit(n)} onClick={() => pick(n)}>★</button>
            ))}
          </div>
          <button type="button" className="rm-btn rm-btn-ghost" onClick={close}>NOT NOW</button>
        </div>
      </div>
    </div>
  );
}
