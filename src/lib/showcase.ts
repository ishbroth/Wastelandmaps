// The cities that have a landmark with a permanent (free) snapshot: the one-click starting points under the search box. Each is the
// real city a free-snapshot landmark stands in, written so the search finds the right one.

import { FREE_RENDERS } from './renders';

/** Landmark (Wikidata id of the free snapshot) -> the city to search for. */
const CITY_OF: Record<string, string> = {
  Q243: 'Paris, France',
  Q9202: 'New York, NY',
  Q5317: 'Seattle, WA',
  Q41225: 'London, UK',
  Q45178: 'Sydney, Australia',
  Q79961: 'Rio de Janeiro, Brazil',
  Q133274: 'Moscow, Russia',
  Q2636724: 'San Antonio, TX',
  Q12495: 'Dubai, UAE',
  Q134883: 'Toronto, Canada',
  Q1107297: 'San Francisco, CA',
  Q4176: 'Cologne, Germany',
  Q1542408: 'Santiago, Chile',
  Q9188: 'New York, NY',
  Q1052042: 'Orlando, FL',
  Q5853834: 'Panama City, Panama',
  Q2027162: 'St. Louis, MO',
  Q44440: 'San Francisco, CA',
  Q1563940: 'Johannesburg, South Africa',
  Q180376: 'Los Angeles, CA',
  Q390028: 'Philadelphia, PA',
  Q6506496: 'Columbus, OH',
  Q831389: 'Buenos Aires, Argentina',
  Q3177225: 'Atlanta, GA',
  Q223207: 'Shanghai, China',
  Q83063: 'Kuala Lumpur, Malaysia',
  Q39054: 'Pisa, Italy',
  Q179191: 'Cleveland, OH',
  Q756452: 'New Orleans, LA',
  Q9141: 'Agra, India',
  Q183536: 'Tokyo, Japan',
  Q178114: 'Washington, DC',
  Q29294: 'Chicago, IL',
};

/** Every city with a free snapshot landmark, each once. */
export function showcaseCities(): string[] {
  const cities = new Set<string>();
  for (const id of Object.keys(FREE_RENDERS)) if (CITY_OF[id]) cities.add(CITY_OF[id]);
  return [...cities];
}

/** The cities in a fresh random order (a different order each visit). */
export function shuffledShowcase(): string[] {
  const list = showcaseCities();
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}
