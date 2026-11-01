import { describe, expect, it } from 'vitest';
import { getTrialConfig } from './trialConfig';
import type { TrialDuration } from '../types';
import { planNextPhase } from './witnessPlan';
import { POOL_KEY, DEFENSE_HALF_KEY, basePoolSeconds, type Clocks } from './witnessPool';

/** Plays the witness stage: each phase says how many seconds of its clock it used and whether a witness was called. */
function play(duration: TrialDuration, openingLeft: [number, number], script: (name: string, clock: number) => { used: number; called?: boolean }) {
  const config = getTrialConfig(duration);
  let clocks: Clocks = { 7: openingLeft[0], 8: openingLeft[1] };
  const called = new Set<number>();
  const visited: Array<{ name: string; clock: number; used: number }> = [];
  let current = 8;
  for (let guard = 0; guard < 60; guard++) {
    const plan = planNextPhase({ config, duration, currentPhase: current, clocks, witnessCalledPhases: called });
    if (plan === 'verdict') return { visited, clocks, config, ended: 'verdict' as const, last: current };
    clocks = plan.clocks;
    current = plan.nextPhase;
    const phase = config.phases.find(p => p.number === current)!;
    if (!/Examination|Redirect/.test(phase.name)) return { visited, clocks, config, ended: phase.name, last: current };
    const clock = clocks[current];
    const step = script(phase.name, clock);
    if (step.called) called.add(current);
    clocks = { ...clocks, [current]: Math.max(0, clock - step.used) };
    visited.push({ name: phase.name, clock, used: step.used });
  }
  throw new Error('stage never ended');
}

describe('witness stage, 15 minute trial', () => {
  it('one witness each: direct gets 4/5 of the half, then the cross reserve, then on to the closing', () => {
    const r = play(15, [0, 0], (name) => ({ used: 0, called: /Direct/.test(name) && /Witness 1/.test(name) }));
    const half = Math.round(basePoolSeconds(15) / 2);
    expect(r.visited[0]).toMatchObject({ name: 'Prosecution Witness 1 - Direct Examination', clock: half - Math.ceil(half / 5) });
    expect(r.visited[1]).toMatchObject({ name: 'Prosecution Witness 1 - Cross-Examination', clock: Math.ceil(half / 5) });
    expect(r.ended).toBe('Closing Statement - Prosecution');
  });

  it('after a first witness a side still gets its next direct phase, where it can call another witness or rest', () => {
    const r = play(15, [0, 0], (name) => ({ used: 30, called: /Direct/.test(name) && /Witness 1/.test(name) }));
    expect(r.visited.map(v => v.name)).toEqual([
      'Prosecution Witness 1 - Direct Examination',
      'Prosecution Witness 1 - Cross-Examination',
      'Prosecution Witness 2 - Direct Examination', // rested without calling anyone: no cross follows
      'Defense Witness 1 - Direct Examination',
      'Defense Witness 1 - Cross-Examination',
      'Defense Witness 2 - Direct Examination'
    ]);
  });

  it('two witnesses each fit, and the other side crosses after every examination', () => {
    const r = play(15, [0, 0], (name) => ({ used: 20, called: /Direct/.test(name) }));
    expect(r.visited.map(v => v.name)).toEqual([
      'Prosecution Witness 1 - Direct Examination',
      'Prosecution Witness 1 - Cross-Examination',
      'Prosecution Witness 2 - Direct Examination',
      'Prosecution Witness 2 - Cross-Examination',
      'Defense Witness 1 - Direct Examination',
      'Defense Witness 1 - Cross-Examination',
      'Defense Witness 2 - Direct Examination',
      'Defense Witness 2 - Cross-Examination'
    ]);
  });

  it('a long first direct leaves the cross its reserve and may leave no time for a second witness', () => {
    const r = play(15, [0, 0], (name, clock) => ({ used: /Direct/.test(name) ? clock : clock, called: /Direct/.test(name) }));
    const pros = r.visited.filter(v => v.name.startsWith('Prosecution'));
    expect(pros.map(v => v.name)).toEqual(['Prosecution Witness 1 - Direct Examination', 'Prosecution Witness 1 - Cross-Examination']);
    expect(pros[0].clock + pros[1].clock).toBe(Math.round(basePoolSeconds(15) / 2));
    expect(pros[1].clock).toBeGreaterThanOrEqual(20);
    expect(pros[0].clock).toBeGreaterThan(pros[1].clock * 3.5);
  });

  it('skips cross-examination when no witness was called, and skips the rest of that side\'s slots', () => {
    const r = play(15, [0, 0], (name) => ({ used: 0, called: false }));
    expect(r.visited.map(v => v.name)).toEqual([
      'Prosecution Witness 1 - Direct Examination',
      'Defense Witness 1 - Direct Examination'
    ]);
  });

  it('time one side leaves unused rolls into the other side\'s half (one pool)', () => {
    const base = Math.round(basePoolSeconds(15) / 2);
    const r = play(15, [0, 0], (name, clock) => ({ used: name.startsWith('Prosecution') ? 0 : clock, called: /Direct/.test(name) }));
    const def = r.visited.find(v => v.name === 'Defense Witness 1 - Direct Examination')!;
    expect(def.clock).toBeGreaterThan(base - Math.ceil(base / 5));
  });

  it('time saved in the openings is added to the pool', () => {
    const a = play(15, [0, 0], () => ({ used: 0, called: true }));
    const b = play(15, [20, 10], () => ({ used: 0, called: true }));
    expect(b.visited[0].clock).toBeGreaterThan(a.visited[0].clock);
    // the two openings' leftover becomes witness time, shared evenly between the halves
    expect(b.visited[0].clock - a.visited[0].clock).toBeLessThanOrEqual(12);
  });
});

describe('witness stage in the other modes', () => {
  it('Quick Play: one witness each, 60 seconds of direct and 15 of cross in the first half', () => {
    const r = play(5, [0, 0], (name) => ({ used: 0, called: /Direct/.test(name) }));
    expect(r.visited.map(v => v.name)).toEqual([
      'Prosecution Witness 1 - Direct Examination',
      'Prosecution Witness 1 - Cross-Examination',
      'Defense Witness 1 - Direct Examination',
      'Defense Witness 1 - Cross-Examination'
    ]);
    expect(r.visited[0].clock).toBe(60);
    expect(r.visited[1].clock).toBe(15);
    expect(r.ended).toBe('Closing Statement - Prosecution');
  });

  it.each([30, 60] as const)('%i minute trial reaches the closing statements', d => {
    const r = play(d, [0, 0], (name) => ({ used: 10, called: /Direct/.test(name) }));
    expect(r.ended).toBe('Closing Statement - Prosecution');
    expect(r.visited.filter(v => /Direct/.test(v.name)).length).toBeGreaterThanOrEqual(2);
  });

  it('never hands out more than the pool, in any mode', () => {
    for (const d of [5, 15, 30, 60] as const) {
      const r = play(d, [0, 0], (name, clock) => ({ used: clock, called: /Direct/.test(name) }));
      const given = r.visited.reduce((sum, v) => sum + v.clock, 0);
      expect(given).toBeLessThanOrEqual(basePoolSeconds(d));
      expect(r.clocks[POOL_KEY]).toBeGreaterThanOrEqual(0);
      expect(r.clocks[DEFENSE_HALF_KEY]).toBe(0);
    }
  });
});
