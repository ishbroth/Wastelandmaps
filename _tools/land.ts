// Land and water, from Natural Earth (public domain): is a point on dry land, how far is it from the shore, and is it on a small island?
// Used by the metro tools to keep icons out of the sea (a bay or a harbor has to be somewhere you can actually reach).

import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
type Ring = [number, number][]; // [lng, lat]
interface Poly { rings: Ring[]; box: [number, number, number, number]; areaKm2: number }

function readPolys(file: string): Poly[] {
  const g = JSON.parse(fs.readFileSync(path.join(ROOT, '_data', file), 'utf8')) as { features: { geometry: { type: string; coordinates: unknown } }[] };
  const out: Poly[] = [];
  const add = (rings: Ring[]) => {
    let w = 180, e = -180, s = 90, n = -90;
    for (const [x, y] of rings[0]) { if (x < w) w = x; if (x > e) e = x; if (y < s) s = y; if (y > n) n = y; }
    // the area of the outer ring, flat (good enough to tell an island from a continent)
    let a = 0;
    const r = rings[0];
    const k = Math.cos((((s + n) / 2) * Math.PI) / 180);
    for (let i = 0, j = r.length - 1; i < r.length; j = i++) a += (r[j][0] * k) * r[i][1] - (r[i][0] * k) * r[j][1];
    out.push({ rings, box: [w, s, e, n], areaKm2: Math.abs(a / 2) * 111.32 * 111.32 });
  };
  for (const f of g.features) {
    if (f.geometry.type === 'Polygon') add(f.geometry.coordinates as Ring[]);
    else if (f.geometry.type === 'MultiPolygon') for (const p of f.geometry.coordinates as Ring[][]) add(p);
  }
  return out;
}

function index(polys: Poly[]): Map<string, Poly[]> {
  const grid = new Map<string, Poly[]>();
  for (const p of polys) {
    for (let x = Math.floor(p.box[0]); x <= Math.floor(p.box[2]); x++) {
      for (let y = Math.floor(p.box[1]); y <= Math.floor(p.box[3]); y++) {
        const key = `${x}:${y}`;
        const list = grid.get(key);
        if (list) list.push(p); else grid.set(key, [p]);
      }
    }
  }
  return grid;
}

const inRing = (x: number, y: number, ring: Ring): boolean => {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
};
const inPoly = (x: number, y: number, p: Poly): boolean => inRing(x, y, p.rings[0]) && !p.rings.slice(1).some((h) => inRing(x, y, h));

/** Meters from a point to the nearest edge of a ring (flat approximation, fine at this scale). */
function edgeMeters(x: number, y: number, ring: Ring): number {
  const k = Math.cos((y * Math.PI) / 180);
  let best = Infinity;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const ax = (ring[j][0] - x) * k, ay = ring[j][1] - y, bx = (ring[i][0] - x) * k, by = ring[i][1] - y;
    const dx = bx - ax, dy = by - ay;
    const len = dx * dx + dy * dy;
    const t = len === 0 ? 0 : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len));
    const d = Math.hypot(ax + t * dx, ay + t * dy);
    if (d < best) best = d;
  }
  return best * 111_320;
}

export interface Land {
  /** True if the point is on dry land (not in the sea, not in a lake), or within `toleranceM` of it (piers, harbors' edges, a coordinate a little off the shore). */
  onLand(lat: number, lng: number, toleranceM?: number): boolean;
  /** The land polygon the point is in, as its area in km² (a small number is an island), or null if it is in the water. */
  landAreaKm2(lat: number, lng: number): number | null;
}

export function loadLand(): Land {
  const land = readPolys('ne_10m_land.geojson');
  const shelves = fs.existsSync(path.join(ROOT, '_data', 'ne_10m_antarctic_ice_shelves_polys.geojson')) ? readPolys('ne_10m_antarctic_ice_shelves_polys.geojson') : [];
  const lakes = readPolys('ne_10m_lakes.geojson');
  const landGrid = index([...land, ...shelves]);
  const lakeGrid = index(lakes);
  const around = (grid: Map<string, Poly[]>, lat: number, lng: number) => grid.get(`${Math.floor(lng)}:${Math.floor(lat)}`) ?? [];
  const dry = (lat: number, lng: number): Poly | null => {
    const hit = around(landGrid, lat, lng).find((p) => inPoly(lng, lat, p));
    if (!hit) return null;
    return around(lakeGrid, lat, lng).some((p) => inPoly(lng, lat, p)) ? null : hit;
  };
  return {
    landAreaKm2: (lat, lng) => dry(lat, lng)?.areaKm2 ?? null,
    onLand(lat, lng, toleranceM = 0) {
      if (dry(lat, lng)) return true;
      if (toleranceM <= 0) return false;
      // in a lake (the coarse outlines put some city shores in the lake): on land if the lake's edge is within the tolerance
      const lake = around(lakeGrid, lat, lng).find((p) => inPoly(lng, lat, p));
      if (lake && lake.rings.some((r) => edgeMeters(lng, lat, r) <= toleranceM)) return true;
      // near a shore: the nearest edge of the land (or the lake's own edge, for a place on a lake shore) is within the tolerance
      for (const dx of [-1, 0, 1]) {
        for (const dy of [-1, 0, 1]) {
          for (const p of landGrid.get(`${Math.floor(lng) + dx}:${Math.floor(lat) + dy}`) ?? []) {
            if (lat < p.box[1] - 0.05 || lat > p.box[3] + 0.05 || lng < p.box[0] - 0.05 || lng > p.box[2] + 0.05) continue;
            if (p.rings.some((r) => edgeMeters(lng, lat, r) <= toleranceM)) return true;
          }
        }
      }
      return false;
    },
  };
}
