import { useEffect, useState } from 'react';
import { faceIdName, onFaceIdOffer, saveFaceId, savedFaceIds } from '../lib/faceid';

/** After a sign-in with a password, in the app: "Use Face ID next time?" (only if the phone has it and this account is not saved already). */
export default function FaceIdOffer() {
  const [offer, setOffer] = useState<{ email: string; password: string; name: string } | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => onFaceIdOffer((o) => {
    if (savedFaceIds().includes(o.email.trim().toLowerCase())) return;
    void faceIdName().then((name) => { if (name) setOffer({ ...o, name }); });
  }), []);
  if (!offer) return null;
  const yes = async () => {
    setBusy(true);
    await saveFaceId(offer.email, offer.password);
    setOffer(null);
    setBusy(false);
  };
  const label = offer.name === 'FACE ID' ? 'Face ID' : offer.name === 'TOUCH ID' ? 'Touch ID' : 'your fingerprint or face';
  return (
    <div className="rm-modal" role="dialog" aria-modal="true" aria-label="Use biometric sign-in" onClick={() => setOffer(null)}>
      <div className="rm-modal-card rm-account" onClick={(e) => e.stopPropagation()}>
        <div className="rm-modal-head"><div><h2>{offer.name} NEXT TIME?</h2></div></div>
        <div className="rm-account-body">
          <p>Sign in to WastelandMaps with {label} instead of typing your email and vault number. It is saved only on this phone, locked behind {label}.</p>
          <button type="button" className="rm-btn" disabled={busy} onClick={() => void yes()}>{busy ? 'SAVING…' : `USE ${offer.name}`}</button>
          <button type="button" className="rm-btn rm-btn-ghost" disabled={busy} onClick={() => setOffer(null)}>NOT NOW</button>
        </div>
      </div>
    </div>
  );
}
