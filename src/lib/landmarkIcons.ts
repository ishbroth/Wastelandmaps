// A miniature of each landmark that has a free snapshot, drawn in the landmark's own shape (keyed by Wikidata id). These pins are also drawn
// slightly larger than the rest so they stand out. Same outline system as placeIcons.ts: f fills in when found, d is a detail, s stays a line.

import { f, d, s, svg } from './placeIcons';
import { FREE_RENDERS } from './renders';
const FREE_IDS = new Set(Object.keys(FREE_RENDERS));

const LANDMARK_ICONS: Record<string, string> = {
  // the Alamo: a mission front with a curved top and a door
  Q2636724: svg(f('M3 21V10h4V8.5h10V10h4v11Z') + f('M8 8.5c0-2 1.8-3.4 4-4.4 2.2 1 4 2.4 4 4.4Z') + d('M10.5 21v-5a1.5 1.5 0 0 1 3 0v5')),
  // Burj Khalifa: a stepped needle
  Q12495: svg(f('M10.6 21 11.2 8h1.6l.6 13Z') + f('M9 21V14.5h1.6V21ZM13.4 21v-6.5H15V21Z') + f('M11.2 8 11.6 5h.8l.4 3Z') + s('M12 5V1.5M7 21h10')),
  // CN Tower: a thin shaft with a pod and an antenna
  Q134883: svg(f('M11 21 11.5 11h1l.5 10Z') + f('M8.2 9.5c0-1.2 1.7-2 3.8-2s3.8.8 3.8 2-1.7 2-3.8 2-3.8-.8-3.8-2Z') + f('M10.8 7.5h2.4v-1h-2.4Z') + s('M12 6.5V1.5M8 21h8')),
  // Coit Tower: a fluted column with a flat top
  Q1107297: svg(f('M9 21V8h6v13Z') + f('M8 8V5.5h8V8Z') + d('M11 21V8M13 21V8') + s('M6 21h12')),
  // Cologne Cathedral: twin openwork spires
  Q4176: svg(f('M4.5 21V10l2.7-7 2.7 7v11Z') + f('M14.1 21V10l2.7-7 2.7 7v11Z') + f('M9.9 21v-7h4.2v7Z') + d('M6 12.5h2.4M15.6 12.5H18') + s('M7.2 3V1.5M16.8 3V1.5')),
  // Gran Torre Costanera: a tall glass slab with a stepped crown
  Q1542408: svg(f('M8 21V5h8v16Z') + f('M10 5V2.5h4V5Z') + d('M10 8.5h4M10 12h4M10 15.5h4')),
  // Empire State Building: setbacks and a mast
  Q9188: svg(f('M6.5 21V13h11v8Z') + f('M8.5 13V9h7v4Z') + f('M10.2 9V6h3.6v3Z') + s('M12 6V1.5') + d('M9.5 16.5h5')),
  // Epcot: the geodesic sphere
  Q1052042: svg(f('M12 3a8.2 8.2 0 1 0 0 16.4A8.2 8.2 0 0 0 12 3Z') + d('M12 3v16.4M3.8 11.2h16.4M5.6 6.2c4 2.6 8.8 2.6 12.8 0M5.6 16.2c4-2.6 8.8-2.6 12.8 0') + s('M8 21.5h8')),
  // F&F Tower (Revolution Tower): a tower that twists
  Q5853834: svg(f('M9 21c2.6-3 2.6-6 0-9s-2.6-6 0-9h6c-2.6 3-2.6 6 0 9s2.6 6 0 9Z') + d('M10 7.5h4M10 12h4M10 16.5h4')),
  // Gateway Arch: one tall parabola
  Q2027162: svg(f('M3 21C3 9 7 3.5 12 3.5S21 9 21 21h-3.6C17.4 12 15 8 12 8s-5.4 4-5.4 13Z') + s('M2 21h20')),
  // Golden Gate Bridge: two towers, swooping cables
  Q44440: svg(f('M2 15.5h20v2H2Z') + f('M5.5 4h2v12h-2ZM16.5 4h2v12h-2Z') + s('M2 14c2.2 0 3.4-4 4.5-9.4M6.5 4.6c2 6 3.4 9.4 5.5 9.4s3.5-3.4 5.5-9.4M17.5 4.6C18.6 10 19.8 14 22 14') + s('M6.5 17.5V21M17.5 17.5V21')),
  // Hillbrow Tower: a shaft with a dish pod and a mast
  Q1563940: svg(f('M10.6 21 11.2 10h1.6l.6 11Z') + f('M7.5 10c0-1 2-1.8 4.5-1.8s4.5.8 4.5 1.8v1.8c0 .8-2 1.4-4.5 1.4s-4.5-.6-4.5-1.4Z') + s('M12 8.2V1.5M9 21h6')),
  // Hollywood sign: big letters on a hillside
  Q180376: svg(f('M2 21l5-6 5 3 5-4 5 2v5Z') + d('M4 11V6M4 8.5h2M6 11V6M8.5 11V6M8.5 6h1.8v2.2H8.5M13 6v5M13 6h2M13 8.5h1.8M16.8 6v5M18.6 6v5M16.8 8.5h1.8')),
  // Independence Hall: a brick hall with a clock steeple
  Q390028: svg(f('M3.5 21v-7h17v7Z') + f('M9.5 14v-3.5h5V14Z') + f('M10.6 10.5V6.5h2.8v4Z') + s('M12 6.5V2.8M10.8 4.6h2.4') + d('M6.5 17h.01M9.5 17h.01M14.5 17h.01M17.5 17h.01M11 21v-2.6h2V21')),
  // LeVeque Tower: Art Deco setbacks with a crown
  Q6506496: svg(f('M6 21V12h12v9Z') + f('M8 12V8h8v4Z') + f('M10 8V4.5h4V8Z') + s('M12 4.5V2M9 21v-4M15 21v-4')),
  // Obelisco de Buenos Aires: a tall obelisk
  Q831389: svg(f('M10.2 21 11 6l1-2.5L13 6l.8 15Z') + s('M7.5 21h9M12 3.5V1.5')),
  // Westin Peachtree Plaza: a round glass cylinder
  Q3177225: svg(f('M8 21V5.5c0-1.2 1.8-2 4-2s4 .8 4 2V21Z') + d('M8 8.5c0 1.2 1.8 2 4 2s4-.8 4-2M8 13c0 1.2 1.8 2 4 2s4-.8 4-2')),
  // Oriental Pearl Tower: spheres on legs
  Q223207: svg(f('M12 2.5a1.4 1.4 0 1 0 0 2.8 1.4 1.4 0 0 0 0-2.8Z') + f('M12 8.5a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z') + f('M12 17a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Z') + s('M12 5.3v3.2M12 14.5V17M7 21l3.5-3M17 21l-3.5-3')),
  // Petronas Towers: two towers with a sky bridge
  Q83063: svg(f('M4.5 21V8.5l2.5-2.5 2.5 2.5V21Z') + f('M14.5 21V8.5L17 6l2.5 2.5V21Z') + s('M7 6V2M17 6V2') + d('M9.5 12.5h5')),
  // Leaning Tower of Pisa: tiers, tilted
  Q39054: svg(f('M7.5 21 9 6.5h5l2.8 14.5Z') + s('M8.4 12h6.2M7.9 16.5h7.6M9.8 3.5l1.8 1.2') + d('M10 9.5h.01M13 9.5h.01M9.5 14h.01M12.2 14h.01')),
  // Rock and Roll Hall of Fame: a glass pyramid beside a drum
  Q179191: svg(f('M2.5 21 10 8l7.5 13Z') + f('M15 21v-6.5h6.5V21Z') + d('M10 8v13M6.2 14.5h7.6')),
  // Superdome: a low wide dome
  Q756452: svg(f('M2.5 17.5c0-5 4.3-9 9.5-9s9.5 4 9.5 9Z') + f('M2.5 17.5h19V20h-19Z') + d('M12 8.5v9M7 10.8l1.5 6.7M17 10.8l-1.5 6.7')),
  // Taj Mahal: a big dome, four minarets
  Q9141: svg(f('M7.5 21v-5.5c0-3 2-4.5 4.5-4.5s4.5 1.5 4.5 4.5V21Z') + s('M12 11V7.5M12 3.5c1 1.2 1.5 2.5 0 4-1.5-1.5-1-2.8 0-4Z') + f('M3 21V9.5h1.6V21ZM19.4 21V9.5H21V21Z') + d('M10.6 21v-3.4a1.4 1.4 0 0 1 2.8 0V21')),
  // Tokyo Tower: lattice, two decks, mast
  Q183536: svg(f('M12 3l1.2 5 3 6.5L19.5 21h-3l-1.6-3h-5.8l-1.6 3h-3l3.3-6.5 3-6.5Z') + d('M10.4 9.5h3.2M9 13.5h6') + s('M12 3V1.5')),
  // Washington Monument: obelisk over a plain
  Q178114: svg(f('M10.6 21 11.2 6 12 3.5 12.8 6l.6 15Z') + s('M5 21h14M12 3.5V1.5')),
  // Willis Tower: bundled tubes that stop at different heights
  Q29294: svg(f('M5 21V10h4.5v11Z') + f('M9.5 21V3.5h5V21Z') + f('M14.5 21v-8H19v8Z') + s('M10.8 3.5V1.5M13.2 3.5V1.5') + d('M11 8h2M11 12h2M11 16h2')),
  // the first seven, which already have their own drawings
  // Big Ben: the Elizabeth Tower with a wing of the palace
  Q41225: svg(f('M9 21V9l1.2-3.5L12 3l1.8 2.5L15 9v12Z') + f('M2.5 21v-5h6.5v5ZM15 21v-5h6.5v5Z') + d('M12 9.5V11l1 .7M11 21v-3h2v3') + s('M12 3V1.5')),
  Q243: '', Q9202: '', Q5317: '', Q45178: '', Q79961: '', Q133274: '',
};

/** The landmark's own miniature, or undefined when it is drawn from the common icon set. */
export const landmarkIcon = (wikidataId: string): string | undefined => LANDMARK_ICONS[wikidataId] || undefined;

/** The icon markup for a spot: the landmark's own miniature when it has a free snapshot, otherwise the common icon. */
export const iconHtmlFor = (spotId: string, fallback: string): string => (spotId.startsWith('wd:') && FREE_IDS.has(spotId.slice(3)) && landmarkIcon(spotId.slice(3))) || fallback;
