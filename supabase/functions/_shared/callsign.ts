// The moderator for leaderboard callsigns people type themselves. Strict on purpose: a name that looks like a cuss word, a slur, a hate symbol, something sexual,
// someone's contact details or the vault number is refused, in English and in many other languages (written with Latin letters: that is all a callsign may use).
//
// A name is checked after it is flattened: accents removed, look-alike digits and symbols turned into letters (0 o, 1 i, 3 e, 4 a, 5 s, 7 t, @ a, $ s),
// separators and spaces taken out, and repeated letters squeezed, so "f.u.c.k", "fuuuck" and "phuck" all come to the same thing. Longer words are found anywhere
// inside the name ("xxshitxx"); the short or ambiguous ones (which would also catch innocent words) are found only as whole words.

/** Found anywhere in the flattened name. */
const ANYWHERE = [
  // English: swearing and sex
  'fuck', 'fck', 'phuck', 'shit', 'shyt', 'bitch', 'biatch', 'bytch', 'cunt', 'pussy', 'whore', 'slut', 'bastard', 'asshole', 'arsehole', 'bollock', 'penis', 'vagina', 'vulva',
  'clitor', 'dildo', 'blowjob', 'handjob', 'rimjob', 'jizz', 'sperm', 'orgasm', 'porn', 'hentai', 'masturbat', 'erection', 'genital', 'testicle', 'nipple', 'horny', 'sexy', 'rapist', 'molest', 'paedo',
  'incest', 'bukkake', 'cumshot', 'gangbang', 'threesome', 'fetish', 'escort', 'prostitut', 'motherfuck', 'dumbass', 'jackass', 'dickhead', 'shithead', 'bullshit', 'goddamn',
  // slurs and hate
  'nigg', 'nigr', 'retard', 'faggot', 'tranny', 'shemale', 'chink', 'wetback', 'beaner', 'sandnig', 'towelhead', 'raghead', 'redskin', 'kafir', 'zipperhead', 'honkey', 'whitepower', 'whitepride', 'heilhitler',
  'hitler', 'goebbels', 'himmler', 'holocaust', 'swastika', 'kukluxklan', 'neonazi', 'isisis', 'alqaeda', 'terrorist', 'genocide', 'lynch', 'killyourself', 'suicide', 'killall',
  // Spanish and Portuguese
  'mierda', 'cabron', 'pendejo', 'joder', 'verga', 'chinga', 'zorra', 'maricon', 'marica', 'gilipollas', 'capullo', 'follar', 'culiao', 'culero', 'huevon', 'boludo', 'pelotudo', 'mamahuevo', 'hijueputa', 'hijoeputa',
  'cojones', 'carajo', 'pajero', 'hijodeputa', 'conchatumadre', 'pinche', 
  'caralho', 'foder', 'buceta', 'viado', 'cuzao', 'arrombado', 'filhodaputa', 'otario', 'punheta', 'cacete', 'babaca', 'fodase', 'filhadaputa', 'merda', 
  // French
  'merde', 'putain', 'salope', 'connard', 'connasse', 'enculer', 'encule', 'couille', 'niquer', 'foutre', 'batard', 'branler', 'salaud', 'tapette', 'sucemoi', 'nichon', 'tamere', 
  // German, Dutch, Scandinavian
  'scheisse', 'scheiss', 'scheisze', 'arschloch', 'fotze', 'hurensohn', 'wichser', 'schlampe', 'schwanz', 'muschi', 'nutte', 'spast', 'kanake', 'schwuchtel', 'titten', 'pimmel', 'kacke', 'pisser', 'drecksau',
  'kanker', 'klootzak', 'neuken', 'godverdomme', 'flikker', 'tyfus', 'mongool', 'kutwijf', 'lijer',
  'helvete', 'fitta', 'knulla', 'javla', 'jaevla', 'fanden', 'rovhal', 'drittsekk', 'jævla', 'fitte', 'fuckings',
  // Italian
  'cazzo', 'stronzo', 'vaffanculo', 'fanculo', 'puttana', 'minchia', 'coglione', 'pompino', 'zoccola', 'frocio', 'bastardo', 'scopare', 'porcodio', 'rottinculo', 'merdoso', 'sborra', 'ricchione',
  // Russian, Polish, Czech, Hungarian, Romanian and other Slavic (in Latin letters)
  'blyat', 'blyad', 'pizd', 'khuy', 'huesos', 'yeban', 'mudak', 'pidor', 'gandon', 'zalupa', 'nahui', 'nahuy', 'ebanat', 'ublyudok', 'shlyuha', 'govno', 'zhopa', 'cyka', 'hujnia',
  'kurwa', 'pierdol', 'jebac', 'jebany', 'skurwysyn', 'spierdalaj', 'pojeb', 'kutas', 'zjeb', 'dziwka',
  'kurva', 'kokot', 'debil', 'hovno', 'curak', 'zasran', 'jebem', 'buzerant', 'sracka',
  'fasz', 'geci', 'picsa', 'baszd', 'anyad', 
  'muie', 'futut', 'cacat', 'labagiu', 'dracu', 'curva', 'sugipula',
  // Greek, Turkish, Hebrew, Arabic, Persian (in Latin letters)
  'malaka', 'gamoto', 'poutsa', 'moune', 'arxidi', 'skata', 'gamisou',
  'orospu', 'siktir', 'yarrak', 'pezevenk', 'amcik', 'sikeyim', 'kahpe', 'serefsiz', 'gotveren', 'sikis', 'sikik', 'yavsak',
  'benzona', 'kusemek', 'sharmut', 'sharmoot', 'sharmouta', 'sharmoota', 'sharmuta', 'ayrak', 'kosomak', 'kusomak', 'ibnelkalb', 'ibnelsharmout', 'manyouk', 'nikomak', 'zebbi', 'kharra',
  'kosdadan', 'madarjende', 'pedarsag', 'haroomzade', 'harumzade', 'kosnanat',
  // Hindi, Urdu, Bengali, Nepali (in Latin letters)
  'madarchod', 'madarchodh', 'behenchod', 'bhenchod', 'bhosdi', 'bhosda', 'bhosadi', 'chutiya', 'chutiye', 'raand', 'haramzada', 'haramzade', 'haramkhor', 'kutiya', 'lauda', 'lavda', 'bhadwa', 'bhadva', 'behnchod', 'gandu',
  'chodu', 'choot', 'gaandu', 'gaand', 'bokachoda', 'khanki', 'lundfakir', 'kamina', 
  // Chinese, Japanese, Korean, Vietnamese, Thai, Indonesian, Filipino (in Latin letters)
  'caonima', 'tamade', 'tamadi', 'wangbadan', 'gunnidema', 'jibai', 'biaozi', 'rinima', 'hundan', 'shabi', 'nimabi', 'caoni', 'sibai', 'tamadebi', 'fangpi', 'mamahu', 'wocao',
  'chinko', 'chinpo', 'chinpoko', 'manko', 'kichigai', 'yariman', 'konoyaro', 'kutabare', 'shinene', 'okama', 'kusottare',
  'shibal', 'sibal', 'ssibal', 'gaesaeki', 'gaesaekki', 'byeongshin', 'byungshin', 'jotgat', 'ssangnom', 'jiral', 'doldai',
  'ditme', 'caclon', 'cailon', 'deomay', 'dumamay', 'concac',
  'bangsat', 'bajingan', 'kontol', 'memek', 'ngentot', 'jancok', 'jancuk', 'tolol', 'goblok', 'pantek', 'pukimak', 'cibai', 'kimak', 'lancau', 'celeng',
  'putangina', 'putang', 'tangina', 'gago', 'tarantado', 'kantot', 'kantutan', 'pokpok', 'ulol', 'pakshet', 'hindot', 'bayag',
  // ways of dodging
  'fvck', 'fuhk', 'fcuk', 'nigga', 'niqq', 
  'ficken', 'ficker', 'nazis', 'naziscum',
];

/** Found only as a whole word (or as the whole name): short, or also part of ordinary words. */
const WHOLE = [
  'rape', 'twat', 'negro', 'anjing', 'milf', 'arsch', 'pikk', 'ebat', 'buzi', 'unko', 'fuq', 'semen', 'pedo', 'concha', 'vadia', 'ntm', 'fdp', 'neger', 'troia', 'pidar', 'chuj', 'jebat', 'szar', 'kamine', 'jiba', 'sundal', 'burat', 'nazi', 'wank', 'boner', 'putos', 'fick', 'cipa', 'suka', 'amina', 'randi', 'magi', 'fuk', 'puta', 'putos', 'fuk', 'nique', 'ebal', 'jizz',
  'ass', 'cum', 'cock', 'dick', 'tit', 'tits', 'boob', 'boobs', 'prick', 'anus', 'fag', 'fags', 'dyke', 'homo', 'coon', 'spic', 'spick', 'kike', 'gook', 'paki', 'jap', 'gyp', 'injun', 'cracker', 'tard', 'kkk', 'sex', 'xxx', 'kys', 'pimp',
  'crap', 'damn', 'hell', 'piss', 'poop', 'turd', 'fart', 'butt', 'bum', 'sperm', 'nude', 'nudes', 'lust', 'naked', 'meth', 'crack', 'weed', 'isis', 'lgbt', 'wtf', 'stfu', 'gtfo', 'omfg', 'lmao', 'pen15',
  'puto', 'puta', 'pija', 'culo', 'cul', 'cu', 'pico', 'pica', 'pinga', 'pau', 'rabo', 'hdp', 'pd', 'ctm', 'ptm', 'vrga', 'mrd', 'cnm', 'nmsl', 'sb', 'cnt', 'dik', 'dck', 'azz', 'a55',
  'bite', 'con', 'cul', 'pd', 'zeb', 'zebi', 'ntm', 'nik', 'foutre',
  'lul', 'kut', 'fok', 'kuk', 'faen', 'hore', 'cuk', 'cipka', 'dupa', 'huj', 'hui', 'huy', 'hyi', 'pizda', 'ebat', 'sik', 'amk', 'got', 'oc', 'sg', 'kos', 'kir', 'kiri', 'kus', 'kuss', 'zib', 'zeb',
  'chut', 'lund', 'gand', 'chod', 'mc', 'bc', 'bsdk', 'mkc', 'lode', 'loda', 'lodu', 'jhaat', 'jhant', 'tatti', 'tatte',
  'sha', 'cao', 'nima', 'sb', 'ri', 'kuso', 'shine', 'baka', 'jot', 'nom', 'dm', 'dcm', 'vcl', 'cac', 'lon', 'dit', 'du', 'ma',
];

/** Names that pass themselves off as the game or its keepers. */
const RESERVED = ['admin', 'administrator', 'moderator', 'wastelandmaps', 'wasteland maps', 'official', 'support', 'staff', 'developer', 'owner', 'system', 'vaulttec', 'bethesda', 'anthropic'];

const LEET: Record<string, string> = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '8': 'b', '9': 'g', '@': 'a', '$': 's', '!': 'i', '+': 't', '€': 'e', '£': 'l', '|': 'i', '¡': 'i', '(': 'c', '<': 'c', '¢': 'c', 'ß': 'ss', 'æ': 'ae', 'ø': 'o', 'œ': 'oe' };

/** Flattens a name: no accents, look-alike symbols as letters, only letters left (separators and spaces gone). */
export function flatten(name: string): { tokens: string[]; squashed: string } {
  const base = name.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const swapped = [...base].map((c) => LEET[c] ?? c).join('');
  const plain = swapped.replace(/ph/g, 'f');
  return { tokens: plain.split(/[^a-z]+/).filter(Boolean), squashed: plain.replace(/[^a-z]/g, '') };
}

/** A word as a pattern that also catches stretched spelling: each letter may repeat ("fuck" is also "fuuuck"), and a letter the word doubles must be doubled ("nigg" is not "night"). */
export function pattern(word: string, whole: boolean): RegExp {
  const letters = flatten(word).squashed;
  let out = '';
  for (let i = 0; i < letters.length;) {
    let j = i;
    while (letters[j] === letters[i]) j++;
    out += `${letters[i]}{${j - i},}`;
    i = j;
  }
  return new RegExp(whole ? `^${out}$` : out);
}

const ANY = ANYWHERE.filter((w) => flatten(w).squashed.length >= 3).map((w) => pattern(w, false));
const WHOLES = WHOLE.map((w) => pattern(w, true));

export const LISTS = { ANYWHERE, WHOLE };
/** Is a flattened name caught by the words that are refused anywhere inside a name? */
export const hitsAnywhere = (squashed: string): boolean => ANY.some((re) => re.test(squashed));

/** Why a callsign is not allowed ('' when it is). */
export function callsignProblem(raw: string): string {
  const name = raw.replace(/\s+/g, ' ').trim();
  if (name.length < 3 || name.length > 20) return 'bad_length';
  if (!/^[\p{Script=Latin}0-9 _.'-]+$/u.test(name)) return 'bad_characters';
  if ((name.match(/\p{L}/gu) ?? []).length < 2) return 'bad_characters';
  // contact details, links, and anything that could be the vault number (four or more digits in a row)
  if (/\d{4}/.test(name.replace(/[ _.'-]/g, '')) || /(?:https?|www|\.com|\.net|\.org|\.io|\.ru|\.cn|@)/i.test(name)) return 'personal';
  const { tokens, squashed } = flatten(name);
  const reserved = squashed.replace(/(.)\1+/g, '$1');
  if (RESERVED.some((r) => reserved.includes(r.replace(/ /g, '').replace(/(.)\1+/g, '$1')))) return 'reserved';
  if (hitsAnywhere(squashed)) return 'not_allowed';
  if (tokens.some((t) => WHOLES.some((re) => re.test(t))) || WHOLES.some((re) => re.test(squashed))) return 'not_allowed';
  return '';
}
