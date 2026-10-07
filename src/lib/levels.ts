/** Rank ladder. A player's rank depends only on how many cases they have won. */
export const LEVELS = [
  { level: 1, wins: 0, title: 'Junior Counsel' },
  { level: 2, wins: 5, title: 'Associate Attorney' },
  { level: 3, wins: 15, title: 'Trial Lawyer' },
  { level: 4, wins: 30, title: 'Senior Attorney' },
  { level: 5, wins: 50, title: 'Trial Counsel' },
  { level: 6, wins: 75, title: 'Senior Advocate' },
  { level: 7, wins: 110, title: 'Lead Attorney' },
  { level: 8, wins: 150, title: 'Principal Counsel' },
  { level: 9, wins: 200, title: 'Master Advocate' },
  { level: 10, wins: 300, title: 'Legendary Attorney' }
];

export const STARTING_RANK = LEVELS[0].title;

export function getLevelForWins(wins: number): { level: number; title: string } {
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (wins >= LEVELS[i].wins) {
      return { level: LEVELS[i].level, title: LEVELS[i].title };
    }
  }
  return { level: LEVELS[0].level, title: LEVELS[0].title };
}

/** The next rank up, or null at the top. */
export function getNextLevel(currentWins: number): { winsNeeded: number; nextTitle: string } | null {
  for (const levelData of LEVELS) {
    if (currentWins < levelData.wins) {
      return {
        winsNeeded: levelData.wins - currentWins,
        nextTitle: levelData.title
      };
    }
  }
  return null;
}

/** 0 to 1: how far through the current rank toward the next one. 1 at the top rank. */
export function getRankProgress(wins: number): number {
  const current = getLevelForWins(wins);
  const next = LEVELS.find(l => l.level === current.level + 1);
  if (!next) return 1;
  const start = LEVELS[current.level - 1].wins;
  return Math.min(1, Math.max(0, (wins - start) / (next.wins - start)));
}
