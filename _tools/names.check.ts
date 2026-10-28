import { locationFromData } from '../src/lib/wasteland.ts';
for (const [id, n] of [['wd:Q243', 'Eiffel Tower'], ['wd:Q1', 'Arc de Triomphe'], ['wd:Q2', 'avenue des Champs-Élysées'], ['wd:Q3', 'Notre-Dame de Paris']]) console.log(n, '=>', locationFromData(id, n, { lat: 0, lng: 0 }, n.includes('Notre') ? 'chapel' : 'other').name);
