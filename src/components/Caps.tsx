// Bottle caps: the currency. The same drawing as the Pip-Boy's caps counter (a crimped cap with a C), then the amount.

/** The cap itself: a crimped rim and the C. */
export function CapIcon({ size = '1em' }: { size?: string }) {
  const rim = Array.from({ length: 12 }, (_, i) => {
    const a = (i / 12) * Math.PI * 2;
    return <circle key={i} cx={12 + Math.cos(a) * 9.6} cy={12 + Math.sin(a) * 9.6} r="1.6" fill="currentColor" />;
  });
  return (
    <svg className="rm-cap-icon" viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      {rim}
      <circle cx="12" cy="12" r="8.4" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M15.6 9.2a4.2 4.2 0 1 0 0 5.6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

/** An amount of caps with the cap in front: <Caps n={800} /> */
export default function Caps({ n }: { n: number | string }) {
  return <span className="rm-caps"><CapIcon />{typeof n === 'number' ? n.toLocaleString('en-US') : n}</span>;
}
