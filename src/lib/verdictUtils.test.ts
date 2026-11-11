import { describe, expect, it } from 'vitest';
import { playerCaseScore } from './verdictUtils';

describe('playerCaseScore', () => {
  it('is the score itself for the prosecution (the AI rates the prosecution\'s case)', () => {
    expect(playerCaseScore(82, 'prosecution')).toBe(82);
    expect(playerCaseScore(0, 'prosecution')).toBe(0);
  });

  it('is 100 minus the score for the defense, so a Not Guilty win reads high', () => {
    expect(playerCaseScore(25, 'defense')).toBe(75);
    expect(playerCaseScore(100, 'defense')).toBe(0);
    expect(playerCaseScore(0, 'defense')).toBe(100);
  });

  it('keeps the result within 0-100 and rounds', () => {
    expect(playerCaseScore(140, 'prosecution')).toBe(100);
    expect(playerCaseScore(-20, 'defense')).toBe(100);
    expect(playerCaseScore(33.4, 'defense')).toBe(67);
  });

  it('gives nothing when there is no usable score', () => {
    expect(playerCaseScore(undefined, 'defense')).toBeNull();
    expect(playerCaseScore(null, 'prosecution')).toBeNull();
    expect(playerCaseScore(NaN, 'defense')).toBeNull();
  });
});
