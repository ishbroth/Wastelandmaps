import { wastelandName } from '../src/lib/lore.ts';
for (const [c, s] of [['Boston','MA'],['Providence','RI'],['Washington','DC'],['San Diego','CA'],['Las Vegas','NV'],['Atlanta','GA'],['Charleston','WV'],['New Haven','CT'],['Athens','GA'],['Smalltown','OH'],['Detroit','MI'],['Pittsburgh','PA']]) console.log(c, '=>', JSON.stringify(wastelandName(c, s)));
