// Checks what the navigation voice says. npx esbuild _tools/speakable.check.ts --bundle --platform=node --format=cjs --outfile=_data/speakable.check.cjs && node _data/speakable.check.cjs
import { speakable } from '../src/lib/speakable';
let bad = 0;
const t = (input: string, want: string) => { const got = speakable(input); const ok = got === want; if (!ok) bad++; console.log(ok ? 'ok  ' : 'FAIL', JSON.stringify(input), '->', JSON.stringify(got), ok ? '' : 'wanted ' + JSON.stringify(want)); };
t('In 400 feet, turn left onto California Highway 125', 'In 400 feet, turn left onto C A 1 25');
t('Merge onto CA-125 North', 'Merge onto C A 1 25 North');
t('Take Interstate 5 south', 'Take I 5 south');
t('Keep right onto I-405', 'Keep right onto I 4 oh 5');
t('Turn right onto US Highway 101', 'Turn right onto U S 1 oh 1');
t('Turn left onto Main Street', 'Turn left onto Main');
t('Turn right onto Pacific Coast Hwy', 'Turn right onto Pacific Coast Hwy');
t('Continue on FM 1960 for two miles', 'Continue on 1960 for two miles');
t('Head north on Polaris Dr', 'Head north on Polaris');
t('Turn onto State Route 94', 'Turn onto Route 94');
t('Turn onto Texas Highway 200', 'Turn onto T X 2 hundred');
process.exit(bad ? 1 : 0);
