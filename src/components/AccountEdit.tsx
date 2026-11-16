import { useState } from 'react';
import { changeEmail, randomCallsign, setCallsign, setVaultPassword, swapVaultNumber, type Account } from '../lib/account';

const REASONS: Record<string, string> = {
  bad_length: 'A CALLSIGN IS 3 TO 20 CHARACTERS',
  bad_characters: 'LETTERS (A TO Z), NUMBERS AND SPACES ONLY',
  personal: 'NO LINKS, EMAIL ADDRESSES OR LONG NUMBERS',
  reserved: 'THAT NAME IS RESERVED',
  not_allowed: 'THAT NAME IS NOT ALLOWED: PICK ANOTHER',
  taken: 'THAT CALLSIGN IS ALREADY TAKEN',
};

/**
 * The pencil beside SIGN OUT: change the callsign (typed, or a random one), the email (a new link is sent to the new address and the account, with everything on it,
 * moves to it once it is confirmed), the four-digit passcode (the number on the vault door in the picture of the house is swapped, not redrawn) and the home address.
 */
export default function AccountEdit({ account, callsign, onDone, onChangeHome }: {
  account: Account; callsign: string | null; onDone: (changed: boolean) => void; onChangeHome: () => void;
}) {
  const [name, setName] = useState(callsign ?? '');
  const [email, setEmail] = useState(account.email ?? '');
  const [digits, setDigits] = useState(account.home?.vaultNumber !== undefined ? String(account.home.vaultNumber).padStart(4, '0') : '');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const hasNumber = account.home?.vaultNumber !== undefined;

  const nameChanged = name.trim() !== (callsign ?? '') && name.trim().length > 0;
  const emailChanged = email.trim().toLowerCase() !== (account.email ?? '').toLowerCase() && /\S+@\S+\.\S+/.test(email.trim());
  const numberChanged = hasNumber && /^\d{4}$/.test(digits) && Number(digits) !== account.home?.vaultNumber;
  const anything = nameChanged || emailChanged || numberChanged;

  const save = async () => {
    setBusy(true);
    setNote('');
    const messages: string[] = [];
    if (nameChanged) {
      const r = await setCallsign(name.trim());
      if (!r.ok) { setNote(REASONS[r.error] ?? 'THE CALLSIGN DID NOT GO THROUGH: TRY AGAIN'); setBusy(false); return; }
    }
    if (numberChanged) {
      const r = await swapVaultNumber(Number(digits));
      if (!r.ok) { setNote('THE PASSCODE DID NOT CHANGE: TRY AGAIN'); setBusy(false); return; }
      await setVaultPassword(account.email, Number(digits));
      messages.push(r.hadPicture && !r.swapped
        ? 'PASSCODE CHANGED. THE DOOR IN THE PICTURE OF YOUR HOUSE COULD NOT BE REDRAWN: UNLOCK THE PHOTO AGAIN FOR 400 CAPS. YOUR VAULT STAYS AS IT WAS.'
        : r.swapped ? 'PASSCODE CHANGED, AND THE NUMBER ON YOUR VAULT DOOR WAS SWAPPED IN THE PICTURE.' : 'PASSCODE CHANGED.');
    }
    if (emailChanged) {
      const problem = await changeEmail(email.trim());
      if (problem) { setNote(problem.toUpperCase()); setBusy(false); return; }
      messages.push('A LINK WAS SENT TO THE NEW EMAIL. OPEN IT TO CONFIRM: YOUR ACCOUNT MOVES THERE WITH EVERYTHING ON IT.');
    }
    setBusy(false);
    if (messages.length > 0) { setNote(messages.join(' ')); onDone(true); } else onDone(nameChanged);
  };

  return (
    <div className="rm-acct-edit">
      <label>CALLSIGN</label>
      <div className="rm-edit-row">
        <input value={name} maxLength={20} autoCapitalize="words" autoComplete="off" spellCheck={false} placeholder="Your callsign" aria-label="Your callsign" onChange={(e) => setName(e.target.value)} />
        <button type="button" className="rm-btn rm-btn-ghost" disabled={busy} onClick={() => setName(randomCallsign())}>RANDOM</button>
      </div>
      <label>EMAIL</label>
      <input type="email" value={email} autoCapitalize="none" autoComplete="off" spellCheck={false} aria-label="Email" onChange={(e) => setEmail(e.target.value)} />
      {emailChanged && <p className="rm-fine">A new link will be sent to this address. Once you confirm it, your account moves to it with everything on it.</p>}
      {hasNumber && (
        <>
          <label>VAULT PASSCODE</label>
          <input value={digits} inputMode="numeric" pattern="[0-9]*" maxLength={4} autoComplete="off" aria-label="Four-digit passcode" onChange={(e) => setDigits(e.target.value.replace(/\D/g, '').slice(0, 4))} />
          {numberChanged && <p className="rm-fine">The number on your vault door is swapped in the picture of your house. If that cannot be done cleanly, the photo of your house costs 400 caps to unlock again. Your vault stays as it is.</p>}
        </>
      )}
      <label>HOME ADDRESS</label>
      <div className="rm-edit-row">
        <span className="rm-fine">{account.home?.address ?? 'Not set'}</span>
        <button type="button" className="rm-btn rm-btn-ghost" disabled={busy} onClick={() => { onDone(false); onChangeHome(); }}>{account.home?.address ? 'CHANGE ADDRESS' : 'SET HOME'}</button>
      </div>
      {note && <p className="rm-account-note">{note}</p>}
      <div className="rm-row-buttons">
        <button type="button" className="rm-btn" disabled={busy || !anything} onClick={() => void save()}>{busy ? 'SAVING…' : 'SAVE'}</button>
        <button type="button" className="rm-btn rm-btn-ghost" disabled={busy} onClick={() => onDone(false)}>CANCEL</button>
      </div>
    </div>
  );
}
