/** A small spinning vault cogwheel: the loading mark for anything being developed, loaded or rendered. It takes the colour of the text around it. */
const TEETH = 8;
const point = (r: number, deg: number): string => {
  const t = ((deg - 90) * Math.PI) / 180;
  return (12 + Math.cos(t) * r).toFixed(2) + ' ' + (12 + Math.sin(t) * r).toFixed(2);
};
const GEAR = (() => {
  let d = '';
  for (let i = 0; i < TEETH; i++) {
    const mid = (i * 360) / TEETH;
    d += (d ? 'L' : 'M') + point(8.4, mid - 13) + 'L' + point(11, mid - 5.2) + 'L' + point(11, mid + 5.2) + 'L' + point(8.4, mid + 13);
    d += 'A8.4 8.4 0 0 1 ' + point(8.4, mid + 360 / TEETH - 13);
  }
  return d + 'Z';
})();
// the round window in the middle, cut out
const HOLE = 'M12 6.3a5.7 5.7 0 1 0 0 11.4 5.7 5.7 0 0 0 0-11.4Z';

export default function CogSpinner({ big = false, label = 'Loading' }: { big?: boolean; label?: string }) {
  return (
    <svg className={'rm-cog' + (big ? ' rm-cog-big' : '')} viewBox="0 0 24 24" role="img" aria-label={label}>
      <path d={GEAR + HOLE} fill="currentColor" fillRule="evenodd" />
    </svg>
  );
}
