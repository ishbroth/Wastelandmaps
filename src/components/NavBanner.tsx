import { formatDistance, formatMinutes, turnArrow } from '../lib/navigation';
import { voiceAvailable } from '../lib/voice';

/** The navigation over the map: the next turn at the top, and at the bottom how far is left, the voice switch and END. */
export default function NavBanner({ destination, instruction, toTurn, remaining, seconds, busy, onEnd, voiceOn, onVoice, walking, onWalking }: {
  destination: string;
  instruction: string;
  toTurn: number | null;
  remaining: number | null;
  seconds: number | null;
  /** 'ROUTING', 'REROUTING' or empty. */
  busy: string;
  onEnd: () => void;
  voiceOn: boolean;
  onVoice: () => void;
  /** Walking directions (lit) instead of driving ones. */
  walking: boolean;
  onWalking: () => void;
}) {
  return (
    <>
      <div className="rm-nav" role="region" aria-label="Navigation">
        <div className="rm-nav-turn">
          <span className="rm-nav-arrow" aria-hidden="true">{busy ? '…' : turnArrow(instruction)}</span>
          <div className="rm-nav-text">
            <b>{busy ? `${busy}…` : instruction || 'Head to the route'}</b>
            {!busy && toTurn !== null && <i>in {formatDistance(toTurn, walking)}</i>}
          </div>
        </div>
      </div>
      <div className="rm-nav-bottom" role="status">
        <span>
          {remaining !== null ? `${formatDistance(remaining, walking)} · ${seconds !== null ? formatMinutes(seconds) : ''}` : ''} <small>to {destination}</small>
        </span>
        <span className="rm-nav-buttons">
          {voiceAvailable() && (
            <button type="button" className="rm-btn rm-btn-ghost rm-nav-voice" onClick={onVoice} aria-pressed={voiceOn} aria-label={voiceOn ? 'Turn the voice off' : 'Turn the voice on'} title={voiceOn ? 'Voice on' : 'Voice off'}>
              <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M4 9.5h4l5-4v13l-5-4H4Z" fill="currentColor" />
                <path d="M16.5 9a4.2 4.2 0 0 1 0 6M19 6.5a8 8 0 0 1 0 11" />
              </svg>
            </button>
          )}
          <button type="button" className="rm-btn rm-btn-ghost rm-nav-voice rm-nav-walk" onClick={onWalking} aria-pressed={walking} aria-label={walking ? 'Back to driving directions' : 'Walking directions'} title={walking ? 'Walking directions' : 'Driving directions'}>
            <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="13.5" cy="4.2" r="1.9" fill="currentColor" />
              <path d="M12.6 8.6 11 14.2M12.6 9.6 9.2 12.4M12.8 9.6l3.6 2.4M11 14.2l-3 7M11 14.2l3.4 3.2.8 4" />
            </svg>
          </button>
          <button type="button" className="rm-btn rm-btn-ghost rm-nav-end" onClick={onEnd}>END</button>
        </span>
      </div>
    </>
  );
}
