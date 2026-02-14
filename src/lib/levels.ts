export const LEVELS = [
  { level: 1, wins: 1, title: 'Practicing Attorney' },
  { level: 2, wins: 3, title: 'Junior Advocate' },
  { level: 3, wins: 5, title: 'Courtroom Attorney' },
  { level: 4, wins: 10, title: 'Associate Counsel' },
  { level: 5, wins: 20, title: 'Senior Counsel' },
  { level: 6, wins: 30, title: 'Trial Specialist' },
  { level: 7, wins: 50, title: 'Master Litigator' },
  { level: 8, wins: 75, title: 'Distinguished Counsel' },
  { level: 9, wins: 100, title: 'Supreme Advocate' },
  { level: 10, wins: 150, title: 'Legend of the Bar' },
];

export function getLevelForWins(wins: number): { level: number; title: string } {
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (wins >= LEVELS[i].wins) {
      return { level: LEVELS[i].level, title: LEVELS[i].title };
    }
  }
  return { level: 0, title: 'Novice' };
}

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
