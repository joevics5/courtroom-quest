import { describe, expect, it } from 'vitest';
import { getTrialFloor, normalizeRole, pickActiveSpeaker } from './stageSpeaker';

describe('pickActiveSpeaker', () => {
  it('moves the glow to the side whose turn it is once the judge has finished', () => {
    expect(pickActiveSpeaker({ lastRole: 'judge', floor: 'defense', ttsSpeaking: false })).toBe('defense');
    expect(pickActiveSpeaker({ lastRole: 'judge', floor: 'prosecution', ttsSpeaking: false })).toBe('prosecution');
  });

  it('stays on the judge while the judge is being read aloud', () => {
    expect(pickActiveSpeaker({ lastRole: 'judge', floor: 'defense', ttsSpeaking: true })).toBe('judge');
  });

  it('highlights the AI counsel while their statement is read, not the judge', () => {
    expect(pickActiveSpeaker({ lastRole: 'prosecution', floor: 'prosecution', ttsSpeaking: true })).toBe('prosecution');
    expect(pickActiveSpeaker({ lastRole: 'prosecution', floor: 'defense', ttsSpeaking: true })).toBe('prosecution');
  });

  it('shows the witness when a witness has the floor', () => {
    expect(pickActiveSpeaker({ lastRole: 'witness', floor: 'witness', ttsSpeaking: false })).toBe('witness');
  });

  it('falls back to the latest speaker, then the judge, when the turn is unknown', () => {
    expect(pickActiveSpeaker({ lastRole: 'prosecution', floor: null, ttsSpeaking: false })).toBe('prosecution');
    expect(pickActiveSpeaker({ lastRole: undefined, floor: null, ttsSpeaking: false })).toBe('judge');
  });

  it('reads "counsel" as the side holding the floor', () => {
    expect(normalizeRole('counsel', 'prosecution')).toBe('prosecution');
    expect(normalizeRole('counsel', 'judge')).toBe('defense');
    expect(normalizeRole('recorder')).toBeUndefined();
  });
});

describe('getTrialFloor (the turn-by-turn switch)', () => {
  it('opening and closing statements belong to the side named in the phase', () => {
    expect(getTrialFloor({ phaseName: 'Opening Statement - Prosecution' })).toBe('prosecution');
    expect(getTrialFloor({ phaseName: 'Opening Statement - Defense' })).toBe('defense');
    expect(getTrialFloor({ phaseName: 'Closing Statement - Prosecution' })).toBe('prosecution');
    expect(getTrialFloor({ phaseName: 'Closing Statement - Defense' })).toBe('defense');
  });

  it('the judge has the turn while giving the instruction, then the side takes over', () => {
    expect(getTrialFloor({ phaseName: 'Opening Statement - Defense', judgeSpeaking: true })).toBe('judge');
    expect(getTrialFloor({ phaseName: 'Opening Statement - Defense', judgeSpeaking: false })).toBe('defense');
  });

  it('witness examination follows the trial turn tracker', () => {
    const phaseName = 'Prosecution Witness 1 - Direct Examination';
    expect(getTrialFloor({ phaseName, currentTurn: 'prosecution' })).toBe('prosecution');
    expect(getTrialFloor({ phaseName, currentTurn: 'witness' })).toBe('witness');
    expect(getTrialFloor({ phaseName: 'Defense Witness 2 - Cross-Examination', currentTurn: 'prosecution' })).toBe('prosecution');
    expect(getTrialFloor({ phaseName, currentTurn: undefined })).toBeNull();
  });

  it('deliberation and verdict belong to the judge; unknown phases to nobody', () => {
    expect(getTrialFloor({ phaseName: 'Judge Deliberation' })).toBe('judge');
    expect(getTrialFloor({ phaseName: 'Verdict Delivery' })).toBe('judge');
    expect(getTrialFloor({ phaseName: 'Case Announcement' })).toBeNull();
    expect(getTrialFloor({})).toBeNull();
  });

  it('end to end: after the judge hands the floor over, the highlight moves to that side', () => {
    const floor = getTrialFloor({ phaseName: 'Opening Statement - Defense', judgeSpeaking: false });
    expect(pickActiveSpeaker({ lastRole: 'judge', floor, ttsSpeaking: false })).toBe('defense');
    // while the judge is still being read aloud the glow stays on the judge
    expect(pickActiveSpeaker({ lastRole: 'judge', floor, ttsSpeaking: true })).toBe('judge');
  });
});
