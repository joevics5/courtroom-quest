import { describe, expect, it } from 'vitest';
import { buildLeaveSave, restoreTotalTime, startsPaused } from './trialResume';

describe('restoreTotalTime', () => {
  it('uses the saved total when there is one', () => {
    expect(restoreTotalTime(540, { 7: 100, 8: 200 }, 7)).toBe(540);
  });

  it('rebuilds it from the phase clocks when it was never saved (this used to be 0 and ended the trial on return)', () => {
    expect(restoreTotalTime(undefined, { 7: 120, 8: 300, 9: 180 }, 7)).toBe(600);
  });

  it('only counts the current phase and the ones after it', () => {
    expect(restoreTotalTime(undefined, { 7: 0, 8: 300, 9: 180 }, 8)).toBe(480);
  });

  it('a saved total of 0 does not force a verdict when phases still have time', () => {
    expect(restoreTotalTime(0, { 8: 200 }, 8)).toBe(200);
  });

  it('is 0 only when there is genuinely nothing left', () => {
    expect(restoreTotalTime(undefined, {}, 7)).toBe(0);
    expect(restoreTotalTime(undefined, undefined, 7)).toBe(0);
  });
});

describe('coming back paused', () => {
  it('a session left mid-trial opens paused', () => {
    expect(startsPaused({ timer_paused_at: '2026-10-15T10:00:00Z' }, false)).toBe(true);
  });
  it('a fresh trial, a resumed (null) one, and practice mode start running as normal', () => {
    expect(startsPaused({}, false)).toBe(false);
    expect(startsPaused({ timer_paused_at: null }, false)).toBe(false);
    expect(startsPaused({ timer_paused_at: '2026-10-15T10:00:00Z' }, true)).toBe(false);
  });
});

describe('buildLeaveSave', () => {
  it('saves a paused snapshot with the clocks, keeping the rest of the session state', () => {
    const now = new Date('2026-10-15T10:30:00Z');
    const save = buildLeaveSave({ currentPhase: 9, phaseTimeRemaining: { 9: 140 }, totalTimeRemaining: 560, sessionState: { playerRole: 'defense' }, now });
    expect(save).toEqual({
      current_phase: 'trial',
      current_trial_phase: 9,
      timer_paused_at: '2026-10-15T10:30:00.000Z',
      session_state: { playerRole: 'defense', phaseTimeRemaining: { 9: 140 }, totalTimeRemaining: 560 }
    });
  });
  it('copes with no session state yet', () => {
    expect(buildLeaveSave({ currentPhase: 7, phaseTimeRemaining: {}, totalTimeRemaining: 0, sessionState: null }).session_state).toEqual({ phaseTimeRemaining: {}, totalTimeRemaining: 0 });
  });
});
