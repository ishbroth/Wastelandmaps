import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import ScrollRow from './ScrollRow';
import { shuffledShowcase } from '../lib/showcase';
import { suggest, type Suggestion } from '../lib/addressSearch';

/** Cities with a permanent landmark snapshot, as one-click starting points (a different order each visit, three showing at a time). Typing also suggests real addresses. */
export default function SearchBar({ busy, disabled, initial, onSearch, onPick, onSignIn, tracking, onToggleTracking }: {
  busy: boolean; disabled: boolean; initial: string; onSearch: (q: string) => void; onPick: (s: Suggestion) => void; /** Present while signed out: the SIGN IN button beside AUTO-DISCOVER. */ onSignIn?: () => void; tracking: boolean; onToggleTracking: () => void;
}) {
  const off = busy || disabled;
  const [value, setValue] = useState(initial);
  const [items, setItems] = useState<Suggestion[]>([]);
  const [active, setActive] = useState(-1);
  const typed = useRef(false);
  const input = useRef<HTMLInputElement>(null);
  const latest = useRef(0);
  const cities = useMemo(() => shuffledShowcase(), []);

  // suggestions for what is being typed (not for text the page put there itself)
  useEffect(() => {
    if (!typed.current) return;
    const q = value.trim();
    if (q.length < 3 || off) {
      setItems([]);
      return;
    }
    const mine = ++latest.current;
    const timer = window.setTimeout(() => {
      void suggest(q).then((found) => {
        if (mine === latest.current) {
          setItems(found);
          setActive(-1);
        }
      });
    }, 220);
    return () => window.clearTimeout(timer);
  }, [value, off]);

  const close = () => {
    typed.current = false;
    latest.current++;
    setItems([]);
    setActive(-1);
  };
  const choose = (s: Suggestion) => {
    close();
    setValue(s.text);
    onPick(s);
  };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (active >= 0 && items[active]) return choose(items[active]);
    close();
    if (value.trim()) onSearch(value.trim());
  };
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (items.length === 0) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => (a + 1) % items.length); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => (a <= 0 ? items.length - 1 : a - 1)); }
    else if (e.key === 'Escape') close();
  };

  return (
    <div className="rm-search">
      <form onSubmit={submit} className="rm-search-row">
        <label htmlFor="rm-q" className="rm-sr">City or address</label>
        <span className="rm-prompt" aria-hidden="true">&gt;</span>
        <input
          id="rm-q"
          ref={input}
          value={value}
          onChange={(e) => { typed.current = true; setValue(e.target.value); }}
          onKeyDown={onKey}
          onBlur={() => window.setTimeout(close, 150)}
          placeholder="Enter a city or an address"
          autoComplete="off"
          spellCheck={false}
          role="combobox"
          aria-expanded={items.length > 0}
          aria-autocomplete="list"
          disabled={off}
        />
        {value && !off && <button type="button" className="rm-clear" aria-label="Clear" title="Clear" onMouseDown={(e) => e.preventDefault()} onClick={() => { close(); setValue(''); input.current?.focus(); }}>×</button>}
        <button type="submit" className="rm-btn" disabled={off || !value.trim()}>{busy ? 'SCANNING…' : 'SCAN'}</button>
      </form>
      {items.length > 0 && (
        <ul className="rm-suggest" role="listbox">
          {items.map((s, i) => (
            <li key={s.id} role="option" aria-selected={i === active}>
              <button type="button" className={i === active ? 'on' : ''} onMouseDown={(e) => e.preventDefault()} onClick={() => choose(s)}>
                <b>{s.main}</b>
                <i>{s.secondary}</i>
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="rm-quick">
        <button type="button" className={`rm-track${tracking ? ' on' : ''}`} aria-pressed={tracking} onClick={onToggleTracking} title="Discover places automatically when you are near them">
          {tracking ? '◉ AUTO-DISCOVER ON' : '○ AUTO-DISCOVER OFF'}
        </button>
        {onSignIn && <button type="button" className="rm-signin" onClick={onSignIn}>SIGN IN</button>}
      </div>
      <div className="rm-try">
        <span>TRY</span>
        <ScrollRow className="rm-try-row" label="Cities to try">
          {cities.map((p) => (
            <button key={p} type="button" className="rm-try-city" disabled={off} onClick={() => { close(); setValue(p); onSearch(p); }} title={p}>{p.split(',')[0]}</button>
          ))}
        </ScrollRow>
      </div>
    </div>
  );
}
