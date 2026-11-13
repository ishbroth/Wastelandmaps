// The buttons that turn kinds of places on and off (church, hospital, ...), with a PERSONAL one for the places a person unlocked themselves (houses and anything that could
// not be sorted into a kind). Personal is switched on or off as a whole, and what is on is then cut down by the kinds that are off: personal medical offices stay hidden
// while MEDICAL is off, whatever PERSONAL says.

import { CATEGORIES, type CategoryId } from '../lib/wasteland';
import { CATEGORY_ICON, placeIcon } from '../lib/placeIcons';

export default function CategoryChips({ counts, hidden, onToggle, personal }: {
  counts: Map<CategoryId, number>;
  hidden: Set<CategoryId>;
  onToggle: (id: CategoryId) => void;
  personal: { count: number; on: boolean; onToggle: () => void };
}) {
  return (
    <div className="rm-chips" role="group" aria-label="Filter locations">
      {CATEGORIES.filter((c) => counts.has(c.id)).map((c) => (
        <button key={c.id} type="button" className={`rm-chip ${hidden.has(c.id) ? 'rm-chip-off' : ''}`} onClick={() => onToggle(c.id)} aria-pressed={!hidden.has(c.id)}>
          <span className="rm-chip-icon" dangerouslySetInnerHTML={{ __html: placeIcon(CATEGORY_ICON[c.id]) }} />
          {c.label} <small>{counts.get(c.id)}</small>
        </button>
      ))}
      <button type="button" className={`rm-chip ${personal.on ? '' : 'rm-chip-off'}`} onClick={personal.onToggle} aria-pressed={personal.on}>
        <span className="rm-chip-icon" dangerouslySetInnerHTML={{ __html: placeIcon('house') }} />
        Personal <small>{personal.count}</small>
      </button>
    </div>
  );
}
