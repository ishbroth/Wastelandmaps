// Every Vault-Tec vault had a secret: the shelter was sold as a refuge, and was really an experiment on the people inside. The vaults of the games have
// their own stories (loreVaults.ts). Every other vault on the map gets one made here, from a few hundred hand-written pieces put together by the vault's
// number and its metro, so each is its own (Vault 042 in Boston is not Vault 042 in Tokyo) and always the same one. Fallout's way of telling it: a cheerful
// corporate pretext, a cruel little test, the human mess that wrecked it, and what is left.

import { hashString, seeded } from './wasteland';

const FIRST = ['Agnes', 'Alvin', 'Beatrix', 'Bernard', 'Cecil', 'Clara', 'Dorian', 'Edith', 'Elmer', 'Fiona', 'Gideon', 'Gladys', 'Harold', 'Hazel', 'Irving', 'Ivy', 'Jasper', 'Josephine', 'Kenneth', 'Lorna', 'Marvin', 'Mildred', 'Nigel', 'Opal', 'Percival', 'Quentin', 'Rosalind', 'Silas', 'Thelma', 'Ulysses', 'Vera', 'Walter', 'Winifred', 'Yolanda', 'Zelda', 'Abner', 'Blanche', 'Chester', 'Delphine', 'Eugene'];
const LAST = ['Abernathy', 'Blackwood', 'Carmichael', 'Dunmore', 'Eastwick', 'Fairweather', 'Grimsby', 'Holloway', 'Ingersoll', 'Jessup', 'Kettleman', 'Lockhart', 'Mortimer', 'Nettleton', 'Oakhurst', 'Pennywhistle', 'Quigley', 'Rutherford', 'Spindle', 'Thistlewood', 'Underhill', 'Vandermeer', 'Whitcombe', 'Yarrow', 'Zimmerman', 'Applegate', 'Bellweather', 'Cobbett', 'Dankworth', 'Fenwick'];

/** Who was sent below. `{n}` is the headcount. */
const PEOPLE = [
  '{n} elementary-school teachers', '{n} professional clowns', '{n} lighthouse keepers and their families', '{n} long-haul truckers', '{n} sets of identical twins',
  '{n} chess club champions', '{n} retired airline pilots', '{n} deaf and hard-of-hearing residents', '{n} dairy farmers', '{n} opera singers', '{n} chronic insomniacs',
  '{n} left-handed volunteers', '{n} orphans and their appointed guardians', '{n} competitive eaters', '{n} clerks of one county records office', '{n} night-shift nurses',
  '{n} carnival performers', '{n} pairs of newlyweds', '{n} taxidermists', '{n} switchboard operators', '{n} graduate students', '{n} stage actors',
  '{n} amateur radio operators', '{n} auto mechanics', '{n} librarians', '{n} lifelong gamblers', '{n} minor celebrities', '{n} people who all shared a birthday',
  '{n} strangers drawn by lottery', '{n} rodeo riders', '{n} tax accountants', '{n} clergy of seven faiths', '{n} marathon runners', '{n} pastry chefs',
  '{n} cartographers', '{n} church bell ringers', '{n} gardeners', '{n} bank tellers', '{n} ventriloquists', '{n} insurance adjusters', '{n} puppeteers',
  '{n} ferry captains', '{n} crossword constructors', '{n} bakers from one street', '{n} retired generals and their dogs', '{n} municipal swimming instructors',
];

/** What they were told. */
const COVER = [
  'a luxury retreat for the war-ready', 'a government-approved sanctuary', 'a prize in a radio contest', 'the first of a new kind of community', 'a showpiece of the Vault-Tec Home Program',
  'a survival shelter rated for two hundred years', 'a model town beneath the earth', 'a safe place to wait for the all-clear', 'a gift from the company to the neighborhood',
  'the future of family living', 'a members-only bunker with a waiting list', 'a training facility for the next generation of leaders', 'a refuge guaranteed by the President',
  'a cooperative of the careful', 'the safest address in America',
];

/** What Vault-Tec was really finding out. Each reads after "Vault-Tec's real purpose was to find out ..." */
const TESTS = [
  'whether people kept under lighting that never changes lose their sense of time',
  'how a community behaves when its Overseer is chosen by coin toss every month',
  'whether a single ration, flavored a different way each day, can start a riot',
  'what happens to trust when the intercom speaks only in the voice of a resident who died years ago',
  'whether laughter is contagious enough to be piped through the corridors on purpose',
  'whether a vault can be governed by the vote of its youngest member',
  'how fast a people forget their own language when the only dictionary is quietly rewritten every year',
  'whether neighbors stay neighbors when every door is secretly keyed to a different resident each week',
  'how people adapt to furniture that shrinks by a hair each month',
  'whether people raised without mirrors know their own faces after sixty years',
  'whether a computer matching marriages by compatibility makes happy couples or one catastrophic divorce',
  'how a sealed community takes being told, on a schedule, that rescue is coming tomorrow',
  'whether a siren that never stops can become comforting',
  'the long-term effects of a ventilation system scented with a lavender sedative',
  'whether memory survives when each generation burns its records at its coming of age',
  'what a society does with exactly one working toilet',
  'whether a population with one shared telephone line develops a single voice',
  'how fast gossip travels when only one rumor is allowed each week',
  'whether jumpsuit colors handed out by lottery harden into a caste system within a year',
  'whether people given one hour of darkness a day invent a religion around it',
  'whether a hundred identical board games can settle every dispute in a vault',
  'whether residents kept in total silence invent their own sign language',
  'whether meals engineered to look like feasts but feed nothing can fool a hungry brain',
  'what comes of an Overseer who tells a different lie to every resident',
  'whether a people can be taught to love an anthem played twelve hours a day',
  'what a community does when the Overseer\'s office door is always open and always unattended',
  'whether people choose paint colors by instinct when the paint is secretly tied to their rations',
  'whether cleanliness becomes virtue when soap is rationed by merit',
  'how a population copes when it must ask a computer\'s permission to speak',
  'whether anyone notices that the vault clocks run ten percent slow',
  'whether a pet hamster per family, issued and then recalled, breaks a household',
  'what a thirty-hour day does to a community of people made for twenty-four',
  'how a sealed society treats the one person the cameras cannot see',
  'whether people stay inside a vault whose door was never locked, but only ever says it is',
  'whether anyone tells the truth to a machine everyone knows lies',
  'what happens when the children of two families are swapped every week',
  'how long it takes a community to adapt to floors tilted by two degrees',
  'whether people grow attached to a single ficus they are told is the last plant on Earth',
  'how a vault fares under an AI that plays favorites, and then loses its favorites',
  'whether a people with only one song can keep their sanity or their music',
  'whether a vault with no Overseer, run by every resident at once, can finish a single decision',
  'whether limitless chocolate leads to collapse or to a very sticky utopia',
  'how people behave when every meal is announced as the last one',
  'whether a population will follow a calendar that skips a day each month without being told',
  'what a vault does with a crate of ten thousand identical hats',
  'whether residents who are each told they are the only real person will treat the rest kindly',
  'how a crowd reacts to a daily broadcast that is always, subtly, wrong about the weather',
  'whether a vault of experts will starve rather than ask for help from a stranger',
  'what happens to a community of strangers given one shared bedroom and a lot of paperwork',
  'whether people can be made homesick for a place they have never seen',
  'whether a society will obey a rule so ridiculous nobody will admit it has no reason',
  "whether a population will politely follow a sign that is clearly wrong",
  "how long a community will keep a ribbon-cutting going once the scissors are lost",
  "what happens when every resident is told, privately, that they are the Overseer",
  "whether a vault with only one working door can be talked into believing it has two",
  "how many people it takes to hold a surprise party for someone who never leaves the room",
  "whether a population fed entirely on cheerful announcements can digest a bad one",
  "whether the dead are more reasonable than the living if you give them the same chairs",
  "whether people will argue about the temperature of a room that has no temperature control",
  "how a town handles being told that the lottery has been held, and it was theirs",
  "whether neighbors will keep a feud going through the end of the world, to be thorough",
];

/** What went wrong. `{O}` is the Overseer, `{n}` the headcount. */
const WRONG = [
  'Overseer {O} began improvising and made it worse. By the second winter nobody could say what the experiment had been, only that it had winners.',
  'A technician added one extra step "to be thorough", and the whole test now measures that step instead.',
  'The control computer developed favorites. Their rations were generous; everyone else\'s were an essay about gratitude.',
  'The residents guessed the experiment on day nine and, out of politeness, began running one on Vault-Tec.',
  'The monitoring cameras were pointed at the wrong room for forty years, so the company\'s data describes somewhere else entirely.',
  'A maintenance error doubled the dose for two decades, and the Overseer, finding it worked, never mentioned it.',
  'The scientists\' own families were sent down with everyone else, and spoiled the blind in a week.',
  'It worked perfectly, and nobody had planned for that. The report is stamped "unacceptable".',
  'The lightbulbs ran out first, then the paperwork, then the patience. The experiment lasted for exactly as long as the lightbulbs did.',
  '{O}, the Overseer, took the whole thing personally and began to keep a list. It was a long list. It was soon the only rule.',
  'A resident named {O2} noticed the pattern, wrote it on a wall, and was believed by everyone, which was worse than being ignored.',
  'The vault had two sets of instructions. They were each delivered, by mistake, to a different half of the population.',
  'The experiment had a stop condition. Someone lost it. It runs to this day, in a sense.',
  'Vault-Tec forgot to program an end. The Overseers kept the schedule anyway, out of habit, long after anyone could say why.',
  'The back-up generator was fine. The back-up Overseer was not.',
  'The ration of the week was never delivered, and the community resolved the shortage with a committee, then a subcommittee, then a duel.',
  'The sealed door was a rumor; the sealed minds were not. Whatever the test measured, it was not what it set out to.',
  'A leak in the water plant turned the drinking supply faintly sweet, and the whole schedule of the vault rearranged itself around mealtimes.',
  'The intercom broke on a single word. The residents quietly built a society that avoids it.',
  'The Overseer\'s secret instructions were in a sealed envelope, to be opened in a crisis. It was opened on day four, by someone who read it aloud.',
  'Someone found the manual, and the manual had a chapter called "If the Residents Find This Manual".',
  'The experiment required a villain. No one was cast, so the community promoted one from among themselves, and has never stopped.',
  'A rodent got into the controls and has been the vault\'s unofficial Overseer ever since. Its decisions are about as sound as the last four.',
  'The test needed exactly {n} participants. A baby was born in year three, and every figure after that is wrong.',
  'A poorly translated warning label on the reactor made "do not touch" read as "please touch". Touching became civic duty.',
  'The scientists and the security staff each thought the other was the experiment, and lived accordingly.',
  'Midway through, the data stopped being kept, and the people stopped needing to be tested. The vault carried on out of pure momentum.',
  'A fire in the records room destroyed the instructions. The residents rebuilt them from memory, and every memory was different.',
  'The Overseer, tired of the test, tried to end it. This was not allowed for in the schedule and was therefore punished by the schedule.',
  'The company never answered a single report. The Overseers kept writing them anyway, and the reports grew into a literature.',
  "The intercom was left on one night, and the residents learned how the Overseer really spoke to the vault when he thought it was asleep.",
  "A resident discovered the control panel had a big red button marked DO NOT, and the whole vault has been quietly arguing about it since.",
  "Overseer {O} taught everyone a calming chant, and the chant outlasted the calm, the Overseer, and the vault door.",
  "The mascot costume was worn by three different people in secret, and they each believe they are the only one. The mascot is the most reliable member of the vault's leadership.",
  "The suggestion box was emptied, every night, by someone who answered every note in the same careful handwriting. They were never found, and the suggestions were always good.",
  "A flood in the lower levels was blamed on {O2}, who spent the next ten years being tried for it by a jury that was, in fact, the flood.",
  "The quarantine ward was never used, until someone realized it was the only room with a window, and now it has a waiting list.",
  "The vault's cafeteria served one dish for eleven years, and the people grew so fond of it that the recipe is now a religion.",
];

/** What became of them, and what is down there now. `{n}` is the headcount, `{O}` the last Overseer. */
const FATE = [
  'The survivors walked out generations ago and founded a settlement that still keeps the rules of the experiment, without remembering why.',
  'Their descendants worship the intercom. It has not spoken in ninety years, which they take as the answer.',
  'The vault is empty now, save for a mural of the whole population painted on one wall, with the last figure unfinished.',
  'Traders warn each other off the place in a tone usually kept for tax collectors.',
  'The last Overseer\'s journal still sits on the desk, open, and ends in the middle of a sentence about soup.',
  'Something moved into the lower levels. It is polite, in its way, and it keeps the lights on.',
  'The residents settled it themselves: they stayed. Whatever comes through the front door is asked, very kindly, to read the rules.',
  'Everyone left the day the door finally opened, except for one resident, who had been told to wait for permission.',
  'A few families remain, and trade the vault\'s old ration tickets as money among themselves. They are, by their own account, rich.',
  'The place is a ruin of beautiful, patient paperwork, and the dust has already begun to file itself.',
  'Scavengers say the vault still hums a tune. Nobody who has tracked it to its source will say what it was.',
  'Whoever was left has taken to leaving small offerings by the door: spare parts, a shoe, a coin. Nobody can say who for.',
  'The survivors scattered, and for generations every one of them has kept to the same odd habit, handed down like a surname.',
  'The vault was cleaned out in a week by a gang that regretted every minute of it.',
  'The people left, but the machines stayed, and the machines are still conducting the test on the dust.',
  'Nobody lives there now. Everyone who goes in comes out a little quieter, and no one will say why.',
  'The lowest level was never opened by anyone alive, and from time to time it knocks back.',
  'The last of them are old now and entirely sure the world outside is the experiment.',
  'A trader named {O} sells maps to it, and has never once been inside.',
  'It is a shelter for strangers now, kept by whoever happens to arrive first, who always become the Overseer.',
  'The residents all went topside one night, decided against it, and came back, which is the only decision the vault ever made unanimously.',
  'The vault was sealed again, from outside this time, by people who never said what they saw.',
  'The community survives on the very habit it was made to test, and thrives on it, to the embarrassment of the company.',
  'What is left are the animals, who inherited the vault\'s routine and keep to it with a discipline no human managed.',
  'The door is open. The welcome mat is still down, and someone is still straightening it.',
  'Even now a faint announcement plays in the empty halls, reminding residents that the experiment is going very well.',
  'The few who left have never agreed on what happened, and have started three separate churches over it.',
  'Whatever it was meant to prove, the vault proved something else, and the something else is why it is still standing.',
  'Nobody can find the exit that the first residents used, and the ones who did are not forthcoming.',
  'The last Overseer is still down there, they say, and has been telling the same story, with slight improvements, since before the walls went up.',
  'People go in to loot it and stay for the company.',
  "The vault keeps a single light burning at the end of its longest hall. Whoever tends it has never once been seen.",
  "The last Overseer left a note taped to the door of the vault: SORRY. It is the only message on the whole level that is entirely true.",
  "A family of mole rats runs the place now. They are not good at it, but they are better than the last thing that tried.",
  "Visitors say the vault hums at night. The hum is a hymn. The hymn is a jingle. The jingle is for a product that never existed.",
  "Somebody has been repainting the hazard stripes every spring. There's nobody there to do it. The paint is always still wet.",
  "The vault door is open a hand-width, as if someone were politely holding it, and has been for a very long time.",
  "Its residents voted to stay, and then voted on a second question, and then a third. The vote is still in progress.",
  "The population is now exactly one, and he is extremely well informed.",
];

function pick<T>(list: readonly T[], rand: () => number): T {
  return list[Math.floor(rand() * list.length)];
}

const fill = (text: string, vars: Record<string, string>): string => text.replace(/\{(\w+)\}/g, (_, k: string) => vars[k] ?? '');

/**
 * The story of one vault: three short paragraphs. Always the same for the same vault in the same place; different from every other vault's (the pieces are
 * mixed by the number and by where the vault stands).
 */
export function vaultStory(place: string, number: number): string[] {
  const rand = seeded((hashString(`vault-story|${place}`) ^ Math.imul(number + 1, 2654435761)) >>> 0);
  for (let i = 0; i < 12; i++) rand(); // the first draws of a seed are too alike from one seed to the next
  const overseer = `${pick(FIRST, rand)} ${pick(LAST, rand)}`;
  const resident = `${pick(FIRST, rand)} ${pick(LAST, rand)}`;
  const trader = `${pick(FIRST, rand)} ${pick(LAST, rand)}`;
  const headcount = String(40 + Math.floor(rand() * 11) * 20 + Math.floor(rand() * 20));
  const vars = { n: headcount, O: overseer, O2: resident };
  const people = fill(pick(PEOPLE, rand), vars);
  const test = pick(TESTS, rand);
  return [
    `Vault ${String(number).padStart(3, '0')} was sold to ${people} as ${pick(COVER, rand)}. Vault-Tec's real purpose was to find out ${test}.`,
    fill(pick(WRONG, rand), vars),
    fill(pick(FATE, rand), { ...vars, O: trader }),
  ];
}
