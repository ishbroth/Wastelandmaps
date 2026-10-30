import { formatDistance, formatMinutes, turnArrow } from '../lib/navigation';

/** The navigation panel over the map: the next turn, how far to it, and how far is left. */
export default function NavBanner({ destination, instruction, toTurn, remaining, seconds, busy, onEnd }: {
  destination: string;
  instruction: string;
  toTurn: number | null;
  remaining: number | null;
  seconds: number | null;
  /** 'ROUTING', 'REROUTING' or empty. */
  busy: string;
  onEnd: () => void;
}) {
  return (
    <div className="rm-nav" role="region" aria-label="Navigation">
      <div className="rm-nav-turn">
        <span className="rm-nav-arrow" aria-hidden="true">{busy ? '…' : turnArrow(instruction)}</span>
        <div className="rm-nav-text">
          <b>{busy ? `${busy}…` : instruction || 'Head to the route'}</b>
          {!busy && toTurn !== null && <i>in {formatDistance(toTurn)}</i>}
        </div>
      </div>
      <div className="rm-nav-foot">
        <span>
          {remaining !== null ? `${formatDistance(remaining)} · ${seconds !== null ? formatMinutes(seconds) : ''}` : ''} <small>to {destination}</small>
        </span>
        <button type="button" className="rm-btn rm-btn-ghost" onClick={onEnd}>END</button>
      </div>
    </div>
  );
}
