// Small drawn icons for the things loot buys: a stimpak (a Fallout-style hypodermic syringe, its barrel full) and a stopwatch (Legendary Time).
// They take the colour of the text round them.

export function StimpakIcon({ size = 22 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="rm-item-icon">
      {/* a hypodermic syringe laid along a diagonal: thumb rest and plunger, finger flange, the barrel full of fluid with its marks, the collar and the needle */}
      <g transform="rotate(-45 12 12)">
        <path d="M2.4 8.6v6.8M2.4 12H6" strokeWidth="1.9" />
        <path d="M6.2 8v8" strokeWidth="2" />
        <rect x="6.6" y="9.3" width="9.6" height="5.4" rx="0.8" />
        <rect x="9.6" y="10.4" width="6.1" height="3.2" fill="currentColor" fillOpacity="0.6" stroke="none" />
        <path d="M9.2 9.3v1.3M11.2 9.3v1.3M13.2 9.3v1.3" strokeWidth="1.1" />
        <path d="M16.2 10.6h1.9v2.8h-1.9" />
        <path d="M18.1 12h4.6" strokeWidth="1.3" />
      </g>
    </svg>
  );
}

export function StopwatchIcon({ size = 22 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="rm-item-icon">
      <circle cx="12" cy="13.5" r="7.5" /><path d="M12 9.5v4l2.6 1.6M9.5 3h5M12 3v3M18.6 6.4l1.4-1.4" />
    </svg>
  );
}
