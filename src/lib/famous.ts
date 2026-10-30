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
];

/** The famous place a real name belongs to, if any. */
export const famousByName = (realName: string): Famous | undefined => FAMOUS.find((f) => f.match.test(realName));
