import { useEffect, useRef, useState, type FormEvent } from 'react';
import { sendSignInLink, signInWithFaceId, signInWithVault } from '../lib/account';
import { faceIdName, forgetFaceId, savedFaceIds } from '../lib/faceid';

/** Signing in: email and vault number (the simple password set when the home was chosen), or, in the
 *  app, Face ID (or Touch ID) for an account that was signed in here before and saved. `auto` starts the Face ID check as soon as it opens (the app does this
 *  when it opens signed out and has a saved account). Everything about the account itself (caps, packs, home, sign out, delete) lives in the Data tab once signed in. */
export default function AccountModal({ onClose, auto = false }: { onClose: () => void; auto?: boolean }) {
  const [email, setEmail] = useState('');
  const [digits, setDigits] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [face, setFace] = useState<string | null>(null);
  const [saved, setSaved] = useState(savedFaceIds());
  const autoTried = useRef(false);
  /** The registration page: a new survivor gives an email, is sent a link, and on opening it picks the vault number and home (see the home prompt). */
  const [registering, setRegistering] = useState(false);
  const [sentTo, setSentTo] = useState('');
  const register = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setNote('');
    const problem = await sendSignInLink(email.trim());
    if (problem) setNote(problem); else setSentTo(email.trim());
    setBusy(false);
  };

  const signIn = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setNote('');
    const problem = await signInWithVault(email.trim(), digits);
    if (problem) setNote(problem);
    else onClose();
    setBusy(false);
  };

  const withFace = async (who: string) => {
    setBusy(true);
    setNote('');
    const result = await signInWithFaceId(who);
    if (result === null) { onClose(); return; }
    if (result !== 'cancelled') setNote(result);
    setBusy(false);
  };

  useEffect(() => {
    let off = false;
    void faceIdName().then((name) => { if (!off) setFace(name); });
    return () => { off = true; };
  }, []);
  // opened by the app because there is a saved account: one account is checked at once; with several, they choose below
  useEffect(() => {
    if (auto && face && saved.length === 1 && !autoTried.current) { autoTried.current = true; void withFace(saved[0]); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto, face]);

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
        {registering ? (
          <form onSubmit={register} className="rm-account-body">
            {sentTo ? (
              <>
                <p>A link is on its way to <b>{sentTo}</b>. Open it on this device to create your vault. You will then choose your four-digit vault number, the one you sign in with from then on, and your home address.</p>
                <p className="rm-fine">Nothing in the inbox? Look in the spam folder, or send it again.</p>
                <button type="button" className="rm-btn rm-btn-ghost" disabled={busy} onClick={() => setSentTo('')}>SEND IT AGAIN</button>
              </>
            ) : (
              <>
                <p>Register your vault. Give your email and we send you a link; opening it creates your vault, and then you choose your four-digit vault number and your home.</p>
                <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" />
                <button type="submit" className="rm-btn" disabled={busy || !email.trim()}>{busy ? 'SENDING…' : 'EMAIL ME THE LINK'}</button>
              </>
            )}
            <button type="button" className="rm-btn rm-btn-ghost" onClick={() => { setRegistering(false); setSentTo(''); setNote(''); }}>BACK TO SIGN IN</button>
          </form>
        ) : (
        <form onSubmit={signIn} className="rm-account-body">
          <p>Sign in with your email and your vault number, the four digits you chose for your home.</p>
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" />
          <input value={digits} inputMode="numeric" pattern="[0-9]*" maxLength={4} placeholder="Vault number (4 digits)" autoComplete="current-password"
            onChange={(e) => setDigits(e.target.value.replace(/\D/g, '').slice(0, 4))} aria-label="Vault number" />
          {face && saved.length > 0 && (
            <div className="rm-faceid">
              {saved.length === 1 ? (
                <button type="button" className="rm-btn" disabled={busy} onClick={() => void withFace(saved[0])}>SIGN IN WITH {face}</button>
              ) : (
                <>
                  <p className="rm-fine">Which account? ({face})</p>
                  {saved.map((who) => <button key={who} type="button" className="rm-btn" disabled={busy} onClick={() => void withFace(who)}>{who}</button>)}
                </>
              )}
            </div>
          )}
          <button type="submit" className="rm-btn" disabled={busy || !email.trim() || digits.length !== 4}>{busy ? 'WORKING…' : 'SIGN IN'}</button>
          <button type="button" className="rm-btn rm-btn-ghost" disabled={busy} onClick={() => { setRegistering(true); setNote(''); }}>REGISTER YOUR VAULT</button>
          <p className="rm-account-small"><a href={`${import.meta.env.BASE_URL}privacy.html`} target="_blank" rel="noreferrer">Privacy policy</a></p>
          {face && saved.length > 0 && (
            <p className="rm-account-small rm-faceid-forget">{face === 'FACE ID' ? 'Face ID' : face === 'TOUCH ID' ? 'Touch ID' : 'Biometric'} sign-in is on for this phone. <button type="button" className="rm-link" onClick={() => void forgetFaceId().then(() => setSaved([]))}>Forget it</button></p>
          )}
        </form>
        )}
        {note && <p className="rm-account-note">{note}</p>}
      </div>
    </div>
  );
}
