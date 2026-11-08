// Where the enemies come from in each picture. The permanent landmarks are marked by hand (every survivor fights the same battle there); any
// other place gets the spots the image model marked when its picture was made (see unlock-render), or the default ground band.

import { DEFAULT_SPAWNS, type Spawns } from './engine';
import { EXTRA_ICONS } from '../placeIcons';
import { VAULT_ZERO_ID } from '../../../supabase/functions/_shared/vaultZero';

/** By Wikidata id: the horizon line and the spots on the ground, in the picture's coordinates (0-1, left to right and top to bottom). */
export const LANDMARK_SPAWNS: Record<string, Spawns> = {
  Q1052042: { horizon: 0.82, points: [{ u: 0.2, v: 0.88 }, { u: 0.45, v: 0.92 }, { u: 0.7, v: 0.9 }, { u: 0.1, v: 0.93 }, { u: 0.85, v: 0.88 }, { u: 0.55, v: 0.86 }, { u: 0.33, v: 0.84 }] },
  Q1107297: { horizon: 0.72, points: [{ u: 0.35, v: 0.85 }, { u: 0.5, v: 0.9 }, { u: 0.62, v: 0.82 }, { u: 0.2, v: 0.78 }, { u: 0.75, v: 0.88 }, { u: 0.45, v: 0.8 }, { u: 0.25, v: 0.92 }] },
  Q12495: { horizon: 0.7, points: [{ u: 0.4, v: 0.78 }, { u: 0.55, v: 0.88 }, { u: 0.25, v: 0.85 }, { u: 0.75, v: 0.92 }, { u: 0.65, v: 0.78 }, { u: 0.35, v: 0.93 }, { u: 0.5, v: 0.74 }] },
  Q133274: { horizon: 0.72, points: [{ u: 0.5, v: 0.78 }, { u: 0.3, v: 0.84 }, { u: 0.7, v: 0.8 }, { u: 0.15, v: 0.9 }, { u: 0.55, v: 0.9 }, { u: 0.85, v: 0.92 }, { u: 0.4, v: 0.75 }] },
  Q134883: { horizon: 0.7, points: [{ u: 0.35, v: 0.74 }, { u: 0.5, v: 0.82 }, { u: 0.65, v: 0.78 }, { u: 0.25, v: 0.88 }, { u: 0.7, v: 0.9 }, { u: 0.45, v: 0.94 }, { u: 0.55, v: 0.72 }] },
  Q1542408: { horizon: 0.72, points: [{ u: 0.45, v: 0.76 }, { u: 0.6, v: 0.8 }, { u: 0.3, v: 0.84 }, { u: 0.55, v: 0.9 }, { u: 0.2, v: 0.92 }, { u: 0.78, v: 0.86 }, { u: 0.4, v: 0.95 }] },
  Q1563940: { horizon: 0.74, points: [{ u: 0.35, v: 0.8 }, { u: 0.5, v: 0.86 }, { u: 0.65, v: 0.82 }, { u: 0.25, v: 0.92 }, { u: 0.45, v: 0.92 }, { u: 0.78, v: 0.9 }, { u: 0.55, v: 0.77 }] },
  Q178114: { horizon: 0.6, points: [{ u: 0.45, v: 0.7 }, { u: 0.55, v: 0.78 }, { u: 0.35, v: 0.76 }, { u: 0.5, v: 0.86 }, { u: 0.65, v: 0.68 }, { u: 0.3, v: 0.92 }, { u: 0.7, v: 0.84 }] },
  Q179191: { horizon: 0.72, points: [{ u: 0.3, v: 0.78 }, { u: 0.5, v: 0.82 }, { u: 0.7, v: 0.76 }, { u: 0.2, v: 0.88 }, { u: 0.45, v: 0.92 }, { u: 0.65, v: 0.9 }, { u: 0.85, v: 0.9 }] },
  Q180376: { horizon: 0.66, points: [{ u: 0.35, v: 0.76 }, { u: 0.55, v: 0.8 }, { u: 0.25, v: 0.86 }, { u: 0.7, v: 0.84 }, { u: 0.45, v: 0.92 }, { u: 0.8, v: 0.94 }, { u: 0.15, v: 0.94 }] },
  Q183536: { horizon: 0.62, points: [{ u: 0.4, v: 0.72 }, { u: 0.55, v: 0.76 }, { u: 0.3, v: 0.84 }, { u: 0.65, v: 0.82 }, { u: 0.5, v: 0.9 }, { u: 0.2, v: 0.78 }, { u: 0.8, v: 0.9 }] },
  Q2027162: { horizon: 0.7, points: [{ u: 0.4, v: 0.78 }, { u: 0.6, v: 0.82 }, { u: 0.5, v: 0.88 }, { u: 0.3, v: 0.9 }, { u: 0.7, v: 0.92 }, { u: 0.2, v: 0.82 }, { u: 0.45, v: 0.74 }] },
  Q223207: { horizon: 0.72, points: [{ u: 0.3, v: 0.82 }, { u: 0.5, v: 0.86 }, { u: 0.65, v: 0.8 }, { u: 0.2, v: 0.9 }, { u: 0.8, v: 0.8 }, { u: 0.45, v: 0.92 }, { u: 0.6, v: 0.9 }] },
  Q243: { horizon: 0.66, points: [{ u: 0.4, v: 0.76 }, { u: 0.5, v: 0.84 }, { u: 0.6, v: 0.9 }, { u: 0.3, v: 0.92 }, { u: 0.45, v: 0.7 }, { u: 0.7, v: 0.82 }, { u: 0.55, v: 0.74 }] },
  Q2636724: { horizon: 0.74, points: [{ u: 0.5, v: 0.8 }, { u: 0.35, v: 0.86 }, { u: 0.65, v: 0.84 }, { u: 0.5, v: 0.92 }, { u: 0.25, v: 0.94 }, { u: 0.75, v: 0.94 }, { u: 0.4, v: 0.78 }] },
  Q29294: { horizon: 0.84, points: [{ u: 0.45, v: 0.88 }, { u: 0.6, v: 0.9 }, { u: 0.75, v: 0.92 }, { u: 0.35, v: 0.9 }, { u: 0.55, v: 0.95 }, { u: 0.85, v: 0.95 }, { u: 0.25, v: 0.95 }] },
  Q3177225: { horizon: 0.85, points: [{ u: 0.4, v: 0.88 }, { u: 0.55, v: 0.9 }, { u: 0.3, v: 0.93 }, { u: 0.7, v: 0.9 }, { u: 0.5, v: 0.95 }, { u: 0.2, v: 0.92 }, { u: 0.85, v: 0.93 }] },
  Q390028: { horizon: 0.82, points: [{ u: 0.3, v: 0.86 }, { u: 0.5, v: 0.9 }, { u: 0.62, v: 0.86 }, { u: 0.2, v: 0.94 }, { u: 0.45, v: 0.95 }, { u: 0.8, v: 0.88 }, { u: 0.85, v: 0.95 }] },
  Q39054: { horizon: 0.6, points: [{ u: 0.45, v: 0.66 }, { u: 0.3, v: 0.74 }, { u: 0.6, v: 0.72 }, { u: 0.5, v: 0.82 }, { u: 0.25, v: 0.9 }, { u: 0.7, v: 0.86 }, { u: 0.45, v: 0.94 }] },
  Q41225: { horizon: 0.72, points: [{ u: 0.4, v: 0.78 }, { u: 0.55, v: 0.82 }, { u: 0.3, v: 0.86 }, { u: 0.65, v: 0.9 }, { u: 0.5, v: 0.92 }, { u: 0.2, v: 0.92 }, { u: 0.8, v: 0.82 }] },
  Q4176: { horizon: 0.74, points: [{ u: 0.3, v: 0.78 }, { u: 0.5, v: 0.8 }, { u: 0.65, v: 0.82 }, { u: 0.4, v: 0.88 }, { u: 0.55, v: 0.92 }, { u: 0.2, v: 0.88 }, { u: 0.8, v: 0.9 }] },
  Q44440: { horizon: 0.66, points: [{ u: 0.45, v: 0.76 }, { u: 0.6, v: 0.8 }, { u: 0.3, v: 0.82 }, { u: 0.5, v: 0.88 }, { u: 0.7, v: 0.86 }, { u: 0.25, v: 0.9 }, { u: 0.4, v: 0.94 }] },
  Q45178: { horizon: 0.72, points: [{ u: 0.35, v: 0.84 }, { u: 0.55, v: 0.88 }, { u: 0.7, v: 0.86 }, { u: 0.2, v: 0.88 }, { u: 0.45, v: 0.94 }, { u: 0.65, v: 0.94 }, { u: 0.85, v: 0.92 }] },
  Q5317: { horizon: 0.78, points: [{ u: 0.4, v: 0.86 }, { u: 0.55, v: 0.9 }, { u: 0.3, v: 0.92 }, { u: 0.65, v: 0.9 }, { u: 0.5, v: 0.96 }, { u: 0.2, v: 0.88 }, { u: 0.8, v: 0.94 }] },
  Q5853834: { horizon: 0.78, points: [{ u: 0.5, v: 0.82 }, { u: 0.35, v: 0.86 }, { u: 0.65, v: 0.84 }, { u: 0.45, v: 0.92 }, { u: 0.25, v: 0.9 }, { u: 0.75, v: 0.92 }, { u: 0.55, v: 0.96 }] },
  Q6506496: { horizon: 0.78, points: [{ u: 0.35, v: 0.86 }, { u: 0.55, v: 0.84 }, { u: 0.7, v: 0.87 }, { u: 0.2, v: 0.9 }, { u: 0.5, v: 0.92 }, { u: 0.8, v: 0.92 }, { u: 0.3, v: 0.8 }] },
  Q756452: { horizon: 0.6, points: [{ u: 0.4, v: 0.7 }, { u: 0.55, v: 0.72 }, { u: 0.25, v: 0.78 }, { u: 0.7, v: 0.8 }, { u: 0.5, v: 0.86 }, { u: 0.15, v: 0.9 }, { u: 0.8, v: 0.9 }] },
  Q79961: { horizon: 0.62, points: [{ u: 0.4, v: 0.7 }, { u: 0.55, v: 0.74 }, { u: 0.3, v: 0.8 }, { u: 0.65, v: 0.8 }, { u: 0.5, v: 0.88 }, { u: 0.2, v: 0.92 }, { u: 0.8, v: 0.9 }] },
  Q83063: { horizon: 0.76, points: [{ u: 0.45, v: 0.84 }, { u: 0.6, v: 0.86 }, { u: 0.3, v: 0.9 }, { u: 0.7, v: 0.9 }, { u: 0.5, v: 0.94 }, { u: 0.2, v: 0.94 }, { u: 0.85, v: 0.94 }] },
  Q831389: { horizon: 0.84, points: [{ u: 0.3, v: 0.88 }, { u: 0.5, v: 0.9 }, { u: 0.65, v: 0.9 }, { u: 0.15, v: 0.92 }, { u: 0.8, v: 0.95 }, { u: 0.45, v: 0.95 }, { u: 0.55, v: 0.86 }] },
  Q9141: { horizon: 0.62, points: [{ u: 0.4, v: 0.72 }, { u: 0.55, v: 0.76 }, { u: 0.3, v: 0.84 }, { u: 0.65, v: 0.82 }, { u: 0.5, v: 0.9 }, { u: 0.15, v: 0.8 }, { u: 0.8, v: 0.9 }] },
  Q9188: { horizon: 0.9, points: [{ u: 0.25, v: 0.93 }, { u: 0.5, v: 0.95 }, { u: 0.7, v: 0.94 }, { u: 0.4, v: 0.97 }, { u: 0.85, v: 0.96 }, { u: 0.15, v: 0.97 }, { u: 0.6, v: 0.98 }] },
  Q9202: { horizon: 0.72, points: [{ u: 0.4, v: 0.84 }, { u: 0.55, v: 0.86 }, { u: 0.25, v: 0.88 }, { u: 0.7, v: 0.9 }, { u: 0.5, v: 0.92 }, { u: 0.35, v: 0.78 }, { u: 0.15, v: 0.94 }] },
};

/** Vault 0's picture: the snowfield in front of the door. */
const VAULT_ZERO_SPAWNS: Spawns = { horizon: 0.62, points: [{ u: 0.2, v: 0.78 }, { u: 0.35, v: 0.85 }, { u: 0.5, v: 0.9 }, { u: 0.15, v: 0.92 }, { u: 0.6, v: 0.82 }, { u: 0.3, v: 0.72 }, { u: 0.72, v: 0.9 }, { u: 0.45, v: 0.76 }] };

export const spawnsFor = (placeId: string, fromRender?: Spawns | null): Spawns => (placeId === VAULT_ZERO_ID ? VAULT_ZERO_SPAWNS : placeId.startsWith('wd:') && LANDMARK_SPAWNS[placeId.slice(3)]) || fromRender || DEFAULT_SPAWNS;

// ---- how close the picture looks ----

/** Icons of things photographed from far off (a landmark, a tower, a stadium): the enemies start small, as if far away. */
const FAR_ICONS = new Set(['skyscraper', 'tower', 'castle', 'capitol', 'stadium', 'bridge', 'monument', 'column', 'statue', 'arch', 'eiffel', 'liberty', 'spaceneedle', 'opera', 'redeemer', 'kremlin', 'clocktower', 'cathedral', 'mosque', 'temple', 'museum', 'cluster', 'lighthouse', 'radiotower', 'observatory', 'ship', 'plane', 'anchor']);
/** Icons of small things photographed from close by (a house, a shop, a restaurant): the enemies start bigger, since they are nearer the camera. */
const NEAR_ICONS = new Set(['house', 'houses', 'apartment', 'trailer', 'smallbuilding', 'fork', 'cart', 'basket', 'bag', 'mug', 'pump', 'wrench', 'car', 'tent', 'tractor', 'bed', 'key', 'pill', 'ambulance', 'ruins']);

/** How big enemies look at the start of a fight in this place's picture (1 is the usual). */
export function sceneScale(spot: { id: string; icon: string; personal?: { kind?: string; home?: boolean } }): number {
  if (spot.personal) {
    // an address typed in: a house is shot from the street, close; a park or an office block from farther back
    if (spot.personal.home || spot.personal.kind === 'house') return 2.5;
    if (spot.personal.kind === 'park') return 1.2;
    return 1.8;
  }
  if (spot.id.startsWith('wd:') && LANDMARK_SPAWNS[spot.id.slice(3)]) return 0.65; // the permanent landmarks: seen from afar
  if (FAR_ICONS.has(spot.icon) || spot.icon in EXTRA_ICONS || spot.icon.startsWith('local:')) return 0.65; // (a famous landmark has an icon drawn as itself)
  if (NEAR_ICONS.has(spot.icon)) return 2.1;
  return 1.2;
}

/** Where the enemies come from in a place's picture, and how big they start. */
export const spawnsForSpot = (spot: { id: string; icon: string; personal?: { kind?: string; home?: boolean } }, fromRender?: Spawns | null): Spawns => ({ ...spawnsFor(spot.id, fromRender), scale: sceneScale(spot) });
