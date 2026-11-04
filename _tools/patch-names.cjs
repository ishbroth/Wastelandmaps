const fs = require('fs');
const p = 'src/lib/lore.ts';
const raw = fs.readFileSync(p, 'utf8'); const crlf = raw.includes('\r\n'); let s = raw.replace(/\r\n/g, '\n');
const a = s.indexOf('const PLAIN_TEMPLATES = [');
const b = s.indexOf('/** Puns that follow from the way a name is built.');
if (a < 0 || b < 0) throw new Error('bounds');
const block = `const PLAIN_TEMPLATES = [
  (c: string) => \`\${c} Ruins\`,
  (c: string) => \`Metro \${c} Ruins\`,
  (c: string) => \`Greater \${c} Ruins\`,
  (c: string) => \`Old \${c}\`,
  (c: string) => \`Old \${c} Abandonment\`,
  (c: string) => \`\${c} Remnants\`,
  (c: string) => \`The \${c} Colony\`,
  (c: string) => \`\${c} Warlands\`,
  (c: string) => \`\${c} Blast Area\`,
  (c: string) => \`\${c} Embattlement\`,
  (c: string) => \`\${c} Disputed Territories\`,
  (c: string) => \`The Condemned \${c}\`,
  (c: string) => \`Abandoned \${c}\`,
  (c: string) => \`\${c} Fields\`,
  (c: string) => \`\${c} Ash Fields\`,
  (c: string) => \`\${c} Badlands\`,
  (c: string) => \`The \${c} Wasteland\`,
  (c: string) => \`\${c} Dead Zone\`,
  (c: string) => \`\${c} Lost Settlement\`,
  (c: string) => \`\${c} Frontier\`,
  (c: string) => \`The \${c} Reclamation Zone\`,
  (c: string) => \`\${c} Scrap Belt\`,
  (c: string) => \`The Fallen \${c}\`,
  (c: string) => \`\${c} Outskirts Ruins\`,
  (c: string) => \`\${c} Hollows\`,
  (c: string) => \`The \${c} Fallout Zone\`,
  (c: string) => \`\${c} Wreckage\`,
  (c: string) => \`The Shattered \${c}\`,
  (c: string) => \`Shattered \${c}\`,
  (c: string) => \`Blasted \${c}\`,
  (c: string) => \`\${c} Debris Field\`,
  (c: string) => \`\${c} Relic\`,
  (c: string) => \`Relic of \${c}\`,
  (c: string) => \`Melted \${c}\`,
  (c: string) => \`The Melted \${c}\`,
  (c: string) => \`\${c} Wreck\`,
  (c: string) => \`The Wreck of \${c}\`,
  (c: string) => \`\${c} Depot\`,
  (c: string) => \`\${c} Graveyard\`,
  (c: string) => \`The \${c} Graveyard\`,
  (c: string) => \`\${c} Sanctuary\`,
  (c: string) => \`\${c} Refuge\`,
  (c: string) => \`The \${c} Refuge\`,
  (c: string) => \`\${c} Stronghold\`,
  (c: string) => \`\${c} Relocation Zone\`,
  (c: string) => \`\${c} Occupied Zone\`,
  (c: string) => \`\${c} Military Zone\`,
  (c: string) => \`\${c} Camp\`,
  (c: string) => \`\${c} Internment Camp\`,
  (c: string) => \`\${c} Asylum\`,
  (c: string) => \`\${c} Trenches\`,
  (c: string) => \`\${c} Minefields\`,
];

/** Punchier shapes, for smaller cities only. */
const PUNCHY_TEMPLATES = [
  (c: string) => \`\${c} Ground Zero\`,
  (c: string) => \`\${c} Crater\`,
  (c: string) => \`\${c} Cinders\`,
  (c: string) => \`\${c}'s Last Stand\`,
  (c: string) => \`The \${c} Glowlands\`,
  (c: string) => \`\${c} Rad-Lands\`,
  (c: string) => \`Nuclear \${c}\`,
  (c: string) => \`The Burnt \${c}\`,
  (c: string) => \`\${c} After Dark\`,
  (c: string) => \`\${c} Heap\`,
  (c: string) => \`The \${c} Heap\`,
  (c: string) => \`\${c} Scrapyard\`,
  (c: string) => \`The \${c} Scrapyard\`,
  (c: string) => \`\${c} Rust Pit\`,
  (c: string) => \`The \${c} Pit\`,
  (c: string) => \`\${c} Hole\`,
  (c: string) => \`\${c} Refuse\`,
  (c: string) => \`\${c} Debris\`,
  (c: string) => \`\${c} Slag Heap\`,
  (c: string) => \`Blasted \${c} Pit\`,
];

/** Where an oasis makes sense: dry country and desert states. */
const ARID_COUNTRIES = new Set(['SA', 'AE', 'QA', 'KW', 'BH', 'OM', 'YE', 'JO', 'IQ', 'IR', 'EG', 'LY', 'DZ', 'TN', 'MA', 'ML', 'NE', 'TD', 'SD', 'MR', 'NA', 'BW', 'AF', 'PK', 'UZ', 'TM', 'IL']);
const ARID_STATES = new Set(['nv', 'az', 'nm', 'ut']);
const OASIS_TEMPLATES = [
  (c: string) => \`\${c} Oasis\`,
  (c: string) => \`The \${c} Oasis\`,
];

`;
s = s.slice(0, a) + block + s.slice(b);
// pick: dry places can also get an oasis
const old = "  const useful = !big && (h >>> 3) % 4 === 0 ? PUNCHY_TEMPLATES : PLAIN_TEMPLATES;\n  return { name: useful[(h >>> 5) % useful.length](name), canon: false };";
if (!s.includes(old)) throw new Error('pick');
s = s.replace(old, () => "  const arid = ARID_COUNTRIES.has(cc) || (cc === 'US' && ARID_STATES.has(st));\n  const base = !big && (h >>> 3) % 4 === 0 ? PUNCHY_TEMPLATES : PLAIN_TEMPLATES;\n  // about one dry place in four is an oasis\n  const useful = arid && (h >>> 9) % 4 === 0 ? OASIS_TEMPLATES : base;\n  return { name: useful[(h >>> 5) % useful.length](name), canon: false };");
// the two hand-written names that used the words
s = s.replace("'manila|ph': 'Manila Meltdown',", "'manila|ph': 'Manila Wreckage',");
fs.writeFileSync(p, crlf ? s.replace(/\n/g, '\r\n') : s);
console.log('ok');
