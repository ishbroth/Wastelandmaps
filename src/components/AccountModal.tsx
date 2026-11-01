import { useState, type FormEvent } from 'react';
import { sendSignInLink } from '../lib/account';

/** Signing in: an email link, no password. Everything about the account itself (credits, packs, home, sign out, delete) lives in the Data tab once signed in. */
export default function AccountModal({ onClose }: { onClose: () => void }) {
  const [email, setEmail] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const signIn = async (e: FormEvent) => {
    e.preventDefault();
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
          <p>Sign in to unlock snapshots of places on the map. We email you a link; no password.</p>
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" />
          <button type="submit" className="rm-btn" disabled={busy || !email.trim()}>{busy ? 'SENDING…' : 'EMAIL ME A LINK'}</button>
          <p className="rm-account-small"><a href={`${import.meta.env.BASE_URL}privacy.html`} target="_blank" rel="noreferrer">Privacy policy</a></p>
        </form>
        {note && <p className="rm-account-note">{note}</p>}
      </div>
    </div>
  );
}
