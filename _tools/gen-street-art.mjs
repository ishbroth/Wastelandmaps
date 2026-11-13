// Makes the Fallout-style pieces our own street view is built from, with the image model: ground textures seen from straight above (road, broken ground, sidewalk) and
// eye-level sprites on flat magenta (rubble, dead trees, wrecked cars, poles, and generic ruined buildings, fronts and sides) that process-street-art.mjs cuts out.
//   node _tools/gen-street-art.mjs [name ...]      none = everything missing.    REDO=1 makes new ones.    Output: _data/street/<name>.png
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const OUT = path.join(ROOT, '_data', 'street');
fs.mkdirSync(OUT, { recursive: true });
const env = Object.fromEntries(fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split(/\r?\n/).filter((l) => l.includes('=') && !l.startsWith('#')).map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]));
const KEY = process.env.GEMINI_API_KEY || env.GEMINI_API_KEY;
if (!KEY) { console.log('no GEMINI_API_KEY in .env.local'); process.exit(1); }
const model = process.env.GEMINI_MODEL || 'gemini-3-pro-image';

const STYLE = 'Photorealistic video game asset in the visual style of Fallout 4 gameplay: gritty, desaturated post-apocalyptic palette, dusty, weathered, detailed textures, no outlines, no text, no logos.';
const TEX = (what) => `${STYLE} A seamless tileable ground texture seen from DIRECTLY ABOVE (a perfectly flat top-down orthographic view, no perspective, no horizon, no sky, no shadows from tall objects, flat even overcast lighting), filling the whole square image edge to edge: ${what}. Nothing tall, no vehicles, no people. It must look the same at every edge so copies tile without a visible seam.`;
const SPRITE = (what, view) => `${STYLE} A game sprite of ${what}, seen at eye level from ${view}, the whole object fully inside the picture with space round it, centered, on a perfectly flat solid magenta (#FF00FF) background with no shadow on the background, no ground plane, no other objects. Soft overcast light.`;

const SKY = (what) => `${STYLE} A wide panoramic picture of ONLY the sky, as seen from the ground looking at the horizon: ${what}. Volumetric clouds with real depth and soft light. Absolutely no ground, no buildings, no trees, no power lines, no birds, no sun disc cut by edges: only sky, with the bottom edge fading into a dusty brownish-orange haze where the horizon would be. It must read as a real photographic game sky, not a cartoon.`;
const ASPECT = {};
for (const t of ['overcast', 'sunset', 'fallout']) for (let i = 1; i <= 3; i++) ASPECT[`sky-${t}${i}`] = '16:9';
const VARIANT = ['with a large cloud bank on the left and a clearer patch to the right', 'with long streaky clouds stretched across the whole width', 'with towering clouds in the middle and thinner haze at both sides'];
const PROMPTS = {
  // ground, from above
  asphalt: TEX('a cracked, broken old asphalt road surface, faded and dusty, with a network of cracks, small potholes, patches of weeds and gravel, no lane markings'),
  asphalt2: TEX('a heavily damaged asphalt road surface with large cracks, crumbled edges, scattered gravel and small rubble, patches of dirt showing through, no lane markings'),
  dirt: TEX('dry cracked wasteland earth: dusty brown-grey dirt with small stones, scattered bits of concrete rubble and dead dry weeds'),
  dirt2: TEX('barren wasteland ground covered in grey ash-dust, broken concrete chunks, charred debris, a few dead tufts of grass'),
  dirt3: TEX('scorched earth and dead brown lawn grass mixed with dust, bits of broken brick and burnt wood, in patches'),
  sidewalk: TEX('a cracked, uplifted old concrete sidewalk slab pattern with weeds in the joints, dirt and leaves, stained and dusty'),
  // sprites
  rubble1: SPRITE('a pile of collapsed concrete and brick rubble with twisted rusty rebar sticking out, about two metres tall', 'the front'),
  rubble2: SPRITE('a heap of broken wood beams, plaster and scorched debris from a collapsed house, with a bent metal sheet on top', 'the front'),
  rubble3: SPRITE('a low spread of broken concrete slabs, bricks and scrap metal, wide and low, about one metre tall', 'the front'),
  rubble4: SPRITE('a burnt-out pile of rubble with a toppled chimney section and charred timbers, wide, about two metres tall', 'the front'),
  tree1: SPRITE('a large dead leafless tree with twisted bare grey branches, no leaves', 'the front'),
  tree2: SPRITE('a burnt black tree trunk with a few broken stubs of branches', 'the front'),
  tree3: SPRITE('a dead overgrown shrub and dry tall dead weeds, brown and grey', 'the front'),
  car1: SPRITE('a rusted wrecked pre-war sedan car with no glass, flat tires, scorched paint and a crushed roof', 'the side, in a clean side elevation'),
  car2: SPRITE('a rusted burnt-out pickup truck wreck, doors open, tires gone, on its rims', 'a three-quarter front angle'),
  pole1: SPRITE('a leaning wooden utility pole with snapped dangling wires and a crossbar', 'the front'),
  lamp1: SPRITE('a bent rusted street lamp post with a broken lamp head hanging', 'the side'),
  // skies, three each
  'sky-overcast1': SKY('a heavy overcast post-apocalyptic sky: thick layered storm clouds in grey, sickly yellow and warm orange, soft diffuse light, ' + VARIANT[0]),
  'sky-overcast2': SKY('a heavy overcast post-apocalyptic sky: thick layered storm clouds in grey, sickly yellow and warm orange, soft diffuse light, ' + VARIANT[1]),
  'sky-overcast3': SKY('a heavy overcast post-apocalyptic sky: thick layered storm clouds in grey, sickly yellow and warm orange, soft diffuse light, ' + VARIANT[2]),
  'sky-sunset1': SKY('a low sun glowing through dusty haze and big volumetric clouds, orange, gold and teal, like the Commonwealth sky of Fallout 4, ' + VARIANT[0]),
  'sky-sunset2': SKY('a low sun glowing through dusty haze and big volumetric clouds, orange, gold and teal, like the Commonwealth sky of Fallout 4, ' + VARIANT[1]),
  'sky-sunset3': SKY('a low sun glowing through dusty haze and big volumetric clouds, orange, gold and teal, like the Commonwealth sky of Fallout 4, ' + VARIANT[2]),
  'sky-fallout1': SKY('a sickly green-yellow radioactive sky with roiling toxic clouds and glowing green fallout haze drifting through, ' + VARIANT[0]),
  'sky-fallout2': SKY('a sickly green-yellow radioactive sky with roiling toxic clouds and glowing green fallout haze drifting through, ' + VARIANT[1]),
  'sky-fallout3': SKY('a sickly green-yellow radioactive sky with roiling toxic clouds and glowing green fallout haze drifting through, ' + VARIANT[2]),
  // more ground
  grass: TEX('wild overgrown wasteland grass: patches of dead yellow grass mixed with living green and olive grass, clover, small weeds and a little bare earth, natural and varied colors'),
  grass2: TEX('lush, rampant overgrowth: vivid green and yellow-green weeds, ivy, moss and small wildflowers growing through cracked dirt, brighter and more colorful than dead ground'),
  dirt4: TEX('reddish-orange clay earth with rust-colored patches, pale dust, streaks of dried mud and a few green moss patches, warm and colorful'),
  debris1: TEX('a dense layer of mixed street trash and junk lying on the ground: broken plastic, colorful scraps of cloth, bottles, cans, paper, bits of blue, red, orange and white among grey rubble and dust, like a heap of garbage seen from above'),
  debris2: TEX('a dense bed of broken concrete, brick fragments, gravel, shattered glass and rusty rebar pieces, grey and red-brown with occasional colorful bits'),
  debris3: TEX('a dense bed of burnt wooden planks, splinters, rusted sheet metal scraps, plaster chunks and ash, dark brown, charcoal and rust-orange'),
  // street junk and shrubs
  swingset1: SPRITE('the broken remains of a playground swing set: a bent rusted A-frame, one swing seat hanging by a single chain, the other fallen on the ground, with weeds around the base', 'the front'),
  bench1: SPRITE('a smashed park bench with broken wooden slats and a bent rusted frame, half collapsed', 'a three-quarter front angle'),
  mailbox1: SPRITE('a rusted leaning roadside mailbox on a bent wooden post, door hanging open', 'the front'),
  trashcan1: SPRITE('a dented overturned metal garbage can with trash spilled out of it, and a second smaller can lying beside it', 'the front'),
  carparts1: SPRITE('a heap of scavenged car parts: a car hood, a door, bumpers, a bare engine block and two worn tires, rusted and scattered', 'the front'),
  junk1: SPRITE('a low heap of assorted city street junk: a bent traffic cone, a broken street sign, a bicycle frame, a shopping cart on its side, bags and boxes of trash', 'the front'),
  shopcart1: SPRITE('a rusted abandoned shopping cart tipped on its side, tangled with weeds', 'the side'),
  hydrant1: SPRITE('a rusted fire hydrant, leaning and chipped, with its top cap missing', 'the front'),
  stopsign1: SPRITE('a bent rusted stop sign on a leaning pole, faded and dented', 'the front'),
  fence1: SPRITE('a section of broken chain-link fence, leaning and torn, two posts bent, with weeds growing through', 'straight on from the front'),
  fence2: SPRITE('a section of broken white wooden picket fence, weathered and grey, half the pickets missing and the rest leaning', 'straight on from the front'),
  tires1: SPRITE('a stack and a scatter of old rotten car tires lying on the ground', 'the front'),
  bigpile1: SPRITE('a very wide, low, sprawling mound of mixed debris and trash: colorful bits of plastic, cloth, bottles and paper mixed with grey rubble, broken furniture and a car door sticking out, like a garbage heap, no taller than two metres but spreading very wide', 'a low eye-level front view'),
  bigpile2: SPRITE('a very wide, low, sprawling mound of broken concrete, bricks, charred timber and scrap metal with weeds growing on it, spreading wide and rolling, no taller than two metres', 'a low eye-level front view'),
  bigpile3: SPRITE('a very wide, low, sprawling mound of burnt household junk: a mattress, springs, a refrigerator door, chairs, pots, tires and ash, spreading wide', 'a low eye-level front view'),
  shrub1: SPRITE('a scraggly dry shrub with thin twisted branches, a few patches of living green leaves and dead brown leaves, knee to waist high', 'the front'),
  shrub2: SPRITE('a wild overgrown bush, tangled, part green and part dead and orange, with a few small flowers, waist high', 'the front'),
  shrub3: SPRITE('a spiky desert-like weed shrub, grey-green with yellow tips, scraggly', 'the front'),
  grass1: SPRITE('a clump of tall wild wasteland grass, yellow-green and olive, blades leaning in the wind, with a few seed heads', 'the front'),
  grass2s: SPRITE('a big patch of tall dry grass and weeds in several colors, green, gold and rust, spread wide and fairly low', 'the front'),
  grass3: SPRITE('a patch of scraggly weeds and thistles with purple and yellow wildflowers amid yellowing grass', 'the front'),
  // more trees
  tree5: SPRITE('a tall dead pine tree, bare of needles except a few brown clumps, thin straight trunk with short dead branches', 'the front'),
  tree6: SPRITE('a gnarled old oak with half its limbs snapped off and a few clusters of sickly yellow-green leaves, thick trunk', 'the front'),
  tree7: SPRITE('a tall dead palm tree with drooping brown fronds, a ragged trunk and a few fronds hanging down', 'the front'),
  tree8: SPRITE('a half-fallen leaning dead tree with a split trunk and tangled roots in the air, a few living green shoots growing from it', 'the front'),
  tree9: SPRITE('a scorched, leafless birch-like tree with pale peeling bark and thin twisting branches', 'the front'),
  tree10: SPRITE('a small scrawny young tree with a few bright green leaves growing out of the cracks, spindly and crooked', 'the front'),
  // flatter debris and things strewn about, to fill bare ground between the piles
  flat1: SPRITE('a flat, wide spread of broken concrete slabs, shattered bricks and gravel lying low on the ground, no tall parts, no more than half a metre high, very wide and low', 'a low eye-level front view'),
  flat2: SPRITE('a wide, low scatter of burnt planks, torn insulation, plaster chunks and crumpled sheet metal lying flat on the ground, nothing taller than half a metre', 'a low eye-level front view'),
  flat3: SPRITE('a low flat patch of asphalt chunks, rubble and dead dry weeds, spread wide and flat on the ground, under half a metre high', 'a low eye-level front view'),
  scatter1: SPRITE('a dozen separate small rocks, pebbles and a few random pieces of junk (a bent pipe, a broken brick, a rusty can) lying spaced apart with gaps between them, each one cut out as its own object, no ground underneath, spread out wide, very low', 'a low eye-level front view'),
  scatter2: SPRITE('small stones, bits of glass, rusty cans and a few scraps of wood scattered sparsely across a patch of dusty ground, spread out with gaps between them, very low', 'a low eye-level front view'),
  scatter3: SPRITE('a few dry dead weed tufts with small rocks and broken tile fragments scattered around, sparse and low', 'a low eye-level front view'),
  tree4: SPRITE('a crooked dead tree with a few dry twisted branches and a hollow split trunk, medium height', 'the front'),
  // generic buildings: fronts straight on, sides straight on (flat elevations so they can be turned into boxes)
  housefront1: SPRITE('the front of a ruined single-storey suburban house: a collapsed roof, broken walls with charred siding, empty window holes and a ruined porch, drawn as a flat straight-on front elevation, the whole width of the house', 'straight on, orthographic, no perspective'),
  housefront2: SPRITE('the front of a ruined two-storey suburban house: a partly collapsed upper floor, torn stucco walls, empty windows, a sagging roof, drawn as a flat straight-on front elevation', 'straight on, orthographic, no perspective'),
  housefront3: SPRITE('the front of a ruined low brick ranch house with a missing roof section, burnt window frames and a rubble-strewn front, drawn as a flat straight-on front elevation', 'straight on, orthographic, no perspective'),
  houseside1: SPRITE('the side wall of a ruined suburban house: a mostly windowless weathered siding wall with a couple of broken windows, a sagging roof edge and rubble at its foot, drawn as a flat straight-on side elevation', 'straight on, orthographic, no perspective'),
  houseside2: SPRITE('the side wall of a ruined brick house with scorched brick, one boarded window, collapsed roof edge and debris at its base, drawn as a flat straight-on side elevation', 'straight on, orthographic, no perspective'),
  houseside3: SPRITE('the side wall of a ruined stucco house with large cracks, a broken window and a fallen gutter, drawn as a flat straight-on side elevation', 'straight on, orthographic, no perspective'),
  shopfront1: SPRITE('the front of a ruined small strip-mall shop: smashed storefront windows, a collapsed awning, peeling facade and rubble, drawn as a flat straight-on front elevation', 'straight on, orthographic, no perspective'),
  shopside1: SPRITE('the side wall of a ruined concrete block commercial building: stained blank wall with a hole blown in it and rubble at the base, drawn as a flat straight-on side elevation', 'straight on, orthographic, no perspective'),
};

const wanted = process.argv.slice(2);
const names = wanted.length ? wanted : Object.keys(PROMPTS);
for (const name of names) {
  const prompt = PROMPTS[name];
  if (!prompt) { console.log('unknown', name); continue; }
  const file = path.join(OUT, `${name}.png`);
  if (fs.existsSync(file) && !process.env.REDO) { console.log(name, 'done already'); continue; }
  const started = Date.now();
  let ok = false;
  for (let attempt = 0; attempt < 3 && !ok; attempt++) {
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST', headers: { 'x-goog-api-key': KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseModalities: ['TEXT', 'IMAGE'], imageConfig: { aspectRatio: ASPECT[name] ?? '1:1' } } }),
      });
      if (!res.ok) { console.log(name, 'FAILED', res.status, (await res.text()).slice(0, 120)); await new Promise((r) => setTimeout(r, 4000)); continue; }
      const body = await res.json();
      const part = (body.candidates?.[0]?.content?.parts ?? []).find((p) => p.inlineData?.data || p.inline_data?.data);
      if (!part) { console.log(name, 'no image returned'); continue; }
      fs.writeFileSync(file, Buffer.from(part.inlineData?.data ?? part.inline_data.data, 'base64'));
      console.log(`${name}: made in ${((Date.now() - started) / 1000).toFixed(0)}s`);
      ok = true;
    } catch (e) { console.log(name, 'error', String(e).slice(0, 100)); }
  }
}
