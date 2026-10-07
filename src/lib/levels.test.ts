import { describe, expect, it } from 'vitest';
import { LEVELS, getLevelForWins, getNextLevel, getRankProgress } from './levels';

describe('rank ladder', () => {
  it('has the ten ranks at the agreed win counts', () => {
    expect(LEVELS.map(l => [l.title, l.wins])).toEqual([
      ['Junior Counsel', 0],
      ['Associate Attorney', 5],
      ['Trial Lawyer', 15],
      ['Senior Attorney', 30],
      ['Trial Counsel', 50],
      ['Senior Advocate', 75],
      ['Lead Attorney', 110],
      ['Principal Counsel', 150],
      ['Master Advocate', 200],
      ['Legendary Attorney', 300]
    ]);
  });

  it('starts everyone as Junior Counsel', () => {
    expect(getLevelForWins(0)).toEqual({ level: 1, title: 'Junior Counsel' });
    expect(getLevelForWins(4).title).toBe('Junior Counsel');
  });

  it('promotes exactly at each threshold', () => {
    for (const l of LEVELS) {
      expect(getLevelForWins(l.wins).title).toBe(l.title);
      if (l.wins > 0) expect(getLevelForWins(l.wins - 1).level).toBe(l.level - 1);
    }
    expect(getLevelForWins(5000).title).toBe('Legendary Attorney');
  });

  it('says what is next', () => {
    expect(getNextLevel(0)).toEqual({ winsNeeded: 5, nextTitle: 'Associate Attorney' });
    expect(getNextLevel(14)).toEqual({ winsNeeded: 1, nextTitle: 'Trial Lawyer' });
    expect(getNextLevel(300)).toBeNull();
  });

  it('reports progress through the current rank', () => {
    expect(getRankProgress(0)).toBe(0);
    expect(getRankProgress(10)).toBeCloseTo(0.5);
    expect(getRankProgress(300)).toBe(1);
  });
});
