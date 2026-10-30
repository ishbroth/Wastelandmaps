import { useState, type FormEvent } from 'react';
import { PACK, buyPack, sendSignInLink, signOut, type Account } from '../lib/account';

/** Sign in, see the balance, buy a pack of render credits. */
export default function AccountModal({ account, onClose }: { account: Account; onClose: () => void }) {
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
  const buy = async () => {
    setBusy(true);
    const problem = await buyPack();
    if (problem) {
      setNote(problem);
      setBusy(false);
    }
  };

  return (
    <div className="rm-modal" role="dialog" aria-modal="true" aria-label="Your account" onClick={onClose}>
      <div className="rm-modal-card rm-account" onClick={(e) => e.stopPropagation()}>
        <div className="rm-modal-head">
          <div>
            <h2>SURVIVOR RECORD</h2>
            <p>{account.email ?? 'Not signed in'}</p>
          </div>
          <button type="button" className="rm-btn rm-btn-ghost" onClick={onClose}>CLOSE</button>
        </div>

        {!account.session ? (
          <form onSubmit={signIn} className="rm-account-body">
            <p>Sign in to unlock snapshots of places on the map. We email you a link; no password.</p>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" />
            <button type="submit" className="rm-btn" disabled={busy || !email.trim()}>{busy ? 'SENDING…' : 'EMAIL ME A LINK'}</button>
          </form>
        ) : (
          <div className="rm-account-body">
            <p className="rm-account-balance">{account.credits === null ? '…' : account.credits} <span>SNAPSHOT CREDITS</span></p>
            <p className="rm-account-small">{account.discoveries} places reached on foot. Every level you reach gives a free snapshot credit (turn on AUTO-DISCOVER and go for a walk; the Data tab shows your level).</p>
            <p>Each credit unlocks one place's snapshot: the real photograph blown apart into the wasteland, to view, download and share. Unlocked renders stay yours.</p>
            <button type="button" className="rm-btn" disabled={busy} onClick={buy}>BUY {PACK.credits} SNAPSHOTS: {PACK.price}</button>
            <p className="rm-account-small">Pay by card, Apple Pay or Google Pay through Stripe. A render that cannot be made gives your credit back.</p>
            <button type="button" className="rm-btn rm-btn-ghost" onClick={() => { void signOut(); onClose(); }}>SIGN OUT</button>
          </div>
        )}
        {note && <p className="rm-account-note">{note}</p>}
      </div>
    </div>
  );
}
