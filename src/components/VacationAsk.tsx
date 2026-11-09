import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import ConfirmSpend from './ConfirmSpend';
import CogSpinner from './CogSpinner';
import { vaultCall, type Account } from '../lib/account';
import { MAX_VACATIONS, ROOMS_FOR_VACATION, vacationRecipe, type VaultHome } from '../lib/vaultHome';
import type { VacationChoice, VacationOffer } from './VaultHome';

/**
 * Turning a discovered, cleared place into a vacation vault (from the map, the list of places, or the discovered places on the Data tab): shows what it costs, a random
 * mix of 8 pieces of loot, and asks. With all four vacation vaults used, it first asks which one this place takes over (the vault, with its rooms and furniture, moves).
 */
export default function VacationAsk({ choice, offer, account, onClose, onDone }: { choice: VacationChoice; offer: VacationOffer; account: Account; onClose: () => void; onDone: () => void }) {
  const [vault, setVault] = useState<VaultHome | null>(null);
  const [problem, setProblem] = useState('');
  const [replace, setReplace] = useState<string | null>(null);
  const full = offer.count >= MAX_VACATIONS;

  useEffect(() => {
    let off = false;
    void vaultCall({ action: 'visit' }).then((r) => {
      if (off) return;
      if (r.ok) setVault(r.vault); else setProblem('YOUR HOME VAULT COULD NOT BE READ. TRY AGAIN IN A MOMENT');
    });
    return () => { off = true; };
  }, []);

  const card = (body: React.ReactNode) => createPortal(
    <div className="rm-confirm rm-confirm-vault" role="alertdialog" aria-modal="true" aria-label="Vacation vault" onClick={onClose}>
      <div className="rm-confirm-card" onClick={(e) => e.stopPropagation()}>{body}</div>
    </div>,
    document.body,
  );

  if (problem) return card(<><h3>VACATION VAULT</h3><p>{problem}</p><div className="rm-confirm-row"><button type="button" className="rm-btn rm-btn-ghost" onClick={onClose}>CLOSE</button></div></>);
  if (!vault) return card(<><h3>VACATION VAULT</h3><p><CogSpinner /> READING YOUR VAULT…</p></>);
  if (vault.rooms.length < ROOMS_FOR_VACATION) {
    return card(<><h3>VACATION VAULT</h3><p>BUILD {ROOMS_FOR_VACATION} ROOMS IN YOUR HOME VAULT FIRST. YOU HAVE {vault.rooms.length}.</p><div className="rm-confirm-row"><button type="button" className="rm-btn rm-btn-ghost" onClick={onClose}>CLOSE</button></div></>);
  }
  if (full && !replace) {
    return card(
      <>
        <h3>WHICH ONE DOES IT REPLACE?</h3>
        <p>YOU HAVE ALL {MAX_VACATIONS} VACATION VAULTS. {choice.name.toUpperCase()} CAN TAKE OVER ONE OF THEM: ITS ROOMS AND FURNITURE MOVE WITH IT.</p>
        <ul className="rm-vh-types">
          {offer.mine.map((v) => <li key={v.placeId}><button type="button" onClick={() => setReplace(v.placeId)}><span>{v.name.toUpperCase()}</span></button></li>)}
        </ul>
        <div className="rm-confirm-row"><button type="button" className="rm-btn rm-btn-ghost" onClick={onClose}>CANCEL</button></div>
      </>,
    );
  }
  return (
    <ConfirmSpend
      tone="vault" title={`MAKE ${choice.name.toUpperCase()} A VACATION VAULT?`} what={choice.name.toUpperCase()} cost={vacationRecipe(vault, choice.placeId) as never} have={account.loot as never} verb="UNLOCK"
      onClose={onClose}
      onConfirm={async () => {
        const msg = await offer.unlock(choice.placeId, choice.icon, replace ?? undefined);
        if (!msg) onDone();
        return msg;
      }}
    />
  );
}
