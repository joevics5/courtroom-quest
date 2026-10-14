import { describe, expect, it } from 'vitest';
import { boardSessions, countMyGames, countWaitingSent } from './gameCounts';

const preset = (id: string, case_id = 'c1') => ({ id, case_id, cases: { is_preset: true } });
const custom = (id: string, case_id = 'mine') => ({ id, case_id, cases: { is_preset: false } });

describe('game counts', () => {
  it('skips custom-case games, which the Case Board does not list', () => {
    const ongoing = [preset('a'), preset('b'), custom('x'), custom('y')];
    expect(boardSessions(ongoing)).toHaveLength(2);
  });

  it('still counts several games of the same case', () => {
    expect(boardSessions([preset('a', 'c1'), preset('b', 'c1')])).toHaveLength(2);
  });

  it('ignores games whose case is missing', () => {
    expect(boardSessions([{ case_id: 'gone', cases: null }, { case_id: 'gone2' }])).toHaveLength(0);
  });

  it('can filter by the loaded preset ids instead', () => {
    const rows = [{ case_id: 'c1' }, { case_id: 'zzz' }];
    expect(boardSessions(rows, new Set(['c1']))).toHaveLength(1);
  });

  it('counts only my open challenges and pending invites', () => {
    const challenges = [
      { status: 'open', creator_user_id: 'me' },
      { status: 'open', creator_user_id: 'them' },
      { status: 'accepted', creator_user_id: 'me' }
    ];
    const invitations = [
      { status: 'pending', inviter_user_id: 'me' },
      { status: 'declined', inviter_user_id: 'me' },
      { status: 'pending', inviter_user_id: 'them' }
    ];
    expect(countWaitingSent('me', challenges, invitations)).toBe(2);
  });

  it('My games = board games + waiting, matching the Case Board tab', () => {
    const r = countMyGames({
      userId: 'me',
      ongoing: [preset('a'), preset('b'), custom('x'), custom('y')],
      challenges: [{ status: 'open', creator_user_id: 'me' }],
      invitations: []
    });
    expect(r).toEqual({ ongoing: 2, waitingSent: 1, myGames: 3 });
  });
});
