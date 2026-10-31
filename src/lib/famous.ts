// The world's most famous buildings and monuments (beyond the ones that have a permanent snapshot): they always appear on the map of the metro they
// stand in, drawn as themselves, a little larger than the places around them, and worth a lot of points. Each has the coordinates it stands at.

import './famousIcons';
import type { IconId } from './placeIcons';

export interface Famous {
  /** Matches the real name of the place in the pre-built lists, in the languages it is commonly written in. */
  match: RegExp;
  /** The name shown (the real name: famous places keep it). */
  name: string;
  lat: number;
  lng: number;
  icon: IconId;
  /** Also move an existing place of this name to these coordinates (for a named corner or district). */
  move?: boolean;
  /** Only this metro gets it, wherever it is (for a landmark that lies between two metros, or just outside the one it belongs to). */
  metro?: string;
}

export const FAMOUS: Famous[] = [
  { match: /notre[- ]dame de paris|cath[eé]drale notre[- ]dame de paris/i, name: 'Notre-Dame de Paris', lat: 48.853, lng: 2.3499, icon: 'notredame' },
  { match: /tower of london/i, name: 'Tower of London', lat: 51.5081, lng: -0.0759, icon: 'toweroflondon' },
  { match: /tower bridge/i, name: 'Tower Bridge', lat: 51.5055, lng: -0.0754, icon: 'towerbridge' },
  { match: /brooklyn bridge/i, name: 'Brooklyn Bridge', lat: 40.7061, lng: -73.9969, icon: 'brooklynbridge' },
  { match: /pyramids? of giza|great pyramid|pyramid of (?:khufu|cheops)|pir[aá]mides de guiz[ae]/i, name: 'Pyramids of Giza', lat: 29.9792, lng: 31.1342, icon: 'pyramids' },
  { match: /london eye|millennium wheel/i, name: 'London Eye', lat: 51.5033, lng: -0.1196, icon: 'londoneye' },
  { match: /chrysler building/i, name: 'Chrysler Building', lat: 40.7516, lng: -73.9755, icon: 'chrysler' },
  { match: /colosseum|coliseum|colosseo/i, name: 'Colosseum', lat: 41.8902, lng: 12.4922, icon: 'colosseum' },
  { match: /sagrada fam[ií]lia/i, name: 'Sagrada Família', lat: 41.4036, lng: 2.1744, icon: 'sagrada' },
  { match: /mus[eé]e du louvre|louvre museum|louvre pyramid|^louvre$/i, name: 'Louvre Museum', lat: 48.8606, lng: 2.3376, icon: 'louvre' },
  { match: /buckingham palace/i, name: 'Buckingham Palace', lat: 51.5014, lng: -0.1419, icon: 'buckingham' },
  { match: /brandenburg gate|brandenburger tor/i, name: 'Brandenburg Gate', lat: 52.5163, lng: 13.3777, icon: 'brandenburg' },
  { match: /parthenon|acropolis of athens/i, name: 'Parthenon', lat: 37.9715, lng: 23.7267, icon: 'parthenon' },
  { match: /hagia sophia|ayasofya/i, name: 'Hagia Sophia', lat: 41.0086, lng: 28.9802, icon: 'hagiasophia' },
  { match: /saint basil|st\.? basil|pokrovsky|покровский/i, name: "Saint Basil's Cathedral", lat: 55.7525, lng: 37.6231, icon: 'stbasils' },
  { match: /^white house$|the white house/i, name: 'White House', lat: 38.8977, lng: -77.0365, icon: 'whitehouse' },
  { match: /lincoln memorial/i, name: 'Lincoln Memorial', lat: 38.8893, lng: -77.0502, icon: 'lincoln' },
  { match: /sydney harbour bridge/i, name: 'Sydney Harbour Bridge', lat: -33.8519, lng: 151.2108, icon: 'sydneybridge' },
  { match: /hoover dam/i, name: 'Hoover Dam', lat: 36.0161, lng: -114.7377, icon: 'hooverdam' },
  { match: /^times square$/i, name: 'Times Square', lat: 40.758, lng: -73.9855, icon: 'timessquare' },
  { match: /grand central (?:terminal|station)/i, name: 'Grand Central Terminal', lat: 40.7527, lng: -73.9772, icon: 'grandcentral' },
  { match: /rockefeller center|30 rockefeller|30 rock\b/i, name: 'Rockefeller Center', lat: 40.7587, lng: -73.9787, icon: 'rockefeller' },
  { match: /forbidden city|palace museum|gugong|故宫/i, name: 'Forbidden City', lat: 39.9163, lng: 116.3972, icon: 'forbiddencity' },
  { match: /alcatraz/i, name: 'Alcatraz Island', lat: 37.8267, lng: -122.423, icon: 'alcatraz' },
  { match: /st\.? peter'?s basilica|saint peter'?s basilica|basilica di san pietro|basilique saint-pierre/i, name: "St. Peter's Basilica", lat: 41.9022, lng: 12.4539, icon: 'stpeters' },
  { match: /trevi fountain|fontana di trevi/i, name: 'Trevi Fountain', lat: 41.9009, lng: 12.4833, icon: 'trevi' },
  { match: /pantheon, rome|^pantheon$|^il pantheon/i, name: 'Pantheon', lat: 41.8986, lng: 12.4769, icon: 'pantheon' },
  { match: /westminster abbey/i, name: 'Westminster Abbey', lat: 51.4993, lng: -0.1273, icon: 'westminsterabbey' },
  { match: /sacr[eé][- ]c[oœ]eur/i, name: 'Sacré-Cœur', lat: 48.8867, lng: 2.3431, icon: 'sacrecoeur' },
  { match: /^atomium$/i, name: 'Atomium', lat: 50.8949, lng: 4.3415, icon: 'atomium' },
  { match: /charles bridge|karl[uů]v most/i, name: 'Charles Bridge', lat: 50.0865, lng: 14.4114, icon: 'charlesbridge' },
  { match: /milan cathedral|duomo di milano/i, name: 'Milan Cathedral', lat: 45.4642, lng: 9.1916, icon: 'duomomilan' },
  { match: /rialto bridge|ponte di rialto/i, name: 'Rialto Bridge', lat: 45.438, lng: 12.3359, icon: 'rialto' },
  { match: /united states capitol|^us capitol|u\.s\. capitol/i, name: 'United States Capitol', lat: 38.8899, lng: -77.0091, icon: 'capitol' },
  { match: /freedom tower/i, name: 'Freedom Tower', lat: 25.7783, lng: -80.189, icon: 'miamifreedom' },
  { match: /world of coca[- ]cola/i, name: 'World of Coca-Cola', lat: 33.7627, lng: -84.3927, icon: 'cocacola' },
  { match: /hartsfield|atlanta (?:hartsfield[- ]jackson )?international airport/i, name: 'Hartsfield-Jackson Atlanta International Airport', lat: 33.6367, lng: -84.4281, icon: 'atlairport', metro: 'us-ga-atlanta' },
  { match: /^key tower|key center/i, name: 'Key Tower', lat: 41.4994, lng: -81.6942, icon: 'keytower' },
  { match: /union terminal|cincinnati museum center/i, name: 'Cincinnati Union Terminal', lat: 39.1107, lng: -84.5361, icon: 'unionterminal' },
  { match: /paycor stadium|paul brown stadium|bengals/i, name: 'Paycor Stadium', lat: 39.0954, lng: -84.516, icon: 'bengalsstadium' },
  { match: /ohio stadium|the horseshoe/i, name: 'Ohio Stadium (the Horseshoe)', lat: 40.0017, lng: -83.0197, icon: 'horseshoe' },
  { match: /indianapolis motor speedway/i, name: 'Indianapolis Motor Speedway', lat: 39.795, lng: -86.2347, icon: 'speedway' },
  { match: /soldiers['’]? (?:and|&) sailors/i, name: "Soldiers' and Sailors' Monument", lat: 39.7684, lng: -86.1581, icon: 'soldierssailors' },
  { match: /renaissance center|gm renaissance/i, name: 'Renaissance Center', lat: 42.3293, lng: -83.0398, icon: 'rencen' },
  { match: /guardian building/i, name: 'Guardian Building', lat: 42.3299, lng: -83.0446, icon: 'guardian' },
  { match: /hancock center|875 n(?:orth|\.)? michigan/i, name: 'John Hancock Center (875 North Michigan)', lat: 41.8989, lng: -87.623, icon: 'hancock' },
  { match: /navy pier/i, name: 'Navy Pier', lat: 41.8917, lng: -87.6086, icon: 'navypier' },
  { match: /wisconsin gas (?:building|company)/i, name: 'Wisconsin Gas Building', lat: 43.0388, lng: -87.9032, icon: 'wisgas' },
  { match: /wisconsin state capitol/i, name: 'Wisconsin State Capitol', lat: 43.0747, lng: -89.3842, icon: 'wiscapitol' },
  { match: /liberty memorial|national world war i museum/i, name: 'Liberty Memorial', lat: 39.0807, lng: -94.5859, icon: 'libertymemorial', metro: 'us-mo-kansas-city' },
  { match: /power (?:&|and) light building/i, name: 'Power & Light Building', lat: 39.0985, lng: -94.581, icon: 'powerlight', metro: 'us-mo-kansas-city' },
  { match: /capella tower/i, name: 'Capella Tower', lat: 44.9759, lng: -93.2689, icon: 'capellatower' },
  { match: /cathedral of (?:saint|st\.?) paul/i, name: 'Cathedral of Saint Paul', lat: 44.9461, lng: -93.1089, icon: 'stpaulcathedral', metro: 'us-mn-minneapolis' },
  { match: /iowa state capitol/i, name: 'Iowa State Capitol', lat: 41.5911, lng: -93.6037, icon: 'iowacapitol' },
  { match: /one seagate|seagate (?:tower|building|center)/i, name: 'One SeaGate', lat: 41.6528, lng: -83.5379, icon: 'seagate' },
  { match: /400 west market|aegon center/i, name: '400 West Market (Aegon Center)', lat: 38.2566, lng: -85.7623, icon: 'aegon' },
  { match: /bass pro shops? at the pyramid|memphis pyramid|pyramid arena|^the pyramid$/i, name: 'The Pyramid (Bass Pro Shops)', lat: 35.1594, lng: -90.0525, icon: 'basspro' },
  { match: /at&t building|bellsouth (?:building|tower)|batman building|333 commerce/i, name: 'AT&T Building (the Batman Building)', lat: 36.1664, lng: -86.7803, icon: 'attbatman' },
  { match: /ppg (?:place|building|plaza)/i, name: 'PPG Place', lat: 40.4413, lng: -80.0023, icon: 'ppgplace' },
  { match: /comcast technology center/i, name: 'Comcast Technology Center', lat: 39.955, lng: -75.1713, icon: 'comcastcenter' },
  { match: /one liberty place/i, name: 'One Liberty Place', lat: 39.9521, lng: -75.1681, icon: 'oneliberty' },
  { match: /bromo[- ]seltzer|emerson tower/i, name: 'Emerson Bromo-Seltzer Tower', lat: 39.288, lng: -76.6222, icon: 'bromoseltzer', metro: 'us-md-baltimore' },
  { match: /bank of america building|10 light street/i, name: 'Bank of America Building', lat: 39.2878, lng: -76.6122, icon: 'bofabaltimore', metro: 'us-md-baltimore' },
  { match: /virginia beach convention center/i, name: 'Virginia Beach Convention Center', lat: 36.8497, lng: -75.9741, icon: 'vbconvention', metro: 'us-va-virginia-beach' },
  { match: /colonial williamsburg/i, name: 'Colonial Williamsburg', lat: 37.2707, lng: -76.7007, icon: 'colonialwilliamsburg', metro: 'us-va-virginia-beach' },
  { match: /virginia state capitol/i, name: 'Virginia State Capitol', lat: 37.5384, lng: -77.4333, icon: 'vacapitol' },
  { match: /niagara falls|horseshoe falls|american falls/i, name: 'Niagara Falls', lat: 43.0818, lng: -79.0741, icon: 'niagara', metro: 'us-ny-buffalo' },
  { match: /(?:one|1) independent (?:square|drive)|bank of america tower/i, name: '1 Independent Square', lat: 30.3268, lng: -81.6556, icon: 'indsquare' },
  { match: /100 north tampa|100 n\.? tampa/i, name: '100 North Tampa', lat: 27.9502, lng: -82.4592, icon: 'tampa100', metro: 'us-fl-tampa' },
  { match: /breakwater (?:hotel|south beach)|^breakwater$/i, name: 'The Breakwater', lat: 25.7791, lng: -80.13, icon: 'breakwater' },
  { match: /french quarter|vieux carr[eé]/i, name: 'French Quarter', lat: 29.9583, lng: -90.0656, icon: 'frenchquarter', move: true },
  { match: /bank of america center|tc energy center/i, name: 'TC Energy Center (Bank of America Center)', lat: 29.7586, lng: -95.3667, icon: 'tcenergy' },
  { match: /space center houston|johnson space center/i, name: 'Space Center Houston', lat: 29.5519, lng: -95.0981, icon: 'spacecenter', metro: 'us-tx-houston' },
];

/** The famous place a real name belongs to, if any. */
export const famousByName = (realName: string): Famous | undefined => FAMOUS.find((f) => f.match.test(realName));
