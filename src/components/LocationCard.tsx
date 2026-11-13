import { useRef, useState } from 'react';
import { placeIcon } from '../lib/placeIcons';
import BinocButton from './BinocButton';
import { iconHtmlFor } from '../lib/landmarkIcons';
import { distanceMeters, subtitle, type LatLng, type Spot, type Wasteland } from '../lib/wasteland';

const miles = (m: number) => (m < 160 ? `${Math.round(m * 3.281)} ft` : `${(m / 1609.34).toFixed(1)} mi`);

/** The card that opens on the map when a place is selected: what it is, what it would cost to get there, and the two things to do about it. */
export default function LocationCard({ waiting, spot, from, here, visited, cleared, unlocked, enemies, onRename, traveling, onTravel, onScene, onEnter, onWalk, walkOn, onClose }: {
  /** The loot waiting here until the place is discovered, as a short line. */
  waiting?: string;
  spot: Spot;
  /** Where the device is (while AUTO-DISCOVER is on), or null. */
  from: LatLng | null;
  wasteland?: Wasteland;
  here: boolean;
  visited: boolean;
  cleared?: boolean;
  /** Its snapshot is unlocked (a permanent one, or opened with a credit). */
  unlocked?: boolean;
  /** What lives there, as the shooting gallery will send it. */
  enemies?: string;
  /** Given for the person's own places: double-tapping the name lets them rename it. */
  onRename?: (name: string) => void;
  traveling: boolean;
  onTravel: () => void;
  onScene: () => void;
  /** Given for your own home vault once it is cleared: goes straight into the vault, without opening the scene first. */
  onEnter?: () => void;
  /** Given when the person owns this metro's atlas: the binoculars, which open our own street view here (lit once the place has a picture of theirs). */
  onWalk?: () => void;
  walkOn?: boolean;
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
        <span className={`rm-card-icon${visited ? ' rm-visited' : ''}${spot.kind === 'vault' || spot.vault || spot.icon === 'vault' || spot.icon === 'homevault' || String(spot.icon).startsWith('vacation:') ? ' rm-card-icon-bare' : ''}`} dangerouslySetInnerHTML={{ __html: iconHtmlFor(spot.id, placeIcon(spot.icon)) }} />
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
        {spot.personal ? <>{spot.personal.home ? 'YOUR HOME' : cleared ? 'CLEARED' : unlocked ? 'UNLOCKED' : spot.personal.atlas ? 'ADDRESS ATLAS' : spot.personal.saved ? 'YOUR PLACE · DISCOVERED' : 'DESTINATION'}{enemies ? ` · ${enemies}` : ''}</> : <>{cleared ? 'CLEARED' : unlocked ? 'UNLOCKED' : visited ? 'DISCOVERED' : 'UNDISCOVERED'}{enemies ? ` · ${enemies}` : ''}{spot.rads > 60 ? ` · ${spot.rads} RADS` : ''}</>}
      </p>
      {waiting && <p className="rm-waiting">WAITING FOR YOU: {waiting}</p>}
      {!here && from && (
        <p className="rm-card-trip">
          <span>{miles(away)} from you</span>
        </p>
      )}
      {onWalk && <BinocButton className="rm-card-walk" on={!!walkOn} onClick={onWalk} title={walkOn ? undefined : 'Unlock the snapshot of this place to walk its street'} />}
      <div className="rm-card-actions">
        <button type="button" className="rm-btn" disabled={traveling || here} onClick={onTravel}>{here ? 'YOU ARE HERE' : traveling ? 'NAVIGATING…' : 'FAST TRAVEL'}</button>
        {onEnter && <button type="button" className="rm-btn rm-card-enter" onClick={onEnter}>ENTER</button>}
        <button type="button" className="rm-btn rm-btn-ghost" onClick={onScene}>VIEW</button>
      </div>
    </div>
  );
}
