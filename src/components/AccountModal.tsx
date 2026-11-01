import { useState, type FormEvent } from 'react';
import { sendSignInLink, signInWithVault } from '../lib/account';

/** Signing in: email and vault number (the simple password set when the home was chosen), or an emailed link for the first time or a forgotten number.
 *  Everything about the account itself (caps, packs, home, sign out, delete) lives in the Data tab once signed in. */
export default function AccountModal({ onClose }: { onClose: () => void }) {
  const [email, setEmail] = useState('');
  const [digits, setDigits] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const signIn = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setNote('');
    const problem = await signInWithVault(email.trim(), digits);
    if (problem) setNote(problem);
    else onClose();
    setBusy(false);
  };

  const mailLink = async () => {
    setBusy(true);
    const problem = await sendSignInLink(email.trim());
    setNote(problem ?? 'Check your email: we sent you a sign-in link. Open it on this device.');
    setBusy(false);
  };

  return (
    <div className="rm-modal" role="dialog" aria-modal="true" aria-label="Sign in" onClick={onClose}>
      <div className="rm-modal-card rm-account" onClick={(e) => e.stopPropagation()}>
        <div className="rm-modal-head">
          <div>
            <h2>SURVIVOR RECORD</h2>
            <p>Not signed in</p>
          </div>
          <button type="button" className="rm-btn rm-btn-ghost" onClick={onClose}>CLOSE</button>
        </div>
        <form onSubmit={signIn} className="rm-account-body">
          <p>Sign in with your email and your vault number, the four digits you chose for your home. New here, or forgot it? We email you a link.</p>
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" />
          <input value={digits} inputMode="numeric" pattern="[0-9]*" maxLength={4} placeholder="Vault number (4 digits)" autoComplete="current-password"
            onChange={(e) => setDigits(e.target.value.replace(/\D/g, '').slice(0, 4))} aria-label="Vault number" />
          <button type="submit" className="rm-btn" disabled={busy || !email.trim() || digits.length !== 4}>{busy ? 'WORKING…' : 'SIGN IN'}</button>
          <button type="button" className="rm-btn rm-btn-ghost" disabled={busy || !email.trim()} onClick={() => void mailLink()}>EMAIL ME A LINK INSTEAD</button>
          <p className="rm-account-small"><a href={`${import.meta.env.BASE_URL}privacy.html`} target="_blank" rel="noreferrer">Privacy policy</a></p>
        </form>
        {note && <p className="rm-account-note">{note}</p>}
      </div>
    </div>
  );
}
