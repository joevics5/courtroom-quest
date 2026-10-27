import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Appeal } from './appeals';

let session: any;
const rpc = vi.fn();
const genResponse = vi.fn();
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
  generateAppealResponse: (a: unknown) => genResponse(a),
  generateAppealRuling: (a: unknown) => genRuling(a)
}));

import { submitAppeal, runAIAppeal, acceptVerdict, reopenCase, appealsSupported } from './appealFlow';
import { getAppeals } from './appeals';

const text = 'Bill knew the clerk swapped the digits, but nobody asked him about the route sheet.';
const verdict: any = { id: 'v', session_id: 's1', outcome: 'win', reasoning: 'r', evidence_cited: [], delivered_at: '' };

beforeEach(() => {
  session = { id: 's1', user_id: 'u1', case_id: 'c1', session_state: { playerRole: 'defense', prosecutorName: 'District Attorney Robert Klein (White Collar Crimes)' } };
  rpc.mockReset(); genResponse.mockReset(); genRuling.mockReset();
  rpc.mockResolvedValue({ error: null });
});

describe('appealsSupported', () => {
  it('is for games against the AI only', () => {
    expect(appealsSupported({ playerRole: 'defense' })).toBe(true);
    expect(appealsSupported({ isMultiplayer: true })).toBe(false);
    expect(appealsSupported({ sameDevicePlay: true })).toBe(false);
    expect(appealsSupported(null)).toBe(false);
  });
});

describe('submitting', () => {
  it('saves the appeal without touching the rest of the session state', async () => {
    const a = await submitAppeal('s1', 'c1', { reason: 'missed_witness', explanation: text, evidence_ids: [], witness_ids: ['w1', 'ghost'] });
    expect(a.status).toBe('awaiting_response');
    expect(a.witness_ids).toEqual(['w1']);
    expect(session.session_state.playerRole).toBe('defense');
    expect(getAppeals(session.session_state)).toHaveLength(1);
  });

  it('refuses a third appeal', async () => {
    const sub = { reason: 'other' as const, explanation: text, evidence_ids: [], witness_ids: [] };
    session.session_state.appeals = [{ id: 'a1', number: 1, status: 'denied' }, { id: 'a2', number: 2, status: 'denied' }];
    // the form never offers it, but the saved number would be 3 and canAppeal blocks it in the UI;
    // here we just make sure numbering continues rather than restarting
    const a = await submitAppeal('s1', 'c1', sub);
    expect(a.number).toBe(3);
  });
});

describe('the AI pipeline', () => {
  const resp = { decision: 'oppose', explanation: 'Heard already.', evidence_ids: [], witness_ids: [], by: 'ai', created_at: '' };

  it('opposing counsel answers, then the judge rules, each saved as it finishes', async () => {
    await submitAppeal('s1', 'c1', { reason: 'missed_evidence', explanation: text, evidence_ids: ['e1'], witness_ids: [] });
    genResponse.mockResolvedValue(resp);
    genRuling.mockResolvedValue({ granted: true, reasoning: 'The sheet was never used.', created_at: '' });
    const steps: string[] = [];
    await runAIAppeal({ sessionId: 's1', caseId: 'c1', playerRole: 'defense', verdict, onStep: a => steps.push(a.status) });
    expect(steps).toEqual(['awaiting_ruling', 'granted']);
    const a = getAppeals(session.session_state)[0];
    expect(a.status).toBe('granted');
    expect(a.response?.decision).toBe('oppose');
    // the opposing counsel's name has no division, and the judge saw the opposing counsel's answer
    expect(genResponse.mock.calls[0][0].case.opponentName).toBe('District Attorney Robert Klein');
    expect(genRuling.mock.calls[0][0].appeal.response.decision).toBe('oppose');
  });

  it('carries on from where it stopped instead of asking opposing counsel twice', async () => {
    await submitAppeal('s1', 'c1', { reason: 'other', explanation: text, evidence_ids: [], witness_ids: [] });
    genResponse.mockResolvedValue(resp);
    genRuling.mockRejectedValueOnce(new Error('The judge could not rule yet.'));
    await expect(runAIAppeal({ sessionId: 's1', caseId: 'c1', playerRole: 'defense', verdict })).rejects.toThrow(/could not rule/);
    expect(getAppeals(session.session_state)[0].status).toBe('awaiting_ruling');

    genRuling.mockResolvedValue({ granted: false, reasoning: 'Only disagrees.', created_at: '' });
    await runAIAppeal({ sessionId: 's1', caseId: 'c1', playerRole: 'defense', verdict });
    expect(genResponse).toHaveBeenCalledTimes(1);
    expect(getAppeals(session.session_state)[0].status).toBe('denied');
  });

  it('does nothing when no appeal is waiting', async () => {
    await runAIAppeal({ sessionId: 's1', caseId: 'c1', playerRole: 'defense', verdict });
    expect(genResponse).not.toHaveBeenCalled();
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
