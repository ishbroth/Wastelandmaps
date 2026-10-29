// Vaults that exist in the games' stories, put where they stand in the game relative to the real map. The games compress and bend geography, so
// these are placed from where each vault sits next to places that DO have a real counterpart (Vault 81 is due west of the Fens, which is
// Fenway; Vault 19 and Vault 34 are the Blue Diamond and Frenchman mines, by the Fallout wiki's real-world list). `approximate` marks the ones
// placed from the game's relative position only. When a vault lines up with a place already on the map, that place becomes its entrance
// (and keeps its snapshot); when it does not, the vault is shown on its own with a line of lore and no snapshot.

export interface LoreVault {
  number: number;
  game: string;
  lat: number;
  lng: number;
  /** What the story says about it, in a line. */
  lore: string;
  approximate: boolean;
}

export const LORE_VAULTS: LoreVault[] = [
  // Fallout: the Necropolis ghouls' vault, under Bakersfield
  { number: 12, game: 'Fallout', lat: 35.3733, lng: -119.0187, approximate: true, lore: 'Beneath Necropolis. Sold as a well-equipped shelter, it was built to study radiation on its people, and its door was made never to close. Its people became ghouls.' },
  // Fallout 4: the Commonwealth (Boston)
  { number: 111, game: 'Fallout 4', lat: 42.47, lng: -71.37, approximate: true, lore: 'Overlooking Sanctuary Hills. Its people were told it was a shelter and were frozen instead: a Vault-Tec experiment in cryogenics. One of them walked out, two hundred years later.' },
  { number: 81, game: 'Fallout 4', lat: 42.346, lng: -71.17, approximate: true, lore: 'West of the Fens. Built to test a universal cure; the Overseer sabotaged the experiments, and the research wing went to the mole rats.' },
  // Fallout 3: the Capital Wasteland (Washington, D.C.)
  { number: 101, game: 'Fallout 3', lat: 38.84, lng: -77.3, approximate: true, lore: 'Northwest of Megaton. The door closed in the Great War and, the Overseer swore, never opened. Someone left anyway, looking for their father.' },
  // Fallout: New Vegas: the Mojave (Las Vegas)
  { number: 21, game: 'Fallout: New Vegas', lat: 36.1147, lng: -115.1728, approximate: false, lore: 'On the Strip, where it is a hotel now. A vault that settled every argument by gambling, and still does, for caps.' },
  { number: 19, game: 'Fallout: New Vegas', lat: 36.046, lng: -115.395, approximate: false, lore: 'The Blue Diamond Mine. A social experiment that split the residents into Reds and Blues and let them go to war. Nobody calls it a success.' },
  { number: 34, game: 'Fallout: New Vegas', lat: 36.152, lng: -115.032, approximate: false, lore: 'The Frenchman Mine, by Nellis. Stocked with weapons and short on water, until the radiation leaked and its people became ghouls.' },
];
