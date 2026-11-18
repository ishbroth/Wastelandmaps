import { useState } from 'react';
import { setVaultPassword, signOut, swapVaultNumber } from '../lib/account';

/** Forgot the vault number: they opened the link in the email we sent (so the email is proved), and now choose a new four-digit number, typed twice. Then they are signed out and
 *  sent back to the sign-in screen to use it. */
export default function ResetVaultNumber({ email, onDone }: { email: string | null; onDone: () => void }) {
  const [first, setFirst] = useState('');
  const [second, setSecond] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const digitsOnly = (v: string) => v.replace(/\D/g, '').slice(0, 4);
  const ready = /^\d{4}$/.test(first) && first === second;

  const save = async () => {
    if (!ready) return;
    setBusy(true);
    setNote('');
    try {
      const r = await swapVaultNumber(Number(first));
      if (!r.ok) { setNote('THE NEW NUMBER DID NOT GO THROUGH: TRY AGAIN'); setBusy(false); return; }
      if (!(await setVaultPassword(email, Number(first)))) { setNote('THE NEW NUMBER DID NOT GO THROUGH: TRY AGAIN'); setBusy(false); return; }
      await signOut();
      onDone();
    } catch (e) {
      setNote(`THE NEW NUMBER DID NOT GO THROUGH (${e instanceof Error ? e.message : 'error'}): TRY AGAIN`);
      setBusy(false);
    }
  };

  return (
    <div className="rm-modal" role="dialog" aria-modal="true" aria-label="Choose a new vault number">
      <div className="rm-modal-card rm-account" onClick={(e) => e.stopPropagation()}>
        <div className="rm-modal-head">
          <div>
            <h2>NEW VAULT NUMBER</h2>
            <p>{email ?? 'Your email is confirmed'}</p>
          </div>
        </div>
        <div className="rm-account-body">
          <p>Your email is confirmed. Choose a new four-digit vault number (0000 to 9999): it is what you sign in with from now on. Type it twice.</p>
          <input autoFocus value={first} inputMode="numeric" pattern="[0-9]*" maxLength={4} placeholder="New vault number" autoComplete="off" aria-label="New vault number" onChange={(e) => setFirst(digitsOnly(e.target.value))} />
          <input value={second} inputMode="numeric" pattern="[0-9]*" maxLength={4} placeholder="Type it again" autoComplete="off" aria-label="New vault number again" onChange={(e) => setSecond(digitsOnly(e.target.value))}
            onKeyDown={(e) => { if (e.key === 'Enter') void save(); }} />
          {second.length === 4 && first !== second && <p className="rm-account-note" role="alert">THE TWO NUMBERS DO NOT MATCH</p>}
          {note && <p className="rm-account-note" role="alert">{note}</p>}
          <button type="button" className="rm-btn" disabled={busy || !ready} onClick={() => void save()}>{busy ? 'SAVING…' : 'SAVE NEW VAULT NUMBER'}</button>
        </div>
      </div>
    </div>
  );
}
