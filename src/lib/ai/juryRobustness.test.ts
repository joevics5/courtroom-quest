import { beforeEach, describe, expect, it, vi } from 'vitest';

type Behave = (system: string, call: number) => string | Error;
let behave: Behave = () => '';
let calls = 0;
let inFlight = 0;
let maxInFlight = 0;

vi.mock('./providerFactory', () => ({
  getAIProvider: () => ({
    isAvailable: () => true,
    generate: async (req: { system?: string }) => {
      const call = calls++;
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise(r => setTimeout(r, 3));
      inFlight--;
      const out = behave(req.system ?? '', call);
      if (out instanceof Error) throw out;
      return { text: out };
    }
  })
}));

import { generateJuryDeliberation, type JurorProfile } from './trialAI';
import { reliefDemands } from '../requestedRelief';

const jurors: JurorProfile[] = Array.from({ length: 12 }, (_, i) => ({ id: `j${i + 1}`, name: `Juror ${i + 1}` }));
const base = { jurors, events: [], evidence: [], caseTitle: 'The Fake Review', retryDelaysMs: [0, 0] };
const guilty = JSON.stringify({ vote: 'GUILTY', reason: 'r' });
const notGuilty = JSON.stringify({ vote: 'NOT_GUILTY', reason: 'r' });
const rateLimited = () => new Error('429 Too Many Requests');
const isJuror = (system: string, n: number) => system.includes(`You are Juror ${n},`);

beforeEach(() => { calls = 0; inFlight = 0; maxInFlight = 0; });

describe('jurors are asked a few at a time', () => {
  it('never has more than four calls in flight', async () => {
    behave = () => notGuilty;
    await generateJuryDeliberation(base);
    expect(calls).toBe(12);
    expect(maxInFlight).toBeLessThanOrEqual(4);
    expect(maxInFlight).toBeGreaterThan(1);
  });

  it('keeps the juror order in the results', async () => {
    behave = () => notGuilty;
    const r = await generateJuryDeliberation(base);
    expect(r.rounds[0].votes.map(v => v.jurorId)).toEqual(jurors.map(j => j.id));
  });
});

describe('a refused call is retried before giving up', () => {
  it('counts a juror who succeeds on a later try', async () => {
    let juror3Calls = 0;
    behave = (system) => {
      if (isJuror(system, 3) && juror3Calls++ < 2) return rateLimited(); // refused twice, accepted on the third try
      return guilty;
    };
    const r = await generateJuryDeliberation(base);
    expect(r.rounds[0].votes).toHaveLength(12);
    expect(r.rounds[0].absent).toBeUndefined();
    expect(r.rounds[0].votes.find(v => v.jurorId === 'j3')!.fallback).toBeUndefined();
    expect(calls).toBe(14); // 12 jurors + 2 retries
  });
});

describe('a juror who cannot be reached is absent, never given a made-up vote', () => {
  it('leaves them out of the votes and the counts', async () => {
    behave = (system) => (isJuror(system, 5) ? rateLimited() : guilty);
    const r = await generateJuryDeliberation({ ...base, demands: reliefDemands({ primary: 'A', financial: 'B' }) });
    const round = r.rounds[0];
    expect(round.votes).toHaveLength(11);
    expect(round.votes.some(v => v.jurorId === 'j5')).toBe(false);
    expect(round.absent).toBe(1);
    expect(round.guilty + round.notGuilty).toBe(11);
    expect(r.absentJurors).toBe(1);
    expect(r.unanimous).toBe(true); // all 11 who voted agreed
    const main = r.demands!.find(d => d.id === 'main')!;
    expect(main.grant + main.deny).toBe(11);
    const money = r.demands!.find(d => d.id === 'money')!;
    expect(money.grant + money.deny).toBe(11);
  });

  it('does not push the verdict to not guilty the way a made-up vote did', async () => {
    // 7 of 12 would convict; with 5 of the not-guilty side unreachable the result must follow the 7 who voted.
    behave = (system) => {
      const n = Number(/You are Juror (\d+),/.exec(system)?.[1]);
      return n <= 7 ? guilty : rateLimited();
    };
    const r = await generateJuryDeliberation(base);
    expect(r.outcome).toBe('win');
    expect(r.rounds[0].absent).toBe(5);
  });

  it('a juror who already voted holds that vote if a later call fails', async () => {
    let round2 = false;
    behave = (system, call) => {
      if (call >= 12) round2 = true;
      const n = Number(/You are Juror (\d+),/.exec(system)?.[1]);
      if (!round2) return n === 1 ? guilty : notGuilty; // round 1: split 1-11
      return isJuror(system, 1) ? rateLimited() : notGuilty;
    };
    const r = await generateJuryDeliberation(base);
    const v = r.rounds[1].votes.find(x => x.jurorId === 'j1')!;
    expect(v).toMatchObject({ vote: 'GUILTY', fallback: true });
    expect(r.rounds[1].absent).toBeUndefined();
  });

  it('gives up with an error if fewer than half the jury can be reached', async () => {
    behave = (system) => {
      const n = Number(/You are Juror (\d+),/.exec(system)?.[1]);
      return n <= 6 ? guilty : rateLimited();
    };
    await expect(generateJuryDeliberation(base)).rejects.toThrow(/Only 6 of 12 jurors/);
  });
});
