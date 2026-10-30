import { placeIcon } from '../lib/placeIcons';
import { iconHtmlFor } from '../lib/landmarkIcons';
import { distanceMeters, subtitle, type LatLng, type Spot, type Wasteland } from '../lib/wasteland';

const miles = (m: number) => (m < 160 ? `${Math.round(m * 3.281)} ft` : `${(m / 1609.34).toFixed(1)} mi`);

/** The card that opens on the map when a place is selected: what it is, what it would cost to get there, and the two things to do about it. */
export default function LocationCard({ spot, points, from, here, visited, traveling, onTravel, onDiscover, onScene, onClose }: {
  spot: Spot;
  /** What reaching this place is worth, in points. */
  points: number;
  /** Where the device is (while AUTO-DISCOVER is on), or null. */
  from: LatLng | null;
  wasteland?: Wasteland;
  here: boolean;
  visited: boolean;
  traveling: boolean;
  onTravel: () => void;
  onDiscover: () => void;
  onScene: () => void;
  onClose: () => void;
}) {
  const away = from ? distanceMeters(from, spot.position) : 0;
  return (
    <div className="rm-card" role="region" aria-label={spot.name}>
      <div className="rm-card-top">
        <span className="rm-card-icon" dangerouslySetInnerHTML={{ __html: iconHtmlFor(spot.id, placeIcon(spot.icon)) }} />
        <div className="rm-card-title">
          <b>{spot.name}</b>
          <i>{spot.kind === 'vault' ? 'Your home' : subtitle(spot)}</i>
        </div>
        <button type="button" className="rm-card-close" onClick={onClose} aria-label="Close">×</button>
      </div>
      <p className="rm-card-meta">
        {visited ? 'DISCOVERED' : 'UNDISCOVERED'}{points > 0 ? ` · ${points} POINTS` : ''} · {spot.threat}{spot.rads > 60 ? ` · ${spot.rads} RADS` : ''}
      </p>
      {!here && from && (
        <p className="rm-card-trip">
          <span>{miles(away)} from you</span>
        </p>
      )}
      <div className="rm-card-actions">
        <button type="button" className="rm-btn" disabled={traveling || here} onClick={onTravel}>{here ? 'YOU ARE HERE' : traveling ? 'NAVIGATING…' : 'FAST TRAVEL'}</button>
        <button type="button" className="rm-btn rm-btn-ghost" onClick={onScene}>VIEW</button>
        {!visited && <button type="button" className="rm-btn rm-btn-ghost" onClick={onDiscover}>DISCOVER</button>}
      </div>
    </div>
  );
}
