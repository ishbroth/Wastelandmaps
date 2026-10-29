// What the image model is asked to do. The rule for every render: the landmark must be recognizable but plainly, heavily DESTROYED, with a
// key part of it broken off, toppled or caved in. Rusty and overgrown is not enough. Used by the unlock-render function and by _tools/gen-test.mjs,
// so what we test is what customers get.

/** Damage written out for the best-known landmarks, by Wikidata id. */
const SPECIFIC: Record<string, string> = {
  Q243: 'The Eiffel Tower has been broken in two. Only the lower half still stands, its top torn off at about the second platform, ending in jagged twisted girders. The whole upper half of the tower has fallen and lies on the ground as a huge bent, crumpled wreck of lattice iron across the street and the ruined buildings, with its pointed tip on the ground. There is no tall spire standing: the skyline is open where the top used to be.',
  Q9202: 'The Statue of Liberty\'s raised arm and torch have broken off at the shoulder and lie in the rubble at the base of the statue; the crown is cracked and missing spikes, the green-blue copper skin is split open in places showing the rusted frame inside, and a large hole gapes in the robe.',
  Q5317: 'The Space Needle\'s saucer-shaped top has partly collapsed: a large section of the ring has fallen away, the rest hangs tilted and sagging from the shaft, and the whole tower leans. Glass is gone and the structure is torn open.',
  Q41225: 'The clock tower has broken in half. Only the lower shaft still stands, ending in jagged broken stone. The upper section with the clock and the spire has fallen and lies crashed on the ground and across the wrecked Palace of Westminster, resting on rubble (nothing floats in the air). The clock face is shattered and the spire is snapped.',
  Q45178: 'Several of the white sails have caved in and fallen, the others are riddled with large holes showing their bare ribs, part of the base has collapsed, and fires smolder inside.',
  Q79961: 'The statue\'s right arm has broken off at the shoulder and lies on the platform, the head is cracked and scarred, the torso is full of holes and cracks with rusted rebar poking out, and the whole figure leans.',
  Q133274: 'Every tower spire of the Kremlin is badly damaged: several are snapped in half with the tops missing, the rest are riddled with large gaping holes showing their bare brick and framing. Long stretches of the red wall have collapsed into piles of bricks, the golden onion domes are caved in, dented and blackened, and the great palace has a collapsed roof and a missing corner of its front wall.',
};

/** Damage for well-known landmarks, matched by name (so the same text works for the image in any language the place is listed in). */
const NAMED: [RegExp, string][] = [
  [/hollywood sign/i, 'Half of the giant white letters have fallen off the hillside and lie smashed and tumbled down the slope; the letters still standing are bent, leaning and full of holes.'],
  [/golden gate/i, 'The bridge has collapsed in the middle: the main span has fallen into the water, leaving the two red towers standing with cables snapped and trailing, and twisted roadway hanging from each side.'],
  [/superdome/i, 'The huge domed roof has caved in and half of it is gone, with steel ribs hanging down, big sections of the outer wall have collapsed, and the stadium is open to the sky and flooded.'],
  [/coit tower/i, 'The fluted tower has snapped near the top and its crown lies in pieces on the hillside, the concrete is cracked open with rebar showing, and the surrounding trees are dead.'],
  [/rock and roll hall/i, 'The glass pyramid is shattered and partly collapsed, the angled concrete wing has crashed down on one side, and twisted steel and broken glass spill out onto the waterfront.'],
  [/gateway arch/i, 'The arch has broken: one leg still stands and curves up, but the top section has fallen and lies in two broken pieces on the ground, the steel skin buckled and torn open.'],
  [/alamo/i, 'The famous front wall has collapsed, the curved gable is broken and half gone, the stone walls are full of holes and rubble, and the old mission roof has fallen in.'],
  [/independence hall/i, 'The clock tower and steeple have collapsed into the building, the brick walls are cracked open with large holes, the roof has fallen in, and the front is blackened and gutted.'],
  [/washington monument/i, 'The obelisk has snapped in half: the top section lies broken in pieces across the ground and the reflecting pool, and the stump that still stands is cracked and jagged.'],
  [/willis tower/i, 'The upper third of the black tower has collapsed and a huge gash is torn down one side, steel beams hang out, the antennas are bent or gone, and the debris has crushed the buildings below.'],
  [/leveque/i, 'The Art Deco spire has snapped off and lies crushed in the street, the stepped upper floors have collapsed, and the limestone walls are blackened and torn open.'],
  [/peachtree/i, 'The tall cylindrical glass tower has partly collapsed: the glass is blown out in huge sections, the revolving crown at the top has fallen and lies crushed below, one side is torn open showing bare floors and twisted steel, and the base is buried in rubble.'],
  [/epcot|spaceship earth/i, 'The giant geodesic sphere has been torn open, most of its silver panels are gone leaving the bare frame, one side has caved in, and the sphere is tilting and sinking into rubble.'],
  [/empire state/i, 'The top third of the skyscraper, with the spire, has broken off and fallen into the street below; what remains is jagged, blackened and torn open down one side.'],
  [/leaning tower|pisa/i, 'The tower has finally fallen: it lies toppled and broken into several huge sections across the grass and the cathedral square, its stone arcades cracked and scattered.'],
  [/cologne cathedral/i, 'One of the two great spires has snapped off and crashed through the roof of the nave, the other is broken and full of holes, the stained glass is gone, and the stone walls are blackened and collapsed in places.'],
  [/taj mahal/i, 'The central dome has caved in, the four minarets have fallen or are leaning and broken, the marble is cracked and stained, and the reflecting pool is choked with rubble and dead weeds.'],
  [/tokyo tower/i, 'The orange and white lattice tower has buckled and bent over at the middle, its upper half crumpled and lying across the streets below, the antenna broken off.'],
  [/oriental pearl/i, 'The great pink spheres have broken: the top spheres have fallen off and lie smashed in the street, the remaining ones are cracked open, and the legs are bent and leaning.'],
  [/cn tower/i, 'The concrete shaft has snapped partway up: the pod and the antenna have fallen and lie crushed across the buildings below, and the broken stump is jagged and leaning.'],
  [/gran torre/i, 'The glass skyscraper has lost its top third, which lies crushed in the streets, the facade is shattered and hanging in sheets, and the lower floors are blackened and gutted.'],
  [/obelisco/i, 'The white obelisk has snapped in two and the top lies cracked on the ground of the avenue, the stump is jagged, and the wide avenue is wrecked and overgrown.'],
  [/f.?&.?f tower|revolution/i, 'The twisting glass tower has collapsed from the top, the spiral facade is torn open and hanging, the upper floors are gone, and the street below is buried in broken glass and rubble.'],
  [/hillbrow|telkom/i, 'The slender concrete tower has snapped below the pod, the revolving pod and the antenna have fallen and lie crushed in the streets of Hillbrow, and the shaft is cracked and leaning.'],
  [/burj khalifa/i, 'The tallest tower in the world has broken in two: the whole upper half has fallen across the city and lies in huge pieces, the stepped glass facade is shattered, and the remaining stump is jagged and burning.'],
  [/petronas/i, 'One of the twin towers has collapsed halfway, its top lying crushed in the street; the other leans badly, the sky bridge between them has fallen, and both are scarred, blackened and torn open.'],
];

/** Damage chosen from what the place is, for everything else. */
function generic(name: string): string {
  const n = name.toLowerCase();
  if (/\b(tower|tour|turm|torre|needle|spire|minaret|lighthouse|campanile|belfry)\b/.test(n)) return 'The tower is half toppled: its upper part has snapped off and fallen, lying broken in the rubble beside it, and what remains is cracked, leaning and torn open, with exposed girders or bare brick.';
  if (/\b(statue|monument|memorial|obelisk|column|sculpture|christ|buddha)\b/.test(n)) return 'The monument is badly broken: an arm, the top or a large piece has snapped off and lies on the ground, the rest is cracked, scarred and leaning, with chunks missing and rusted rebar showing.';
  if (/\b(cathedral|church|basilica|abbey|mosque|temple|synagogue|chapel|dom\b|duomo|pagoda)\b/.test(n)) return 'The roof and one side have caved in, a tower or spire has broken off and fallen, the walls are full of holes and cracks, and the sky shows through the shattered windows.';
  if (/\b(palace|castle|ch[aâ]teau|fortress|citadel|kremlin|fort|schloss|keep|capitol|parliament|city hall|town hall)\b/.test(n)) return 'Large sections of the walls and towers have collapsed into rubble, the spires and domes are full of holes or broken off, and the roof is partly gone.';
  if (/\b(bridge|pont|br[uü]cke|viaduct|overpass)\b/.test(n)) return 'The bridge has partly collapsed: a section of the span has fallen into the water or ravine, with twisted steel cables and girders hanging down.';
  if (/\b(stadium|arena|coliseum|ballpark|colosseum|dome)\b/.test(n)) return 'Part of the stands and the roof have collapsed inward, steel beams hang down, huge sections of the outer wall are missing, and the field is overgrown.';
  if (/\b(skyscraper|tower block|building|center|centre|plaza|hotel|hall|library|museum|university|college|school|hospital)\b/.test(n)) return 'The upper floors have collapsed, one whole side has been torn open exposing bare floors and twisted steel, windows are gone, and a large part of the structure lies in a rubble heap at its base.';
  return 'Severely damaged: a large part of the structure has collapsed or broken off and lies in the rubble, with big holes torn through the walls and roof and the frame exposed.';
}

export function renderPrompt(name: string, entityId?: string): string {
  const damage = (entityId && SPECIFIC[entityId]) || NAMED.find(([re]) => re.test(name))?.[1] || generic(name);
  return `Re-render this photograph as a scene from a modern open-world post-apocalyptic video game, in the visual style of Fallout 4 gameplay: the same landmark${name ? ` (${name})` : ''}, from the same angle and framing, still clearly recognizable and in the same place, but two hundred years after a nuclear war, and DESTROYED. The destruction must be dramatic and obvious, not just rust or dirt: ${damage} The rest of the scene is ruined too: fallen debris and heavy rubble, broken and burnt buildings, cracked ground with dead weeds and scrub, abandoned rusted cars, patches of vines. A hazy dusty sky in sickly orange-green with heavy clouds and a low sun, soft volumetric light, warm highlights and teal shadows, slightly desaturated colors, painterly realistic game-engine look, subtle film grain. Remove all modern people, boats, flags, cranes and signs. No text, no logos, no UI.`;
}
