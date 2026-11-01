import { useState } from 'react';
import Caps from './Caps';
import { PACKS, buyPack, caps } from '../lib/account';
import { purchasesAvailable } from '../lib/native';

/** The popup that opens when someone tries to spend caps they do not have: the three packs, each going straight to the payment page. */
export default function BuyCaps({ onClose }: { onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const buy = async (pack: string) => {
    setBusy(true);
    setNote('');
    const problem = await buyPack(pack);
    if (problem) { setNote(problem); setBusy(false); }
  };
  return (
    <div className="rm-modal rm-modal-buy" role="dialog" aria-modal="true" aria-label="Buy caps" onClick={(e) => { e.stopPropagation(); onClose(); }}>
      <div className="rm-modal-card rm-buy-card" onClick={(e) => e.stopPropagation()}>
        <div className="rm-modal-head">
          <div><h2>NEED MORE CAPS</h2></div>
          <button type="button" className="rm-btn rm-btn-ghost" onClick={onClose} aria-label="Close">CLOSE</button>
        </div>
        {purchasesAvailable() ? (
          <div className="rm-packs">
            {PACKS.map((pk) => (
              <button key={pk.id} type="button" className="rm-btn" disabled={busy} onClick={() => void buy(pk.id)}><Caps n={caps(pk.credits)} /> FOR {pk.price}</button>
            ))}
          </div>
        ) : (
          <p className="rm-fine">Caps cannot be bought inside the app yet.</p>
        )}
        {note && <p className="rm-account-note">{note}</p>}
      </div>
    </div>
  );
}
