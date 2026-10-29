import { placeIcon } from '../lib/placeIcons';
import { formatDuration, radsAlongRoute, travelMinutes } from '../lib/travel';
import { distanceMeters, subtitle, type LatLng, type Spot, type Wasteland } from '../lib/wasteland';

const miles = (m: number) => (m < 160 ? `${Math.round(m * 3.281)} ft` : `${(m / 1609.34).toFixed(1)} mi`);

/** The card that opens on the map when a place is selected: what it is, what it would cost to get there, and the two things to do about it. */
export default function LocationCard({ spot, from, wasteland, here, visited, traveling, onTravel, onDiscover, onScene, onClose }: {
  spot: Spot;
  from: LatLng | null;
  wasteland: Wasteland;
  here: boolean;
  visited: boolean;
  traveling: boolean;
  onTravel: () => void;
  onDiscover: () => void;
  onScene: () => void;
  onClose: () => void;
}) {
  const away = from ? distanceMeters(from, spot.position) : 0;
  const minutes = from ? travelMinutes(from, spot.position) : 0;
  const rads = from ? radsAlongRoute(from, spot.position, wasteland.zones) : 0;
  return (
    <div className="rm-card" role="region" aria-label={spot.name}>
      <div className="rm-card-top">
        <span className="rm-card-icon" dangerouslySetInnerHTML={{ __html: placeIcon(spot.icon) }} />
        <div className="rm-card-title">
          <b>{spot.name}</b>
          <i>{spot.kind === 'vault' ? 'Your home' : subtitle(spot)}</i>
        </div>
        <button type="button" className="rm-card-close" onClick={onClose} aria-label="Close">×</button>
      </div>
      <p className="rm-card-meta">
        {visited ? 'DISCOVERED' : 'UNDISCOVERED'} · {spot.threat}{spot.rads > 60 ? ` · ${spot.rads} RADS` : ''}
      </p>
      {!here && (
        <p className="rm-card-trip">
          <span>{miles(away)}</span><span>{formatDuration(minutes)}</span><span className={rads > 0 ? 'rm-hot' : ''}>{rads > 0 ? `+${rads} RADS on the way` : 'clear route'}</span>
        </p>
      )}
      <div className="rm-card-actions">
        <button type="button" className="rm-btn" disabled={traveling || here} onClick={onTravel}>{here ? 'YOU ARE HERE' : traveling ? 'TRAVELING…' : 'FAST TRAVEL'}</button>
        <button type="button" className="rm-btn rm-btn-ghost" onClick={onScene}>VIEW</button>
        {!visited && <button type="button" className="rm-btn rm-btn-ghost" onClick={onDiscover}>DISCOVER</button>}
      </div>
    </div>
  );
}
