import { describe, expect, it } from 'vitest';
import { usedBySide, usedByEither } from './usedBySide';

const events = [
  { event_type: 'witness_call', speaker_role: 'prosecution', metadata: { witness_id: 'w1' } },
  { event_type: 'evidence_submission', speaker_role: 'prosecution', metadata: { evidence_id: 'e1' } },
  { event_type: 'witness_call', speaker_role: 'defense', metadata: { witness_id: 'w2' } },
  { event_type: 'witness_examination', speaker_role: 'defense', metadata: { witness_id: 'w1' } }
];

describe('used by side', () => {
  it('only counts what that side itself used, so the other side can use the same witness or exhibit', () => {
    expect(usedBySide(events, 'prosecution')).toEqual({ witnesses: ['w1'], evidence: ['e1'] });
    expect(usedBySide(events, 'defense')).toEqual({ witnesses: ['w2'], evidence: [] });
  });
  it('a side that called a witness can no longer call that same one again, but the other side still can', () => {
    expect(usedBySide(events, 'defense').witnesses).not.toContain('w1');
  });
  it('everything either side used, for the verdict and closings', () => {
    expect(usedByEither(events)).toEqual({ witnesses: ['w1', 'w2'], evidence: ['e1'] });
  });
  it('ignores events with no id and counts each only once', () => {
    expect(usedBySide([{ event_type: 'witness_call', speaker_role: 'defense', metadata: {} },
      { event_type: 'witness_call', speaker_role: 'defense', metadata: { witness_id: 'w2' } },
      { event_type: 'witness_call', speaker_role: 'defense', metadata: { witness_id: 'w2' } }], 'defense').witnesses).toEqual(['w2']);
  });
});
