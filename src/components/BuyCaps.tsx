import { useState } from 'react';
import { createPortal } from 'react-dom';
import Caps from './Caps';
import { PACKS, caps } from '../lib/account';
import { purchasesAvailable } from '../lib/native';
import { purchasePack, usePackPrices } from '../lib/iap';

/** The popup with the three cap packs, each going straight to the payment page: opened when someone is short of caps, and from the Data tab's TRADE PRE-WAR MONEY. */
export default function BuyCaps({ onClose, onBought, title = 'NEED MORE CAPS', anchor }: { onClose: () => void; /** Where the popup sits: over the map ('map', for a wide desktop), or over a point of the screen (where the button was tapped, in the app). Nothing: the middle of the page. */ anchor?: 'map' | { x: number; y: number }; /** Called when caps were added (in the iPhone app, where the purchase finishes here). */ onBought?: () => void; title?: string }) {
  const prices = usePackPrices();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  // the card is placed by hand when it has an anchor: fixed on the screen, centred on the map or on the tapped point, kept inside the screen
  const place = (): React.CSSProperties | undefined => {
    if (!anchor) return undefined;
    const W = window.innerWidth, H = window.innerHeight, w = Math.min(420, W - 24), h = 270;
    let cx: number, cy: number;
    if (anchor === 'map') { const r = document.querySelector('.rm-screen')?.getBoundingClientRect(); cx = r ? r.left + r.width / 2 : W / 2; cy = r ? r.top + r.height / 2 : H / 2; }
    else { cx = anchor.x; cy = anchor.y; }
    return { position: 'fixed', width: w, left: Math.max(12, Math.min(W - w - 12, cx - w / 2)), top: Math.max(12, Math.min(H - h - 12, cy - h / 2)), margin: 0 };
  };
  const buy = async (pack: string) => {
    setBusy(true);
    setNote('');
    const { bought, problem } = await purchasePack(pack);
    if (problem) setNote(problem);
    if (bought) { onBought?.(); onClose(); return; }
    setBusy(false);
  };
  return createPortal(
    <div className={`rm-modal rm-modal-buy${anchor ? ' rm-modal-anchored' : ''}`} role="dialog" aria-modal="true" aria-label={title} onClick={(e) => { e.stopPropagation(); onClose(); }}>
      <div className="rm-modal-card rm-buy-card" style={place()} onClick={(e) => e.stopPropagation()}>
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
