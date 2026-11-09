import { placeIcon } from '../lib/placeIcons';

/** The small vault cogwheel button: turn this cleared place, far from home, into a vacation vault. */
export default function VacationCog({ onClick, name }: { onClick: () => void; name: string }) {
  return (
    <button type="button" className="rm-cog-btn" onClick={(e) => { e.stopPropagation(); onClick(); }} title="Make this a vacation vault" aria-label={`Make ${name} a vacation vault`}>
      <span dangerouslySetInnerHTML={{ __html: placeIcon('vault') }} />
    </button>
  );
}
