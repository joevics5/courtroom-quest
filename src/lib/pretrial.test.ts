import { describe, expect, it } from 'vitest';
import { AI_DEFENSE_PLEA, LINGER_MS, aiPleaLine, pretrialSteps, readingTimeMs } from './pretrial';

describe('pretrial script', () => {
  const steps = pretrialSteps({ judgeName: 'Justice Chen', caseTitle: 'State v. Rivera', prosecutorName: 'DA Harrison', defenseName: 'Ada' });

  it('is a single narration that ends at the plea', () => {
    expect(steps.map(s => s.phase)).toEqual(['bailiff_call', 'case_announcement', 'counsel_appearances', 'counsel_appearances', 'defendant_plea']);
    expect(steps[0].text).toContain('The Honorable Justice Chen presiding');
    expect(steps[1].text).toContain('State v. Rivera');
    expect(steps[2].text).toContain('prosecution: DA Harrison');
    expect(steps[3].text).toContain('defense: Ada');
  });

  it('is told in the bailiff\'s own words, not as lines by the judge or counsel', () => {
    expect(steps.every(s => !/^(This is the case|For the (prosecution|defense))/.test(s.text))).toBe(true);
  });

  it('gives longer lines more time to read, within sensible limits', () => {
    expect(readingTimeMs('Hi.')).toBe(3500);
    expect(readingTimeMs('x'.repeat(100))).toBeGreaterThan(readingTimeMs('x'.repeat(40)));
    expect(readingTimeMs('x'.repeat(1000))).toBe(14000);
    expect(LINGER_MS).toBeGreaterThanOrEqual(1500);
  });

  it('has the AI defense keep the trial going, and reports the plea in words', () => {
    expect(AI_DEFENSE_PLEA).toBe('not_guilty');
    expect(aiPleaLine(false)).toMatch(/pleads not guilty/);
    expect(aiPleaLine(true)).toMatch(/pleads guilty/);
  });
});
