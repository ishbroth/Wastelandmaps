// Checks which places get their vault door lying in the ground (no building) and which keep it in a standing wall.   npx esbuild _tools/vdoor.check.ts --bundle --platform=node --format=cjs --outfile=_data/vdoor.cjs && node _data/vdoor.cjs
import { hasNoBuilding, renderPrompt } from '../supabase/functions/_shared/renderPrompt';
let bad = 0;
const check = (name: string, ok: boolean) => { if (!ok) bad++; console.log(ok ? 'ok  ' : 'FAIL', name); };
check('Central Park: ground', hasNoBuilding('Central Park', 'park'));
check('Boston Common: ground', hasNoBuilding('Boston Common', 'park'));
check('Lake Hemet: ground', hasNoBuilding('Lake Hemet'));
check('a park of no name by category: ground', hasNoBuilding('Riverside', 'park'));
check('City Hall: building', !hasNoBuilding('City Hall', 'guard'));
check('Fenway Park (a stadium): building', !hasNoBuilding('Fenway Park', 'arena'));
check('Park Plaza Hotel: building', !hasNoBuilding('Park Plaza Hotel', 'lodging'));
check('Griffith Observatory: building', !hasNoBuilding('Griffith Observatory', 'other'));
const ground = renderPrompt('Boston Common', 'Q1', false, false, 42, 'park');
const wall = renderPrompt('Old Courthouse', 'Q2', false, false, 42, 'guard');
check('the park prompt lays the door flat and forbids standing it up', /FLAT IN THE GROUND/.test(ground) && /NOT standing up/.test(ground) && !/set into a wall that is still standing/.test(ground));
check('a building keeps the wall-or-ground choice', /set into a wall that is still standing/.test(wall));
check('no vault, no door', !/VAULT 0/.test(renderPrompt('Boston Common', 'Q1', false, false, undefined, 'park')));
console.log(bad ? `${bad} FAILED` : 'all good');
