// What the navigation voice actually says. Shorter is better: a road named "California State Route 125" is said "C A 1 25", a street's "Street" and "Avenue" are left off,
// and an abbreviation that is not clearly known is not read out at all (reading "FM" or "CR" aloud as letters helps nobody).

const STATES: Record<string, string> = {
  Alabama: 'AL', Alaska: 'AK', Arizona: 'AZ', Arkansas: 'AR', California: 'CA', Colorado: 'CO', Connecticut: 'CT', Delaware: 'DE', Florida: 'FL', Georgia: 'GA', Hawaii: 'HI', Idaho: 'ID',
  Illinois: 'IL', Indiana: 'IN', Iowa: 'IA', Kansas: 'KS', Kentucky: 'KY', Louisiana: 'LA', Maine: 'ME', Maryland: 'MD', Massachusetts: 'MA', Michigan: 'MI', Minnesota: 'MN',
  Mississippi: 'MS', Missouri: 'MO', Montana: 'MT', Nebraska: 'NE', Nevada: 'NV', 'New Hampshire': 'NH', 'New Jersey': 'NJ', 'New Mexico': 'NM', 'New York': 'NY', 'North Carolina': 'NC',
  'North Dakota': 'ND', Ohio: 'OH', Oklahoma: 'OK', Oregon: 'OR', Pennsylvania: 'PA', 'Rhode Island': 'RI', 'South Carolina': 'SC', 'South Dakota': 'SD', Tennessee: 'TN', Texas: 'TX',
  Utah: 'UT', Vermont: 'VT', Virginia: 'VA', Washington: 'WA', 'West Virginia': 'WV', Wisconsin: 'WI', Wyoming: 'WY',
};
const CODES = new Set(Object.values(STATES));
const letters = (code: string): string => code.split('').join(' ');

/** A route number the short way: 5 and 88 as they are, 125 as "1 25", 101 as "1 oh 1", 405 as "4 oh 5", 200 as "2 hundred". */
export function routeNumber(n: string): string {
  const m = /^(\d{1,3})([A-Za-z]?)$/.exec(n);
  if (!m) return n;
  const d = m[1];
  const tail = m[2] ? ` ${m[2].toUpperCase()}` : '';
  if (d.length < 3) return String(Number(d)) + tail;
  const rest = d.slice(1);
  if (rest === '00') return `${d[0]} hundred${tail}`;
  if (rest[0] === '0') return `${d[0]} oh ${rest[1]}${tail}`;
  return `${d[0]} ${Number(rest)}${tail}`;
}

/** Words that end a street's name and add nothing when it is spoken. */
const SUFFIX = /\b([A-Z][A-Za-z'’.-]+)\s+(?:Street|Avenue|Road|Drive|Lane|Boulevard|Court|Place|Terrace|Circle|St|Ave|Rd|Dr|Ln|Blvd|Ct|Pl|Cir)\b\.?/g;
const DIRECTIONS: Record<string, string> = { N: 'north', S: 'south', E: 'east', W: 'west', NE: 'northeast', NW: 'northwest', SE: 'southeast', SW: 'southwest' };
/** Abbreviations that are clearly known, and left as they are. */
const KNOWN = new Set(['US', 'USA', 'UK']);

export function speakable(text: string): string {
  let s = text.replace(/\bU\.S\.?\s*/g, 'US ');
  const names = Object.keys(STATES).sort((a, b) => b.length - a.length).join('|');
  // "California State Route 125", "Texas Highway 71": the state's letters and the number
  s = s.replace(new RegExp(`\\b(${names})\\s+(?:State\\s+)?(?:Route|Highway|Hwy|Rte|SR|Freeway)\\s*-?\\s*(\\d{1,3}[A-Za-z]?)\\b`, 'g'), (_m, st: string, n: string) => `${letters(STATES[st])} ${routeNumber(n)}`);
  // "CA-125", "CA 125", "SR-125"
  s = s.replace(/\b([A-Z]{2})\s*-\s*(\d{1,3}[A-Za-z]?)\b/g, (m, code: string, n: string) => (CODES.has(code) ? `${letters(code)} ${routeNumber(n)}` : code === 'SR' ? `Route ${routeNumber(n)}` : m));
  s = s.replace(/\bSR\s+(\d{1,3}[A-Za-z]?)\b/g, (_m, n: string) => `Route ${routeNumber(n)}`);
  // "Interstate 5", "I-405"
  s = s.replace(/\b(?:Interstate|I)\s*-?\s*(\d{1,3})\b/g, (_m, n: string) => `I ${routeNumber(n)}`);
  // "US Highway 101", "US-101"
  s = s.replace(/\bUS\s*-?\s*(?:Highway|Route|Hwy|Rte)?\s*-?\s*(\d{1,3}[A-Za-z]?)\b/g, (_m, n: string) => `U S ${routeNumber(n)}`);
  // "State Route 125", "Highway 125", "Route 8"
  s = s.replace(/\b(?:State Route|State Highway|Highway|Hwy|Route|Rte)\s+(\d{1,3}[A-Za-z]?)\b/g, (_m, n: string) => `Route ${routeNumber(n)}`);
  // a street is its name: "Main Street" is "Main"
  s = s.replace(SUFFIX, '$1');
  // a lone N, S, E, W (or NE...) is a direction
  s = s.replace(/\b(NE|NW|SE|SW|N|S|E|W)\b\.?/g, (m, d: string) => DIRECTIONS[d] ?? m);
  // an abbreviation of capital letters that is not clearly known is left out (the letters spaced out above, "C A", are single letters and stay)
  s = s.replace(/\b[A-Z]{2,6}\b/g, (m) => (KNOWN.has(m) ? m : ''));
  return s.replace(/\s{2,}/g, ' ').replace(/\s+([,.])/g, '$1').trim();
}
