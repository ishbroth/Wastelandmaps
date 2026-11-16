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
  // Taipei 101: stacked flared tiers and a spire
  Q83101: svg(f('M8.2 21v-3.4h7.6V21Z') + f('M8.8 17.6v-3.4h6.4v3.4Z') + f('M9.2 14.2V11h5.6v3.2Z') + f('M9.6 11V8h4.8v3Z') + f('M10.2 8V5.4h3.6V8Z') + s('M12 5.4V1.5') + d('M8.2 19.3h7.6M8.8 15.9h6.4')),
  // the Makkah Royal Clock Tower: a square tower with a clock face and a crescent spire between lower blocks
  Q189476: svg(f('M3.5 21v-8h4.6v8ZM15.9 21v-8h4.6v8Z') + f('M8.8 21V9.5h6.4V21Z') + f('M8 9.5h8V5.5H8Z') + d('M12 6.1a1.4 1.4 0 1 0 0 2.8 1.4 1.4 0 0 0 0-2.8Z') + s('M12 5.5V3.2M12 3.2a1.2 1.2 0 1 1 1.2 1.2')),
  // the Iconic Tower: a tall rounded tower of stacked bands with a glass edge
  Q102281065: svg(f('M9.5 21V6.2C9.5 4.9 10.5 4 12 4s2.5.9 2.5 2.2V21Z') + d('M9.8 8.5h4.4M9.8 11h4.4M9.8 13.5h4.4M9.8 16h4.4M9.8 18.5h4.4') + s('M8.2 21V8.5')),
  // the Lotte World Tower: a smooth tapering tower with a notched crown
  Q494895: svg(f('M8.6 21 10.3 7.5 12 2.5l1.7 5L15.4 21Z') + d('M10.9 12.5h2.2M10.2 16.8h3.6') + s('M12 2.5V1.4')),
  // Marina Bay Sands: three slanted towers under one long curved roof
  Q548679: svg(f('M5 21V10.4h3.6V21ZM10.2 21V10.4h3.6V21ZM15.4 21V10.4H19V21Z') + f('M2.5 8.2c4.6 1 12.4 1.2 19-.8v3H2.5Z') + d('M6.8 13.5v4M12 13.5v4M17.2 13.5v4')),
  // Hagia Sophia: a great dome on a stone body, with a minaret at each end
  Q12506: svg(f('M6.4 21v-7.6h11.2V21Z') + f('M8.2 13.4a3.8 3.8 0 0 1 7.6 0Z') + f('M3 21V10h1.6v11ZM19.4 21V10H21v11Z') + s('M3.8 10V7.4M20.2 10V7.4M12 9.6V7.6') + d('M10.7 21v-3.2a1.3 1.3 0 0 1 2.6 0V21')),
  // the Bank of China Tower: triangular prisms rising to a point, crossed by diagonal braces, two masts
  // Q7604504
  Q7604504: svg(f('M10.2 3.6a1.8 1.8 0 1 1 3.6 0 1.8 1.8 0 0 1-3.6 0Z') + f('M9 7h6l1.3 10.5H7.7Z') + f('M5.5 17.5h13V21h-13Z') + d('M12 8v9M10.4 17.5v3M13.6 17.5v3')),
  // the Christ the Redeemer statue: head, arms stretched wide, the long robe, the tall pedestal
  Q79961: svg(f('M12 2.4a1.6 1.6 0 1 0 0 3.2 1.6 1.6 0 0 0 0-3.2Z') + f('M2.2 9.4 10.4 6.4h3.2l8.2 3v1.8l-7.4-1.6.8 6.6H8.8l.8-6.6-7.4 1.6Z') + d('M12 7.6v8.6') + f('M8.2 16.8h7.6l1.4 4.2H6.8Z') + s('M5 21h14')),
  // Q470763
  Q470763: svg(f('M2.4 21 5.8 18h12.4l3.4 3Z') + f('M10.2 18 10.4 9.6 12 7.6h3l1.2 3 .6 7.4Z') + f('M13.4 2.6a1.9 1.9 0 1 0 0 3.8 1.9 1.9 0 0 0 0-3.8Z') + f('M12 6.2h3.2l.4 1.8H11.6Z') + f('M15.6 9.6 19 6.4l1 1.2-3.2 3.8Z') + f('M20.4 2.6a1.3 1.3 0 1 0 0 2.6 1.3 1.3 0 0 0 0-2.6Z') + f('M19.4 5.4 21.6 5.2 21.2 7.8 19.4 8.4Z') + f('M8.8 18 8.2 13.4 5.6 10.4 7.2 9.2 9.8 12 10.4 18Z') + f('M3.6 7.8a1.4 1.4 0 1 0 2.8 0 1.4 1.4 0 0 0-2.8 0Z') + f('M5.6 8.8 7.6 10.2 6.8 11.2 4.6 10Z') + f('M6.4 8.4 2.6 3.8 3.6 3 7.4 7.4Z')),
  // Q947870
  Q947870: svg(f('M9.4 21V8.6h5.2V21Z') + f('M10.6 8.6V5.8h2.8v2.8Z') + s('M12 5.8V1.4') + d('M9.4 11.2h5.2M9.4 13.8h5.2M9.4 16.4h5.2M9.4 19h5.2') + s('M6.5 21h11')),
  // Q200328
  Q200328: svg(f('M8 21V8.6h8V21Z') + f('M9.4 8.6V4.4h5.2v4.2Z') + d('M8 11.6h8M8 14.4h8M8 17.2h8') + f('M4.6 21v-2.8h14.8V21Z')),
  // Q798416
  Q798416: svg(f('M9.2 21V4.2l5.6-1.6V21Z') + d('M9.2 7.4h5.6M9.2 10.6h5.6M9.2 13.8h5.6M9.2 17h5.6') + s('M6.5 21h11')),
  // Q2226897
  Q2226897: svg(f('M12 3.4 20.6 18.6H3.4Z') + d('M12 7.4 16.4 15.2M12 7.4 7.6 15.2M3.4 18.6h17.2') + f('M5.4 18.6h13.2V21H5.4Z')),
  // Q285467
  Q285467: svg(f('M3.5 19.5c0-3.4 3.8-5.6 8.5-5.6s8.5 2.2 8.5 5.6Z') + f('M9.4 14.2 13 2.8l2.2.6-2.2 11Z') + d('M13 3.2 19 13.4M13.2 4.4 8 13.6')),
  // Q2746222
  Q2746222: svg(f('M5 21V13.4h14V21Z') + f('M4 13.4 6.6 9l2.6 4.4Z') + f('M14.8 13.4 17.4 9l2.6 4.4Z') + f('M9 13.4V7.2h6v6.2Z') + f('M8.6 7.2 12 2.6l3.4 4.6Z') + d('M12 2.6V1.2M10.4 21v-3.6a1.6 1.6 0 0 1 3.2 0V21')),
  // Q429371
  Q429371: svg(f('M8.6 21V8l4.2-3.4L15.4 8v13Z') + f('M12.8 4.6 15.4 2.6V8Z') + d('M8.6 11.4h6.8M8.6 14.4h6.8M8.6 17.4h6.8') + s('M5.6 21h12.8')),
  // Q4255374
  Q4255374: svg(f('M10.4 20V9.4L12 1.8l1.6 7.6V20Z') + d('M10.4 12.4h3.2M10.4 15.4h3.2') + f('M3.6 21 9 17.6v3.4Z') + f('M20.4 21 15 17.6v3.4Z') + s('M3 21h18')),
  // Q48435
  Q48435: svg(f('M3.4 21V11l1.6-4.6L6.6 11v10Z') + f('M7.8 21V8l1.8-6 1.8 6v13Z') + f('M12.6 21V8l1.8-6 1.8 6v13Z') + f('M17.4 21V11l1.6-4.6 1.6 4.6v10Z') + d('M9.6 10v3M14.4 10v3M9.6 15.4v3M14.4 15.4v3') + s('M2.5 21h19')),
  // Q172822
  Q172822: svg(f('M2.4 3.6 9.6 21H2.4Z') + f('M21.6 3.6 14.4 21h7.2Z') + f('M3.8 6.2c5.4 2.6 11 2.6 16.4 0L14.4 21H9.6Z') + d('M6.6 10.6c3.4 1.6 7.4 1.6 10.8 0M8.2 15.2c2.4 1.1 5.2 1.1 7.6 0') + f('M5.6 6.4V3.4h1.6v3.4ZM8.2 7.2V4.2h1.6v3.4ZM14.2 7.2V4.2h1.6v3.4ZM16.8 6.4V3.4h1.6v3.4Z') + s('M9.4 21h5.2')),
  // Q271466
  Q271466: svg(f('M10.6 21V7.6L12 1.8l1.4 5.8V21Z') + f('M6.4 21V13l2.6 2v6Z') + f('M17.6 21V13L15 15v6Z') + d('M10.6 10.4h2.8M10.6 13.4h2.8M10.6 16.4h2.8') + s('M4 21h16')),
  // Q1122206
  Q1122206: svg(f('M3.2 21V11l1.5-4.4L6.2 11v10Z') + f('M7.6 21V8.6l1.5-4.6 1.5 4.6V21Z') + f('M10.8 21V7.4L12 1.6l1.2 5.8V21Z') + f('M13.4 21V8.6l1.5-4.6 1.5 4.6V21Z') + f('M17.8 21V11l1.5-4.4L20.8 11v10Z') + d('M10.8 11h2.4M10.8 14h2.4M10.8 17h2.4') + s('M2.5 21h19')),
  // Q893204
  Q893204: svg(f('M8 21V7h8v14Z') + d('M8 7 10 21M16 7 14 21M8 12l8 3M16 12l-8 3') + s('M7.4 7V3.4M16.6 7V3.4M7.4 3.4h9.2') + s('M5.6 21h12.8')),
  // Q630212
  Q630212: svg(f('M3 21l4-6.4h10L21 21Z') + f('M5.6 14.6C7 10.4 17 10.4 18.4 14.6Z') + f('M11 10.6 12 2l1 8.6Z') + d('M7.4 18h9.2')),
  // Q2722966
  Q2722966: svg(f('M3 21V8l3-2.4L9 8v13Z') + f('M15 21V8l3-2.4L21 8v13Z') + d('M9 10c1.4-2.6 4.6-2.6 6 0M9 13.4h6') + d('M5 11h2M17 11h2M5 14h2M17 14h2') + s('M2.5 21h19')),
  // Q169420
  Q169420: svg(f('M8 21V10h8v11Z') + f('M9.4 10V6.4h5.2V10Z') + f('M10.6 6.4V3.6h2.8v2.8Z') + s('M12 3.6V1.4') + d('M9.8 13h4.4M9.8 16h4.4M9.8 19h4.4') + s('M6 21h12')),
  // Q310023
  Q310023: svg(f('M3 21C3 13.4 6.4 7.8 10.2 4.6 11.2 9 11.6 15 10.8 21Z') + f('M11.6 21C10.8 15.6 13.2 9 16 6.6c3 2.4 5 6.6 5 10.4 0 1.4-.2 2.8-.6 4Z') + s('M2.5 21h19')),
  // Q1640197
  Q1640197: svg(f('M9 21V7.2L15.4 1.6V21Z') + f('M6.8 17.8H9V20H6.8ZM7.6 14.6H9v2H7.6ZM15.4 7.2h2V9.4h-2ZM15.4 10.6h1.6v2h-1.6Z') + d('M10 18.4h1.8v-2h1.8v-2h1.2M10 15.4h1.4M11.6 12.4h1.4M12.8 9.4h1.4') + s('M6 21h12')),
  // Q206435
  Q206435: svg(f('M9.4 21V16h5.2v5Z') + f('M9.8 16v-4.4l4.6-.8V16Z') + f('M10.2 11.6V7.8l4.4-.8v3.8Z') + f('M10.6 7.8V4.6l4-.8V7Z') + f('M11 4.6V2.2l3.6-.4v2.6Z') + s('M8.4 21V5M5.6 21h12.8')),
  // Q25452628
  Q25452628: svg(f('M10.2 19V8.4L12 1.6l1.8 6.8V19Z') + d('M10.2 11.6h3.6M10.2 14.6h3.6') + f('M5.6 21c0-2.4 2.8-3.4 6.4-3.4s6.4 1 6.4 3.4Z')),
  // Q6062105
  Q6062105: svg(f('M4.4 21V5h15.2v16Z') + f('M8.6 9h6.8v6.8H8.6Z') + d('M4.4 18.4h15.2M4.4 8.2h4.2M15.4 8.2h4.2') + s('M3 21h18')),
  // Q5715648
  Q5715648: svg(f('M5.4 21V9.6h3.2V6h2.8V3.2h2.6V21Z') + f('M13.6 21V11h3.2V8.4h2.6V21Z') + d('M7 12.6h1.6M7 15.6h1.6M7 18.4h1.6M15.4 14h1.4M15.4 17h1.4') + s('M3.4 21h17.2')),
  // Q27857526
  Q27857526: svg(f('M9.4 21V6.4L12 1.8l2.6 4.6V21Z') + d('M9.4 9.6l5.2 3.6M9.4 15l5.2-3.4M9.4 18.4l5.2-2.8') + f('M5.6 21v-3h3.8v3ZM14.6 21v-3h3.8v3Z') + s('M4.6 21h14.8')),
  // Q804210
  Q804210: svg(f('M12 3a4.4 4.4 0 1 0 0 8.8A4.4 4.4 0 0 0 12 3Z') + f('M10.8 11.4 9.6 21h4.8l-1.2-9.6Z') + d('M7.6 8.2l3.4 3.4M16.4 8.2 13 11.6M12 7.4v3.6') + s('M7 21h10')),
  // Q80290
  Q80290: svg(f('M3 21v-6.5h18V21Z') + f('M1.5 14.5 5 11.2h14l3.5 3.3Z') + f('M5.5 11.2V8.2L12 4.6l6.5 3.6v3Z') + s('M12 4.6V2.4') + d('M9.5 21v-4h5v4M7 8.8h.01M17 8.8h.01')),
  // Q685484
  Q685484: svg(f('M4.6 21V7h4.4v14Z') + f('M15 21V9.4h4.4V21Z') + f('M9 8.6h6V12H9Z') + f('M5.4 7V5.2h2.8V7Z') + f('M4.8 5.2c0-1.4 1.4-2.2 2.4-2.2s2.4.8 2.4 2.2Z') + s('M7 3V1.4') + d('M6 10.4h1.4M6 13.4h1.4M6 16.4h1.4M16.6 12.4h1.4M16.6 15.4h1.4') + s('M3.4 21h17.2')),
  // Q1519373
  Q1519373: svg(f('M4 21V12h16v9Z') + f('M8.6 12V8h6.8v4Z') + f('M10 8V5.4h4V8Z') + f('M9.4 5.4c0-1.8 1.2-3 2.6-3s2.6 1.2 2.6 3Z') + s('M12 2.4V1') + d('M6 14.6h1.4M9.2 14.6h1.4M13.4 14.6h1.4M16.6 14.6H18M6 18h1.4M9.2 18h1.4M13.4 18h1.4M16.6 18H18') + s('M3 21h18')),
  // Q722125
  Q722125: svg(f('M11 21 11.5 9h1l.5 12Z') + f('M8.4 7.8c0-1.4 1.6-2.4 3.6-2.4s3.6 1 3.6 2.4-1.6 2.4-3.6 2.4-3.6-1-3.6-2.4Z') + f('M10.4 5.4V4h3.2v1.4Z') + s('M12 4V1.2M8 21h8') + d('M8.8 7.8h6.4')),
  // Q868874
  Q868874: svg(f('M10.6 21 11.4 10h1.2l.8 11Z') + f('M8.6 8.6c0-1.6 1.6-2.6 3.4-2.6s3.4 1 3.4 2.6S13.8 11 12 11 8.6 10.2 8.6 8.6Z') + d('M9 8.6h6M10.4 6.6v4M13.6 6.6v4') + s('M12 6V1.2M7.6 21h8.8')),
  Q214855: svg(f('M6.6 21V13.4L12 8.6V21Z') + f('M12 21V3.6l5.4 6.8V21Z') + d('M7 20.4 12 14M12 20.4l5-6.4M12 13.6l4.6-3.4') + s('M12 3.6V1.5M13.8 5.7V2.6')),
  // the first seven, which already have their own drawings
  // Big Ben: the Elizabeth Tower with a wing of the palace
  Q41225: svg(f('M9 21V9l1.2-3.5L12 3l1.8 2.5L15 9v12Z') + f('M2.5 21v-5h6.5v5ZM15 21v-5h6.5v5Z') + d('M12 9.5V11l1 .7M11 21v-3h2v3') + s('M12 3V1.5')),
  // the Statue of Liberty: the raised torch, the crowned head with its rays, the robe and the tablet
  Q9202: svg(f('M5.4 1.3c.9 1 1.3 1.7 1.3 2.4a1.3 1.3 0 0 1-2.6 0c0-.7.4-1.4 1.3-2.4Z') + f('M4.1 5.2h2.6l-.4 1.8H4.5Z') + d('M5.4 7 8.4 12.2') + f('M13.2 5.4a2.3 2.3 0 1 0 0 4.6 2.3 2.3 0 0 0 0-4.6Z') + s('M13.2 2.2v1.3M10.2 3.2l1 1M16.2 3.2l-1 1M9 6l1.3.3M17.4 6l-1.3.3') + f('M8.2 14.2 13 10.6l4.8 3.6V21H8.2Z') + f('M15.4 14.6l3.4-.7.9 3.8-3.4.7Z') + d('M11.2 14v6.4M13.4 12.4v2.2')),
  Q243: '', Q5317: '', Q45178: '', Q133274: '',
};

/** The landmark's own miniature, or undefined when it is drawn from the common icon set. */
export const landmarkIcon = (wikidataId: string): string | undefined => LANDMARK_ICONS[wikidataId] || undefined;

/** The icon markup for a spot: the landmark's own miniature when it has a free snapshot, otherwise the common icon. */
export const iconHtmlFor = (spotId: string, fallback: string): string => (spotId.startsWith('wd:') && FREE_IDS.has(spotId.slice(3)) && landmarkIcon(spotId.slice(3))) || fallback;
