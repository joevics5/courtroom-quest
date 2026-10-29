import { describe, it, expect } from 'vitest';
import { shouldFreezeForAbsentOpponent, shouldFreezeWhileHidden } from './presence';

const base = { onlineTwoPlayer: true, opponentOnline: false as boolean | null, currentTurn: 'prosecution', playerRole: 'defense' };

describe('shouldFreezeForAbsentOpponent', () => {
  it('freezes when it is the absent opponent\'s turn', () => expect(shouldFreezeForAbsentOpponent(base)).toBe(true));
  it('keeps running on my own turn', () => expect(shouldFreezeForAbsentOpponent({ ...base, currentTurn: 'defense' })).toBe(false));
  it('keeps running when the opponent is online or unknown', () => {
    expect(shouldFreezeForAbsentOpponent({ ...base, opponentOnline: true })).toBe(false);
    expect(shouldFreezeForAbsentOpponent({ ...base, opponentOnline: null })).toBe(false);
  });
  it('never freezes outside online two-player games or with no turn', () => {
    expect(shouldFreezeForAbsentOpponent({ ...base, onlineTwoPlayer: false })).toBe(false);
    expect(shouldFreezeForAbsentOpponent({ ...base, currentTurn: null })).toBe(false);
  });
});

describe('shouldFreezeWhileHidden', () => {
  it('only in online two-player games', () => {
    expect(shouldFreezeWhileHidden(true, true)).toBe(true);
    expect(shouldFreezeWhileHidden(true, false)).toBe(false);
    expect(shouldFreezeWhileHidden(false, true)).toBe(false);
  });
});
