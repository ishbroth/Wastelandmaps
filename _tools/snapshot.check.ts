// The photo-matching rule. Run: npx tsx _tools/snapshot.check.ts
import { photoIsOf } from '../src/lib/snapshot.ts';
let bad = 0;
const check = (name: string, ok: boolean) => { if (!ok) bad++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`); };
check('exact name matches', photoIsOf('Boston Common', 'File:Boston Common.jpg'));
check('name with extra words in the title matches', photoIsOf('Boston Public Library', 'File:Boston Public Library, McKim Building, Copley Square.jpg'));
check('accents and punctuation do not matter', photoIsOf('Café Bonjour', 'File:Cafe Bonjour storefront.jpg'));
check('a shrub near City Hall Plaza is NOT City Hall Plaza', !photoIsOf('City Hall Plaza', 'File:Elaeagnus umbellata SCA-02837.jpg'));
check('a generic city photo is NOT Post Office Square', !photoIsOf('Post Office Square', 'File:2007 Boston2116453076.jpg'));
check('sharing only a generic word does not count', !photoIsOf('Boston Tea Party Ships & Museum', 'File:Boston skyline at dusk.jpg'));
check('most of the name must appear', !photoIsOf('Hyatt Regency Boston', 'File:Boston harbor.jpg'));
check('a cinema named after a park is not the park', !photoIsOf('AMC Boston Common 19', 'File:Boston Common in the fall 02.jpg'));
check('a name with no usable words never matches', !photoIsOf('A', 'File:A.jpg'));
check('the description can carry the name', photoIsOf('Quincy Market', 'File:Faneuil Hall area.jpg Quincy Market colonnade at night'));
process.exit(bad ? 1 : 0);
