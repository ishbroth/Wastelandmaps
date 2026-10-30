// The things that live in the ruins now. All of them are from the games. Raiders are the weakest and deathclaws the toughest; health is what decides
// how many of them a place has (see raid.ts): a place of the same worth has many raiders or few deathclaws.

export type EnemyId = 'raider' | 'ghoul' | 'radroach' | 'molerat' | 'bloatfly' | 'radscorpion' | 'mirelurk' | 'supermutant' | 'robot' | 'deathclaw';
export type BossId = 'gangrenousghoul' | 'glowingbloatfly' | 'mirelurkqueen' | 'behemoth';

export interface EnemyType {
  id: EnemyId | BossId;
  name: string;
  plural: string;
  hp: number;
  /** Screen widths a second it crosses (of the picture's width). */
  speed: number;
  /** Health taken from the survivor each time it reaches them. */
  bite: number;
  /** Seconds between its attacks once it is close. */
  every: number;
  /** How big it is on screen next to a person at the same distance (1 = a man). */
  size: number;
  flying?: boolean;
  /** Fires from a distance rather than closing in. */
  ranged?: boolean;
  /** What the journal says about them living in the place. */
  now: string;
}

export const ENEMIES: Record<EnemyId, EnemyType> = {
  raider: { id: 'raider', name: 'Raider', plural: 'raiders', hp: 30, speed: 0.05, bite: 6, every: 1.6, size: 1, ranged: true, now: 'A raider gang has made a fort of it, with scrap armor, pipe guns and bad tempers.' },
  bloatfly: { id: 'bloatfly', name: 'Bloatfly', plural: 'bloatflies', hp: 35, speed: 0.11, bite: 4, every: 1.2, size: 0.45, flying: true, now: 'Bloatflies drift in clouds through the broken glass, spitting at anything that moves.' },
  radroach: { id: 'radroach', name: 'Radroach', plural: 'radroaches', hp: 40, speed: 0.09, bite: 5, every: 1, size: 0.6, now: 'Radroaches pour out of the walls the moment anyone steps inside.' },
  molerat: { id: 'molerat', name: 'Mole Rat', plural: 'mole rats', hp: 45, speed: 0.08, bite: 6, every: 1.1, size: 0.7, now: 'Mole rats have undermined the foundations and come up through the floor.' },
  ghoul: { id: 'ghoul', name: 'Feral Ghoul', plural: 'feral ghouls', hp: 60, speed: 0.07, bite: 8, every: 1.2, size: 1, now: 'Feral ghouls shamble through the ruins, as many as the radiation ever made.' },
  robot: { id: 'robot', name: 'Robot', plural: 'robots', hp: 100, speed: 0.05, bite: 10, every: 1.4, size: 1.2, ranged: true, now: 'Old Protectrons and Mr. Gutsys still patrol it, running orders nobody remembers giving.' },
  radscorpion: { id: 'radscorpion', name: 'Radscorpion', plural: 'radscorpions', hp: 120, speed: 0.07, bite: 14, every: 1.3, size: 1.3, now: 'Radscorpions have dug nests in the rubble, and they are not sharing.' },
  mirelurk: { id: 'mirelurk', name: 'Mirelurk', plural: 'mirelurks', hp: 160, speed: 0.055, bite: 16, every: 1.5, size: 1.4, now: 'Mirelurks crawl up out of the water and nest among the fallen stones.' },
  supermutant: { id: 'supermutant', name: 'Super Mutant', plural: 'super mutants', hp: 220, speed: 0.055, bite: 20, every: 1.5, size: 1.7, now: 'Super mutants have claimed the place as a stronghold and ask nothing of visitors but their lives.' },
  deathclaw: { id: 'deathclaw', name: 'Deathclaw', plural: 'deathclaws', hp: 400, speed: 0.09, bite: 34, every: 1.3, size: 2.1, now: 'A deathclaw has nested here. Everything else left a long time ago.' },
};

export const BOSSES: Record<BossId, EnemyType> = {
  gangrenousghoul: { id: 'gangrenousghoul', name: 'Gangrenous Ghoul', plural: 'gangrenous ghouls', hp: 600, speed: 0.05, bite: 24, every: 1.4, size: 2, now: 'Something worse than a feral ghoul rules it: a gangrenous ghoul, bloated and rotting and still on its feet.' },
  glowingbloatfly: { id: 'glowingbloatfly', name: 'Glowing Bloatfly', plural: 'glowing bloatflies', hp: 500, speed: 0.08, bite: 14, every: 1.1, size: 1.4, flying: true, now: 'A glowing bloatfly the size of a car hangs over it, lit from inside and shedding radiation like rain.' },
  mirelurkqueen: { id: 'mirelurkqueen', name: 'Mirelurk Queen', plural: 'mirelurk queens', hp: 900, speed: 0.04, bite: 38, every: 1.8, size: 3, now: 'A mirelurk queen has taken it over and spits acid at anything that comes near her brood.' },
  behemoth: { id: 'behemoth', name: 'Behemoth', plural: 'behemoths', hp: 1400, speed: 0.04, bite: 50, every: 2, size: 3.4, now: 'A behemoth stands in the middle of it, a super mutant three stories tall, tearing up lampposts to throw.' },
};

export const ENEMY_IDS = Object.keys(ENEMIES) as EnemyId[];
export const BOSS_IDS = Object.keys(BOSSES) as BossId[];
export const enemyById = (id: EnemyId | BossId): EnemyType => (ENEMIES as Record<string, EnemyType>)[id] ?? (BOSSES as Record<string, EnemyType>)[id];
