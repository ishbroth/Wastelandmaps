import { useRef, useState } from 'react';
import { placeIcon } from '../lib/placeIcons';
import { iconHtmlFor } from '../lib/landmarkIcons';
import { distanceMeters, subtitle, type LatLng, type Spot, type Wasteland } from '../lib/wasteland';

const miles = (m: number) => (m < 160 ? `${Math.round(m * 3.281)} ft` : `${(m / 1609.34).toFixed(1)} mi`);

/** The card that opens on the map when a place is selected: what it is, what it would cost to get there, and the two things to do about it. */
export default function LocationCard({ spot, from, here, visited, cleared, onRename, traveling, onTravel, onScene, onClose }: {
  spot: Spot;
  /** Where the device is (while AUTO-DISCOVER is on), or null. */
  from: LatLng | null;
  wasteland?: Wasteland;
  here: boolean;
  visited: boolean;
  cleared?: boolean;
  /** Given for the person's own places: double-tapping the name lets them rename it. */
  onRename?: (name: string) => void;
  traveling: boolean;
  onTravel: () => void;
  onScene: () => void;
  onClose: () => void;
}) {
  const away = from ? distanceMeters(from, spot.position) : 0;
  const [editing, setEditing] = useState<string | null>(null);
  const lastTap = useRef(0);
  const tapName = () => {
    if (!onRename) return;
    const now = Date.now();
    if (now - lastTap.current < 400) setEditing(spot.name);
    lastTap.current = now;
  };
  const finish = (save: boolean) => {
    if (save && editing && editing.trim() && editing.trim() !== spot.name) onRename?.(editing.trim());
    setEditing(null);
  };
  return (
    <div className="rm-card" role="region" aria-label={spot.name}>
      <div className="rm-card-top">
        <span className="rm-card-icon" dangerouslySetInnerHTML={{ __html: iconHtmlFor(spot.id, placeIcon(spot.icon)) }} />
        <div className="rm-card-title">
          {editing !== null ? (
            <input
              className="rm-card-rename" value={editing} maxLength={80} autoFocus aria-label="Rename this place"
              onChange={(e) => setEditing(e.target.value)} onBlur={() => finish(true)}
              onKeyDown={(e) => { if (e.key === 'Enter') finish(true); else if (e.key === 'Escape') finish(false); }}
            />
          ) : (
            <b onClick={tapName} title={onRename ? 'Double-tap to rename' : undefined}>{spot.name}</b>
          )}
          <i>{cleared ? '[Cleared]' : spot.personal ? spot.personal.address : spot.kind === 'vault' ? 'Your home' : subtitle(spot)}</i>
        </div>
        <button type="button" className="rm-card-close" onClick={onClose} aria-label="Close">×</button>
      </div>
      <p className="rm-card-meta">
        {spot.personal ? (spot.personal.saved ? 'YOUR PLACE · DISCOVERED' : 'DESTINATION') : <>{visited ? 'DISCOVERED' : 'UNDISCOVERED'} · {spot.threat}{spot.rads > 60 ? ` · ${spot.rads} RADS` : ''}</>}
      </p>
      {!here && from && (
        <p className="rm-card-trip">
          <span>{miles(away)} from you</span>
        </p>
      )}
      <div className="rm-card-actions">
        <button type="button" className="rm-btn" disabled={traveling || here} onClick={onTravel}>{here ? 'YOU ARE HERE' : traveling ? 'NAVIGATING…' : 'FAST TRAVEL'}</button>
        <button type="button" className="rm-btn rm-btn-ghost" onClick={onScene}>VIEW</button>
      </div>
    </div>
  );
}
