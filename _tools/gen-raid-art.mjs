// Makes the Fallout-style art for the shooting gallery with the image model: a 4-pose sprite sheet per enemy and a first-person view per gun, each on flat
// magenta so process-raid-art.mjs can cut them out.
//   node _tools/gen-raid-art.mjs [name ...]       names: enemy ids (ghoul), boss ids (behemoth) or gun ids (m1911); none = everything missing
//   REDO=1 makes new ones.   Output: _data/raid/<name>.png
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const OUT = path.join(ROOT, '_data', 'raid');
fs.mkdirSync(OUT, { recursive: true });
const env = Object.fromEntries(fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split(/\r?\n/).filter((l) => l.includes('=') && !l.startsWith('#')).map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]));
const KEY = process.env.GEMINI_API_KEY || env.GEMINI_API_KEY;
if (!KEY) { console.log('no GEMINI_API_KEY in .env.local'); process.exit(1); }
const model = process.env.GEMINI_MODEL || 'gemini-3-pro-image';

const STYLE = 'Photorealistic video game render in the visual style of Fallout 4 gameplay: gritty, desaturated post-apocalyptic palette, soft warm light from the upper left, detailed textures, no outline, no cartoon look.';
const SHEET = (what, poses) => `${STYLE} A game sprite sheet of ${what}. Four frames in a 2x2 grid, each frame in its own equal quadrant of a square image, on a perfectly flat solid magenta (#FF00FF) background with no floor, no shadow, no text, no border and no gradient. The same creature, same size and same lighting in every frame, whole body visible with a little empty margin around it in each quadrant. ${poses}`;
const POSES_WALK = 'Top-left: walking straight toward the camera, left foot forward. Top-right: walking straight toward the camera, right foot forward. Bottom-left: attacking, lunging forward at the camera with arms or claws swinging. Bottom-right: dead, collapsed on the ground.';
const POSES_FLY = 'Top-left: hovering and flying toward the camera, wings up. Top-right: hovering and flying toward the camera, wings down. Bottom-left: attacking, diving at the camera with its body arched. Bottom-right: dead, lying on its back with its wings and legs curled.';
const POSES_SHOOT = 'Top-left: advancing toward the camera, left foot forward, weapon held ready. Top-right: advancing toward the camera, right foot forward, weapon held ready. Bottom-left: aiming and firing its weapon at the camera. Bottom-right: dead, collapsed on the ground.';

const ENEMIES = {
  raider: SHEET('a Fallout raider: a wasteland marauder in scrap-metal armor and spiked leather, with a mohawk, face paint and a pipe pistol', POSES_SHOOT),
  ghoul: SHEET('a Fallout feral ghoul: a hairless, rotting, irradiated humanoid with exposed raw flesh, torn rags and glowing-less dead eyes', POSES_WALK),
  radroach: SHEET('a Fallout radroach: a giant mutated cockroach the size of a dog, brown and glossy, with long antennae, seen from the front', POSES_WALK),
  molerat: SHEET('a Fallout mole rat: a large mutated mole with a pale pink snout, tiny eyes, huge front claws and brown fur, the size of a pig', POSES_WALK),
  bloatfly: SHEET('a Fallout bloatfly: a giant mutated fly with a swollen bloated abdomen, translucent wings and a sharp stinger', POSES_FLY),
  radscorpion: SHEET('a Fallout radscorpion: a giant mutated scorpion the size of a car, pale glossy armor, big pincers and a raised stinger tail', POSES_WALK),
  mirelurk: SHEET('a Fallout mirelurk: a hulking mutated crab with a spiked shell, big snapping claws and a gaping mouth, dark green-brown', POSES_WALK),
  supermutant: SHEET('a Fallout super mutant: a huge, muscular, green-grey-skinned brute in scrap armor with a crude bolted-together weapon', POSES_WALK),
  robot: SHEET('a Fallout robot: a rusty pre-war Protectron-style humanoid robot with a boxy head, a glowing visor and clamp hands, dented and scorched', POSES_SHOOT),
  deathclaw: SHEET('a Fallout deathclaw: a huge horned, reptilian, hunched predator with leathery brown-grey skin and enormous curved claws', POSES_WALK),
  gangrenousghoul: SHEET('a Fallout gangrenous ghoul: a bloated, grotesque, rotting ghoul with swollen green-black sores and tattered clothes, much larger and more diseased than a normal ghoul', POSES_WALK),
  glowingbloatfly: SHEET('a Fallout glowing bloatfly: a giant mutated fly with a swollen abdomen that glows radioactive green from inside, translucent wings, huge and menacing', POSES_FLY),
  mirelurkqueen: SHEET('a Fallout mirelurk queen: an enormous mutated crab queen with a massive spiked shell, a crest, huge claws and a gaping acid-spitting mouth', POSES_WALK),
  behemoth: SHEET('a Fallout behemoth: a gigantic super mutant, three times the size of a man, pale grey-blue skin, a scar-covered body and a huge lamppost-sized club', POSES_WALK),
};

const GUN = (what) => `${STYLE} A first-person video game view of the player's hands holding ${what}, seen from behind and slightly above, the barrel pointing away from the camera and up, centered, cropped at the forearms, on a perfectly flat solid magenta (#FF00FF) background with no floor, no shadow, no text and no gradient. Gloved hands, worn and scratched metal, realistic and detailed.`;
const GUNS = {
  m1911: GUN('a Colt M1911 .45 pistol'),
  sw29: GUN('a Smith & Wesson Model 29 .44 Magnum revolver with a long barrel'),
  deagle: GUN('an IMI Desert Eagle .50 pistol, big and angular'),
  sw500: GUN('a Smith & Wesson Model 500 revolver with a very long barrel and a compensator'),
  uzi: GUN('an IMI Uzi submachine gun with the stock folded'),
  mp5: GUN('a Heckler & Koch MP5 submachine gun'),
  ak47: GUN('a Kalashnikov AK-47 assault rifle with a wooden stock and curved magazine'),
  m249: GUN('an FN M249 SAW belt-fed light machine gun with its bipod folded'),
  model70: GUN('a Winchester Model 70 bolt-action hunting rifle with a wooden stock and a scope'),
  rem700: GUN('a Remington 700 sniper rifle with a long barrel and a large scope'),
  svd: GUN('a Dragunov SVD sniper rifle with a skeletal wooden stock and a scope'),
  m82: GUN('a Barrett M82 .50 caliber anti-materiel rifle with a huge muzzle brake, big scope and bipod'),
  flamethrower: GUN('an M2 flamethrower: a long wand with a nozzle and pilot flame, fed by a hose from a backpack'),
  m79: GUN('an M79 grenade launcher with a short wooden stock and a fat single barrel'),
  missile: GUN('an M72 LAW rocket launcher, a long olive-drab tube held on the shoulder'),
  fatman: GUN('a Fallout Fat Man mini-nuke launcher, a bulky catapult-like launcher loaded with a small nuclear warhead'),
};

const PROMPTS = { ...ENEMIES, ...GUNS };
const wanted = process.argv.slice(2);
const names = wanted.length ? wanted : Object.keys(PROMPTS);
for (const name of names) {
  const prompt = PROMPTS[name];
  if (!prompt) { console.log('unknown', name); continue; }
  const file = path.join(OUT, `${name}.png`);
  if (fs.existsSync(file) && !process.env.REDO) { console.log(name, 'done already'); continue; }
  const started = Date.now();
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST', headers: { 'x-goog-api-key': KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseModalities: ['TEXT', 'IMAGE'], imageConfig: { aspectRatio: '1:1' } } }),
  });
  if (!res.ok) { console.log(name, 'FAILED', res.status, (await res.text()).slice(0, 160)); continue; }
  const body = await res.json();
  const part = (body.candidates?.[0]?.content?.parts ?? []).find((p) => p.inlineData?.data || p.inline_data?.data);
  if (!part) { console.log(name, 'no image returned'); continue; }
  fs.writeFileSync(file, Buffer.from(part.inlineData?.data ?? part.inline_data.data, 'base64'));
  console.log(`${name}: made in ${((Date.now() - started) / 1000).toFixed(0)}s`);
}
