// Builds the zoomed-out map of the wasteland: simplified outlines of countries and US states (Natural Earth, public domain) with a label point for
// each, so the page can tell which country or state is under the middle of the map without asking Google.
//   node _tools/build-regions.mjs        (needs _data/ne_110m_admin_0_countries.geojson and ne_110m_admin_1_states_provinces.geojson)
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const read = (f) => JSON.parse(fs.readFileSync(path.join(ROOT, '_data', f), 'utf8'));

const round = (n) => Math.round(n * 20) / 20; // 0.05 degrees is plenty at these zooms

/** Polygons of a feature as lists of rings, each ring a flat [lng, lat, lng, lat, ...] list. Only outer rings. */
function rings(geometry) {
  const polys = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
  return polys.map((poly) => poly[0].flatMap(([x, y]) => [round(x), round(y)]));
}

/** The label point: the middle of the largest ring (by area), which sits on the mainland rather than in the sea between islands. */
function labelPoint(allRings) {
  let best = null;
  let bestArea = -1;
  for (const ring of allRings) {
    let area = 0;
    let cx = 0;
    let cy = 0;
    for (let i = 0; i < ring.length - 2; i += 2) {
      const [x1, y1, x2, y2] = [ring[i], ring[i + 1], ring[i + 2], ring[i + 3]];
      const cross = x1 * y2 - x2 * y1;
      area += cross;
      cx += (x1 + x2) * cross;
      cy += (y1 + y2) * cross;
    }
    area /= 2;
    if (Math.abs(area) > bestArea && area !== 0) {
      bestArea = Math.abs(area);
      best = [round(cy / (6 * area)), round(cx / (6 * area))]; // lat, lng
    }
  }
  return best ?? [0, 0];
}

const countries = read('ne_110m_admin_0_countries.geojson').features
  .filter((f) => f.properties.CONTINENT !== 'Antarctica' && f.properties.CONTINENT !== 'Seven seas (open ocean)')
  .map((f) => {
    const p = f.properties;
    const r = rings(f.geometry);
    return { iso: p.ISO_A2 !== '-99' ? p.ISO_A2 : p.ISO_A2_EH, name: p.NAME, continent: p.CONTINENT, label: labelPoint(r), rings: r };
  });

const states = read('ne_110m_admin_1_states_provinces.geojson').features.map((f) => {
  const r = rings(f.geometry);
  return { code: f.properties.postal, name: f.properties.name, label: labelPoint(r), rings: r };
});

const out = path.join(ROOT, 'public', 'data', 'regions.json');
fs.writeFileSync(out, JSON.stringify({ countries, states }));
console.log(`${countries.length} countries, ${states.length} states, ${(fs.statSync(out).size / 1024).toFixed(0)} KB`);
