import { describe, it, expect } from 'vitest';
import {
  MAX_APPEALS, getAppeals, canAppeal, appealsRemaining, activeAppeal, validateAppeal, newAppeal,
  withAppealUpdated, responseIsOverdue, onlyKnownIds, type Appeal
} from './appeals';

const goodText = 'The delivery log shows the driver scanned the right address, which the jury never heard.';
const base = (over: Partial<Appeal> = {}): Appeal => ({
  id: 'a1', number: 1, status: 'denied', reason: 'other', explanation: goodText, evidence_ids: [], witness_ids: [],
  created_at: '2026-10-27T10:00:00.000Z', response_due_at: '2026-10-29T10:00:00.000Z', ...over
});

describe('who can appeal', () => {
  it('only a player who lost', () => {
    expect(canAppeal({ playerWon: true, state: {} })).toBe(false);
    expect(canAppeal({ playerWon: false, state: {} })).toBe(true);
  });

  it('not after accepting the verdict', () => {
    expect(canAppeal({ playerWon: false, state: { verdictAccepted: true } })).toBe(false);
  });

  it('not while an appeal is in progress', () => {
    const state = { appeals: [base({ status: 'awaiting_response' })] };
    expect(activeAppeal(state)?.id).toBe('a1');
    expect(canAppeal({ playerWon: false, state })).toBe(false);
  });

  it('at most two appeals per case', () => {
    const one = { appeals: [base()] };
    expect(appealsRemaining(one)).toBe(1);
    expect(canAppeal({ playerWon: false, state: one })).toBe(true);
    const two = { appeals: [base(), base({ id: 'a2', number: 2 })] };
    expect(appealsRemaining(two)).toBe(MAX_APPEALS - 2);
    expect(canAppeal({ playerWon: false, state: two })).toBe(false);
  });

  it('copes with missing or broken state', () => {
    expect(getAppeals(undefined)).toEqual([]);
    expect(getAppeals({ appeals: 'nope' })).toEqual([]);
  });
});

describe('the form', () => {
  it('needs a reason and a real explanation', () => {
    expect(validateAppeal({ reason: null, explanation: goodText, evidence_ids: [], witness_ids: [] })).toMatch(/reason/);
    expect(validateAppeal({ reason: 'other', explanation: 'too short', evidence_ids: [], witness_ids: [] })).toMatch(/at least/);
    expect(validateAppeal({ reason: 'other', explanation: 'x'.repeat(1300), evidence_ids: [], witness_ids: [] })).toMatch(/under/);
    expect(validateAppeal({ reason: 'other', explanation: goodText, evidence_ids: [], witness_ids: [] })).toBeNull();
  });

  it('asks for the evidence or witness that matches the reason', () => {
    expect(validateAppeal({ reason: 'missed_evidence', explanation: goodText, evidence_ids: [], witness_ids: ['w1'] })).toMatch(/evidence/);
    expect(validateAppeal({ reason: 'missed_evidence', explanation: goodText, evidence_ids: ['e1'], witness_ids: [] })).toBeNull();
    expect(validateAppeal({ reason: 'missed_witness', explanation: goodText, evidence_ids: ['e1'], witness_ids: [] })).toMatch(/witness/);
    expect(validateAppeal({ reason: 'missed_witness', explanation: goodText, evidence_ids: [], witness_ids: ['w1'] })).toBeNull();
  });

  it('only keeps ids that exist in the case', () => {
    expect(onlyKnownIds(['e1', 'e1', 'ghost'], ['e1', 'e2'])).toEqual(['e1']);
  });
});

describe('creating and updating appeals', () => {
  const now = new Date('2026-10-27T10:00:00.000Z');

  it('numbers appeals, sets the 48 hour deadline and drops unknown ids', () => {
    const a = newAppeal({
      state: { appeals: [base()] },
      submission: { reason: 'missed_evidence', explanation: `  ${goodText}  `, evidence_ids: ['e1', 'ghost'], witness_ids: [] },
      knownEvidenceIds: ['e1'], knownWitnessIds: [], now
    });
    expect(a.number).toBe(2);
    expect(a.status).toBe('awaiting_response');
    expect(a.evidence_ids).toEqual(['e1']);
    expect(a.explanation).toBe(goodText);
    expect(a.response_due_at).toBe('2026-10-29T10:00:00.000Z');
  });

  it('refuses an invalid submission', () => {
    expect(() => newAppeal({
      state: {}, submission: { reason: null, explanation: '', evidence_ids: [], witness_ids: [] },
      knownEvidenceIds: [], knownWitnessIds: []
    })).toThrow();
  });

  it('updates one appeal and leaves the others', () => {
    const list = withAppealUpdated({ appeals: [base(), base({ id: 'a2', number: 2 })] }, 'a2', { status: 'granted' });
    expect(list.map(a => a.status)).toEqual(['denied', 'granted']);
  });

  it('knows when a human opponent has run out of time', () => {
    const a = base({ status: 'awaiting_response' });
    expect(responseIsOverdue(a, new Date('2026-10-28T10:00:00.000Z'))).toBe(false);
    expect(responseIsOverdue(a, new Date('2026-10-29T10:00:01.000Z'))).toBe(true);
    expect(responseIsOverdue({ ...a, status: 'awaiting_ruling' }, new Date('2026-11-30T00:00:00.000Z'))).toBe(false);
  });
});
