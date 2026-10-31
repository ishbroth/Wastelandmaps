// More famous landmarks (the second batch), each drawn as itself. The towers are built from one outline (a shaft, a crown, a few details) so they stay
// consistent; the places with a shape of their own (a ball on a stalk, a bridge, a vault door) are drawn by hand. Registered with placeIcons on import.

import { EXTRA_ICONS, d, f, s, svg } from './placeIcons';

const n = (v: number) => Math.round(v * 100) / 100;

type Crown = 'flat' | 'spire' | 'pyramid' | 'dome' | 'gables' | 'antenna' | 'stepped' | 'slant' | 'crown' | 'clock';
type Detail = 'bands' | 'ribs' | 'x' | 'none';

/** A tower: a shaft with a crown on it and some detail, optionally standing on a podium or between lower wings. */
function tower(o: { w?: number; top?: number; crown?: Crown; detail?: Detail; base?: 'none' | 'podium' | 'wings'; cx?: number } = {}): string {
  const w = o.w ?? 7, top = o.top ?? 7, cx = o.cx ?? 12, crown = o.crown ?? 'flat', detail = o.detail ?? 'bands', base = o.base ?? 'none';
  const x0 = cx - w / 2, x1 = cx + w / 2;
  let out = '';
  if (base === 'podium') out += f(`M${n(x0 - 2.2)} 21V16.4H${n(x1 + 2.2)}V21Z`);
  if (base === 'wings') out += f(`M${n(x0 - 3.6)} 21V15h3.6v6ZM${n(x1)} 21V15h3.6v6Z`);
  out += crown === 'slant' ? f(`M${n(x0)} 21V${top}L${n(x1)} ${top - 3}V21Z`) : f(`M${n(x0)} 21V${top}H${n(x1)}V21Z`);
  switch (crown) {
    case 'flat': out += f(`M${n(x0 + 1)} ${top}V${top - 1.6}H${n(x1 - 1)}V${top}Z`); break;
    case 'spire': out += f(`M${n(x0 + 1)} ${top}V${top - 1.6}H${n(x1 - 1)}V${top}Z`) + f(`M${n(cx - 1.2)} ${top - 1.6}L${cx} ${top - 4.6}L${n(cx + 1.2)} ${top - 1.6}Z`) + s(`M${cx} ${top - 4.6}V${top - 6}`); break;
    case 'pyramid': out += f(`M${n(x0)} ${top}L${cx} ${top - 4}L${n(x1)} ${top}Z`); break;
    case 'dome': out += f(`M${n(x0 + 0.4)} ${top}a${n(w / 2 - 0.4)} ${n(w / 2 - 0.4)} 0 0 1 ${n(w - 0.8)} 0Z`); break;
    case 'gables': out += f(`M${n(x0)} ${top}L${n(x0 + w * 0.17)} ${top - 3}L${n(x0 + w * 0.34)} ${top}L${cx} ${top - 4}L${n(x0 + w * 0.66)} ${top}L${n(x0 + w * 0.83)} ${top - 3}L${n(x1)} ${top}Z`); break;
    case 'antenna': out += s(`M${cx} ${top}V${top - 5}M${n(cx - 1.4)} ${top - 3.2}h2.8`); break;
    case 'stepped': out += f(`M${n(x0 + 1)} ${top}V${top - 2}H${n(x1 - 1)}V${top}Z`) + f(`M${n(x0 + 2)} ${top - 2}V${top - 3.8}H${n(x1 - 2)}V${top - 2}Z`) + s(`M${cx} ${top - 3.8}V${top - 5.4}`); break;
    case 'crown': out += f(`M${n(x0)} ${top}V${top - 2.4}L${n(x0 + w / 4)} ${top - 1.2}L${cx} ${top - 3}L${n(x1 - w / 4)} ${top - 1.2}L${n(x1)} ${top - 2.4}V${top}Z`); break;
    case 'clock': out += f(`M${n(x0 + 0.6)} ${top}V${top - 2.4}H${n(x1 - 0.6)}V${top}Z`) + f(`M${n(x0 + 0.6)} ${top - 2.4}L${cx} ${top - 5.4}L${n(x1 - 0.6)} ${top - 2.4}Z`) + s(`M${cx} ${top - 5.4}V${top - 6.6}`); break;
    default: break;
  }
  if (detail === 'bands') { let p = ''; for (let y = top + 2.6; y < 20; y += 3) p += `M${n(x0 + 1.3)} ${n(y)}h${n(w - 2.6)}`; out += d(p); }
  if (detail === 'ribs') out += d(`M${n(x0 + w / 3)} ${top + 1}V20M${n(x0 + (2 * w) / 3)} ${top + 1}V20`);
  if (detail === 'x') out += d(`M${n(x0 + 0.8)} 20 ${n(x1 - 0.8)} ${top + 1}M${n(x1 - 0.8)} 20 ${n(x0 + 0.8)} ${top + 1}`);
  return svg(out);
}

/** A state capitol or hall with a dome, in a few variants. */
function domeHall(o: { star?: boolean; lantern?: boolean; wide?: boolean; cross?: boolean; flag?: boolean } = {}): string {
  let out = f('M3 21v-5h18v5Z') + f('M4.5 16v-3.2h15V16Z');
  out += f('M8.4 12.8c0-4.2 1.5-6.8 3.6-6.8s3.6 2.6 3.6 6.8Z');
  out += s('M12 6V3.4');
  if (o.lantern) out += f('M11 6.2V4.6h2v1.6Z');
  if (o.star) out += f('M12 1l.7 1.5 1.6.2-1.2 1.1.3 1.6L12 4.5l-1.4.9.3-1.6-1.2-1.1 1.6-.2Z');
  if (o.cross) out += s('M10.8 4.4h2.4');
  if (o.flag) out += s('M12 3.4V1.2') + f('M12 1.2h3v1.6h-3Z');
  out += d('M7 18.2v2.8M10 17.6V21M14 17.6V21M17 18.2v2.8');
  return svg(out);
}

/** A hall with a columned front (a courthouse, a custom house), optionally with a cupola. */
function portico(o: { cupola?: boolean; dome?: boolean } = {}): string {
  let out = f('M3.5 20.4h17V22h-17Z') + f('M4.5 11.4 12 8l7.5 3.4Z') + f('M5.4 12.2h13.2v1.4H5.4Z');
  out += f('M6.2 13.6h1.6v6.8H6.2ZM9.2 13.6h1.6v6.8H9.2ZM12.2 13.6h1.6v6.8h-1.6ZM15.2 13.6h1.6v6.8h-1.6Z');
  if (o.cupola) out += f('M10.4 8V6h3.2v2Z') + f('M10.8 6 12 3.4 13.2 6Z') + s('M12 3.4V1.8');
  if (o.dome) out += f('M9 8c0-2.6 1.2-4.2 3-4.2S15 5.4 15 8Z') + s('M12 3.8V2');
  return svg(out);
}

/** A big castle-like hall (turrets, a central tower, arched doors). */
function castleHall(o: { turrets?: boolean; tower?: boolean } = {}): string {
  let out = f('M3 21V12h18v9Z');
  if (o.turrets !== false) out += f('M3 12l2.2-6 2.2 6ZM16.6 12l2.2-6 2.2 6Z');
  if (o.tower !== false) out += f('M9.4 12V7l2.6-4 2.6 4v5Z') + s('M12 3V1.4');
  out += d('M6 21v-3a1.5 1.5 0 0 1 3 0v3M10.5 21v-3a1.5 1.5 0 0 1 3 0v3M15 21v-3a1.5 1.5 0 0 1 3 0v3M11 8.6h2M11 10.6h2');
  return svg(out);
}

const ICONS: Record<string, string> = {
  reuniontower: svg(f('M10.8 21V11h2.4v10Z') + f('M12 2.8a4.4 4.4 0 1 0 0 8.8 4.4 4.4 0 0 0 0-8.8Z') + s('M12 2.8V.8') + d('M7.8 7.2h8.4M9 4.8c2 1 4 1 6 0M9 9.6c2-1 4-1 6 0') + f('M8.5 21h7v-1.4h-7Z')),
  oldred: castleHall({ turrets: true, tower: true }),
  livestockexchange: svg(f('M3 21V12h18v9Z') + f('M9.5 12V7.4L12 4.6l2.5 2.8V12Z') + s('M10 4.8c-1.4-.2-2.1-1-2.3-2.2M14 4.8c1.4-.2 2.1-1 2.3-2.2') + d('M5.4 21v-3a1.4 1.4 0 0 1 2.8 0v3M15.8 21v-3a1.4 1.4 0 0 1 2.8 0v3M10.6 21v-3h2.8v3M11 9h2')),
  riverwalk: svg(f('M2 11h20v2.2H2Z') + d('M2 13.2c2.6 5.4 6.4 5.4 9 0M13 13.2c2.6 5.4 6.4 5.4 9 0') + f('M7 18.6h10l-1.4 2.2H8.4Z') + s('M12 18.6V15.4M12 15.4l3 3.2M2 9h20') + d('M5 9v2M9 9v2M15 9v2M19 9v2')),
  toweramericas: svg(f('M11 21V10h2v11Z') + f('M5.4 8.2C5.4 7 8.3 6 12 6s6.6 1 6.6 2.2c0 1.4-2.9 2.4-6.6 2.4S5.4 9.6 5.4 8.2Z') + f('M9.4 6c.4-2 1.4-3 2.6-3s2.2 1 2.6 3Z') + s('M12 3V1') + f('M8.5 21h7v-1.2h-7Z')),
  shoreline: tower({ w: 7, top: 6, crown: 'flat', detail: 'ribs', base: 'podium' }),
  txcapitol: domeHall({ star: true }),
  uttower: svg(f('M9 21V9h6v12Z') + f('M8 9h8V7.4H8Z') + f('M9 7.4V4.6h6v2.8Z') + f('M10 4.6V3h4v1.6Z') + s('M12 3V1.2') + d('M10.4 11.4h3.2M10.4 14.4h3.2M10.4 17.4h3.2M11 5.6a1 1 0 1 0 2 0 1 1 0 0 0-2 0') + f('M5.5 21v-3.4H9V21ZM15 21v-3.4h3.5V21Z')),
  block185: tower({ w: 6, top: 5, crown: 'flat', detail: 'ribs' }),
  otbassett: tower({ w: 6, top: 8, crown: 'stepped', detail: 'bands' }),
  albplaza: tower({ w: 6, top: 6, crown: 'flat', detail: 'bands', base: 'podium' }),
  sanxavier: svg(f('M3.5 21V8.4h5.5V21Z') + f('M3.5 8.4C3.5 6 4.7 4.4 6.2 4.4S9 6 9 8.4Z') + f('M15 21V10.6h5.5V21Z') + f('M9 21V12.6h6V21Z') + f('M10 12.6c0-2 .8-3.4 2-3.4s2 1.4 2 3.4Z') + s('M6.2 4.4V2.8M5.4 3.6h1.6') + d('M10.6 21v-3a1.4 1.4 0 0 1 2.8 0v3M5.4 12h.01M5.4 16h.01M17.7 13.6h.01')),
  grandcentraltower: tower({ w: 7, top: 6, crown: 'flat', detail: 'bands', base: 'wings' }),
  westwardho: tower({ w: 6, top: 7, crown: 'stepped', detail: 'bands' }),
  usbanktower: svg(f('M8.5 21V6.4h7V21Z') + f('M9.3 6.4V4.8h5.4v1.6Z') + f('M10.2 4.8V3.2h3.6v1.6Z') + s('M12 3.2V1.2') + d('M9.6 9h4.8M9.6 12h4.8M9.6 15h4.8M9.6 18h4.8') + f('M6 21v-3h2.5v3ZM15.5 21v-3H18v3Z')),
  capitolrecords: svg(f('M8.5 21V6h7v15Z') + f('M7.8 6h8.4V4.6H7.8Z') + s('M12 4.6V1.4') + d('M8.5 9h7M8.5 12h7M8.5 15h7M8.5 18h7') + f('M4 21v-4h4.5v4ZM15.5 21v-4H20v4Z')),
  oneamerica: tower({ w: 7, top: 5.5, crown: 'flat', detail: 'ribs', base: 'podium' }),
  coronadobridge: svg(f('M1.5 17.4c3.6 0 6-6.4 10.5-6.4s6.9 6.4 10.5 6.4v1.8c-3.6 0-6-6.4-10.5-6.4S5.1 19.2 1.5 19.2Z') + f('M6.2 21v-4.4H8V21ZM16 21v-4.4h1.8V21Z') + s('M1.5 21.6h21') + d('M10.5 12.6V19M13.5 12.6V19')),
  eastcountycourthouse: portico(),
  transamerica: svg(f('M12 1.4 8.2 21h7.6Z') + f('M8.8 13.2H6.8V6.6l2.4 3.2ZM15.2 13.2h2V6.6l-2.4 3.2Z') + d('M10.8 8h2.4M10.2 11.5h3.6M9.6 15h4.8M9 18.4h6')),
  stanford: svg(f('M2.5 21v-6h13v6Z') + d('M4.2 21v-3a1.5 1.5 0 0 1 3 0v3M8.8 21v-3a1.5 1.5 0 0 1 3 0v3M13.4 21v-3') + f('M16.5 21V8.6h4V21Z') + f('M16 8.6h5L20.4 7h-3.8Z') + f('M17.4 7V4.2h2.2V7Z') + s('M18.5 4.2V2.4')),
  tribuneoakland: tower({ w: 5, top: 9, crown: 'clock', detail: 'bands', base: 'podium' }),
  casscapitol: domeHall({ flag: true }),
  sanjosecityhall: svg(f('M4 21V14h16v7Z') + f('M8 14c0-4 1.6-6 4-6s4 2 4 6Z') + f('M16.4 14V5h3v9Z') + s('M12 8V5.8') + d('M5.6 17h.01M8.2 17h.01M10.8 17h.01M13.4 17h.01M16 17h.01M18 17h.01')),
  renoarch: svg(f('M3 21V9h2.6v12ZM18.4 21V9H21v12Z') + f('M3 9c3-5 15-5 18 0v3.4c-3-5-15-5-18 0Z') + d('M6.4 8.8h.01M9 7.5h.01M12 7h.01M15 7.5h.01M17.6 8.8h.01') + s('M8 14.5h8M8 17.5h8')),
  mgmgrand: svg(f('M10 21V6l2-3.4 2 3.4v15Z') + f('M3.5 21v-8l5 2.5V21ZM15.5 21v-5.5l5-2.5v8Z') + d('M11 9h2M11 12h2M11 15h2M11 18h2')),
  slctemple: svg(f('M10.2 21V9L12 2.6 13.8 9v12Z') + f('M4.4 21V9l1.4-4 1.4 4v12ZM16.8 21V9l1.4-4 1.4 4v12Z') + f('M7.4 21v-6h9.2v6Z') + s('M12 2.6V1.2') + d('M5.8 12v3M18.2 12v3M11 12h2M11 15h2')),
  slccityhall: castleHall({ turrets: false, tower: true }),
  walkercenter: tower({ w: 6, top: 8, crown: 'antenna', detail: 'bands' }),
  cocapitol: domeHall({ lantern: true }),
  danielsfisher: tower({ w: 4.4, top: 9, crown: 'clock', detail: 'ribs', base: 'podium' }),
  wellsfargodenver: tower({ w: 7, top: 8, crown: 'stepped', detail: 'ribs' }),
  pioneercourthouse: portico({ cupola: true }),
  portlandbuilding: svg(f('M4.5 21V6.5h15V21Z') + f('M9 3h6v3.5H9Z') + d('M7 10h2M11 10h2M15 10h2M7 13.5h2M11 13.5h2M15 13.5h2M7 17h2M11 17h2M15 17h2')),
  koin: tower({ w: 6, top: 9, crown: 'pyramid', detail: 'bands' }),
  columbiacenter: tower({ w: 7, top: 6, crown: 'slant', detail: 'ribs' }),
  smithtower: svg(f('M7 21v-6h10v6Z') + f('M9 15v-5h6v5Z') + f('M10 10V7.6h4V10Z') + f('M10.8 7.6V5.6h2.4v2Z') + f('M10.8 5.6 12 2.4l1.2 3.2Z') + s('M12 2.4V1') + d('M10.6 12h.01M13.4 12h.01M10 18h.01M12 18h.01M14 18h.01')),
  boisedepot: svg(f('M2 21v-5h20v5Z') + f('M9.5 16V6.6l2.5-3.4 2.5 3.4V16Z') + s('M12 3.2V1.6') + d('M4.4 21v-2.4a1.2 1.2 0 0 1 2.4 0V21M17.2 21v-2.4a1.2 1.2 0 0 1 2.4 0V21M11 9h2M11 12h2')),
  idcapitol: domeHall({ lantern: true, flag: false }),
  firstinterstate: tower({ w: 6.5, top: 5, crown: 'flat', detail: 'bands', base: 'podium' }),
  arkcapitol: domeHall({ flag: true }),
  oldcourthousestl: svg(f('M6.8 12c0-3.6 2.2-6 5.2-6s5.2 2.4 5.2 6Z') + s('M12 6V3.4') + f('M3.5 12h17v1.8h-17Z') + f('M4.5 14h15v7h-15Z') + d('M7 14v7M10 14v7M14 14v7M17 14v7') + f('M11 3.4 12 1.6l1 1.8Z')),
  swbell: tower({ w: 8, top: 7, crown: 'stepped', detail: 'bands', base: 'podium' }),
  bofacorp: tower({ w: 7, top: 6, crown: 'crown', detail: 'ribs' }),
  southtryon550: tower({ w: 6, top: 8, crown: 'spire', detail: 'ribs', base: 'podium' }),
  nccapitol: domeHall({ cross: true }),
  wvcapitol: domeHall({ lantern: true, star: false }),
  keeneland: svg(f('M4 21v-9h16v9Z') + f('M7 12V8l1.5-4.6L10 8v4ZM14 12V8l1.5-4.6L17 8v4Z') + d('M5.4 15.4h13.2M5.4 18.2h13.2') + s('M8.5 3.4V1.6M15.5 3.4V1.6')),
  fortknox: svg(f('M12 2.6a9.4 9.4 0 1 0 0 18.8 9.4 9.4 0 0 0 0-18.8Z') + d('M12 5.4a6.6 6.6 0 1 0 0 13.2 6.6 6.6 0 0 0 0-13.2Z') + f('M12 9.4a2.6 2.6 0 1 0 0 5.2 2.6 2.6 0 0 0 0-5.2Z') + d('M12 6v3.4M12 14.6V18M6 12h3.4M14.6 12H18')),
  sunsphere: svg(f('M12 2.2a5 5 0 1 0 0 10 5 5 0 0 0 0-10Z') + s('M10.4 12.2 9 21M13.6 12.2 15 21M10 17h4') + d('M7.4 7.2h9.2M8.2 4.8c2.4 1 5.2 1 7.6 0M8.2 9.6c2.4-1 5.2-1 7.6 0')),
  maclellan: tower({ w: 7, top: 9, crown: 'stepped', detail: 'bands', base: 'podium' }),
  cadetchapel: svg(f('M2.5 21 4.2 8l1.7 13ZM6.3 21 8.1 5.5l1.8 15.5ZM10.4 21 12 2l1.6 19ZM14.1 21 15.9 5.5l1.8 15.5ZM18.1 21 19.8 8l1.7 13Z') + s('M2 21.6h20')),
  pacificsw: tower({ w: 6, top: 7, crown: 'flat', detail: 'bands', base: 'podium' }),
  devontower: tower({ w: 6.5, top: 6, crown: 'slant', detail: 'ribs' }),
  southboston320: tower({ w: 6, top: 9, crown: 'spire', detail: 'bands', base: 'podium' }),
  nebcapitol: svg(f('M3 21v-6.4h18V21Z') + f('M8.4 14.6V6h7.2v8.6Z') + f('M9.4 6c0-2 1-3 2.6-3s2.6 1 2.6 3Z') + s('M12 3V1.2') + d('M10 9h4M10 11.6h4M6 17h.01M9 17h.01M15 17h.01M18 17h.01')),
  mutualomaha: tower({ w: 6, top: 5, crown: 'crown', detail: 'bands' }),
  epiccenter: tower({ w: 7, top: 6, crown: 'flat', detail: 'ribs' }),
  mscapitol: domeHall({ lantern: true, cross: true }),
  alcapitol: portico({ dome: true }),
  wattsbuilding: tower({ w: 6.5, top: 8, crown: 'flat', detail: 'bands', base: 'podium' }),
  regionsharbert: tower({ w: 6, top: 7, crown: 'spire', detail: 'bands' }),
  shangrila: tower({ w: 6, top: 4, crown: 'slant', detail: 'ribs' }),
  paradox: tower({ w: 6, top: 6, crown: 'flat', detail: 'x' }),
  vancouverhouse: svg(f('M10 21 8 5.4l9.6 2.4-2 13.2Z') + d('M9.4 10.6l5.6 1.4M9.9 14.6l4.9 1.2M10.3 18l3.6.9')),
  saddledome: svg(f('M2 9c4 6 6.5 7.2 10 7.2S18 15 22 9v3.2C18 18.2 15.5 19.6 12 19.6S6 18.2 2 12.2Z') + f('M3 19.6h18V21H3Z') + d('M7 17v2.6M12 17.6v2M17 17v2.6')),
  telussky: tower({ w: 6.5, top: 7, crown: 'dome', detail: 'ribs' }),
  bowcalgary: svg(f('M8.5 21V4.4C13.4 6 16 8.4 16 12.6S13.4 19.4 8.5 21Z') + d('M8.5 8.6 14.4 9.6M8.5 12.4 15.4 12.8M8.5 16.2 14.4 15.4')),
  epcortower: tower({ w: 6, top: 8, crown: 'antenna', detail: 'bands' }),
  stantectower: tower({ w: 5.4, top: 7, crown: 'spire', detail: 'ribs', base: 'podium' }),
  mosaicregina: tower({ w: 6, top: 8, crown: 'flat', detail: 'ribs' }),
  nutrientower: tower({ w: 6, top: 8, crown: 'flat', detail: 'bands', base: 'podium' }),
  main300: tower({ w: 6, top: 9, crown: 'flat', detail: 'bands' }),
  parliamentcanada: svg(f('M10 21V8.4h4V21Z') + f('M9.2 8.4h5.6L12 2.6Z') + s('M12 2.6V1') + d('M12 11.2a1.1 1.1 0 1 0 0 2.2 1.1 1.1 0 0 0 0-2.2Z') + f('M2.5 21v-7h7.5v7ZM14 21v-7h7.5v7Z') + f('M2.5 14l1.6-2 1.6 2ZM18.3 14l1.6-2 1.6 2Z') + d('M4.6 17.4h.01M7.4 17.4h.01M16.6 17.4h.01M19.4 17.4h.01')),
  maryqueen: svg(f('M6.6 14c0-4.8 2.2-7.6 5.4-7.6s5.4 2.8 5.4 7.6Z') + s('M12 6.4V2.6M10.8 4h2.4') + f('M4 14h16v1.8H4Z') + f('M5 15.8h14V21H5Z') + d('M7.2 15.8V21M9.6 15.8V21M12 15.8V21M14.4 15.8V21M16.8 15.8V21') + f('M5.6 14V12l.8-1.2.8 1.2v2ZM16.8 14v-2l.8-1.2.8 1.2v2Z')),
  notredamemontreal: svg(f('M3.5 21V8l2.6-3.6L8.7 8v13Z') + f('M15.3 21V8l2.6-3.6L20.5 8v13Z') + f('M8.7 21V11h6.6v10Z') + s('M6.1 4.4V2.6M17.9 4.4V2.6') + d('M10.2 21v-3.4a1.8 1.8 0 0 1 3.6 0V21M5 12h.01M5 15h.01M19 12h.01M19 15h.01')),
  maestria: tower({ w: 7, top: 5, crown: 'dome', detail: 'x' }),
  quebecparliament: svg(f('M3 21V11h18v10Z') + f('M3 11l2-3h14l2 3Z') + f('M9.4 11V6.4h5.2V11Z') + f('M8.8 6.4 12 2.6l3.2 3.8Z') + s('M12 2.6V1') + d('M6 14.6h.01M9 14.6h.01M15 14.6h.01M18 14.6h.01M10.8 21v-3.4h2.4V21M11 8.6h2')),
  chateaufrontenac: svg(f('M3.4 21V11h17.2v10Z') + f('M3 11l2.2-6 2.2 6ZM16.6 11l2.2-6 2.2 6Z') + f('M9 11V6l3-4.4L15 6v5Z') + s('M12 1.6V.4') + d('M5.2 14h.01M8.4 14h.01M15.6 14h.01M18.8 14h.01M5.2 17.6h.01M8.4 17.6h.01M15.6 17.6h.01M18.8 17.6h.01M11 9h2M10.6 21v-4h2.8v4')),
  halifaxclock: svg(f('M1.5 21c4-4.4 7-5.2 10.5-5.2S18.5 16.6 22.5 21Z') + f('M9.6 16V8h4.8v8Z') + f('M9 8h6V6.6H9Z') + f('M10 6.6 12 3l2 3.6Z') + d('M12 9.6a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Z') + s('M12 3V1.6')),
  customhouseme: portico(),
  industrialtrust: svg(f('M8.5 21V11h7v10Z') + f('M9.5 11V8h5v3Z') + f('M10.5 8V5.6h3V8Z') + f('M11.2 5.6V3.6h1.6v2Z') + s('M12 3.6V1.6') + f('M5.5 21v-6h3v6ZM15.5 21v-6h3v6Z') + d('M10.4 13.4v6.6M12 13.4v6.6M13.6 13.4v6.6')),
  travelerstower: svg(f('M9 21V9h6v12Z') + f('M8.4 9h7.2V7.6H8.4Z') + f('M10 7.6V5.6h4v2Z') + d('M11.3 6.2v1M12.7 6.2v1') + f('M10 5.6 12 2.4l2 3.2Z') + s('M12 2.4V1') + d('M10.6 12h2.8M10.6 15h2.8M10.6 18h2.8')),
  buffalocityhall: svg(f('M7 21V10h10v11Z') + f('M9 10V6h6v4Z') + f('M10.5 6V3.4h3V6Z') + f('M10.6 3.4 12 1.2l1.4 2.2Z') + f('M4.5 21v-6H7v6ZM17 21v-6h2.5v6Z') + d('M9.6 13.4V20M12 13.4V20M14.4 13.4V20')),
  empirestateplaza: svg(f('M14.5 21V3.6h4.6V21Z') + f('M3 21V11h2.4v10ZM6.4 21V11h2.4v10ZM9.8 21V11h2.4v10Z') + f('M3 21c0-2 1.4-3.4 4.2-3.4S11.4 19 11.4 21Z') + d('M16 7h1.6M16 10h1.6M16 13h1.6M16 16h1.6')),
};

for (const [id, markup] of Object.entries(ICONS)) EXTRA_ICONS[id] = markup;
