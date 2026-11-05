// The landmarks with a permanent snapshot, as places on the map wherever you are looking: they stay visible when you zoom out past the city whose
// map is loaded (the rest of the world's places only load with their own city).

import { FREE_RENDERS } from './renders';
import { locationFromData, type Location } from './wasteland';
import { VAULT_ZERO } from './vaultZero';

/** Where the first seven stand (the ones added later carry their own coordinates in rendersMore.ts). */
const ORIGINAL_SPOTS: Record<string, [number, number]> = {
  Q243: [48.8584, 2.2945],
  Q9202: [40.6892, -74.0445],
  Q5317: [47.6205, -122.3493],
  Q41225: [51.5007, -0.1246],
  Q45178: [-33.8568, 151.2153],
  Q79961: [-22.9519, -43.2105],
  Q133274: [55.752, 37.6175],
};

export const GLOBAL_LANDMARKS: Location[] = [...Object.entries(FREE_RENDERS).flatMap(([id, r]) => {
  const at = r.lat !== undefined && r.lng !== undefined ? { lat: r.lat, lng: r.lng } : ORIGINAL_SPOTS[id] ? { lat: ORIGINAL_SPOTS[id][0], lng: ORIGINAL_SPOTS[id][1] } : null;
  if (!at || id.startsWith('famous:')) return [];
  const loc = locationFromData(`wd:${id}`, r.real ?? r.name, at, 'other', 999);
  if (r.postName) loc.name = r.postName;
  return [loc];
}), VAULT_ZERO];
