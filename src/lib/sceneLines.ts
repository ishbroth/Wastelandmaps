// Short, strange little write-ups for the SCENE tab, one pool for each kind of building the map's icons stand for (a hospital, a church, a school, a diner, a
// bridge...). A place picks from the pool of its own icon, by its id, so it is always the same for that place; a personal address picks by the icon of its kind.
// The older, plainer lines (wasteland.ts OPENERS, personal.ts FLAVOR) stay in the mix, but the new ones count double, so a street full of houses or a block of
// offices is far less likely to repeat itself.

const HOSPITAL = [
  'The waiting room is still waiting. Number 41 is on the ticket machine, and somebody is holding number 42.',
  'A hand-lettered sign over the triage desk reads PLEASE TAKE A NUMBER. The skeleton in the front chair appears to have taken several.',
  "The chart at the foot of the nearest bed says 'discharged'. In the margin someone has added 'against advice, via window'.",
  "Every cabinet is empty but one, which holds forty-one tongue depressors and a note: 'stop asking'.",
  'The vending machine in the lobby still has one packet of crackers. A tiny sign on it says RESERVED.',
];
const DENTIST = [
  'The chair still reclines and the drill still hums if you hit it right. Please do not ask how we know.',
  "A framed poster explains flossing to an audience that has since lost its interest in teeth, and then, in a few cases, its teeth.",
];
const PHARMACY = [
  "The shelves are bare, but the bell over the door still rings when it opens, out of habit. Nobody has answered it in two hundred years.",
  "The pharmacist's note on the counter reads: 'Take with food.' There is no food. The advice has aged badly.",
];
const AMBULANCE = [
  'The siren still has opinions. It arrived forty minutes after the bombs and has been parked, politely, ever since.',
  'A gurney sits in the back with the straps still done up. Whatever it was carrying got out on its own.',
];
const CHURCH = [
  'The collection plate is still going around. It has not come back in two hundred years.',
  'Somebody rings the bell exactly once a day. Nobody admits to it. The rope is warm.',
  'A choir rehearses in the cellar every evening. The choir is not from here, and neither is the hymn.',
  'The stained glass lost its saints but kept their halos, which hang in the air at dusk like unclaimed coins.',
];
const CEMETERY = [
  'The graves are in alphabetical order. The residents have been rearranging them to be near the ones they like.',
  'Every headstone has the same flowers, left by the same hand, and the hand is on a schedule.',
];
const HOLY = [
  'It was built to hold ten thousand voices. It holds one now, and the echo has learned to answer back.',
  'The prayer rugs are still lined up. Every one of them has been turned by a few degrees, to face something new.',
];
const SCHOOL = [
  'The honor roll is still on the wall. Last place is somehow the only name that has not faded.',
  "The lunch menu on the door says Tuesday: mystery loaf. It has been Tuesday for two hundred years.",
  "A pop quiz lies on every desk. Every answer is 'duck'. Nobody knows why, and nobody is willing to mark them wrong.",
  "The principal's office is locked from the inside, which has never been explained.",
];
const LIBRARY = [
  'Overdue notices have piled up for two centuries. The fines could buy this county back.',
  'The card catalog is the only thing here in perfect order, and the things it describes are gone.',
  'A sign says SHHH. Someone still obeys it, loudly, from behind the stacks.',
];
const HOUSE = [
  "The welcome mat is still out. It says WELCOME and, underneath, in felt pen: 'NOT YOU'.",
  'Every house on this street has the same lawn ornament: a ceramic duck dressed for a different season.',
  "The fridge door still has its magnets. The note under them reads 'back in five minutes', dated the day of the war.",
  'Someone left the porch light on. It still works. That bothers people more than the rest of it.',
  'The garden gnome has been moved. Twice. Nobody lives here.',
];
const APARTMENT = [
  'Every door on the third floor has a different number and the same scratch marks.',
  'The intercom still buzzes on the hour. Whoever is pressing it has been very patient.',
];
const TRAILER = [
  'The trailer is the only structure on the block that did not move an inch. It is also the only one with a working doorbell.',
  'A hand-painted sign on the door says BEWARE OF DOG. The dog is a very good one, and very old, and very much still on duty.',
];
const OFFICE = [
  "Forty floors of cubicles, and a motivational poster on every one: 'Hang in there.' Several residents did.",
  'The lobby directory lists a Department of Redundancy Department on the ninth floor. It still exists, in duplicate.',
  'The elevator is stuck between floors with its music still playing. Somebody has been dancing in it.',
  'The coffee machine on the top floor is the only thing in the building that works. It will not say who pays.',
  'The corner office was always the best one. It is now the only one with a floor.',
];
const PLAZA = [
  'The plaza fountain is dry, but the pigeons still show up, out of loyalty.',
  'A bronze bull, a bronze bear, and between them a very small bronze accountant, looking nervous.',
];
const STORE = [
  "The sign still says 'Everything must go.' It was right.",
  'The price scanner in aisle five still beeps. It quotes prices from a time that no longer exists, and nobody argues.',
  'Shopping carts stand in the lot like a herd. They have moved since last night. Nobody has seen how.',
  'The sale rack has one item left, a single glove, marked down for the ninth time.',
];
const DINER = [
  "The special of the day is on the chalkboard, and it is still 'soup'. The soup is also still there.",
  'A table is set for two. Both chairs are pulled out. Neither guest is staying.',
  "The jukebox plays one song, always the same, and it is somehow always the one you were about to think of.",
];
const BAR = [
  'Last call was two hundred years ago. The bartender is still stubbornly counting down.',
  'The bar has a tab for every man in the county. It is the only thing in town with a credit rating.',
];
const MALL = [
  'The food court still smells of cinnamon. There is no cinnamon. We have checked.',
  "The escalator is still going up, in the sense that it tries every time you step on.",
];
const STADIUM = [
  'The scoreboard is frozen at 0 to 0, bottom of the ninth, and the home team hopes it stays that way.',
  'The stands are full and nobody is moving. It is a very polite crowd.',
  "A lone vendor's cart stands in the concourse. Do not read the price.",
  "The trophy case is empty but for a small plaque: 'Participation.'",
];
const TRANSIT = [
  'The next train is delayed. The board has said so for two hundred years, with admirable consistency.',
  'The last stop on the line is a stop nobody got off at. The announcer still names it, politely.',
  'A single umbrella hangs on the platform bench. It is dry. It is always dry.',
];
const BUS = [
  'The bus still runs its route, they say. Nobody has seen the driver, only the doors opening at each stop for no one.',
  'A tattered ad on the shelter promises that the future will be here shortly. It was more punctual than the bus.',
];
const AIRPORT = [
  'The runway lights come on at dusk. They are on a timer. The timer does not know how this ends.',
  'Departures: all of them. Arrivals: none. The board is uncharacteristically honest.',
  'The lost luggage office has a very long line of luggage and no one in it.',
];
const SHIP = [
  'The ship\'s bell rings on the hour, though the sea has gone elsewhere.',
  "The harbor master's log ends mid-sentence: 'a very large wave of'.",
  'The lifebuoy on the rail has a name painted on it that is not the name of any ship in this harbor.',
];
const FUEL = [
  "Pump 3 still has a 'Pay Inside' sign. Inside is a long way away.",
  "The mechanic's bay has a car on the lift. It has been 'almost ready' for two hundred years.",
  'The air pump still works. It has been filling a tire that is no longer there with pure, meaningless confidence.',
];
const PARK = [
  "The park bench plaque reads 'In loving memory of Gerald, who loved this bench.' Gerald is still using it.",
  'The swings move on windless days. Only slightly. Go around.',
  'A founder stands in the weeds with a traffic cone on his head. The cone is also history now.',
  "The picnic table has a note carved in it: 'Meet here when it's over.' It is not clear who is meant to arrive.",
];
const FOUNTAIN = [
  'The fountain is full again, with something. We do not recommend asking.',
  'Coins glint in the dry basin. Wishes were made here. The management regrets the outcome.',
];
const CACTUS = [
  'The cactus is the only living thing for miles that does not mind. A visitor gave it a small hat, and it has kept it.',
  'Somebody has been watering the cactus. There is no water. We are worried.',
];
const GOV = [
  'The paperwork is still in progress. A form for the form is on the desk, and the stamp is warm.',
  'The flag was lowered at sunset and never raised again. Nobody has found out who is holding the rope.',
  "The clerk's window has a sign: 'Back at 1.' The clock on the wall agrees, which is not helpful.",
];
const BADGE = [
  "The sheriff's office keeps a very old, very patient dog at the door. The collar says 'Deputy'.",
  'The cells are unlocked. Every one of them has a mug on the bunk. Nobody is quite brave enough to ask whose.',
];
const FIRE = [
  'The fire pole is still polished. The bell rang once on the first day and has been embarrassed ever since.',
  'A fire truck sits in its bay, running, with nobody at the wheel. It has been on its way to the same fire for two centuries.',
];
const COLUMN = [
  'Four columns stand holding up nothing, and they are very proud of it.',
  'The portico is intact. The building it introduced has gone elsewhere.',
];
const MUSEUM = [
  "The exhibit labels have outlasted the exhibits. 'Do not touch' has never been more reasonable.",
  'The dinosaur in the lobby lost a rib and gained a hat. The staff are divided.',
  'The gift shop is in perfect condition. This is the most disturbing thing in the building.',
];
const STATUE = [
  "The plaque has worn off, so everyone picks their own hero. At the moment it is Gerald.",
  'The statue has been pointing at something for two hundred years. Everyone has looked. It is not that.',
];
const MONUMENT = [
  'They built it so we would never forget, and then, with great discipline, we did.',
  'The inscription is mostly gone. What is left says: IN HONOR OF, and then a gap the size of a person.',
];
const ART = [
  "The sculpture is a ring of steel the artist called 'Continuity'. It has been hit by many things and has stayed round out of spite.",
  'The mural has weathered into something better than what was painted, and a great deal stranger.',
];
const RUINS = [
  'It was ancient before the war. The war only added the part with the scorch marks.',
  'The stones have been stacked and unstacked so many times that they have started to look like they are enjoying it.',
];
const CASTLE = [
  "The drawbridge is up and the sign says 'out for lunch'. The lunch was in the thirteenth century.",
  'The cannon points at the old town. It has been aimed at the same bakery for three hundred years, which is the bakery\'s problem.',
];
const FACTORY = [
  'The shift whistle still blows at five. Nobody comes out. The whistle is a patient creature.',
  'The assembly line still holds half of a thing. We do not know which half.',
  'A sign counts the days since the last accident. It reads zero, and it has read zero for a very long time.',
];
const LAB = [
  "The whiteboard says DO NOT MIX and then, in a different hand, 'too late'.",
  'A sticky note on the fume hood reads: if you can smell this, we owe you an apology.',
];
const FARM = [
  'The tractor sits in the middle of a field as if the farmer had just stepped away. The field has been waiting ever since.',
  'The scarecrow has been given a very stern hat. Whatever it is guarding has stopped being scared.',
];
const HAZMAT = [
  'The warning signs have faded, but the sirens remember. They test themselves at noon.',
  'A rack of gas masks hangs by the door. Each has a name on it. One is missing, and the hook is still warm.',
];
const CLOCK = [
  'The clock stopped at 10:17, and every clock in the district has politely agreed.',
  'The hour bell rings thirteen. Residents have decided that is the right number.',
];
const LIGHTHOUSE = [
  'The lamp sweeps the dry plain every night, warning off ships from a shore that moved.',
  'A very old keeper polishes the lens each evening. If you ask, he says the ships are late.',
];
const RADIO = [
  'A voice is still on the dead frequency, reading the weather for a day that never came.',
  'The antenna hums a tune. It is almost familiar.',
];
const OBSERVATORY = [
  'The telescope points at one patch of sky. Whatever it found there, it has not been willing to say.',
  'A star chart on the wall has one new star circled in red, and a single word: finally.',
];
const WINDMILL = [
  'The windmill turns on, grinding nothing into flour with great dignity.',
  'The sails creak a very slow word. Someone has been reading them for a hundred years.',
];
const HOTEL = [
  "The front desk bell is on the counter beside a sign that says 'Ring for service'. Nobody does, and the bell knows.",
  'Every door has a Do Not Disturb sign, and every door has been respected, in the sense that nobody has gone in.',
  'Room 237 is in the lobby. Do not ask the staff how.',
  'The pool is empty, but the lifeguard chair is still manned, in a manner of speaking.',
];
const THEATRE = [
  'The curtain is half drawn on a play with a very long intermission.',
  "The marquee spells out the final show: 'A WELL-EARNED ENCORE'. The audience was unavailable for comment.",
];
const SCENIC = [
  "The overlook has a coin-operated telescope. It still takes coins, and it still shows the view as it used to be.",
  "The photo spot sign says 'Best view in town.' It is accurate. The competition is rubble.",
];
const FISH = [
  'The fishing hole has one very old fish who has seen all of it and regrets nothing.',
  'A rod leans on the dock with a line in the water. The bait is gone. The fish are waiting, as a courtesy.',
];
/** For anything else (and as a spare for everything): places with no clear purpose, told as what they feel like. */
const OTHER = [
  'No sign, no door, no clue. It has the look of a place that mattered a great deal to exactly one person.',
  'It was a thing, once, with a purpose. The purpose has gone out for a walk and left no note.',
  'Whatever happened here was important, and a little embarrassing, and nobody has ever written it down.',
  'The bricks are warm in a way the weather cannot explain. Somebody has been leaning on them lately.',
  'A single chair stands in the middle of it, facing a wall that is no longer there.',
  'Nothing here is for sale, and nothing here is for free. Everything is on loan, for reasons unstated.',
  'Every scavenger who passed said it was empty. Every one of them looked back over a shoulder as they left.',
  'The building has the confidence of something that survived on purpose.',
];

const FAMILIES: Record<string, string[]> = {
  hospital: HOSPITAL, dentist: DENTIST, pharmacy: PHARMACY, ambulance: AMBULANCE,
  church: CHURCH, cemetery: CEMETERY, holy: HOLY, school: SCHOOL, library: LIBRARY,
  house: HOUSE, apartment: APARTMENT, trailer: TRAILER, office: OFFICE, plaza: PLAZA,
  store: STORE, diner: DINER, bar: BAR, mall: MALL, stadium: STADIUM,
  transit: TRANSIT, bus: BUS, airport: AIRPORT, ship: SHIP, fuel: FUEL,
  park: PARK, fountain: FOUNTAIN, cactus: CACTUS, gov: GOV, badge: BADGE, fire: FIRE, column: COLUMN,
  museum: MUSEUM, statue: STATUE, monument: MONUMENT, art: ART, ruins: RUINS, castle: CASTLE,
  factory: FACTORY, lab: LAB, farm: FARM, hazmat: HAZMAT, clock: CLOCK, lighthouse: LIGHTHOUSE, radio: RADIO,
  observatory: OBSERVATORY, windmill: WINDMILL, hotel: HOTEL, theatre: THEATRE, scenic: SCENIC, fish: FISH, other: OTHER,
};

/** Which pool each map icon draws from. */
const FAMILY_OF: Record<string, string> = {
  hospital: 'hospital', medkit: 'hospital', caduceus: 'hospital', bandage: 'hospital', heartbeat: 'hospital', crossheart: 'hospital', lifestar: 'hospital', syringe: 'hospital',
  tooth: 'dentist', pill: 'pharmacy', capsules: 'pharmacy', medbottle: 'pharmacy', ambulance: 'ambulance',
  church: 'church', bell: 'church', cross: 'cemetery', mosque: 'holy', cathedral: 'holy', temple: 'holy',
  school: 'school', gradcap: 'school', book: 'library',
  house: 'house', houses: 'house', smallbuilding: 'house', apartment: 'apartment', trailer: 'trailer',
  skyscraper: 'office', officeslab: 'office', twintowers: 'office', artdeco: 'office', glasstower: 'office', curvedtower: 'office', campus: 'office', officepark: 'office', cluster: 'office', tower: 'office', plaza: 'plaza',
  cart: 'store', basket: 'store', bag: 'store', fork: 'diner', mug: 'bar', mall: 'mall',
  stadium: 'stadium', arenaflags: 'stadium', standsflags: 'stadium', bowlflags: 'stadium', pitch: 'stadium', track: 'stadium', ball: 'stadium', trophy: 'stadium',
  subway: 'transit', tram: 'transit', railcross: 'transit', bus: 'bus', plane: 'airport', ship: 'ship', anchor: 'ship', lifebuoy: 'ship',
  car: 'fuel', pump: 'fuel', wrench: 'fuel',
  tree: 'park', leafytree: 'park', pinetree: 'park', palm: 'park', lamp: 'park', tent: 'park', mountain: 'scenic', camera: 'scenic', fountain: 'fountain', cactus: 'cactus',
  capitol: 'gov', shield: 'gov', flag: 'gov', badge: 'badge', firebadge: 'fire', helmet: 'badge', column: 'column', arch: 'column',
  museum: 'museum', statue: 'statue', monument: 'monument', ringart: 'art', star: 'art', ruins: 'ruins', castle: 'castle', cannon: 'castle',
  factory: 'factory', beaker: 'lab', tractor: 'farm', gasmask: 'hazmat', clocktower: 'clock', lighthouse: 'lighthouse', radiotower: 'radio', observatory: 'observatory', windmill: 'windmill',
  bed: 'hotel', key: 'hotel', skeletonkey: 'hotel', theatre: 'theatre', fish: 'fish',
};

/** The new lines for a map icon (empty for the famous ones, which have their own stories). */
export const sceneLinesFor = (icon: string): string[] => FAMILIES[FAMILY_OF[icon] ?? 'other'] ?? OTHER;

/** How many lines there are in all (the new ones). */
export const SCENE_LINE_COUNT = new Set(Object.values(FAMILIES).flat()).size;

const hash = (s: string): number => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0;
  h ^= h >>> 15; h = Math.imul(h, 2246822519) >>> 0; h ^= h >>> 13;
  return h >>> 0;
};

/** One line for a place: from the pool of its icon (counted twice) and the older plain lines, picked by its id so it is always the same. */
export function sceneLine(icon: string, key: string, older: string[]): string {
  const pool = [...sceneLinesFor(icon), ...sceneLinesFor(icon), ...older];
  return pool[hash(`${key}|scene`) % pool.length];
}
