import { describe, expect, it } from 'vitest';
import { hasFee, parseFeeBoard } from './coins';

describe('parseFeeBoard', () => {
  it('maps rows by case id', () => {
    const board = parseFeeBoard([
      { case_id: 'a', prosecution_fee: 95, defense_fee: 80, repeat_win: false },
      { case_id: 'b', prosecution_fee: 24, defense_fee: 20, repeat_win: true }
    ]);
    expect(board.a).toEqual({ prosecution: 95, defense: 80, repeat: false });
    expect(board.b.repeat).toBe(true);
  });

  it('skips malformed rows and survives a missing result', () => {
    expect(parseFeeBoard(null)).toEqual({});
    expect(parseFeeBoard([{ prosecution_fee: 5 }, null])).toEqual({});
  });

  it('treats nulls and negatives as no fee', () => {
    const board = parseFeeBoard([{ case_id: 'a', prosecution_fee: null, defense_fee: -5, repeat_win: null }]);
    expect(board.a).toEqual({ prosecution: 0, defense: 0, repeat: false });
    expect(hasFee(board.a)).toBe(false);
  });
});

describe('hasFee', () => {
  it('is true when either side pays', () => {
    expect(hasFee({ prosecution: 0, defense: 40, repeat: false })).toBe(true);
    expect(hasFee(undefined)).toBe(false);
  });
});
