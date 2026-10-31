// What the image model is asked to do with a street-level picture of someone's own place (a house, a park, a shop, a church...): the same game look as the
// landmark renders, but the building is an ordinary one, so it is ruined rather than toppled.

const BY_KIND: Record<string, string> = {
  house: 'The house is ruined: the roof has partly fallen in, walls are cracked open and blackened, windows and doors are gone, the porch has collapsed, and fences are down.',
  park: 'The park is a wasteland: trees are dead, split or burnt, paths are cracked and overgrown, benches and playground equipment are rusted and twisted, and any buildings or shelters have collapsed.',
  office: 'The building is gutted: the upper floors have partly collapsed, glass is blown out, the facade is torn open showing bare floors and twisted steel, and the signs are gone.',
  church: 'The roof and one side have caved in, a tower or steeple has broken off and fallen, the walls are full of holes, and the sky shows through the shattered windows.',
  medical: 'The building is a burnt, half-collapsed shell: the windows are blown out, the entrance canopy has fallen, walls are blackened and torn open, and wrecked ambulances and gurneys lie in the rubble.',
  gov: 'Large sections of the walls and any columns, tower or dome have collapsed into rubble, the stonework is blackened and full of holes, and the roof is partly gone.',
};

export function streetPrompt(kind: string, name: string): string {
  const damage = BY_KIND[kind] ?? BY_KIND.office;
  return `Re-render this street-level photograph as a scene from a modern open-world post-apocalyptic video game, in the visual style of Fallout 4 gameplay: the same place${name ? ` (${name})` : ''}, from the same angle and framing, still recognizable and in the same spot, but two hundred years after a nuclear war, and DESTROYED. The destruction must be dramatic and obvious, not just rust or dirt: ${damage} The rest of the scene is ruined too: fallen debris and heavy rubble, broken and burnt buildings, cracked road with dead weeds and scrub, abandoned rusted cars, patches of vines. A hazy dusty sky in sickly orange-green with heavy clouds and a low sun, soft volumetric light, warm highlights and teal shadows, slightly desaturated colors, painterly realistic game-engine look, subtle film grain. Remove all people, faces, license plates, house numbers, signs and text. No text, no logos, no UI.`;
}
