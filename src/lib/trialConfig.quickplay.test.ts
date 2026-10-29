import { describe, expect, it } from 'vitest';
import { getTrialConfig } from './trialConfig';

describe('Quick Play (5 minute) trial', () => {
  const config = getTrialConfig(5);

  it('has one witness per side, direct and cross only', () => {
    const names = config.phases.filter(p => p.category === 'trial').map(p => p.name);
    expect(names).toEqual([
      'Opening Statement - Prosecution',
      'Opening Statement - Defense',
      'Prosecution Witness 1 - Direct Examination',
      'Prosecution Witness 1 - Cross-Examination',
      'Defense Witness 1 - Direct Examination',
      'Defense Witness 1 - Cross-Examination',
      'Closing Statement - Prosecution',
      'Closing Statement - Defense',
      'Judge Deliberation',
      'Verdict Delivery'
    ]);
    expect(config.maxWitnesses).toBe(2);
  });

  it('phase clocks add up to the five minutes', () => {
    const total = Object.values(config.phaseDurations).reduce((a, b) => a + b, 0);
    expect(total).toBe(5);
  });

  it('numbers its phases without gaps, starting the trial at phase 7 like the others', () => {
    const numbers = config.phases.map(p => p.number);
    expect(numbers).toEqual(numbers.map((_, i) => i + 1));
    expect(config.phases.find(p => p.number === 7)?.name).toBe('Opening Statement - Prosecution');
  });
});
