import { useState } from 'react';
import { createPortal } from 'react-dom';
import { describeBag, lootName, type LootBag, type LootId } from '../lib/raid/loot';

/**
 * "Spend this loot to get that?": every spend of loot in the game goes through this question first (a room, a piece of furniture, a gun, stimpaks, Legendary Time). It says
 * exactly what will be taken, and when the thing can be bought several at a time it asks how many (never more than the loot pays for). Nothing is spent until CONFIRM.
 *
 * `cost` is what ONE costs. `max` is how many can be bought at most (1 when it is a single thing). `onConfirm` does the buying with the number chosen and answers with a
 * message if it did not go through (or null when it did), after which the question closes by itself.
 */
export default function ConfirmSpend({ title, what, cost, have, max = 1, owned, counted, verb = 'CONFIRM', tone, onConfirm, onClose }: {
  title: string;
  /** What is being bought, as one thing: "STIMPAK", "KITCHEN". */
  what: string;
  cost: LootBag;
  have: LootBag;
  max?: number;
  /** How many of it they have now (shown beside the quantity). */
  owned?: number;
  /** It is something bought by the piece (stimpaks): the question says "1 STIMPAK" even when only one can be bought. */
  counted?: boolean;
  verb?: string;
  /** 'vault' draws it in the vault's own green whatever look the map has. */
  tone?: 'vault';
  onConfirm: (qty: number) => Promise<string | null>;
  onClose: () => void;
}) {
  const [qty, setQty] = useState(1);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const total: LootBag = {};
  for (const [id, n] of Object.entries(cost)) total[id as LootId] = (n ?? 0) * qty;
  const left: LootBag = {};
  for (const [id, n] of Object.entries(total)) left[id as LootId] = Math.max(0, (have[id as LootId] ?? 0) - (n ?? 0));
  const confirm = async () => {
    setBusy(true);
    const problem = await onConfirm(qty);
    setBusy(false);
    if (problem) setNote(problem); else onClose();
  };
  return createPortal(
    <div className={`rm-confirm${tone === 'vault' ? ' rm-confirm-vault' : ''}`} role="alertdialog" aria-modal="true" aria-label={title} onClick={(e) => { e.stopPropagation(); if (!busy) onClose(); }}>
      <div className="rm-confirm-card" onClick={(e) => e.stopPropagation()}>
        <h3>{title}</h3>
        {max > 1 && (
          <div className="rm-confirm-qty" role="group" aria-label="How many">
            <button type="button" disabled={busy || qty <= 1} onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="One fewer">−</button>
            <b>{qty}</b>
            <button type="button" disabled={busy || qty >= max} onClick={() => setQty((q) => Math.min(max, q + 1))} aria-label="One more">+</button>
            <span>{what}{qty === 1 ? '' : 'S'}{owned !== undefined ? ` · YOU HAVE ${owned}` : ''}</span>
          </div>
        )}
        <p>SPEND <b>{describeBag(total).toUpperCase()}</b> TO GET {max > 1 || counted ? `${qty} ${what}${qty === 1 ? '' : 'S'}` : `THE ${what}`}?</p>
        <ul className="rm-confirm-lines">
          {Object.entries(total).map(([id, n]) => (
            <li key={id}><span>{lootName(id as LootId)}</span><b>−{n}</b><i>{(have[id as LootId] ?? 0)} → {left[id as LootId]}</i></li>
          ))}
        </ul>
        {note && <p className="rm-confirm-note">{note}</p>}
        <div className="rm-confirm-row">
          <button type="button" className="rm-btn rm-btn-ghost" disabled={busy} onClick={onClose}>CANCEL</button>
          <button type="button" className="rm-btn" disabled={busy} onClick={() => void confirm()}>{busy ? 'WORKING…' : verb}</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
