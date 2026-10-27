import { useState, type FormEvent } from 'react';

/** Real-world cities that stand in for the games' wastelands, as one-click starting points. */
const STARTING_PLACES = ['Boston, MA', 'Washington, DC', 'Las Vegas, NV', 'Charleston, WV', 'Seattle, WA', 'Chicago, IL'];

export default function SearchBar({ busy, disabled, initial, onSearch, onLocate }: { busy: boolean; disabled: boolean; initial: string; onSearch: (q: string) => void; onLocate: () => void }) {
  const off = busy || disabled;
  const [value, setValue] = useState(initial);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (value.trim()) onSearch(value.trim());
  };
  return (
    <div className="rm-search">
      <form onSubmit={submit} className="rm-search-row">
        <label htmlFor="rm-q" className="rm-sr">City or address</label>
        <span className="rm-prompt" aria-hidden="true">&gt;</span>
        <input
          id="rm-q"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Enter a city, e.g. Boston"
          autoComplete="off"
          spellCheck={false}
          disabled={off}
        />
        <button type="submit" className="rm-btn" disabled={off || !value.trim()}>{busy ? 'SCANNING…' : 'SCAN'}</button>
        <button type="button" className="rm-btn rm-btn-ghost" disabled={off} onClick={onLocate} title="Use my current position">⌖ ME</button>
      </form>
      <div className="rm-quick">
        <span>TRY</span>
        {STARTING_PLACES.map((p) => (
          <button key={p} type="button" disabled={off} onClick={() => { setValue(p); onSearch(p); }}>{p.split(',')[0]}</button>
        ))}
      </div>
    </div>
  );
}
