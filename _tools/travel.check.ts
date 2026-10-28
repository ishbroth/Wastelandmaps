// Checks on the travel math. Run: npx tsx _tools/travel.check.ts
import { encounterFor, formatClock, formatDuration, radsAlongRoute, travelMinutes, START_MINUTES } from '../src/lib/travel.ts';
import { describeSpot, distanceMeters, vaultSpot, generateWasteland, type Spot } from '../src/lib/wasteland.ts';

let bad = 0;
const check = (name: string, ok: boolean, detail = '') => { if (!ok) bad++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : '  ' + detail}`); };

const a = { lat: 42.36, lng: -71.06 };
const east = (m: number) => ({ lat: a.lat, lng: a.lng + m / (111_320 * Math.cos((a.lat * Math.PI) / 180)) });

check('5 km takes about an hour', Math.abs(travelMinutes(a, east(5000)) - 60) <= 1, String(travelMinutes(a, east(5000))));
check('even a few steps take at least 5 minutes', travelMinutes(a, east(10)) === 5);
check('farther takes longer', travelMinutes(a, east(8000)) > travelMinutes(a, east(2000)));

const zone = (at: { lat: number; lng: number }, r: number, rads: number) => ({ position: at, radiusMeters: r, rads });
check('no zones, no rads', radsAlongRoute(a, east(3000), []) === 0);
check('a zone far off the path adds nothing', radsAlongRoute(a, east(3000), [zone({ lat: a.lat + 0.05, lng: a.lng }, 300, 300)]) === 0);
const through = radsAlongRoute(a, east(3000), [zone(east(1500), 400, 300)]);
check('walking straight through a zone picks up half its strength', through === 150, String(through));
const edge = radsAlongRoute(a, east(3000), [zone({ lat: a.lat + 0.0035, lng: east(1500).lng }, 400, 300)]);
check('clipping the edge of a zone picks up less than going through the middle', edge > 0 && edge < through, String(edge));
check('a zone behind you adds nothing', radsAlongRoute(east(1000), east(3000), [zone(a, 300, 300)]) === 0);
check('a zone beyond the destination adds nothing', radsAlongRoute(a, east(1000), [zone(east(3000), 300, 300)]) === 0);
const two = radsAlongRoute(a, east(3000), [zone(east(600), 300, 200), zone(east(2000), 300, 200)]);
check('two zones on the path add up', two === 2 * radsAlongRoute(a, east(3000), [zone(east(600), 300, 200)]), String(two));
check('same trip, same radiation both ways', radsAlongRoute(a, east(3000), [zone(east(1500), 400, 300)]) === radsAlongRoute(east(3000), a, [zone(east(1500), 400, 300)]));

check('the clock starts at day 1, 08:00', formatClock(START_MINUTES) === 'DAY 1  08:00', formatClock(START_MINUTES));
check('the clock rolls over to day 2', formatClock(START_MINUTES + 16 * 60 + 45) === 'DAY 2  00:45', formatClock(START_MINUTES + 16 * 60 + 45));
check('durations read naturally', formatDuration(25) === '25 MIN' && formatDuration(60) === '1 HR' && formatDuration(95) === '1 HR 35 MIN');
check('the same trip always gives the same flavor line', encounterFor('a', 'b') === encounterFor('a', 'b'));

const w = generateWasteland('Boston', a, 9000);
const v = vaultSpot(w);
check('the vault is a place you can travel to, with its number', v.id === 'vault' && v.name === `VAULT ${w.vault.number}` && v.kind === 'vault' && distanceMeters(v.position, w.vault.position) === 0);
const j = describeSpot(v, w.regionName);
check('the vault has a journal entry', j.length === 3 && j[0].includes(v.name));
const spot: Spot = { id: 'x1', name: 'Rusted Pump Station', oldName: 'Shell', kind: 'fuel', position: a, threat: 'Raiders', loot: 'Fusion cells', rads: 5 };
const sj = describeSpot(spot, w.regionName);
check('a place gets a journal entry that names what it used to be, its threat and its loot', sj[0].includes('Formerly Shell') && sj[2].includes('Raiders') && sj[2].includes('fusion cells'), JSON.stringify(sj));
check('the journal is the same every time', JSON.stringify(sj) === JSON.stringify(describeSpot(spot, w.regionName)));
process.exit(bad ? 1 : 0);
