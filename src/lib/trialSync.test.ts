import { describe, expect, it } from 'vitest';
import {
  ACTIVITY_FRESH_MS, activityLine, applyRemoteEvents, authorTag, currentActivity, isRemoteEvent, observeActivity,
  parseActivity, voiceRoleFor, witnessOnStand
} from './trialSync';

const turn = (over: Record<string, unknown> = {}) => ({
  current_turn: 'defense', current_witness_id: null, current_witness_name: null, current_phase_type: 'cross', current_phase_number: 12,
  questions_asked: 0, phase_time_remaining: 300, witnesses_called: [], evidence_submitted: [], objection_cooldown_until: null, ...over
}) as any;
const ev = (over: Record<string, unknown>) => ({ event_type: 'announcement', speaker_role: 'judge', content: 'x', metadata: {}, ...over }) as any;

describe('who wrote a line', () => {
  it('only treats a line stamped by the other player as remote', () => {
    expect(authorTag('u1')).toEqual({ by: 'u1' });
    expect(isRemoteEvent(ev({ metadata: { by: 'u2' } }), 'u1')).toBe(true);
    expect(isRemoteEvent(ev({ metadata: { by: 'u1' } }), 'u1')).toBe(false);
    expect(isRemoteEvent(ev({ metadata: {} }), 'u1')).toBe(false);
  });
});

describe('what is read out', () => {
  it('reads the judge, the witness and counsel, but not filings or rests', () => {
    expect(voiceRoleFor(ev({ speaker_role: 'judge' }))).toBe('judge');
    expect(voiceRoleFor(ev({ speaker_role: 'witness', event_type: 'witness_examination' }))).toBe('witness');
    expect(voiceRoleFor(ev({ speaker_role: 'prosecution', event_type: 'opening' }))).toBe('counsel');
    expect(voiceRoleFor(ev({ speaker_role: 'defense', event_type: 'witness_examination' }))).toBe('counsel');
    expect(voiceRoleFor(ev({ speaker_role: 'defense', event_type: 'closing', metadata: { rested: true } }))).toBeNull();
    expect(voiceRoleFor(ev({ speaker_role: 'prosecution', event_type: 'evidence_submission' }))).toBeNull();
    expect(voiceRoleFor(ev({ speaker_role: 'prosecution', event_type: 'witness_call' }))).toBeNull();
  });
});

describe('the witness on the stand', () => {
  it('is whoever was called last, whichever side called them', () => {
    const events = [
      ev({ event_type: 'witness_call', content: 'Dr. Warren', metadata: { witness_id: 'w1', phase: 9 } }),
      ev({ event_type: 'witness_examination', speaker_role: 'witness' }),
      ev({ event_type: 'witness_call', content: 'Sam Lee', metadata: { witness_id: 'w2', phase: 12 } })
    ];
    expect(witnessOnStand(events)).toEqual({ id: 'w2', name: 'Sam Lee' });
    expect(witnessOnStand([])).toBeNull();
  });

  it('puts the witness the other player called on the stand for the cross-examiner', () => {
    const next = applyRemoteEvents(turn(), [
      ev({ event_type: 'witness_call', speaker_role: 'prosecution', content: 'Dr. Warren', metadata: { witness_id: 'w1', phase: 12 } })
    ]);
    expect(next.current_witness_id).toBe('w1');
    expect(next.current_witness_name).toBe('Dr. Warren');
    expect(next.witnesses_called).toEqual(['w1']);
  });

  it('records exhibits and counts answers, but only for the current phase', () => {
    const next = applyRemoteEvents(turn(), [
      ev({ event_type: 'evidence_submission', speaker_role: 'prosecution', metadata: { evidence_id: 'e1', phase: 12 } }),
      ev({ event_type: 'evidence_submission', speaker_role: 'prosecution', metadata: { evidence_id: 'e9', phase: 7 } }),
      ev({ event_type: 'witness_examination', speaker_role: 'witness', metadata: { phase: 12 } }),
      ev({ event_type: 'witness_examination', speaker_role: 'witness', metadata: { phase: 12 } }),
      ev({ event_type: 'witness_examination', speaker_role: 'witness', metadata: { phase: 3 } })
    ]);
    expect(next.evidence_submitted).toEqual(['e1']);
    expect(next.questions_asked).toBe(2);
  });

  it('leaves the turn untouched when nothing new arrived', () => {
    const t = turn();
    expect(applyRemoteEvents(t, [])).toBe(t);
  });
});

describe('typing and speaking notices', () => {
  const state = { activityDefense: { kind: 'typing', seq: 4 } };
  it('reads the other player\'s notice', () => {
    expect(parseActivity(state, 'defense')).toEqual({ kind: 'typing', seq: 4 });
    expect(parseActivity(state, 'prosecution')).toBeNull();
    expect(parseActivity({ activityDefense: { kind: 'dancing', seq: 1 } }, 'defense')).toEqual({ kind: 'idle', seq: 1 });
  });

  it('stays up while the counter keeps moving, and goes quiet when it stops', () => {
    let w = observeActivity(null, { kind: 'typing', seq: 1 }, 1000);
    expect(currentActivity(w, 2000)).toBe('typing');
    w = observeActivity(w, { kind: 'typing', seq: 1 }, 5000); // same counter: nothing new
    expect(w!.changedAt).toBe(1000);
    expect(currentActivity(w, 1000 + ACTIVITY_FRESH_MS + 1)).toBeNull();
    w = observeActivity(w, { kind: 'typing', seq: 2 }, 9000);
    expect(currentActivity(w, 9500)).toBe('typing');
    w = observeActivity(w, { kind: 'idle', seq: 3 }, 9600);
    expect(currentActivity(w, 9700)).toBeNull();
  });

  it('words the notice', () => {
    expect(activityLine('Chidi', 'typing')).toBe('Chidi is typing…');
    expect(activityLine('Chidi', 'speaking')).toBe('Chidi is speaking…');
    expect(activityLine('Chidi', null)).toBeNull();
  });
});
