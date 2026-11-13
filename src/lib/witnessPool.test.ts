import { describe, expect, it } from 'vitest';
import {
  POOL_KEY, DEFENSE_HALF_KEY, CROSS_RESERVE_KEY, basePoolSeconds, statementMinutes, crossReserve, canCallWitness,
  startPool, beginDirect, beginCross, settlePhase, releaseDefenseHalf, availableInHalf, statementGiven, beginRedirect,
  wordCount, statementWordCount, statementComplete
} from './witnessPool';

describe('pool sizes', () => {
  it.each([[5, 150], [15, 720], [30, 1260], [60, 2580]])('%i minute trial has %i seconds of witness time', (d, secs) => {
    expect(basePoolSeconds(d)).toBe(secs);
  });
  it('each opening and closing statement gets 1.5 / 3 / 6 minutes in the 15 / 30 / 60 minute trials; the 5 minute trial keeps its short ones', () => {
    expect([5, 15, 30, 60].map(statementMinutes)).toEqual([0.5, 1.5, 3, 6]);
  });
});

describe('4:1 cross-examination reserve', () => {
  it('sets aside a fifth, never less than the floor', () => {
    expect(crossReserve(300, 15)).toBe(60);
    expect(crossReserve(60, 15)).toBe(20);
    expect(crossReserve(75, 5)).toBe(15);
  });
  it('stops a new witness once there is not room for a direct and a cross', () => {
    expect(canCallWitness(39, 15)).toBe(false);
    expect(canCallWitness(40, 15)).toBe(true);
    expect(canCallWitness(29, 5)).toBe(false);
  });
});

describe('witness stage clocks', () => {
  const start = startPool({ 7: 10, 8: 0 }, 15, [7, 8]);

  it('adds time saved in the openings and holds back the defense half', () => {
    expect(start[POOL_KEY]).toBe(730);
    expect(start[DEFENSE_HALF_KEY]).toBe(365);
    expect(availableInHalf(start)).toBe(365);
    expect(start[7]).toBe(0);
  });

  it('is only started once', () => {
    expect(startPool(start, 15, [7, 8])).toBe(start);
  });

  it('gives direct four fifths and keeps the rest for cross', () => {
    const d = beginDirect(start, 9, 15)!;
    expect(d[9]).toBe(292);
    expect(d[CROSS_RESERVE_KEY]).toBe(73);
    const c = beginCross(d, 10);
    expect(c[10]).toBe(73);
    expect(c[POOL_KEY]).toBe(730 - 292 - 73);
  });

  it('returns unused time to the pool so another witness can follow', () => {
    let c = beginDirect(start, 9, 15)!;
    c = { ...c, 9: 200 }; // direct rested with 200s left
    c = settlePhase(c, 9);
    c = beginCross(c, 10);
    c = { ...c, 10: 40 };
    c = settlePhase(c, 10);
    expect(c[POOL_KEY]).toBe(730 - 292 + 200 - 73 + 40);
    const second = beginDirect(c, 11, 15);
    expect(second).not.toBeNull();
    expect(availableInHalf(c)).toBe(365 - 92 - 33);
  });

  it('lets the defense use what the prosecution left', () => {
    let c = beginDirect(start, 9, 15)!;
    c = settlePhase({ ...c, 9: 100 }, 9); // prosecution rested with 100s unused
    c = settlePhase({ ...beginCross(c, 10), 10: 0 }, 10);
    c = releaseDefenseHalf(c);
    expect(availableInHalf(c)).toBe(c[POOL_KEY]);
    expect(availableInHalf(c)).toBe(365 + 100);
  });

  it('refuses a witness when the half is nearly spent', () => {
    expect(beginDirect({ [POOL_KEY]: 100, [DEFENSE_HALF_KEY]: 70, [CROSS_RESERVE_KEY]: 0 }, 9, 15)).toBeNull();
  });

  it('gives redirect a short turn or none', () => {
    expect(beginRedirect(start, 12)![12]).toBe(30);
    expect(beginRedirect({ [POOL_KEY]: 80, [DEFENSE_HALF_KEY]: 70, [CROSS_RESERVE_KEY]: 0 }, 12)).toBeNull();
  });
});

describe('statement gate', () => {
  it('counts anything the player sent, not the automatic rests line', () => {
    expect(statementGiven([{ speaker_role: 'prosecution', metadata: { phase: 7, rested: true } }], 'prosecution', 7)).toBe(false);
    expect(statementGiven([{ speaker_role: 'prosecution', metadata: { phase: 7 } }], 'prosecution', 7)).toBe(true);
    expect(statementGiven([{ speaker_role: 'defense', metadata: { phase: 7 } }], 'prosecution', 7)).toBe(false);
    expect(statementGiven([{ speaker_role: 'prosecution', metadata: { phase: 8 } }], 'prosecution', 7)).toBe(false);
  });
});

import { getTrialConfig, getTotalTrialTime } from './trialConfig';

describe('trial lengths still add up', () => {
  // The statements run on their own clocks outside the witness pool, so the whole trial is the nominal length
  // plus whatever the four statements get beyond the statement time already built into the pool.
  it.each([[5, 2], [15, 4], [30, 6], [60, 12]] as const)('%i minute trial: fixed clocks + pool = the trial length plus %i minutes of longer statements', (d, extra) => {
    const config = getTrialConfig(d);
    const fixed = Object.values(config.phaseDurations).reduce((a, b) => a + b, 0);
    expect(fixed + basePoolSeconds(d) / 60).toBeCloseTo(d + extra, 5);
    expect(getTotalTrialTime(d)).toBeCloseTo(d + extra, 5);
  });

  it('the witness pool is not shortened by the longer statements', () => {
    expect([5, 15, 30, 60].map(basePoolSeconds)).toEqual([150, 720, 1260, 2580]);
  });

  it('openings and closings get the same time, except the 5 minute trial, which keeps its extra minute on openings', () => {
    for (const [d, opening, closing] of [[5, 1.5, 0.5], [15, 1.5, 1.5], [30, 3, 3], [60, 6, 6]] as const) {
      const cfg = getTrialConfig(d);
      const open = cfg.phases.filter(p => /opening/i.test(p.name));
      const close = cfg.phases.filter(p => /closing/i.test(p.name));
      expect(open).toHaveLength(2);
      expect(close).toHaveLength(2);
      open.forEach(p => expect(cfg.phaseDurations[p.number]).toBe(opening));
      close.forEach(p => expect(cfg.phaseDurations[p.number]).toBe(closing));
    }
  });

  it('witness phases have no fixed clock; each side has its slots, direct then cross', () => {
    const cfg = getTrialConfig(15);
    const w = cfg.phases.filter(p => /Witness/.test(p.name));
    expect(w.map(p => p.name)).toEqual([
      'Prosecution Witness 1 - Direct Examination', 'Prosecution Witness 1 - Cross-Examination',
      'Prosecution Witness 2 - Direct Examination', 'Prosecution Witness 2 - Cross-Examination',
      'Defense Witness 1 - Direct Examination', 'Defense Witness 1 - Cross-Examination',
      'Defense Witness 2 - Direct Examination', 'Defense Witness 2 - Cross-Examination'
    ]);
    w.forEach(p => expect(cfg.phaseDurations[p.number]).toBeUndefined());
  });

  it('numbers phases without gaps in every mode', () => {
    for (const d of [5, 15, 30, 60] as const) {
      const nums = getTrialConfig(d).phases.map(p => p.number);
      expect(nums).toEqual(nums.map((_, i) => i + 1));
    }
  });
});

describe('statement word minimum', () => {
  const ev = (speaker: string, content: string, over: Record<string, unknown> = {}) => ({ speaker_role: speaker, content, metadata: { phase: 7, ...over } });
  const words = (n: number) => Array.from({ length: n }, (_, i) => `w${i}`).join(' ');

  it('counts words, ignoring extra spaces and empty text', () => {
    expect(wordCount('  one   two\nthree ')).toBe(3);
    expect(wordCount('')).toBe(0);
  });

  it('adds up what a side sent in that phase, not the other side, another phase or the automatic rest line', () => {
    const events = [
      ev('prosecution', words(30)),
      ev('prosecution', words(25)),
      ev('defense', words(40)),
      ev('prosecution', words(60), { phase: 8 }),
      ev('prosecution', 'The prosecution rests.', { rested: true })
    ];
    expect(statementWordCount(events, 'prosecution', 7)).toBe(55);
    expect(statementWordCount(events, 'defense', 7)).toBe(40);
  });

  it('a player\'s statement is complete at 50 words, across one or several sends', () => {
    expect(statementComplete([ev('prosecution', words(49))], 'prosecution', 7, true)).toBe(false);
    expect(statementComplete([ev('prosecution', words(50))], 'prosecution', 7, true)).toBe(true);
    expect(statementComplete([ev('prosecution', words(20)), ev('prosecution', words(30))], 'prosecution', 7, true)).toBe(true);
  });

  it('a statement the computer gave only has to have been given, so a short one cannot stall the trial', () => {
    expect(statementComplete([ev('defense', 'The defense will show reasonable doubt.')], 'defense', 7, false)).toBe(true);
    expect(statementComplete([], 'defense', 7, false)).toBe(false);
  });
});
