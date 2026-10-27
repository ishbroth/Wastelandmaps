// Checks on the wasteland generator: same city = same result, zones keep apart, names and categories behave. Run: npx tsx _tools/wasteland.check.ts
import { categorize, distanceMeters, generateWasteland, hashString, toLocation } from '../src/lib/wasteland.ts';

let bad = 0;
const check = (name: string, ok: boolean, detail = '') => { if (!ok) bad++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : '  ' + detail}`); };

const cities: [string, number, number][] = [['Boston', 42.36, -71.06], ['Las Vegas', 36.17, -115.14], ['Charleston', 38.35, -81.63], ['Seattle', 47.61, -122.33], ['Tiny Town', 44.0, -100.0]];
for (const [name, lat, lng] of cities) {
  const a = generateWasteland(name, { lat, lng }, 9000);
  const b = generateWasteland(name, { lat, lng }, 9000);
  check(`${name}: same city gives the identical wasteland`, JSON.stringify(a) === JSON.stringify(b));
  check(`${name}: 1 to 5 zones, named "The ${name} Wasteland", vault 001-999`, a.zones.length >= 1 && a.zones.length <= 5 && a.regionName === `The ${name} Wasteland` && /^\d{3}$/.test(a.vault.number) && Number(a.vault.number) >= 1);
  let apart = true;
  for (let i = 0; i < a.zones.length; i++) for (let j = i + 1; j < a.zones.length; j++) if (distanceMeters(a.zones[i].position, a.zones[j].position) < 9000 * 0.3) apart = false;
  check(`${name}: radiation zones keep their distance`, apart);
  check(`${name}: everything stays within the city`, [a.vault.position, ...a.zones.map((z) => z.position)].every((p) => distanceMeters(p, { lat, lng }) <= 9000 * 0.95));
}
check('different cities get different vaults somewhere', new Set(cities.map(([n, la, lo]) => generateWasteland(n, { lat: la, lng: lo }, 9000).vault.number)).size > 2);

check('hospital is Medical', categorize('hospital', ['hospital', 'health']).id === 'medical');
check('primary type wins over other types', categorize('library', ['point_of_interest', 'school']).id === 'school');
check('a place with unknown types is a Landmark', categorize('florist', ['florist']).id === 'other');
check('no types at all is a Landmark', categorize(null, null).id === 'other');
const loc = toLocation({ id: 'abc', name: 'Boston Common', position: { lat: 1, lng: 2 }, primaryType: 'park', types: ['park'] });
check('a park becomes a Wild with its old name kept', loc.category === 'park' && loc.oldName === 'Boston Common' && loc.name !== 'Boston Common');
check('the same place always gets the same wasteland name', JSON.stringify(loc) === JSON.stringify(toLocation({ id: 'abc', name: 'Boston Common', position: { lat: 1, lng: 2 }, primaryType: 'park', types: ['park'] })));
check('hash is stable', hashString('radmaps') === hashString('radmaps') && hashString('a') !== hashString('b'));
process.exit(bad ? 1 : 0);
