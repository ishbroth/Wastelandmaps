// Vaults that exist in the games' stories, put where they stand in the game relative to the real map. The games compress and bend geography, so
// these are placed from where each vault sits next to places that DO have a real counterpart (Vault 81 is due west of the Fens, which is
// Fenway; Vault 19 and Vault 34 are the Blue Diamond and Frenchman mines, by the Fallout wiki's real-world list; Vault 88 is under the Quincy Quarries,
// Vault 114 is in Park Street Station, Vault 92 is northwest of Old Olney, which is Olney, Maryland). `approximate` marks the ones placed from the game's
// relative position only. When a vault lines up with a place already on the map, that place becomes its entrance (and keeps its snapshot); when it does not,
// the vault is shown on its own with its story and no snapshot. The stories are summaries, in our own words, of what the games and the Fallout wiki tell.

export interface LoreVault {
  number: number;
  /** The one metro it is placed in (the metros around it do not get it as well). */
  metro: string;
  game: string;
  lat: number;
  lng: number;
  /** What the story says about it, in a line. */
  lore: string;
  /** The whole story, as a few short paragraphs. */
  story: string[];
  approximate: boolean;
}

export const LORE_VAULTS: LoreVault[] = [
  // ---- Fallout: the Necropolis ghouls' vault, under Bakersfield
  {
    number: 12, metro: 'us-ca-bakersfield', game: 'Fallout', lat: 35.3733, lng: -119.0187, approximate: true,
    lore: 'Beneath Necropolis. Sold as a well-equipped shelter, it was built to study radiation on its people, and its door was made never to close. Its people became ghouls.',
    story: [
      'Vault 12 was sold as a well-stocked shelter and built as a radiation study: its great door was made so that it could never fully close.',
      'When the bombs fell, the fallout came in with the people, and the residents began to change.',
      'The vault became the ghoul city of Necropolis, where the people who stayed have gone on living long past anything the company planned.',
    ],
  },
  // ---- Fallout 4: the Commonwealth (Boston)
  {
    number: 111, metro: 'us-ma-boston', game: 'Fallout 4', lat: 42.47, lng: -71.37, approximate: true,
    lore: 'Overlooking Sanctuary Hills. Its people were told it was a shelter and were frozen instead: a Vault-Tec experiment in cryogenics. One of them walked out, two hundred years later.',
    story: [
      'Vault 111 stands above Sanctuary Hills. The neighbors who ran to it were told the pods were for decontamination; they were frozen to see what long sleep would do.',
      'The Overseer sat on the door past the six months promised, the guards mutinied, and the vault went into lockdown with the sleepers still under glass.',
      'Two hundred years on, an agent of the Institute came for one baby and left the rest of the pods without power. Only one of the sleepers ever walked out.',
    ],
  },
  {
    number: 81, metro: 'us-ma-boston', game: 'Fallout 4', lat: 42.346, lng: -71.17, approximate: true,
    lore: 'West of the Fens. Built to test a universal cure; the Overseer sabotaged the experiments, and the research wing went to the mole rats.',
    story: [
      'Vault 81 was built to find a cure for every disease, using its own residents as unwitting patients; the diseases were to be released through hidden nozzles in their homes.',
      'The first Overseer, a doctor, refused: she disabled the nozzles and sealed off the secret research wing where the scientists worked.',
      'The main vault never learned what it had been spared, and lives on as a shelter that trades with the caravans. The research wing went to the mole rats, and one scientist\'s robot is still down there tending it.',
    ],
  },
  {
    number: 88, metro: 'us-ma-boston', game: 'Fallout 4', lat: 42.286, lng: -71.047, approximate: false,
    lore: 'Under the Quincy Quarries. A testing ground for prototype devices, never finished; it sealed itself when the bombs fell and the ghouls took it.',
    story: [
      'Vault 88 was meant to be the place where Vault-Tec tested its prototype devices before they went into other vaults, built over a rich seam of uranium.',
      'The construction went badly, and the vault was unfinished when the bombs fell; its entrance, under the Quincy Quarries, was buried in rubble.',
      'An automated lockdown sealed the Overseer and her staff inside, and feral ghouls have been the vault\'s only residents ever since.',
    ],
  },
  {
    number: 114, metro: 'us-ma-boston', game: 'Fallout 4', lat: 42.3564, lng: -71.0624, approximate: false,
    lore: 'In Park Street Station. A vault for the wealthy, meant to see how the privileged cope with less; never finished, and now a gangster\'s.',
    story: [
      'Vault 114 was begun inside Park Street Station for a hundred and twenty of Boston\'s wealthy and powerful, who were to be packed several families to a room to see how the privileged cope with less.',
      'It was never finished. Some say it was a swindle, a vault built to keep the workers on the payroll and nothing more.',
      'A mobster and his gunmen took it over afterward, and the families on its register were never heard from again.',
    ],
  },
  {
    number: 75, metro: 'us-ma-boston', game: 'Fallout 4', lat: 42.4251, lng: -71.0662, approximate: true,
    lore: 'Under Malden Middle School. Meant to refine human genetics through children alone; the adults were removed, and the "graduates" were harvested.',
    story: [
      'Vault 75 was dug under a school and sold as a shelter for its students. When the bombs fell the children were separated from their families and the adults were taken away.',
      'The children were raised to believe they would someday help the wasteland; at eighteen the ones judged fit were harvested for their genes or drafted into the vault\'s science team, and the rest met their end at a graduation ceremony.',
      'The company\'s purpose is still argued about. Gunners moved in when it ended.',
    ],
  },
  {
    number: 95, metro: 'us-ma-boston', game: 'Fallout 4', lat: 42.2, lng: -71.19, approximate: true,
    lore: 'At the edge of the Glowing Sea. A rehabilitation vault for addicts, with a hidden stash to see what would happen when it was found.',
    story: [
      'Vault 95 was a rehabilitation program for chem addicts, sealed for five years of treatment.',
      'When the five years ended, a Vault-Tec agent posing as a resident was to open a hidden stash of drugs and record how the community reacted; the revelation broke the bonds between residents, some giving in at once and others clinging to the program.',
      'Those who worked out it had been planned wrote furious logs about being deceived. Gunners took the vault from the people who were left.',
    ],
  },
  // ---- Fallout 3: the Capital Wasteland (Washington, D.C.)
  {
    number: 101, metro: 'us-dc-washington', game: 'Fallout 3', lat: 38.84, lng: -77.3, approximate: true,
    lore: 'Northwest of Megaton. The door closed in the Great War and, the Overseer swore, never opened. Someone left anyway, looking for their father.',
    story: [
      'Vault 101 was a social experiment in a door that would never open: a closed community, with a planted Overseer, to see how it behaves.',
      'Each Overseer groomed the next and played recorded broadcasts of a hopeless wasteland over the radio, until a whole generation was in on the secret and kept it from its own children.',
      'The experiment only truly began when a young resident ran out through the door, and the vault split between those who wanted it open and those who would die to keep it shut.',
    ],
  },
  {
    number: 87, metro: 'us-dc-washington', game: 'Fallout 3', lat: 38.93, lng: -77.42, approximate: true,
    lore: 'Northwest of Little Lamplight. Built to study the Forced Evolutionary Virus on people; its residents became super mutants.',
    story: [
      'Vault 87 was built for the Forced Evolutionary Virus program: the Overseer and the guards knew from the beginning that the residents were test subjects.',
      'The residents were exposed to the virus and, from 2078, turned into super mutants who broke out and overran their keepers.',
      'For two hundred years they carried off people to change, until their supply ran low, and they have been looking for the "green stuff" ever since.',
    ],
  },
  {
    number: 92, metro: 'us-dc-washington', game: 'Fallout 3', lat: 39.2, lng: -77.16, approximate: true,
    lore: 'Northwest of Old Olney. A vault of musicians used to test white-noise mind control, which drove them to murder.',
    story: [
      'Vault 92 was built for two hundred and forty-five musicians under cover of preserving musical talent.',
      'In truth the Overseer was running a white-noise experiment, broadcasting ultra-low-frequency noise through the studios and homes to plant combat suggestions in the residents\' heads.',
      'It broke minds, set the dwellers on each other, and ended with a flooded vault full of bodies and weapons.',
    ],
  },
  {
    number: 106, metro: 'us-dc-washington', game: 'Fallout 3', lat: 38.77, lng: -77.1, approximate: true,
    lore: 'Southeast of Arefu. Psychoactive drugs were released into its air from the tenth day; the survivors are still hallucinating.',
    story: [
      'Ten days after Vault 106 was sealed, its Overseer began releasing psychoactive drugs through the air filters, and ordered the guards to say all was well.',
      'The vault went mad, and is still full of the insane survivors of it, breathing the same drugs two centuries later.',
      'Some tried to blast their way out. A cave at the end of the vault holds a mini-nuke and the skeletons of the people who did.',
    ],
  },
  {
    number: 108, metro: 'us-dc-washington', game: 'Fallout 3', lat: 38.82, lng: -77.21, approximate: true,
    lore: 'South of Canterbury Commons. A vault run on leadership conflict, where the scientists cloned a man named Gary until nobody could stand him.',
    story: [
      'Vault 108 was built for four hundred and seventy-five people for thirty-eight years, with every position left for the Overseer to assign personally, triple the usual defenses, and no entertainment of any kind.',
      'Its scientists also cloned a resident named Gary, and every copy came out more violent than the last, until the staff were destroying them for room.',
      'When anyone came, the leaders were dead, and only the Garys and what had mutated around them were left.',
    ],
  },
  {
    number: 112, metro: 'us-dc-washington', game: 'Fallout 3', lat: 38.7, lng: -77.38, approximate: true,
    lore: 'West of Evergreen Mills. Its residents sleep in pods, living a simulated life, and their keeper has been playing with them for two hundred years.',
    story: [
      'Vault 112 held eighty-five residents, not living but sleeping: asleep in pods with their minds in a virtual neighborhood, a perfect suburb, at the pleasure of a doctor.',
      'The Overseer is the neighborhood\'s only true resident, and the one who runs it.',
      'The sleepers are still in their pods, tended by robots, and they are among the few residents of any vault who are still the original ones.',
    ],
  },
  // ---- Fallout: New Vegas: the Mojave (Las Vegas)
  {
    number: 21, metro: 'us-nv-las-vegas', game: 'Fallout: New Vegas', lat: 36.1147, lng: -115.1728, approximate: false,
    lore: 'On the Strip, where it is a hotel now. A vault that settled every argument by gambling, and still does, for caps.',
    story: [
      'Vault 21 was a vault that settled every dispute by chance, on the theory that a community living by the luck of the draw would be an equal one.',
      'When a rich man offered its residents a place in the revival of Vegas, the side in favor won a very long game of blackjack, and he sealed the lower levels with concrete.',
      'Its upper floors are a hotel and gift shop now, run by one of the old residents, and many of the others went to live in the town outside.',
    ],
  },
  {
    number: 19, metro: 'us-nv-las-vegas', game: 'Fallout: New Vegas', lat: 36.046, lng: -115.395, approximate: false,
    lore: 'The Blue Diamond Mine. A social experiment that split the residents into Reds and Blues and let them go to war. Nobody calls it a success.',
    story: [
      'Vault 19 was a test of paranoia without violence or drugs: the residents were split into red and blue halves and kept apart.',
      'Sulfur from the caves beneath the vault leaked into the vents, and the residents, blaming each other for the draughts and noises, grew paranoid exactly as planned, while the real culprits were the Overseers acting on orders.',
      'The vault was left to itself, until escaped convicts found it and moved in, and fire geckos and nightstalkers took the lower levels.',
    ],
  },
  {
    number: 34, metro: 'us-nv-las-vegas', game: 'Fallout: New Vegas', lat: 36.152, lng: -115.032, approximate: false,
    lore: 'The Frenchman Mine, by Nellis. Stocked with weapons and short on water, until the radiation leaked and its people became ghouls.',
    story: [
      'Vault 34 was a test of overcrowding with an open armory: too many people, too little room (the pool took the space), and every one of them armed.',
      'The Overseer locked the armory when the fighting began; one faction walked out and became the Boomers of Nellis, and the rest stormed the armory, breaking the reactor.',
      'The radiation sealed the main door on the survivors, who became feral ghouls.',
    ],
  },
  {
    number: 3, metro: 'us-nv-las-vegas', game: 'Fallout: New Vegas', lat: 36.075, lng: -115.215, approximate: true,
    lore: 'South Vegas, west of the airport. A control vault with no experiment, taken by the Fiends after a flood.',
    story: [
      'Vault 3 was one of the control vaults: no experiment at all, just a community living in an orderly, democratic way for generations.',
      'A leak flooded the lower levels in the twenty-third century and drove the residents up to the surface, where they traded until the Fiends noticed them.',
      'The Fiends conned their way inside, killed the residents, and made the vault a fort and a drug den.',
    ],
  },
  {
    number: 11, metro: 'us-nv-las-vegas', game: 'Fallout: New Vegas', lat: 35.84, lng: -115.0, approximate: true,
    lore: 'West of Boulder City. Every year the residents had to choose one of their own to die, and the vault ate itself arguing over who.',
    story: [
      'Vault 11 asked its residents for one life a year: a person chosen to die, or the computer would shut off the life support.',
      'Voting became a market of bribes, bloc deals and smuggling, and when the overseer swapped the vote for a lottery the violence began.',
      'Five people survived, and they discovered that refusing the sacrifice was all it took to open the door. The vault is empty now.',
    ],
  },
  {
    number: 22, metro: 'us-nv-las-vegas', game: 'Fallout: New Vegas', lat: 36.19, lng: -115.47, approximate: true,
    lore: 'West of Las Vegas, east of Jacobstown. A garden vault where a fungus escaped and turned the residents into spore carriers.',
    story: [
      'Vault 22 was a green vault: its scientists worked to improve crops and fight hunger, and after the war they meant to feed everyone from the vault\'s own plants.',
      'A fungus bred to kill pests went airborne and turned the residents into spore carriers, who rose again after they died.',
      'The scientists tried to gas them, which only made them attack, and the vault was left to the plants.',
    ],
  },
];

/**
 * Every vault number the games use, with or without a place on the real map. None of these is given to an invented vault, so a canon number always means its
 * own vault (the ones on the map are above; the others have no place on this map but keep their numbers).
 */
export const RESERVED_VAULT_NUMBERS: number[] = [
  0, 1, 2, 3, 4, 7, 8, 11, 12, 13, 15, 17, 19, 21, 22, 24, 29, 31, 32, 33, 34, 43, 44, 51, 63, 69, 75, 76, 77, 79, 81, 84, 87, 88, 92, 94, 95, 96, 101, 106, 108, 109, 111, 112, 114, 117, 118, 119, 122,
];
