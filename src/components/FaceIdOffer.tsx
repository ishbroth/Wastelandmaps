import { useEffect, useRef, useState } from 'react';
import { faceIdName, onFaceIdOffer, saveFaceId, savedFaceIds } from '../lib/faceid';

/** After a sign-in with a password, in the app: "Use Face ID next time?" (only if the phone has it and this account is not saved already). */
export default function FaceIdOffer() {
  const [offer, setOffer] = useState<{ email: string; password: string; name: string } | null>(null);
  const [busy, setBusy] = useState(false);
  // asked once per account per visit to the app: a second sign-in event right behind the first (or a "not now") must not bring the question back at once
  const asked = useRef(new Set<string>());
  useEffect(() => onFaceIdOffer((o) => {
    const who = o.email.trim().toLowerCase();
    if (savedFaceIds().includes(who) || asked.current.has(who)) return;
    asked.current.add(who);
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
