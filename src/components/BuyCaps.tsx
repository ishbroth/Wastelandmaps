import { useState } from 'react';
import { createPortal } from 'react-dom';
import Caps from './Caps';
import { PACKS, caps } from '../lib/account';
import { purchasesAvailable } from '../lib/native';
import { purchasePack, usePackPrices } from '../lib/iap';

/** The popup with the three cap packs, each going straight to the payment page: opened when someone is short of caps, and from the Data tab's TRADE PRE-WAR MONEY. */
export default function BuyCaps({ onClose, onBought, title = 'NEED MORE CAPS' }: { onClose: () => void; /** Called when caps were added (in the iPhone app, where the purchase finishes here). */ onBought?: () => void; title?: string }) {
  const prices = usePackPrices();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const buy = async (pack: string) => {
    setBusy(true);
    setNote('');
    const { bought, problem } = await purchasePack(pack);
    if (problem) setNote(problem);
    if (bought) { onBought?.(); onClose(); return; }
    setBusy(false);
  };
  return createPortal(
    <div className="rm-modal rm-modal-buy" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => { e.stopPropagation(); onClose(); }}>
      <div className="rm-modal-card rm-buy-card" onClick={(e) => e.stopPropagation()}>
        <div className="rm-modal-head">
          <div><h2>{title}</h2></div>
          <button type="button" className="rm-btn rm-btn-ghost" onClick={onClose} aria-label="Close">CLOSE</button>
        </div>
        {purchasesAvailable() ? (
          <div className="rm-packs">
            {PACKS.map((pk) => (
              <button key={pk.id} type="button" className="rm-btn" disabled={busy} onClick={() => void buy(pk.id)}><Caps n={caps(pk.credits)} /> FOR {prices[pk.id] ?? pk.price}</button>
            ))}
          </div>
        ) : (
          <p className="rm-fine">Caps cannot be bought inside the app yet.</p>
        )}
        {note && <p className="rm-account-note">{note}</p>}
      </div>
    </div>,
    document.body,
  );
}
