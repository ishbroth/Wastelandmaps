import { useEffect, useRef, useState } from 'react';
import { reverseGeocode, resolveSuggestion, suggest, type PickedPlace, type Suggestion } from '../lib/addressSearch';
import { currentFix } from '../lib/navigation';

type Step = 'ask' | 'type';

/**
 * Asked once, when someone signs in for the first time: where is home? With location on they can use where they are standing; otherwise (or if they would rather)
 * they type an address. They can skip it.
 */
export default function HomePrompt({ onChosen, onSkip }: { onChosen: (place: PickedPlace) => void; onSkip: () => void }) {
  const [step, setStep] = useState<Step | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [value, setValue] = useState('');
  const [items, setItems] = useState<Suggestion[]>([]);
  const latest = useRef(0);

  // location available and not refused: offer it; otherwise go straight to typing an address
  useEffect(() => {
    let cancelled = false;
    const decide = async () => {
      if (!navigator.geolocation) return 'type';
      try {
        const state = await navigator.permissions?.query({ name: 'geolocation' as PermissionName });
        if (state?.state === 'denied') return 'type';
      } catch { /* the permission cannot be read: ask anyway */ }
      return 'ask';
    };
    void decide().then((s) => { if (!cancelled) setStep(s as Step); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (step !== 'type') return;
    const q = value.trim();
    if (q.length < 3) { setItems([]); return; }
    const mine = ++latest.current;
    const timer = window.setTimeout(() => { void suggest(q).then((found) => { if (mine === latest.current) setItems(found.filter((s) => !s.area || /\d/.test(s.text))); }); }, 220);
    return () => window.clearTimeout(timer);
  }, [value, step]);

  const useHere = async () => {
    setBusy(true);
    setNote('');
    const fix = await currentFix();
    const place = fix ? await reverseGeocode(fix) : null;
    setBusy(false);
    if (!place) {
      setNote('We could not find where you are. Type your address instead.');
      setStep('type');
      return;
    }
    onChosen(place);
  };
  const choose = async (s: Suggestion) => {
    setBusy(true);
    setItems([]);
    try {
      onChosen(await resolveSuggestion(s));
    } catch {
      setNote('That address could not be found. Try another.');
      setBusy(false);
    }
  };

  return (
    <div className="rm-modal" role="dialog" aria-modal="true" aria-label="Set your home">
      <div className="rm-modal-card rm-account rm-home" onClick={(e) => e.stopPropagation()}>
        <div className="rm-modal-head">
          <div>
            <h2>WHERE IS HOME?</h2>
            <p>Your vault door: where your map begins</p>
          </div>
        </div>
        <div className="rm-account-body">
          {step === null && <p>…</p>}
          {step === 'ask' && (
            <>
              <p>Do you want to set where you are right now as your home?</p>
              <button type="button" className="rm-btn" disabled={busy} onClick={() => void useHere()}>{busy ? 'LOCATING…' : 'YES, I AM HOME'}</button>
              <button type="button" className="rm-btn rm-btn-ghost" disabled={busy} onClick={() => setStep('type')}>NO, TYPE MY ADDRESS</button>
            </>
          )}
          {step === 'type' && (
            <>
              <p>Type your home address.</p>
              <input
                autoFocus value={value} onChange={(e) => setValue(e.target.value)} placeholder="Street address" autoComplete="off" spellCheck={false} aria-label="Home address"
              />
              {items.length > 0 && (
                <ul className="rm-suggest rm-suggest-inline" role="listbox">
                  {items.map((s) => (
                    <li key={s.id}>
                      <button type="button" onClick={() => void choose(s)}><b>{s.main}</b><i>{s.secondary}</i></button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
          {note && <p className="rm-account-note">{note}</p>}
          <button type="button" className="rm-btn rm-btn-ghost" disabled={busy} onClick={onSkip}>SKIP FOR NOW</button>
        </div>
      </div>
    </div>
  );
}
