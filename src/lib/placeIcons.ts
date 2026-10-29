// The map's icons: one drawn for what each place actually is (a church, a house, a hospital, a bridge...), and for the famous landmarks a
// miniature of the landmark itself. Original line drawings, 24x24. A place you have not found yet shows only the outline; once found, the
// shapes fill in solid. Three kinds of stroke make that work:
//   f = a shape that fills in solid when found      d = a detail inside a shape (shows dark on the solid fill)      s = a line that stays a line

import type { CategoryId } from './wasteland';

export type IconId =
  | 'school' | 'church' | 'cross' | 'cluster' | 'house' | 'smallbuilding' | 'museum' | 'clocktower' | 'hospital' | 'plane' | 'subway' | 'bridge'
  | 'anchor' | 'stadium' | 'tree' | 'shield' | 'capitol' | 'castle' | 'bed' | 'vault' | 'tower' | 'monument' | 'arch'
  | 'eiffel' | 'liberty' | 'spaceneedle' | 'opera' | 'redeemer' | 'kremlin';

const f = (d: string) => `<path class="f" d="${d}"/>`;
const d = (p: string) => `<path class="d" d="${p}"/>`;
const s = (p: string) => `<path class="s" d="${p}"/>`;
const svg = (inner: string) =>
  `<svg viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;

const ICONS: Record<IconId, string> = {
  school: svg(f('M2.5 9 12 4.5 21.5 9 12 13.5Z') + f('M6.5 11.2V16c0 1.4 2.5 2.6 5.5 2.6s5.5-1.2 5.5-2.6v-4.8L12 13.5Z') + s('M21.5 9v6')),
  church: svg(f('M5 21V12.5l7-4.5 7 4.5V21Z') + s('M12 8V2.5M9.8 4.6h4.4') + d('M10 21v-4a2 2 0 0 1 4 0v4')),
  cross: svg(f('M10 3h4v5h5v4h-5v9h-4v-9H5V8h5Z')),
  cluster: svg(f('M2.5 21V10h5.5v11Z') + f('M8 21V3.5h8V21Z') + f('M16 21v-8h5.5v8Z') + d('M10.2 7h3.6M10.2 11h3.6M10.2 15h3.6M4.5 13.5h1.5M4.5 17h1.5M18 16.5h1.5')),
  house: svg(f('M4 11.5 12 4l8 7.5V20H4Z') + s('M2.5 12.7 12 3.6l9.5 9.1') + d('M10 20v-5h4v5')),
  smallbuilding: svg(f('M4.5 20V8.5h15V20Z') + s('M3.5 8.5 5 4.5h14l1.5 4') + d('M9.7 20v-5.2h4.6V20M6.5 11.5h2.3M15.2 11.5h2.3')),
  museum: svg(f('M3 9.2 12 3.5l9 5.7Z') + f('M5 10.8h2.2v7H5ZM9 10.8h2.2v7H9ZM12.8 10.8H15v7h-2.2ZM16.8 10.8H19v7h-2.2Z') + f('M3.5 18.5h17v2.2h-17Z')),
  clocktower: svg(f('M8.5 21V8.5L12 3l3.5 5.5V21Z') + d('M12 9.4V11l1.2.8') + d('M10.9 21v-3.4h2.2V21') + s('M12 3V1.2')),
  hospital: svg(f('M12 2.5a9.5 9.5 0 1 0 0 19 9.5 9.5 0 0 0 0-19Z') + d('M12 6.8v10.4M6.8 12h10.4')),
  plane: svg(f('M12 2c.9 0 1.6.7 1.6 1.6V9l8 4.9v2L13.6 14v4.2l2.1 1.6V22L12 21l-3.7 1v-2.2l2.1-1.6V14l-8 1.9v-2L10.4 9V3.6C10.4 2.7 11.1 2 12 2Z')),
  subway: svg(f('M6 3h12a2 2 0 0 1 2 2v11a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V5a2 2 0 0 1 2-2Z') + d('M7 6.8h10v5.4H7Z') + d('M8.5 15.6h.01M15.5 15.6h.01') + s('M7.5 19.3 5.5 22M16.5 19.3l2 2.7')),
  bridge: svg(f('M2 12.5h20v2.3H2Z') + f('M6 5h2v8H6ZM16 5h2v8h-2Z') + s('M2 12.5C5 12.5 6.6 9 7 5.5M7 5.5c1 4 2.5 7 5 7s4-3 5-7M17 5.5c.4 3.5 2 7 5 7') + s('M7 14.8V20M17 14.8V20')),
  anchor: svg(f('M12 3a2.2 2.2 0 1 0 0 4.4A2.2 2.2 0 0 0 12 3Z') + s('M12 7.4V21M7.5 12h9M4.5 15c.2 3.3 3.2 6 7.5 6s7.3-2.7 7.5-6')),
  stadium: svg(f('M12 5.5c5.2 0 9.5 2.9 9.5 6.5s-4.3 6.5-9.5 6.5S2.5 15.6 2.5 12 6.8 5.5 12 5.5Z') + d('M12 9.3c2.8 0 5 1.2 5 2.7s-2.2 2.7-5 2.7-5-1.2-5-2.7 2.2-2.7 5-2.7Z')),
  tree: svg(f('M12 3 5.5 12h3L5 17h14l-3.5-5h3L12 3Z') + s('M12 17v4')),
  shield: svg(f('M12 2.8 4.5 5.6v6c0 4.4 3 7.8 7.5 9.6 4.5-1.8 7.5-5.2 7.5-9.6v-6L12 2.8Z') + d('m9 11.8 2.2 2.2 4.2-4.4')),
  capitol: svg(f('M6 20v-7h12v7Z') + f('M7.4 13a4.6 4.6 0 0 1 9.2 0Z') + s('M12 8.4V4M4 21h16') + d('M9 15v3.4M12 15v3.4M15 15v3.4')),
  castle: svg(f('M4 21V6h4v3h2V6h4v3h2V6h4v15Z') + d('M10 21v-4.5a2 2 0 0 1 4 0V21M6 12.5h.01M18 12.5h.01')),
  bed: svg(f('M3 13h18v5H3Z') + f('M5.3 9a1.8 1.8 0 1 0 0 3.6 1.8 1.8 0 0 0 0-3.6Z') + s('M3 18V6.5M21 13a3 3 0 0 0-3-3h-8v3')),
  vault: svg(f('M12 2.8a9.2 9.2 0 1 0 0 18.4 9.2 9.2 0 0 0 0-18.4Z') + d('M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10ZM12 11a1 1 0 1 0 0 2 1 1 0 0 0 0-2Z') + d('M12 7v2.5M12 14.5V17M7 12h2.5M14.5 12H17') + s('M12 1.3v1.5M12 21.2v1.5M1.3 12h1.5M21.2 12h1.5')),
  tower: svg(f('M10.8 21 11.4 11.5h1.2l.6 9.5Z') + f('M7.5 9.6c0-1.2 2-2.1 4.5-2.1s4.5.9 4.5 2.1-2 2.1-4.5 2.1-4.5-.9-4.5-2.1Z') + s('M12 7.5V2.5')),
  monument: svg(f('M12 2l2 5.2V19h-4V7.2Z') + s('M7 21h10M8.5 19h7')),
  arch: svg(f('M3 21V6h18v15h-4v-8a5 5 0 0 0-10 0v8Z') + d('M3 9.2h18')),
  eiffel: svg(f('M12 2l1.3 6 2.2 6 3 7h-3.2l-1.3-3h-4l-1.3 3H5.5l3-7 2.2-6Z') + d('M10.6 8.3h2.8M9.3 13h5.4') + s('M10.2 17.5h3.6')),
  liberty: svg(f('M9 21l1-9.3h4L15 21Z') + f('M12 6.8a1.9 1.9 0 1 0 0 3.8 1.9 1.9 0 0 0 0-3.8Z') + f('M7 21h10v-1.8H7Z') + s('M13.6 11.5 17 5M17 5l.8-2.4M10.3 6.8 9 5.5M12 5V3.3M13.7 6.8l1.1-1.3')),
  spaceneedle: svg(f('M6 7.2c0-1.1 2.7-2 6-2s6 .9 6 2-2.7 2-6 2-6-.9-6-2Z') + f('M10.7 9.2h2.6L12.8 21h-1.6Z') + s('M12 5.2V1.8M9 21l1.8-6M15 21l-1.8-6')),
  opera: svg(f('M3 20.5C3 14 6 9 10.5 7c.3 4.3.6 9.5-1.2 13.5Z') + f('M10 20.5C10.6 15 14 9.5 19.5 8.5c1 5-1 9.5-3.8 12Z') + s('M2 21.5h20')),
  redeemer: svg(f('M12 2.3a1.6 1.6 0 1 0 0 3.2 1.6 1.6 0 0 0 0-3.2Z') + f('M11 6h2v3.5l8.5 1.4v1.9L13 11.9V21h-2v-9.1L2.5 12.8v-1.9L11 9.5Z')),
  kremlin: svg(f('M12 2c1.9 2 2.7 3.6 2.7 5.3 0 1-1.2 1.7-2.7 1.7s-2.7-.7-2.7-1.7C9.3 5.6 10.1 4 12 2Z') + f('M5.4 8.5c1 1.2 1.5 2.1 1.5 3 0 .7-.7 1.1-1.5 1.1s-1.5-.4-1.5-1.1c0-.9.5-1.8 1.5-3Z') + f('M18.6 8.5c1 1.2 1.5 2.1 1.5 3 0 .7-.7 1.1-1.5 1.1s-1.5-.4-1.5-1.1c0-.9.5-1.8 1.5-3Z') + f('M3.5 21V13.2h17V21Z') + d('M9 21v-4a3 3 0 0 1 6 0v4M6.5 16.5h.01M17.5 16.5h.01')),
};

export const placeIcon = (id: IconId): string => ICONS[id];

/** The everyday icon for each kind of place, used on the filter buttons and when nothing about the real name says more. */
export const CATEGORY_ICON: Record<CategoryId, IconId> = {
  medical: 'hospital', school: 'school', market: 'smallbuilding', fuel: 'smallbuilding', park: 'tree', guard: 'shield', cantina: 'smallbuilding',
  chapel: 'church', transit: 'subway', arena: 'stadium', lodging: 'bed', other: 'monument',
};

// ---- choosing an icon from what the place is ----
const test = (re: RegExp, name: string) => re.test(name);

/** The icon for a place: a miniature for the famous landmarks, otherwise what the name says it is, otherwise the kind of place it is. */
export function pickIcon(category: CategoryId, realName: string): IconId {
  const n = realName.toLowerCase();

  // the famous ones, drawn as themselves
  if (test(/\b(?:eiffel|tour eiffel)\b/, n)) return 'eiffel';
  if (test(/statue of liberty/, n)) return 'liberty';
  if (test(/space needle/, n)) return 'spaceneedle';
  if (test(/sydney opera house/, n)) return 'opera';
  if (test(/christ the redeemer|cristo redentor/, n)) return 'redeemer';
  if (test(/\bkremlin\b/, n)) return 'kremlin';
  if (test(/arc de triomphe|arch of triumph|triumphal arch|brandenburg gate|gateway arch|arco de|arc du|porte de|wellington arch|india gate/, n)) return 'arch';
  if (test(/big ben|elizabeth tower|clock tower|clocktower|tour de l.horloge|uhrturm|torre del reloj|torre dell.orologio|zytglogge/, n)) return 'clocktower';

  // what the name says it is
  if (test(/cemetery|cimeti[eè]re|friedhof|graveyard|necropolis|cementerio|cimitero|burial ground/, n)) return 'cross';
  if (test(/\b(?:airport|airfield|aerodrome|airbase|air base|heliport|flughafen|a[eé]roport|aeropuerto|aeroporto)\b/, n)) return 'plane';
  if (test(/\bbridge\b|\bpont\b|br[uü]cke|\bponte\b|puente|viaduct/, n)) return 'bridge';
  if (test(/\btunnel\b|\bstation\b|\bgare\b|bahnhof|estaci[oó]n|stazione|\bmetro\b|subway|underground|\btram\b/, n) && category === 'transit') return 'subway';
  if (test(/\b(?:port|harbou?r|ferry|pier|dock|wharf|marina)\b/, n) && category === 'transit') return 'anchor';
  if (test(/hospital|h[oô]pital|krankenhaus|ospedale|clinic|medical cent|infirmary|sanatorium/, n)) return 'hospital';
  if (test(/museum|mus[eé]e|museo|gallery|galerie|aquarium|planetarium/, n)) return 'museum';
  if (test(/library|biblioth[eè]que|biblioteca|archive/, n) && category === 'school') return 'museum';
  if (test(/castle|ch[aâ]teau|palace|palais|fortress|citadel|schloss|castello|alc[aá]zar|\bfort\b|barracks/, n)) return 'castle';
  if (test(/capitol|parliament|city hall|town hall|courthouse|court house|state house|senate|congress|assembly|rathaus|ayuntamiento|h[oô]tel de ville|\bcourt of\b/, n)) return 'capitol';
  if (test(/stadium|stade|stadion|estadio|arena|ballpark|coliseum|colosseum|speedway|racecourse|velodrome/, n)) return 'stadium';
  if (test(/cathedral|cath[eé]drale|church|chapel|basilica|abbey|mosque|synagogue|temple|kirche|chiesa|iglesia|[eé]glise|minster|monastery|meeting house|shrine|pagoda|mission/, n)) return 'church';
  if (test(/(?:tv|radio|observation|television|telecom|water|cn) tower|needle|spire|lighthouse|campanile|belfry|\bmast\b/, n)) return 'tower';
  if (test(/police|precinct|fire (?:station|department)|sheriff|\bjail\b|prison/, n)) return 'shield';
  if (test(/\b(?:house|mansion|villa|manor|cottage|homestead|birthplace|residence|home)\b/, n) && !test(/opera house|light ?house|power ?house|custom ?house|guest ?house|town house|boat ?house|wareh|club ?house|play ?house|coffee ?house|green ?house|steak ?house/, n)) return 'house';
  if (test(/tower|plaza|center|centre|building|skyscraper|complex|campus|financial|headquarters|\bplace\b|square|trade|exchange|bank|insurance/, n) && category !== 'park') return 'cluster';
  if (test(/monument|memorial|statue|obelisk|column|mus[eé]e en plein|sculpture/, n)) return 'monument';

  return CATEGORY_ICON[category];
}
