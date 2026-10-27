// Small line icons, drawn for this project (24x24, stroke only, colored by `currentColor`). They are generic wasteland symbols, not copies
// of any game's artwork.

import type { CategoryId } from './wasteland';

const wrap = (inner: string) =>
  `<svg viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;

/** A radiation trefoil: a small hub and three blades. */
function trefoil(): string {
  const blade = (startDeg: number) => {
    const r1 = 3.2, r2 = 10;
    const pt = (r: number, deg: number) => {
      const a = ((deg - 90) * Math.PI) / 180;
      return `${(12 + r * Math.cos(a)).toFixed(2)} ${(12 + r * Math.sin(a)).toFixed(2)}`;
    };
    return `<path d="M${pt(r1, startDeg)} L${pt(r2, startDeg)} A${r2} ${r2} 0 0 1 ${pt(r2, startDeg + 60)} L${pt(r1, startDeg + 60)} A${r1} ${r1} 0 0 0 ${pt(r1, startDeg)} Z" fill="currentColor" fill-opacity="0.35"/>`;
  };
  return wrap(`${blade(0)}${blade(120)}${blade(240)}<circle cx="12" cy="12" r="1.6" fill="currentColor"/>`);
}

const ICONS: Record<string, string> = {
  // a round vault door: ring, bolts and a hub
  vault: wrap('<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6.2"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/><path d="M12 2v3.8M12 18.2V22M2 12h3.8M18.2 12H22M5 5l2.7 2.7M16.3 16.3 19 19M19 5l-2.7 2.7M7.7 16.3 5 19"/>'),
  rad: trefoil(),
  medical: wrap('<rect x="3.5" y="3.5" width="17" height="17" rx="3"/><path d="M12 7.5v9M7.5 12h9"/>'),
  school: wrap('<path d="M2.5 9 12 4.5 21.5 9 12 13.5 2.5 9Z"/><path d="M6.5 11.2V16c0 1.4 2.5 2.6 5.5 2.6s5.5-1.2 5.5-2.6v-4.8"/>'),
  market: wrap('<path d="M3 4h2.6l2 10.2h9.6L19.5 7H6.4"/><circle cx="9.5" cy="18.5" r="1.4"/><circle cx="16.5" cy="18.5" r="1.4"/>'),
  fuel: wrap('<path d="M12 3s6 6.2 6 10.4A6 6 0 0 1 6 13.4C6 9.2 12 3 12 3Z"/><path d="M9.5 14a2.6 2.6 0 0 0 2.5 2.4"/>'),
  park: wrap('<path d="M12 21v-6"/><path d="M12 3 5.5 12h3L5 17h14l-3.5-5h3L12 3Z"/>'),
  guard: wrap('<path d="M12 2.8 4.5 5.6v6c0 4.4 3 7.8 7.5 9.6 4.5-1.8 7.5-5.2 7.5-9.6v-6L12 2.8Z"/><path d="m9 11.8 2.2 2.2L15.4 9.6"/>'),
  cantina: wrap('<path d="M5 6h10v9a3.5 3.5 0 0 1-3.5 3.5h-3A3.5 3.5 0 0 1 5 15V6Z"/><path d="M15 8h2.2a2.3 2.3 0 0 1 0 4.6H15"/><path d="M8 3.2v1.4M11 3.2v1.4"/>'),
  chapel: wrap('<path d="M12 3v18M7 8h10"/><path d="M4 21h16"/>'),
  transit: wrap('<path d="M3 12 21 4l-6 17-3-7-9-2Z"/><path d="m12 14 9-10"/>'),
  arena: wrap('<ellipse cx="12" cy="12" rx="9.5" ry="6.2"/><ellipse cx="12" cy="12" rx="5" ry="2.8"/>'),
  lodging: wrap('<path d="M3 18V7M3 13h18v5M21 13a3 3 0 0 0-3-3h-7v3"/><circle cx="7" cy="10.2" r="1.7"/>'),
  other: wrap('<path d="M12 3 21 12 12 21 3 12 12 3Z"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/>'),
  skull: wrap('<path d="M12 3.5c-4.2 0-7 2.7-7 6.4 0 2.2 1 3.7 2.5 4.6v2.5h9v-2.5c1.5-.9 2.5-2.4 2.5-4.6 0-3.7-2.8-6.4-7-6.4Z"/><circle cx="9.2" cy="10.4" r="1.4" fill="currentColor"/><circle cx="14.8" cy="10.4" r="1.4" fill="currentColor"/><path d="M10 17v3M12 17v3M14 17v3"/>'),
};

export const iconFor = (kind: CategoryId | 'vault' | 'rad' | 'skull'): string => ICONS[kind] ?? ICONS.other;
