import { describe, expect, it } from 'vitest';
import { aiRank, castAvatars } from './stageCast';
import { JUDGE_AVATARS, randomAvatar } from './avatars';

const me = randomAvatar('me');
const base = { judgeName: 'Justice Sarah Williams', prosecutorName: 'DA Harrison', myAvatar: me, sessionId: 's1' };

describe('castAvatars', () => {
  it('puts the player in their own seat and AI counsel opposite', () => {
    const asDefense = castAvatars({ ...base, playerRole: 'defense' });
    expect(asDefense.defense).toEqual(me);
    expect(asDefense.prosecution).not.toEqual(me);
    const asProsecution = castAvatars({ ...base, playerRole: 'prosecution' });
    expect(asProsecution.prosecution).toEqual(me);
  });

  it('is stable: pre-trial and trial always get the same faces', () => {
    expect(castAvatars({ ...base, playerRole: 'defense' })).toEqual(castAvatars({ ...base, playerRole: 'defense' }));
  });

  it('gives the judge one of the ready-made judges, same name same judge', () => {
    const a = castAvatars({ ...base, playerRole: 'defense' }).judge;
    expect(JUDGE_AVATARS).toContainEqual(a);
    expect(castAvatars({ ...base, playerRole: 'prosecution' }).judge).toEqual(a);
  });

  it('prefers a real opponent\'s own avatar', () => {
    const rival = randomAvatar('rival');
    expect(castAvatars({ ...base, playerRole: 'defense', opponentAvatar: rival }).prosecution).toEqual(rival);
    expect(castAvatars({ ...base, playerRole: 'prosecution', opponentAvatar: rival }).defense).toEqual(rival);
  });
});

describe('aiRank', () => {
  it('stays between 3 and 7 and is steady per name', () => {
    for (const n of ['a', 'DA Harrison', 'Defense Counsel', 'x'.repeat(40)]) {
      const r = aiRank(n);
      expect(r).toBeGreaterThanOrEqual(3);
      expect(r).toBeLessThanOrEqual(7);
      expect(aiRank(n)).toBe(r);
    }
  });
});
