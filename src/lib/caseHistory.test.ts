import { describe, it, expect } from 'vitest';
import { buildHistory, filterHistory } from './caseHistory';

const verdict = (outcome: string, at = '2026-10-20T10:00:00Z') => ({ id: 'v' + outcome + at, session_id: 's', outcome, reasoning: 'r', evidence_cited: [], delivered_at: at });
const row = (over: Record<string, any> = {}): any => ({
  id: 's1', user_id: 'me', case_id: 'c1', session_state: { playerRole: 'defense' }, completed_at: '2026-10-20T10:05:00Z', updated_at: '2026-10-20T10:05:00Z',
  cases: { title: 'The Missing Package', difficulty: 'easy' }, verdicts: [verdict('win')], ...over
});

describe('case history', () => {
  it('works out win or loss from the verdict and the side the player took', () => {
    const entries = buildHistory([
      row({ id: 'a', verdicts: [verdict('win')], session_state: { playerRole: 'defense' } }),       // guilty vs defense = lost
      row({ id: 'b', verdicts: [verdict('lose')], session_state: { playerRole: 'defense' } }),      // not guilty vs defense = won
      row({ id: 'c', verdicts: [verdict('win')], session_state: { playerRole: 'prosecution' } })    // guilty vs prosecution = won
    ], 'me');
    expect(Object.fromEntries(entries.map(e => [e.sessionId, e.won]))).toEqual({ a: false, b: true, c: true });
    expect(entries.find(e => e.sessionId === 'a')?.verdictWord).toBe('Guilty');
  });

  it('marks lost games with appeals left, no verdict accepted and none in progress as appealable', () => {
    const lostAI = row({ id: 'a' });
    const won = row({ id: 'b', verdicts: [verdict('lose')] });
    const lostOnline = row({ id: 'c', session_state: { playerRole: 'defense', isMultiplayer: true, defenseUserId: 'me', prosecutionUserId: 'them' } });
    const accepted = row({ id: 'd', session_state: { playerRole: 'defense', verdictAccepted: true } });
    const spent = row({ id: 'e', session_state: { playerRole: 'defense', appeals: [{ status: 'denied' }, { status: 'denied' }] } });
    const pending = row({ id: 'f', session_state: { playerRole: 'defense', appeals: [{ status: 'awaiting_ruling' }] } });
    const m = Object.fromEntries(buildHistory([lostAI, won, lostOnline, accepted, spent, pending], 'me').map(e => [e.sessionId, e.appealable]));
    expect(m).toEqual({ a: true, b: false, c: true, d: false, e: false, f: false });
  });

  it('describes appeals on a game', () => {
    const e = Object.fromEntries(buildHistory([
      row({ id: 'p', session_state: { playerRole: 'defense', appeals: [{ status: 'awaiting_response' }] } }),
      row({ id: 'u', session_state: { playerRole: 'defense', appeals: [{ status: 'denied' }, { status: 'denied' }] } }),
      row({ id: 'w', verdicts: [verdict('lose')], session_state: { playerRole: 'defense', appealRound: 1, appeals: [{ status: 'granted', reopened: true }] } })
    ], 'me').map(x => [x.sessionId, x.appealNote]));
    expect(e).toEqual({ p: 'Appeal in progress', u: '2 appeals used', w: '1 appeal used' });
  });

  it('uses the latest verdict, skips games with none, and lists newest first', () => {
    const entries = buildHistory([
      row({ id: 'old', completed_at: '2026-10-01T00:00:00Z' }),
      row({ id: 'none', verdicts: [] }),
      row({ id: 'new', completed_at: '2026-10-25T00:00:00Z', verdicts: [verdict('win', '2026-10-24T00:00:00Z'), verdict('lose', '2026-10-25T00:00:00Z')] })
    ], 'me');
    expect(entries.map(e => e.sessionId)).toEqual(['new', 'old']);
    expect(entries[0].verdict.outcome).toBe('lose');
  });

  it('filters', () => {
    const entries = buildHistory([row({ id: 'a' }), row({ id: 'b', verdicts: [verdict('lose')] })], 'me');
    expect(filterHistory(entries, 'won').map(e => e.sessionId)).toEqual(['b']);
    expect(filterHistory(entries, 'lost').map(e => e.sessionId)).toEqual(['a']);
    expect(filterHistory(entries, 'all')).toHaveLength(2);
  });
});
