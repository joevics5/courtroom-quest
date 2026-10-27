import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Appeal } from './appeals';

let session: any;
const rpc = vi.fn();
const genRuling = vi.fn();

vi.mock('./supabase', () => ({ supabase: { rpc: (...a: unknown[]) => rpc(...a) } }));
vi.mock('./database', () => ({
  db: {
    sessions: {
      getSession: vi.fn(async () => structuredClone(session)),
      updateSession: vi.fn(async (_id: string, updates: any) => { session = { ...session, ...updates }; return structuredClone(session); })
    },
    evidence: { getCaseEvidence: vi.fn(async () => [{ id: 'e1', title: 'Route sheet' }]) },
    witnesses: { getCaseWitnesses: vi.fn(async () => [{ id: 'w1', name: 'Bill', role: 'Supervisor' }]) },
    cases: { getCaseWithDetails: vi.fn(async () => ({ title: 'The Missing Package', description: 'A theft.' })) },
    trialEvents: { getSessionEvents: vi.fn(async () => []) }
  }
}));
vi.mock('./ai/appealAI', () => ({
  generateAppealRuling: (a: unknown) => genRuling(a)
}));

import { submitAppeal, respondToAppeal, advanceAppeal, acceptVerdict, reopenCase, appealsSupported } from './appealFlow';
import { getAppeals } from './appeals';

const text = 'Bill knew the clerk swapped the digits, but nobody asked him about the route sheet.';
const verdict: any = { id: 'v', session_id: 's1', outcome: 'win', reasoning: 'r', evidence_cited: [], delivered_at: '' };

beforeEach(() => {
  session = { id: 's1', user_id: 'u1', case_id: 'c1', session_state: { playerRole: 'defense', prosecutorName: 'District Attorney Robert Klein (White Collar Crimes)' } };
  rpc.mockReset(); genRuling.mockReset();
  rpc.mockResolvedValue({ error: null });
});

const defense = { role: 'defense' as const, userId: 'u1' };

describe('appealsSupported', () => {
  it('works in every kind of game', () => {
    expect(appealsSupported({ playerRole: 'defense' })).toBe(true);
    expect(appealsSupported({ isMultiplayer: true })).toBe(true);
    expect(appealsSupported({ sameDevicePlay: true })).toBe(true);
    expect(appealsSupported(null)).toBe(false);
  });
});

describe('submitting', () => {
  it('saves the appeal without touching the rest of the session state', async () => {
    const a = await submitAppeal('s1', 'c1', { reason: 'missed_witness', explanation: text, evidence_ids: [], witness_ids: ['w1', 'ghost'] }, defense);
    expect(a.status).toBe('awaiting_response');
    expect(a.by_user_id).toBe('u1');
    expect(a.witness_ids).toEqual(['w1']);
    expect(session.session_state.playerRole).toBe('defense');
    expect(getAppeals(session.session_state)).toHaveLength(1);
    expect(session.session_state.appealAwaiting).toBeNull(); // vs the AI: nobody to notify
  });

  it('marks an online game as waiting for the other player, so it shows on their dashboard', async () => {
    session.session_state = { isMultiplayer: true, prosecutionUserId: 'pros', defenseUserId: 'u1' };
    await submitAppeal('s1', 'c1', { reason: 'other', explanation: text, evidence_ids: [], witness_ids: [] }, defense);
    expect(session.session_state.appealAwaiting).toBe('pros');
  });

  it('continues numbering rather than restarting', async () => {
    session.session_state.appeals = [{ id: 'a1', number: 1, status: 'denied' }, { id: 'a2', number: 2, status: 'denied' }];
    const a = await submitAppeal('s1', 'c1', { reason: 'other', explanation: text, evidence_ids: [], witness_ids: [] }, defense);
    expect(a.number).toBe(3);
  });
});

describe('against the AI', () => {
  it('opposing counsel always accepts, then the judge rules, each saved as it finishes', async () => {
    await submitAppeal('s1', 'c1', { reason: 'missed_evidence', explanation: text, evidence_ids: ['e1'], witness_ids: [] }, defense);
    genRuling.mockResolvedValue({ granted: true, reasoning: 'The sheet was never used.', created_at: '' });
    const steps: string[] = [];
    await advanceAppeal({ sessionId: 's1', caseId: 'c1', playerRole: 'defense', verdict, onStep: a => steps.push(a.status) });
    expect(steps).toEqual(['awaiting_ruling', 'granted']);
    const a = getAppeals(session.session_state)[0];
    expect(a.response?.decision).toBe('accept');
    expect(a.response?.by).toBe('ai');
    expect(a.response?.explanation).toContain('District Attorney Robert Klein'); // no division in the name
    expect(genRuling.mock.calls[0][0].appeal.response.decision).toBe('accept');
  });

  it('carries on from where it stopped', async () => {
    await submitAppeal('s1', 'c1', { reason: 'other', explanation: text, evidence_ids: [], witness_ids: [] }, defense);
    genRuling.mockRejectedValueOnce(new Error('The judge could not rule yet.'));
    await expect(advanceAppeal({ sessionId: 's1', caseId: 'c1', playerRole: 'defense', verdict })).rejects.toThrow(/could not rule/);
    expect(getAppeals(session.session_state)[0].status).toBe('awaiting_ruling');
    genRuling.mockResolvedValue({ granted: false, reasoning: 'Only disagrees.', created_at: '' });
    await advanceAppeal({ sessionId: 's1', caseId: 'c1', playerRole: 'defense', verdict });
    expect(getAppeals(session.session_state)[0].status).toBe('denied');
  });

  it('does nothing when no appeal is waiting', async () => {
    await advanceAppeal({ sessionId: 's1', caseId: 'c1', playerRole: 'defense', verdict });
    expect(genRuling).not.toHaveBeenCalled();
  });
});

describe('against another player', () => {
  beforeEach(async () => {
    session.session_state = { isMultiplayer: true, prosecutionUserId: 'pros', defenseUserId: 'u1', playerRole: 'defense' };
    await submitAppeal('s1', 'c1', { reason: 'other', explanation: text, evidence_ids: [], witness_ids: [] }, defense);
  });

  it('waits for the other player while there is time', async () => {
    await advanceAppeal({ sessionId: 's1', caseId: 'c1', playerRole: 'defense', verdict, now: new Date(Date.now() + 3600_000) });
    expect(getAppeals(session.session_state)[0].status).toBe('awaiting_response');
    expect(genRuling).not.toHaveBeenCalled();
  });

  it('goes to the judge as unopposed after 48 hours of silence, and clears the dashboard notice', async () => {
    genRuling.mockResolvedValue({ granted: true, reasoning: 'Unopposed and well founded.', created_at: '' });
    await advanceAppeal({ sessionId: 's1', caseId: 'c1', playerRole: 'defense', verdict, now: new Date(Date.now() + 49 * 3600_000) });
    const a = getAppeals(session.session_state)[0];
    expect(a.response?.by).toBe('timeout');
    expect(a.status).toBe('granted');
    expect(session.session_state.appealAwaiting).toBeNull();
  });

  it('records the other player\'s answer, clears the notice, and the judge sees it', async () => {
    const id = getAppeals(session.session_state)[0].id;
    await respondToAppeal('s1', 'c1', id, { decision: 'oppose', explanation: 'The jury heard the route sheet already.', evidence_ids: ['e1', 'ghost'], witness_ids: [] }, 'pros');
    const a = getAppeals(session.session_state)[0];
    expect(a.status).toBe('awaiting_ruling');
    expect(a.response).toMatchObject({ decision: 'oppose', by: 'pros', evidence_ids: ['e1'] });
    expect(session.session_state.appealAwaiting).toBeNull();

    genRuling.mockResolvedValue({ granted: false, reasoning: 'Already heard.', created_at: '' });
    await advanceAppeal({ sessionId: 's1', caseId: 'c1', playerRole: 'defense', verdict });
    expect(genRuling.mock.calls[0][0].appeal.response.decision).toBe('oppose');
  });

  it('will not answer the same appeal twice', async () => {
    const id = getAppeals(session.session_state)[0].id;
    const answer = { decision: 'accept' as const, explanation: 'Fine, go again, we are confident.', evidence_ids: [], witness_ids: [] };
    await respondToAppeal('s1', 'c1', id, answer, 'pros');
    await expect(respondToAppeal('s1', 'c1', id, answer, 'pros')).rejects.toThrow(/already been answered/);
  });
});

describe('same device', () => {
  it('waits for the second player to answer on screen', async () => {
    session.session_state = { sameDevicePlay: true, creatorRole: 'defense', playerRole: 'defense' };
    await submitAppeal('s1', 'c1', { reason: 'other', explanation: text, evidence_ids: [], witness_ids: [] }, defense);
    await advanceAppeal({ sessionId: 's1', caseId: 'c1', playerRole: 'defense', verdict, now: new Date(Date.now() + 99 * 3600_000) });
    expect(getAppeals(session.session_state)[0].status).toBe('awaiting_response');
    expect(genRuling).not.toHaveBeenCalled();
  });
});

describe('accepting and reopening', () => {
  it('accepting closes the case for appeals', async () => {
    const s = await acceptVerdict('s1');
    expect(s.session_state.verdictAccepted).toBe(true);
  });

  it('reopening asks the database to reset the case', async () => {
    await reopenCase('s1');
    expect(rpc).toHaveBeenCalledWith('reopen_case_for_appeal', { p_session_id: 's1' });
  });

  it('passes on a database refusal', async () => {
    rpc.mockResolvedValue({ error: new Error('Not allowed') });
    await expect(reopenCase('s1')).rejects.toThrow('Not allowed');
  });
});
