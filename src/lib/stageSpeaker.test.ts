import { describe, expect, it } from 'vitest';
import { normalizeRole, pickActiveSpeaker } from './stageSpeaker';

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
