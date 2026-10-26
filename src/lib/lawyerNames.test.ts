import { describe, it, expect } from 'vitest';
import { PROSECUTOR_NAMES, DEFENSE_NAMES, aiDefenseName, plainLawyerName } from './trialConfig';

describe('AI lawyer names', () => {
  it('strips a trailing division but leaves ordinary names alone', () => {
    expect(plainLawyerName('District Attorney Robert Klein (White Collar Crimes)')).toBe('District Attorney Robert Klein');
    expect(plainLawyerName('Prosecutor Emily Rodriguez (Fraud & Financial Crimes)')).toBe('Prosecutor Emily Rodriguez');
    expect(plainLawyerName('Attorney Sofia Reyes')).toBe('Attorney Sofia Reyes');
  });

  it('new prosecutor and defense names carry no division', () => {
    for (const n of [...PROSECUTOR_NAMES, ...DEFENSE_NAMES]) expect(n).not.toMatch(/[()]/);
  });

  it('gives the AI defense a real name that never changes for a session', () => {
    const a = aiDefenseName('session-123');
    expect(DEFENSE_NAMES).toContain(a);
    expect(aiDefenseName('session-123')).toBe(a);
    expect(a).not.toBe('Defense Counsel');
    expect(DEFENSE_NAMES).toContain(aiDefenseName(''));
  });

  it('spreads names across sessions', () => {
    const names = new Set(Array.from({ length: 40 }, (_, i) => aiDefenseName(`s-${i}`)));
    expect(names.size).toBeGreaterThan(4);
  });
});
