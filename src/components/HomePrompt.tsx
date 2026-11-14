import { useEffect, useRef, useState } from 'react';
import { reverseGeocode, resolveSuggestion, suggest, type PickedPlace, type Suggestion } from '../lib/addressSearch';
import { currentFix } from '../lib/navigation';
import { locationState } from '../lib/geo';

type Step = 'ask' | 'type' | 'number';

/**
 * Asked once, when someone signs in for the first time: where is home, and which vault number is it? With location on they can use where they are standing;
 * otherwise (or if they would rather) they type an address. Then they pick a four-digit number: their home is a vault on the map, and no other vault on the
 * whole map has four digits. They can skip it.
 */
export default function HomePrompt({ onChosen, onSkip, canSkip = true, startWith, number: startNumber }: {
  /** Saves the home; returns a message if it could not be (the number is taken), or null when it is done. */
  onChosen: (place: PickedPlace, vaultNumber: number) => Promise<string | null>;
  onSkip: () => void;
  /** False for a survivor with no vault number yet: the number is what they sign in with, so the first time it cannot be put off (or they could never sign back in). */
  canSkip?: boolean;
  /** A home already chosen that still needs its number. */
  startWith?: PickedPlace;
  /** The number to start from (their current one, when changing home). */
  number?: number;
}) {
  const [step, setStep] = useState<Step | null>(startWith ? 'number' : null);
  const [picked, setPicked] = useState<PickedPlace | null>(startWith ?? null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [value, setValue] = useState('');
  const [digits, setDigits] = useState(startNumber !== undefined ? String(startNumber).padStart(4, '0') : '');
  const [items, setItems] = useState<Suggestion[]>([]);
  const latest = useRef(0);

  // location available and not refused: offer it; otherwise go straight to typing an address
  useEffect(() => {
    if (startWith) return;
    let cancelled = false;
    const decide = async () => {
      const state = await locationState();
      return state === 'unsupported' || state === 'denied' ? 'type' : 'ask';
    };
    void decide().then((s) => { if (!cancelled) setStep(s as Step); });
    return () => { cancelled = true; };
  }, [startWith]);

  useEffect(() => {
    if (step !== 'type') return;
    const q = value.trim();
    if (q.length < 3) { setItems([]); return; }
    const mine = ++latest.current;
    const timer = window.setTimeout(() => { void suggest(q).then((found) => { if (mine === latest.current) setItems(found.filter((s) => !s.area || /\d/.test(s.text))); }); }, 220);
    return () => window.clearTimeout(timer);
  }, [value, step]);

  const picks = (place: PickedPlace) => {
    setPicked(place);
    setNote('');
    setStep('number');
  };
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
    picks(place);
  };
  const choose = async (s: Suggestion) => {
    setBusy(true);
    setItems([]);
    try {
      picks(await resolveSuggestion(s));
    } catch {
      setNote('That address could not be found. Try another.');
    }
    setBusy(false);
  };

  const number = Number(digits);
  const valid = /^\d{4}$/.test(digits);
  const build = async () => {
    if (!picked || !valid) return;
    setBusy(true);
    setNote('');
    const problem = await onChosen(picked, number);
    if (problem) { setNote(problem); setBusy(false); }
  };

  return (
    <div className="rm-modal" role="dialog" aria-modal="true" aria-label="Set your home">
      <div className="rm-modal-card rm-account rm-home" onClick={(e) => e.stopPropagation()}>
        <div className="rm-modal-head">
          <div>
            <h2>{step === 'number' ? 'YOUR VAULT NUMBER' : 'WHERE IS HOME?'}</h2>
            <p>{step === 'number' ? 'Your home is a vault on the map' : 'Your vault door: where your map begins'}</p>
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
          {step === 'number' && picked && (
            <>
              <p>{picked.address}</p>
              <p>Pick a four-digit number (0000 to 9999) for your vault; it may start with a zero, and 0730 is not the same as Vault 730. It is yours alone: nobody else can have the same one.</p>
              <input
                autoFocus value={digits} inputMode="numeric" pattern="[0-9]*" maxLength={4} placeholder="1234" autoComplete="off" aria-label="Vault number"
                onChange={(e) => setDigits(e.target.value.replace(/\D/g, '').slice(0, 4))}
                onKeyDown={(e) => { if (e.key === 'Enter') void build(); }}
              />
              <button type="button" className="rm-btn" disabled={busy || !valid} onClick={() => void build()}>{busy ? 'BUILDING…' : valid ? `BUILD VAULT ${digits}` : 'ENTER FOUR DIGITS'}</button>
              {!startWith && <button type="button" className="rm-btn rm-btn-ghost" disabled={busy} onClick={() => { setStep('type'); setPicked(null); }}>CHOOSE A DIFFERENT ADDRESS</button>}
            </>
          )}
          {note && <p className="rm-account-note">{note}</p>}
          {canSkip && <button type="button" className="rm-btn rm-btn-ghost" disabled={busy} onClick={onSkip}>SKIP FOR NOW</button>}
        </div>
      </div>
    </div>
  );
}
