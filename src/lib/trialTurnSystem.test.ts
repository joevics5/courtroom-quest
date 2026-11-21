import { describe, expect, it } from 'vitest';
import { turnMatchesPhase } from './trialTurnSystem';


describe('turnMatchesPhase', () => {
  it('is false until the turn state has been rebuilt for the phase the trial is in', () => {
    expect(turnMatchesPhase({ current_phase_number: 12 }, 13)).toBe(false);
    expect(turnMatchesPhase({ current_phase_number: 13 }, 13)).toBe(true);
    expect(turnMatchesPhase(null, 13)).toBe(false);
  });
});
