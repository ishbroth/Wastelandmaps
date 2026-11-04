// The map's icons: one drawn for what each place actually is (a church, a house, a hospital, a bridge...), and for the famous landmarks a
// miniature of the landmark itself. Original line drawings, 24x24. A place you have not found yet shows only the outline; once found, the
// shapes fill in solid. Three kinds of stroke make that work:
//   f = a shape that fills in solid when found      d = a detail inside a shape (shows dark on the solid fill)      s = a line that stays a line

import type { CategoryId } from './wasteland';

type BaseIconId =
  | 'school' | 'church' | 'cross' | 'cluster' | 'house' | 'smallbuilding' | 'museum' | 'clocktower' | 'hospital' | 'plane' | 'subway' | 'bridge'
  | 'anchor' | 'stadium' | 'tree' | 'shield' | 'capitol' | 'castle' | 'bed' | 'vault' | 'homevault' | 'tower' | 'monument' | 'arch'
  | 'book' | 'beaker' | 'houses' | 'skyscraper' | 'statue' | 'ringart' | 'flag' | 'column' | 'railcross' | 'tram' | 'mosque' | 'cathedral' | 'temple' | 'badge' | 'firebadge' | 'fork' | 'cart' | 'theatre' | 'leafytree' | 'fountain'
  | 'factory' | 'apartment' | 'trailer'
  | 'radiotower' | 'lighthouse' | 'gasmask' | 'tractor' | 'cannon' | 'bus' | 'tent' | 'observatory' | 'lifebuoy' | 'ruins' | 'ship' | 'pinetree'
  | 'eiffel' | 'liberty' | 'spaceneedle' | 'opera' | 'redeemer' | 'kremlin';

/** The world-famous buildings and monuments, drawn as themselves (famousIcons.ts). */
export type FamousIconId =
  | 'notredame' | 'toweroflondon' | 'brooklynbridge' | 'pyramids' | 'londoneye' | 'chrysler' | 'colosseum' | 'sagrada' | 'louvre' | 'buckingham' | 'brandenburg'
  | 'parthenon' | 'hagiasophia' | 'stbasils' | 'whitehouse' | 'lincoln' | 'sydneybridge' | 'hooverdam' | 'timessquare' | 'grandcentral' | 'rockefeller'
  | 'forbiddencity' | 'alcatraz' | 'towerbridge' | 'stpeters' | 'trevi' | 'westminsterabbey' | 'sacrecoeur' | 'atomium' | 'charlesbridge' | 'duomomilan'
  | 'rialto' | 'pantheon'
  | 'miamifreedom' | 'cocacola' | 'atlairport' | 'keytower' | 'unionterminal' | 'bengalsstadium'
  | 'horseshoe' | 'speedway' | 'soldierssailors' | 'rencen' | 'guardian' | 'hancock'
  | 'navypier' | 'wisgas' | 'wiscapitol' | 'libertymemorial' | 'powerlight' | 'capellatower'
  | 'stpaulcathedral' | 'iowacapitol' | 'seagate' | 'aegon' | 'basspro' | 'attbatman'
  | 'ppgplace' | 'comcastcenter' | 'oneliberty' | 'bromoseltzer' | 'bofabaltimore' | 'vbconvention'
  | 'colonialwilliamsburg' | 'vacapitol' | 'niagara' | 'indsquare' | 'tampa100' | 'breakwater'
  | 'frenchquarter' | 'tcenergy' | 'spacecenter'
  | 'reuniontower' | 'oldred' | 'livestockexchange' | 'riverwalk' | 'toweramericas' | 'shoreline'
  | 'txcapitol' | 'uttower' | 'block185' | 'otbassett' | 'albplaza' | 'sanxavier'
  | 'grandcentraltower' | 'westwardho' | 'usbanktower' | 'capitolrecords' | 'oneamerica' | 'coronadobridge'
  | 'eastcountycourthouse' | 'transamerica' | 'stanford' | 'tribuneoakland' | 'casscapitol' | 'sanjosecityhall'
  | 'renoarch' | 'mgmgrand' | 'slctemple' | 'slccityhall' | 'walkercenter' | 'cocapitol'
  | 'danielsfisher' | 'wellsfargodenver' | 'pioneercourthouse' | 'portlandbuilding' | 'koin' | 'columbiacenter'
  | 'smithtower' | 'boisedepot' | 'idcapitol' | 'firstinterstate' | 'arkcapitol' | 'oldcourthousestl'
  | 'swbell' | 'bofacorp' | 'southtryon550' | 'nccapitol' | 'wvcapitol' | 'churchilldowns' | 'lexfinancial'
  | 'fortknox' | 'sunsphere' | 'maclellan' | 'cadetchapel' | 'pacificsw' | 'devontower'
  | 'southboston320' | 'nebcapitol' | 'mutualomaha' | 'epiccenter' | 'mscapitol' | 'alcapitol'
  | 'wattsbuilding' | 'regionsharbert' | 'shangrila' | 'paradox' | 'vancouverhouse' | 'saddledome'
  | 'telussky' | 'bowcalgary' | 'epcortower' | 'stantectower' | 'skleg' | 'nutrientower'
  | 'main300' | 'parliamentcanada' | 'maryqueen' | 'notredamemontreal' | 'maestria' | 'quebecparliament'
  | 'chateaufrontenac' | 'halifaxclock' | 'customhouseme' | 'industrialtrust' | 'travelerstower' | 'buffalocityhall'
  | 'empirestateplaza';
export type IconId = BaseIconId | FamousIconId | `local:${string}`;
/** Makers for icons that are built from their id (the local landmarks of famousIcons2.ts). */
export const ICON_MAKERS: ((id: string) => string | undefined)[] = [];
/** Filled in by famousIcons.ts when it loads. */
export const EXTRA_ICONS: Record<string, string> = {};

export const f = (d: string) => `<path class="f" d="${d}"/>`;
export const d = (p: string) => `<path class="d" d="${p}"/>`;
export const s = (p: string) => `<path class="s" d="${p}"/>`;
export const svg = (inner: string) =>
  `<svg viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;

/** The outline of a cog: a ring of teeth, like the door of a vault. */
function gearPath(cx: number, cy: number, teeth: number, outer: number, root: number, tooth = 0.17, flank = 0.3): string {
  const step = (2 * Math.PI) / teeth;
  let out = '';
  for (let i = 0; i < teeth; i++) {
    for (const [turn, r] of [[-flank, root], [-tooth, outer], [tooth, outer], [flank, root]] as [number, number][]) {
      const t = i * step + turn * step;
      out += `${out ? 'L' : 'M'}${Math.round((cx + Math.cos(t) * r) * 100) / 100} ${Math.round((cy + Math.sin(t) * r) * 100) / 100}`;
    }
  }
  return out + 'Z';
}
/** The Vault-Tec cog as on the map of the games: ten broad teeth on a thick rim, a round window cut out of it, and a hub in the middle. */
const COG = gearPath(12, 12, 10, 11, 8.9, 0.2, 0.32);
const cut = (cx: number, cy: number, r: number) => `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0Z`;
const cog = `<path class="f" fill-rule="evenodd" d="${COG}${cut(12, 12, 5.8)}"/>` + f(cut(12, 12, 2.9)) + d(cut(12, 12, 4.3));

const ICONS: Record<BaseIconId, string> = {
  school: svg(f('M3.6 20.5v-9.4L12 7.6l8.4 3.5v9.4Z') + f('M10.4 7.6V4.6h3.2v3') + s('M12 4.6V2') + d('M10.6 20.5v-4.4h2.8v4.4') + d('M6.2 13.4h2.2M15.6 13.4h2.2')),
  church: svg(f('M4.8 21v-9L12 7.8l7.2 4.2v9Z') + f('M10.6 8.2V5.8L12 3.4l1.4 2.4v2.4') + s('M12 3.4V1.6M10.9 2.5h2.2') + d('M10 21v-3.6a2 2 0 0 1 4 0V21') + d('M7 13.6h1.8M15.2 13.6H17')),
  cross: svg(f('M10 3h4v5h5v4h-5v9h-4v-9H5V8h5Z')),
  cluster: svg(f('M2.5 21V10h5.5v11Z') + f('M8 21V3.5h8V21Z') + f('M16 21v-8h5.5v8Z') + d('M10.2 7h3.6M10.2 11h3.6M10.2 15h3.6M4.5 13.5h1.5M4.5 17h1.5M18 16.5h1.5')),
  house: svg(f('M2.8 12.2 12 3.8l9.2 8.4h-2.7v8.3h-13V12.2Z') + f('M16.2 5.2h2.6v4.6l-2.6-2.3Z') + d('M10.2 20.5v-5.2h3.6v5.2') + d('M6.6 13.4h2.3v2.1H6.6ZM15.1 13.4h2.3v2.1h-2.3Z')),
  smallbuilding: svg(f('M2.8 8.6 4.4 4h15.2l1.6 4.6Z') + f('M4.4 8.6V20.5h15.2V8.6Z') + d('M9.8 20.5v-6.4h4.4v6.4') + d('M6.4 11.6h2.2M15.4 11.6h2.2') + d('M8.2 4v4.6M12 4v4.6M15.8 4v4.6')),
  museum: svg(f('M3 9.2 12 3.5l9 5.7Z') + f('M5 10.8h2.2v7H5ZM9 10.8h2.2v7H9ZM12.8 10.8H15v7h-2.2ZM16.8 10.8H19v7h-2.2Z') + f('M3.5 18.5h17v2.2h-17Z')),
  clocktower: svg(f('M8.5 21V8.5L12 3l3.5 5.5V21Z') + d('M12 9.4V11l1.2.8') + d('M10.9 21v-3.4h2.2V21') + s('M12 3V1.2')),
  hospital: svg(f('M12 2.5a9.5 9.5 0 1 0 0 19 9.5 9.5 0 0 0 0-19Z') + d('M12 6.8v10.4M6.8 12h10.4')),
  plane: svg(f('M12 2c.9 0 1.6.7 1.6 1.6V9l8 4.9v2L13.6 14v4.2l2.1 1.6V22L12 21l-3.7 1v-2.2l2.1-1.6V14l-8 1.9v-2L10.4 9V3.6C10.4 2.7 11.1 2 12 2Z')),
  subway: svg(f('M6 3h12a2 2 0 0 1 2 2v11a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V5a2 2 0 0 1 2-2Z') + d('M7 6.8h10v5.4H7Z') + d('M8.5 15.6h.01M15.5 15.6h.01') + s('M7.5 19.3 5.5 22M16.5 19.3l2 2.7')),
  bridge: svg(f('M2 14h20v2.6H2Z') + f('M3.4 7.4h17.2v2.2H3.4Z') + d('M5.4 14l2.5-4.4 2.6 4.4 2.5-4.4 2.6 4.4 2.5-4.4') + f('M3 16.6h2.2V21H3ZM18.8 16.6H21V21h-2.2Z')),
  anchor: svg(f('M12 3a2.2 2.2 0 1 0 0 4.4A2.2 2.2 0 0 0 12 3Z') + s('M12 7.4V21M7.5 12h9M4.5 15c.2 3.3 3.2 6 7.5 6s7.3-2.7 7.5-6')),
  stadium: svg(f('M12 5.5c5.2 0 9.5 2.9 9.5 6.5s-4.3 6.5-9.5 6.5S2.5 15.6 2.5 12 6.8 5.5 12 5.5Z') + d('M12 9.3c2.8 0 5 1.2 5 2.7s-2.2 2.7-5 2.7-5-1.2-5-2.7 2.2-2.7 5-2.7Z')),
  tree: svg(f('M12 2.8 5.6 12h3.2L4.8 17.4h14.4L15.2 12h3.2Z') + f('M10.8 17.4h2.4v4h-2.4Z')),
  shield: svg(f('M12 2.8 4.5 5.6v6c0 4.4 3 7.8 7.5 9.6 4.5-1.8 7.5-5.2 7.5-9.6v-6L12 2.8Z') + d('m9 11.8 2.2 2.2 4.2-4.4')),
  capitol: svg(f('M6 20v-7h12v7Z') + f('M7.4 13a4.6 4.6 0 0 1 9.2 0Z') + s('M12 8.4V4M4 21h16') + d('M9 15v3.4M12 15v3.4M15 15v3.4')),
  castle: svg(f('M3.6 21V5.4h3.6v2.4h1.8V5.4h3v2.4h1.8V5.4H18v2.4h1.8V5.4H20.4V21Z') + d('M10 21v-4.4a2 2 0 0 1 4 0V21') + d('M6 11.4h.01M18 11.4h.01')),
  bed: svg(f('M3 13h18v5H3Z') + f('M5.3 9a1.8 1.8 0 1 0 0 3.6 1.8 1.8 0 0 0 0-3.6Z') + s('M3 18V6.5M21 13a3 3 0 0 0-3-3h-8v3')),
  vault: svg(cog),
  tower: svg(f('M10.8 21 11.4 11.5h1.2l.6 9.5Z') + f('M7.5 9.6c0-1.2 2-2.1 4.5-2.1s4.5.9 4.5 2.1-2 2.1-4.5 2.1-4.5-.9-4.5-2.1Z') + s('M12 7.5V2.5')),
  monument: svg(f('M12 2l2 5.2V19h-4V7.2Z') + s('M7 21h10M8.5 19h7')),
  arch: svg(f('M3 21V6h18v15h-4v-8a5 5 0 0 0-10 0v8Z') + d('M3 9.2h18')),
  factory: svg(f('M2.6 21V11.6l5.6 3.4v-3.4l5.6 3.4v-3.4l5.6 3.4V5.4h3V21Z') + d('M5.6 17.6h2M10.6 17.6h2M15.6 17.6h2M20.4 8.4v.01') + s('M19.2 4V2.6')),
  apartment: svg(f('M4.8 21V3.6h14.4V21Z') + d('M8.2 7.4h2.4M13.4 7.4h2.4M8.2 11h2.4M13.4 11h2.4M8.2 14.6h2.4M13.4 14.6h2.4') + d('M10.4 21v-3.4h3.2V21')),
  trailer: svg(f('M1.8 17V8.4a1.4 1.4 0 0 1 1.4-1.4h11.4c2.6 0 5.2 3.4 5.8 5.4l1.2.4V17Z') + d('M5 9.6h4.2v3.2H5ZM11.8 9.6h2.6l2 3.2h-4.6Z') + f('M7 17.6a2 2 0 1 0 0 4 2 2 0 0 0 0-4ZM16.6 17.6a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z')),
  radiotower: svg(f('M12 5 8.2 21h2.2l.6-2.6h2l.6 2.6h2.2Z') + d('M10 15.4h4M10.8 11.6h2.4') + s('M12 5V2.6') + s('M7.4 6.6a6 6 0 0 1 0-4.8M16.6 1.8a6 6 0 0 1 0 4.8')),
  lighthouse: svg(f('M9.6 21 10.6 8.4h2.8l1 12.6Z') + f('M9.2 8.4h5.6V6.6H9.2Z') + f('M10.4 6.6V4.6L12 3l1.6 1.6v2Z') + f('M7.4 21h9.2v1.4H7.4Z') + d('M10.2 13h3.6M9.9 17h4.2') + s('M6.4 5.2H8.4M15.6 5.2h2')),
  gasmask: svg(f('M12 3C8 3 5.5 6 5.5 10.2c0 3.2 1.6 5 3 6.2V19h7v-2.6c1.4-1.2 3-3 3-6.2C18.5 6 16 3 12 3Z') + d('M8.1 9.8a2 2 0 1 0 4 0 2 2 0 0 0-4 0ZM11.9 9.8a2 2 0 1 0 4 0 2 2 0 0 0-4 0Z') + f('M9.8 19v2.8h4.4V19Z') + d('M10.4 14.6h3.2')),
  tractor: svg(f('M2.8 11.4h13.4v5.2H2.8Z') + f('M8.4 5.4h5.8l2 6H8.4Z') + d('M10 7.4h3.4v3H10Z') + f('M6.6 13.4a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z') + f('M18.6 15.6a2.4 2.4 0 1 0 0 4.8 2.4 2.4 0 0 0 0-4.8Z') + s('M16.2 13.6h2.4v2')),
  cannon: svg(f('M2.6 10.4 14.6 6l1.9 4.6L5 15.2Z') + f('M14 12.6a4.2 4.2 0 1 0 0 8.4 4.2 4.2 0 0 0 0-8.4Z') + d('M14 14.4v4.8M11.6 16.8h4.8') + f('M19.4 17.4a1.7 1.7 0 1 0 0 3.4 1.7 1.7 0 0 0 0-3.4Z')),
  bus: svg(f('M3 6.4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2V17.4H3Z') + d('M5 7.4h5v3.6H5ZM11.6 7.4H19v3.6h-7.4Z') + d('M3 14.4h18') + f('M6.6 16.4a2 2 0 1 0 0 4 2 2 0 0 0 0-4ZM17.4 16.4a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z')),
  tent: svg(f('M2.4 20.6 12 4.4l9.6 16.2Z') + d('M9.8 20.6 12 14.4l2.2 6.2') + s('M12 4.4V2.4')),
  observatory: svg(f('M4.4 21v-8a7.6 7.6 0 0 1 15.2 0v8Z') + d('M11 5.6h2v8h-2Z') + d('M10.2 21v-3.6h3.6V21')),
  lifebuoy: svg(f('M12 2.8a9.2 9.2 0 1 0 0 18.4 9.2 9.2 0 0 0 0-18.4Z') + d('M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z') + d('M5.6 5.6l3.6 3.6M18.4 5.6l-3.6 3.6M5.6 18.4l3.6-3.6M18.4 18.4l-3.6-3.6')),
  ruins: svg(f('M3.4 21V12.2l2.2-1.6V8.4l2.2 1.2V6.4l2.2 1.4v3.4l1.8 1.1V9l2.4 1.5v2.7l1.8-.9V21Z') + d('M7.4 21v-3.4M13.4 21v-4.6')),
  ship: svg(f('M2.4 14h19.2l-2.4 5.6H4.8Z') + f('M7 14V9.4h7.6V14Z') + f('M10 9.4V6.2h2.6v3.2') + d('M8.6 11.6h.01M11.3 11.6h.01M14 11.6h.01') + s('M3 22c2 0 2-1 4-1s2 1 4 1 2-1 4-1 2 1 4 1')),
  pinetree: svg(f('M12 2.4 6.4 9.4h3L5.4 15h4.2l-3.6 4.6h12L14.4 15h4.2l-4-5.6h3Z') + f('M10.8 19.6h2.4v2.4h-2.4Z')),
  eiffel: svg(f('M12 2l1.3 6 2.2 6 3 7h-3.2l-1.3-3h-4l-1.3 3H5.5l3-7 2.2-6Z') + d('M10.6 8.3h2.8M9.3 13h5.4') + s('M10.2 17.5h3.6')),
  liberty: svg(f('M9 21l1-9.3h4L15 21Z') + f('M12 6.8a1.9 1.9 0 1 0 0 3.8 1.9 1.9 0 0 0 0-3.8Z') + f('M7 21h10v-1.8H7Z') + s('M13.6 11.5 17 5M17 5l.8-2.4M10.3 6.8 9 5.5M12 5V3.3M13.7 6.8l1.1-1.3')),
  spaceneedle: svg(f('M6 7.2c0-1.1 2.7-2 6-2s6 .9 6 2-2.7 2-6 2-6-.9-6-2Z') + f('M10.7 9.2h2.6L12.8 21h-1.6Z') + s('M12 5.2V1.8M9 21l1.8-6M15 21l-1.8-6')),
  opera: svg(f('M3 20.5C3 14 6 9 10.5 7c.3 4.3.6 9.5-1.2 13.5Z') + f('M10 20.5C10.6 15 14 9.5 19.5 8.5c1 5-1 9.5-3.8 12Z') + s('M2 21.5h20')),
  redeemer: svg(f('M12 2.3a1.6 1.6 0 1 0 0 3.2 1.6 1.6 0 0 0 0-3.2Z') + f('M11 6h2v3.5l8.5 1.4v1.9L13 11.9V21h-2v-9.1L2.5 12.8v-1.9L11 9.5Z')),
  kremlin: svg(f('M12 2c1.9 2 2.7 3.6 2.7 5.3 0 1-1.2 1.7-2.7 1.7s-2.7-.7-2.7-1.7C9.3 5.6 10.1 4 12 2Z') + f('M5.4 8.5c1 1.2 1.5 2.1 1.5 3 0 .7-.7 1.1-1.5 1.1s-1.5-.4-1.5-1.1c0-.9.5-1.8 1.5-3Z') + f('M18.6 8.5c1 1.2 1.5 2.1 1.5 3 0 .7-.7 1.1-1.5 1.1s-1.5-.4-1.5-1.1c0-.9.5-1.8 1.5-3Z') + f('M3.5 21V13.2h17V21Z') + d('M9 21v-4a3 3 0 0 1 6 0v4M6.5 16.5h.01M17.5 16.5h.01')),
  book: svg(f('M3 5.5c3-1.1 6-1 9 1v13c-3-2-6-2.1-9-1Z') + f('M21 5.5c-3-1.1-6-1-9 1v13c3-2 6-2.1 9-1Z') + d('M5.5 9c1.7-.3 3.4-.2 5 .5M5.5 12.2c1.7-.3 3.4-.2 5 .5M18.5 9c-1.7-.3-3.4-.2-5 .5M18.5 12.2c-1.7-.3-3.4-.2-5 .5')),
  beaker: svg(f('M9.5 3.5h5V9l5 9.5c.6 1.4-.3 2.5-1.7 2.5H6.2c-1.4 0-2.3-1.1-1.7-2.5L9.5 9Z') + s('M8.3 3.5h7.4') + d('M7 15.5h10M11 12.5h.01M13.5 18h.01')),
  houses: svg(f('M1.8 20.5v-6.4l3.7-3.3 3.7 3.3v6.4Z') + f('M8.2 20.5V9.2L12.8 5l4.6 4.2v11.3Z') + f('M16.6 20.5v-6.4l3.1-2.8 3.1 2.8v6.4Z') + d('M11.3 20.5v-4.2h2.9v4.2') + d('M10.9 10.6h3.8')),
  skyscraper: svg(f('M3.6 21V10.4h5.4V21Z') + f('M9 21V3.4h6.2V21Z') + f('M15.2 21v-8.6h5.2V21Z') + d('M10.8 6.6h2.6M10.8 10h2.6M10.8 13.4h2.6M10.8 16.8h2.6') + d('M5.2 13.4h2.2M5.2 16.8h2.2M16.8 15.4H19M16.8 18.4H19')),
  statue: svg(f('M12 2.5a2.1 2.1 0 1 0 0 4.2 2.1 2.1 0 0 0 0-4.2Z') + f('M9.2 17V9.8L12 7.6l2.8 2.2V17Z') + f('M7.5 21v-4h9v4Z') + s('M9.2 10.5 6.5 8.5M14.8 10.5l2.7-2')),
  ringart: svg(f('M12 3a6.8 6.8 0 1 0 0 13.6A6.8 6.8 0 0 0 12 3Z') + d('M12 7.3a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5Z') + f('M8 21v-3.2h8V21Z')),
  flag: svg(s('M6 21.5V2.5') + f('M6.5 3.5h12l-3.2 4 3.2 4h-12Z') + s('M3.5 21.5h5')),
  column: svg(f('M8 4h8v2.2H8ZM9.4 6.2h5.2v11.6H9.4ZM8 17.8h8V20H8Z') + d('M11.1 8v8M12.9 8v8') + s('M6 21h12')),
  railcross: svg(f('M3.8 6.6 6.6 3.8 12 9.2l5.4-5.4 2.8 2.8-5.4 5.4 5.4 5.4-2.8 2.8-5.4-5.4-5.4 5.4-2.8-2.8 5.4-5.4Z') + d('M12 12h.01')),
  tram: svg(f('M5 9h14a1 1 0 0 1 1 1v8H4v-8a1 1 0 0 1 1-1Z') + d('M6.5 11.2h11v3.3h-11ZM8 16.3h.01M16 16.3h.01') + s('M12 9V4M8.5 4h7M3 21h18')),
  mosque: svg(f('M6.5 21v-6.5c0-3.2 2.4-5 5.5-5s5.5 1.8 5.5 5V21Z') + s('M12 9.5V5.2M12 3a1.6 1.6 0 0 0 0 3 1.2 1.2 0 1 1 0-3Z') + f('M2.5 21V9l1.3-2.3L5.1 9v12ZM18.9 21V9l1.3-2.3L21.5 9v12Z') + d('M10.2 21v-3a1.8 1.8 0 0 1 3.6 0v3')),
  cathedral: svg(f('M3 21V11l3-6.5L9 11v10Z') + f('M15 21V11l3-6.5L21 11v10Z') + f('M9 21v-8.5h6V21Z') + d('M12 15.4h.01M10.8 21v-2.2h2.4V21') + s('M6 4.5V2.5M18 4.5V2.5M12 12.5V9')),
  temple: svg(f('M9 7.5h6L13.6 5h-3.2Z') + f('M6.5 13h11l-2-3.5h-7Z') + f('M4 19.5h16L17 15.5H7Z') + s('M12 5V2.5M3 21.5h18')),
  badge: svg(f('M12 2.5l2.5 5.3 5.8.7-4.3 4 1.1 5.7L12 15.3 6.9 18.2 8 12.5l-4.3-4 5.8-.7Z') + d('M12 9a2.2 2.2 0 1 0 0 4.4A2.2 2.2 0 0 0 12 9Z') + s('M12 18.5V21')),
  firebadge: svg(f('M12 2.6 4.6 5.5v6.6c0 4.2 3 7.4 7.4 9 4.4-1.6 7.4-4.8 7.4-9V5.5Z') + d('M12 7.2c2 2.4 3.1 4 3.1 6a3.1 3.1 0 0 1-6.2 0c0-1.4.7-2.3 1.4-3 .2 1 .6 1.5 1 1.6-.2-1.8.2-3.6.7-4.6Z')),
  fork: svg(f('M6.2 3v6.3a2.3 2.3 0 0 0 2.3 2.3V21h1.5v-9.4a2.3 2.3 0 0 0 2.3-2.3V3') + f('M17.5 3c-2 1.4-3 4-3 7v3.5h3V21H19V3Z') + d('M9.3 3v5.5')),
  homevault: svg(`<path class="f" fill-rule="evenodd" d="${COG}${cut(12, 12, 5.8)}"/>` + f('M8.7 13.2 12 10l3.3 3.2v3.4H8.7Z') + d('M7.9 13.3 12 9.2l4.1 4.1') + d('M11.1 16.6v-2.2h1.8v2.2')),
  cart: svg(s('M2.5 4h3l2.3 11.2h10.2') + f('M6.4 6.8h14.2l-2 7.2H8Z') + f('M9.6 17.4a1.6 1.6 0 1 0 0 3.2 1.6 1.6 0 0 0 0-3.2ZM16.6 17.4a1.6 1.6 0 1 0 0 3.2 1.6 1.6 0 0 0 0-3.2Z') + d('M11 9v3M14 9v3M17 9v3')),
  theatre: svg(f('M3.5 4h9.5v7.8a4.75 4.75 0 0 1-9.5 0Z') + f('M11 9.5h9.5v6.8a4.75 4.75 0 0 1-9.5 0Z') + d('M6.2 8.5h.01M10.3 8.5h.01M5.8 12.2c.8.8 2.2.8 3 0M14 13.5h.01M18 13.5h.01M14.2 17.2c.8-.8 2.4-.8 3.2 0')),
  leafytree: svg(f('M12 2.8a5 5 0 0 0-4.6 6.9A4.3 4.3 0 0 0 8 18.2h3V21h2v-2.8h3a4.3 4.3 0 0 0 .6-8.5A5 5 0 0 0 12 2.8Z') + d('M12 18V11M12 13.5l-2-2M12 12l2-2')),
  fountain: svg(f('M4.5 16.5h15l-1.8 4h-11.4Z') + s('M12 16.5V8M12 8C10.5 6.5 8.5 7 7.5 9M12 8c1.5-1.5 3.5-1 4.5 1M12 5V3M9.5 5.5 8.5 4M14.5 5.5l1-1.5')),
};

export function placeIcon(id: IconId): string {
  const known = (ICONS as Record<string, string>)[id] ?? EXTRA_ICONS[id];
  if (known) return known;
  for (const make of ICON_MAKERS) {
    const made = make(id);
    if (made) { EXTRA_ICONS[id] = made; return made; }
  }
  return ICONS.monument;
}

/** The everyday icon for each kind of place, used on the filter buttons and when nothing about the real name says more. */
export const CATEGORY_ICON: Record<CategoryId, IconId> = {
  medical: 'hospital', school: 'school', market: 'smallbuilding', fuel: 'smallbuilding', park: 'tree', guard: 'shield', cantina: 'smallbuilding',
  chapel: 'church', transit: 'subway', arena: 'stadium', lodging: 'bed', other: 'monument',
};

// ---- choosing an icon from what the place is ----
/** A steady pick from a few icons for the same sort of place, so the map mixes them but a place never changes its icon. */
const mix = (name: string, options: IconId[]): IconId => {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return options[h % options.length];
};
/** Mostly subway cars; some stops get a railroad crossing, some a tram. */
const transitIcon = (name: string): IconId => (/\b(?:tram|trolley|light rail|streetcar)\b/.test(name) ? 'tram' : mix(name, ['subway', 'bus', 'subway', 'railcross', 'tram', 'bus']));
const churchIcon = (name: string): IconId =>
  /mosque|masjid|moschee|mezquita|moschea/.test(name) ? 'mosque'
  : /synagogue|temple|shrine|pagoda|gurdwara|mandir|\bwat\b|buddh|hindu|shinto/.test(name) ? 'temple'
  : /cathedral|cath[eé]drale|kathedrale|basilica|duomo|minster|abbey/.test(name) ? mix(name, ['cathedral', 'cathedral', 'church'])
  : mix(name, ['church', 'church', 'cathedral']);
/** A district of the city: a few buildings together, or a cluster of small houses. */
export const neighborhoodIcon = (name: string): IconId => mix(name, ['cluster', 'houses', 'houses', 'cluster']);

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
  if (test(/tokyo tower|oriental pearl|cn tower|hillbrow|coit tower|leaning tower|torre de pisa/, n)) return 'tower';
  if (test(/taj mahal|independence hall/, n)) return 'capitol';
  if (test(/superdome/, n)) return 'stadium';
  if (test(/rock and roll hall of fame/, n)) return 'museum';
  if (test(/hollywood sign|washington monument|obelisco/, n)) return 'monument';
  if (test(/big ben|elizabeth tower|clock tower|clocktower|tour de l.horloge|uhrturm|torre del reloj|torre dell.orologio|zytglogge/, n)) return 'clocktower';

  // what the name says it is
  if (test(/cemetery|cimeti[eè]re|friedhof|graveyard|necropolis|cementerio|cimitero|burial ground/, n)) return 'cross';
  if (test(/\b(?:airport|airfield|aerodrome|airbase|air base|heliport|flughafen|a[eé]roport|aeropuerto|aeroporto)\b/, n)) return 'plane';
  if (test(/\bbridge\b|\bpont\b|br[uü]cke|\bponte\b|puente|viaduct/, n)) return 'bridge';
  if (test(/\btunnel\b|\bstation\b|\bgare\b|bahnhof|estaci[oó]n|stazione|\bmetro\b|subway|underground|\btram\b/, n) && category === 'transit') return transitIcon(n);
  if (test(/\b(?:port|harbou?r|ferry|pier|dock|wharf|marina)\b/, n) && category === 'transit') return mix(n, ['anchor', 'lifebuoy', 'ship']);
  if (test(/hospital|h[oô]pital|krankenhaus|ospedale|clinic|medical cent|infirmary|sanatorium/, n)) return 'hospital';
  if (test(/museum|mus[eé]e|museo|gallery|galerie|aquarium|planetarium/, n)) return 'museum';
  if (test(/library|biblioth[eè]que|biblioteca|bibliothek|archive/, n)) return 'book';
  if (test(/observatory|planetarium|telescope|astronom/, n)) return 'observatory';
  if (test(/chemical|hazmat|nuclear|reactor|power (?:plant|station)|refiner|waste|sewage|incinerat/, n)) return 'gasmask';
  if (test(/factory|\bplant\b|\bmill\b|industrial|manufactur|foundry|brewery|\bworks\b/, n)) return 'factory';
  if (test(/\bfarm\b|\branch\b|orchard|vineyard|agricult|\bbarn\b|dairy|stockyard|livestock/, n)) return 'tractor';
  if (test(/\bruins?\b|abandoned|ancient|archaeolog|historic (?:site|district)|battlefield|\bold fort\b/, n)) return 'ruins';
  if (test(/\blab\b|laborator|research (?:center|centre|institute)|science (?:center|centre)/, n)) return 'beaker';
  if (test(/castle|ch[aâ]teau|palace|palais|fortress|citadel|schloss|castello|alc[aá]zar|\bfort\b|barracks/, n)) return /\bfort\b|barracks|fortress|citadel/.test(n) ? mix(n, ['castle', 'cannon']) : 'castle';
  if (test(/capitol|parliament|city hall|town hall|courthouse|court house|state house|senate|congress|assembly|rathaus|ayuntamiento|h[oô]tel de ville|\bcourt of\b/, n)) return 'capitol';
  if (test(/stadium|stade|stadion|estadio|arena|ballpark|coliseum|colosseum|speedway|racecourse|velodrome/, n)) return 'stadium';
  if (test(/cathedral|cath[eé]drale|church|chapel|basilica|abbey|mosque|synagogue|temple|kirche|chiesa|iglesia|[eé]glise|minster|monastery|meeting house|shrine|pagoda|mission/, n)) return churchIcon(n);
  if (test(/lighthouse|light station|beacon/, n)) return 'lighthouse';
  if (test(/(?:tv|radio|television|telecom|transmitter|antenna)|\bmast\b/, n)) return 'radiotower';
  if (test(/(?:observation|water|cn) tower|needle|spire|campanile|belfry/, n)) return 'tower';
  if (test(/fire (?:station|department|house|brigade)|firehouse|pompier|feuerwehr|bomberos/, n)) return 'firebadge';
  if (test(/police|precinct|sheriff|gendarmerie|polizei|polic[ií]a|\bjail\b|prison/, n)) return 'badge';
  if (test(/restaurant|diner|grill|bistro|brasserie|steak ?house|pizzeria|trattoria|caf[eé]\b|cafeteria|tavern|\bpub\b|oyster|deli\b|bakery|cantina|eatery/, n)) return 'fork';
  if (test(/department store|supermarket|grocery|\bmall\b|\bstore\b|\bshop\b|market|bazaar|galleria|emporium|outlet|shopping|boutique|trading post/, n) && category !== 'park') return 'cart';
  if (test(/theat(?:re|er)|playhouse|opera house|concert hall|auditorium|cinema|music hall|philharmon/, n)) return 'theatre';
  if (test(/fountain|fontaine|brunnen/, n)) return 'fountain';
  if (test(/sculpture|installation|cloud gate|public art|mural/, n)) return 'ringart';
  if (test(/\bstatue\b|estatua|statua|standbild/, n)) return 'statue';
  if (test(/\b(?:house|mansion|villa|manor|cottage|homestead|birthplace|residence|home)\b/, n) && !test(/opera house|light ?house|power ?house|custom ?house|guest ?house|town house|boat ?house|wareh|club ?house|play ?house|coffee ?house|green ?house|steak ?house/, n)) return 'house';
  if (test(/tower|plaza|center|centre|building|skyscraper|complex|campus|financial|headquarters|\bplace\b|square|trade|exchange|bank|insurance/, n) && category !== 'park') return mix(n, ['cluster', 'skyscraper', 'cluster']);
  if (test(/monument|memorial|statue|obelisk|column|mus[eé]e en plein|sculpture/, n)) return mix(n, ['monument', 'column', 'flag', 'statue']);

  if (category === 'park') return test(/camp|trail|forest|wilderness|reserve/, n) ? mix(n, ['tent', 'pinetree', 'tree']) : mix(n, ['tree', 'leafytree', 'fountain', 'pinetree', 'leafytree']);
  if (category === 'cantina') return mix(n, ['smallbuilding', 'fork', 'fork']);
  if (category === 'market') return mix(n, ['smallbuilding', 'cart', 'cart']);
  if (category === 'other') return mix(n, ['monument', 'column', 'flag', 'statue', 'ringart', 'skyscraper', 'ruins', 'radiotower']);
  return CATEGORY_ICON[category];
}

/** The icon for an address someone has unlocked, from what it seems to be: an apartment block, a trailer, a factory, a shop and so on (the house is the fallback). */
export function addressIcon(kind: 'house' | 'park' | 'office' | 'church' | 'medical' | 'gov', name: string, address: string): IconId {
  const n = `${name} ${address}`.toLowerCase();
  if (/trailer|mobile home|rv park|manufactured home/.test(n)) return 'trailer';
  if (/factory|plant|mill|industrial|manufactur|refiner|foundry|warehouse|distribution cent|brewery|works/.test(n)) return 'factory';
  if (kind === 'house') return /(?:apt|apartments?|unit|suite|ste|flat)|#s?d/.test(n) || /towers?|condos?|lofts?|residences/.test(n) ? 'apartment' : 'house';
  const picked = pickIcon(kind === 'park' ? 'park' : kind === 'church' ? 'chapel' : kind === 'medical' ? 'medical' : kind === 'gov' ? 'guard' : 'other', name);
  if (kind === 'office') return ['monument', 'column', 'flag', 'statue', 'ringart'].includes(picked) ? 'skyscraper' : picked;
  return picked;
}
