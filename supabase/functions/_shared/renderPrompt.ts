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
  const damage = (entityId && SPECIFIC[entityId]) || generic(name);
  return `Re-render this photograph as a scene from a modern open-world post-apocalyptic video game, in the visual style of Fallout 4 gameplay: the same landmark${name ? ` (${name})` : ''}, from the same angle and framing, still clearly recognizable and in the same place, but two hundred years after a nuclear war, and DESTROYED. The destruction must be dramatic and obvious, not just rust or dirt: ${damage} The rest of the scene is ruined too: fallen debris and heavy rubble, broken and burnt buildings, cracked ground with dead weeds and scrub, abandoned rusted cars, patches of vines. A hazy dusty sky in sickly orange-green with heavy clouds and a low sun, soft volumetric light, warm highlights and teal shadows, slightly desaturated colors, painterly realistic game-engine look, subtle film grain. Remove all modern people, boats, flags, cranes and signs. No text, no logos, no UI.`;
}
