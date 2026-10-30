import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

/**
 * One line of buttons that scrolls sideways when it does not fit. A small arrow at the end shows there is more (and one at the start once
 * you have moved along). It starts at the left, with the first button flush against the edge.
 */
export default function ScrollRow({ children, className = '', label }: { children: ReactNode; className?: string; label?: string }) {
  const track = useRef<HTMLDivElement>(null);
  const [more, setMore] = useState({ left: false, right: false });

  const measure = useCallback(() => {
    const el = track.current;
    if (!el) return;
    setMore({ left: el.scrollLeft > 4, right: el.scrollLeft + el.clientWidth < el.scrollWidth - 4 });
  }, []);

  useEffect(() => {
    measure();
    const el = track.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const watcher = new ResizeObserver(measure);
    watcher.observe(el);
    return () => watcher.disconnect();
  }, [measure, children]);

  const move = (direction: 1 | -1) => {
    const el = track.current;
    if (el) el.scrollBy({ left: direction * Math.max(80, el.clientWidth * 0.75), behavior: 'smooth' });
  };

  return (
    <div className={`rm-scrollrow ${className}`} role="group" aria-label={label}>
      <button type="button" className="rm-scroll-arrow" style={{ visibility: more.left ? 'visible' : 'hidden' }} onClick={() => move(-1)} aria-label="Scroll back" tabIndex={more.left ? 0 : -1}>‹</button>
      <div className="rm-scrollrow-track" ref={track} onScroll={measure}>{children}</div>
      <button type="button" className="rm-scroll-arrow" style={{ visibility: more.right ? 'visible' : 'hidden' }} onClick={() => move(1)} aria-label="Scroll for more" tabIndex={more.right ? 0 : -1}>›</button>
    </div>
  );
}
