import { describe, expect, it } from 'vitest';
import { getTrialConfig } from './trialConfig';
import { basePoolSeconds } from './witnessPool';

describe('Quick Play (10 minute) trial', () => {
  const config = getTrialConfig(10);

  it('has one witness per side: direct, cross and a redirect slot', () => {
    const names = config.phases.filter(p => p.category === 'trial').map(p => p.name);
    expect(names).toEqual([
      'Opening Statement - Prosecution',
      'Opening Statement - Defense',
      'Prosecution Witness 1 - Direct Examination',
      'Prosecution Witness 1 - Cross-Examination',
      'Prosecution Witness 1 - Redirect',
      'Defense Witness 1 - Direct Examination',
      'Defense Witness 1 - Cross-Examination',
      'Defense Witness 1 - Redirect',
      'Closing Statement - Prosecution',
      'Closing Statement - Defense',
      'Judge Deliberation',
      'Verdict Delivery'
    ]);
    expect(config.maxWitnesses).toBe(2);
  });

  it('fixed clocks plus the shared witness pool: the 10 minute Quick Play: 7 fixed minutes plus a 3 minute witness pool', () => {
    const fixed = Object.values(config.phaseDurations).reduce((a, b) => a + b, 0);
    expect(fixed).toBe(7); // two 2:00 openings, two 1:00 closings, 1 minute of deliberation
    expect(fixed + basePoolSeconds(10) / 60).toBe(10);
  });

  it('numbers its phases without gaps, starting the trial at phase 7 like the others', () => {
    const numbers = config.phases.map(p => p.number);
    expect(numbers).toEqual(numbers.map((_, i) => i + 1));
    expect(config.phases.find(p => p.number === 7)?.name).toBe('Opening Statement - Prosecution');
  });
});

describe('Lightning (5 minute) trial', () => {
  const config = getTrialConfig(5);

  it('has the same shape as Quick Play, with one witness per side', () => {
    expect(config.phases.map(p => p.name)).toEqual(getTrialConfig(10).phases.map(p => p.name));
    expect(config.maxWitnesses).toBe(2);
  });

  it('adds up to 5 minutes: four 30 second statements, 30 seconds of deliberation and a 2.5 minute witness pool', () => {
    const fixed = Object.values(config.phaseDurations).reduce((a, b) => a + b, 0);
    expect(fixed).toBe(2.5);
    expect(basePoolSeconds(5)).toBe(150);
    expect(fixed + basePoolSeconds(5) / 60).toBe(5);
  });
});
