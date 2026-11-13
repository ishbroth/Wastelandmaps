// The binoculars: the button that opens our own street view. The picture is a stencil (public/binoculars.png) drawn in the ink colour.
const BASE = import.meta.env.BASE_URL;

export default function BinocButton({ on, onClick, className = '', title }: { on: boolean; onClick: () => void; className?: string; title?: string }) {
  const mask = `url(${BASE}binoculars.png)`;
  return (
    <button type="button" className={`rm-binoc${on ? ' on' : ''} ${className}`} disabled={!on} aria-label="Street view" title={title ?? (on ? 'Walk the street' : 'Get near a place with a snapshot to walk its street')} onClick={onClick}>
      <span className="rm-binoc-img" aria-hidden="true" style={{ WebkitMaskImage: mask, maskImage: mask }} />
    </button>
  );
}
