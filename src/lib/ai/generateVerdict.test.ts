import { beforeEach, describe, expect, it, vi } from 'vitest';

// A plain function, not a spy: a spy that rejects on purpose is reported as an unhandled rejection.
let replies: Array<{ text: string } | Error> = [];
let sticky = false;
let calls = 0;
const generate = {
  mockReset() { replies = []; sticky = false; calls = 0; return generate; },
  mockResolvedValueOnce(r: { text: string }) { replies.push(r); return generate; },
  mockResolvedValue(r: { text: string }) { replies = [r]; sticky = true; return generate; },
  mockFails() { replies = [new Error('rate limited')]; sticky = true; return generate; },
  get callCount() { return calls; }
};
vi.mock('./providerFactory', () => ({
  getAIProvider: () => ({
    isAvailable: () => true,
    generate: async () => {
      calls += 1;
      const next = sticky ? replies[0] : replies.shift();
      if (next instanceof Error) throw next;
      if (!next) throw new Error('no reply queued');
      return next;
    }
  })
}));

import { generateVerdict } from './trialAI';
import { isThinWriteup } from './verdictWriteup';

const vote = (name: string, v: 'GUILTY' | 'NOT_GUILTY', reason: string) => ({ jurorId: name, name, occupation: 'Nurse', vote: v, reason });
const juryResult = {
  outcome: 'lose' as const, guiltyVotes: 3, notGuiltyVotes: 9, unanimous: false,
  rounds: [{ round: 1, guilty: 3, notGuilty: 9, votes: [vote('Ada', 'NOT_GUILTY', 'The key witness contradicted herself.'), vote('Cy', 'GUILTY', 'The timeline fits.')] }]
};
const long = 'The jury finds the defendant not guilty. '.repeat(6) + '\n\n' + 'The prosecution leaned on one witness whose account changed. '.repeat(6) + '\n\n' + 'The defense pointed to missing exhibits. '.repeat(6) + '\n\n' + 'What decided it was doubt. '.repeat(6);

beforeEach(() => generate.mockReset());

describe('generateVerdict: the written decision', () => {
  it('keeps a full decision from the AI as it is', async () => {
    generate.mockResolvedValueOnce({ text: JSON.stringify({ outcome: 'lose', reasoning: long, evidence_cited: ['Exhibit A'], score: 30 }) });
    const v = await generateVerdict([], [], 'State v. Rivera', 'Marco Rivera', 'jury', juryResult as any);
    expect(v.reasoning).toBe(long);
    expect(generate.callCount).toBe(1);
  });

  it('asks again when the first decision is a one-liner', async () => {
    generate
      .mockResolvedValueOnce({ text: JSON.stringify({ outcome: 'lose', reasoning: 'The jury finds the defendant not guilty.', evidence_cited: [], score: 30 }) })
      .mockResolvedValueOnce({ text: JSON.stringify({ outcome: 'lose', reasoning: long, evidence_cited: [], score: 30 }) });
    const v = await generateVerdict([], [], 'State v. Rivera', 'Marco Rivera', 'jury', juryResult as any);
    expect(generate.callCount).toBe(2);
    expect(v.reasoning).toBe(long);
  });

  it('never ends with just "by a vote of 9 to 3" when the AI keeps failing', async () => {
    generate.mockFails();
    const v = await generateVerdict([], [], 'State v. Rivera', 'Marco Rivera', 'jury', juryResult as any);
    expect(v.outcome).toBe('lose');
    expect(isThinWriteup(v.reasoning)).toBe(false);
    expect(v.reasoning).toMatch(/9 to 3/);
    expect(v.reasoning).toMatch(/contradicted herself/);
    expect(v.reasoning).toMatch(/timeline fits/);
  });

  it('pads a thin answer with the jurors\' own reasons', async () => {
    generate.mockResolvedValue({ text: JSON.stringify({ outcome: 'lose', reasoning: 'Not guilty.', evidence_cited: [], score: 30 }) });
    const v = await generateVerdict([], [], 'State v. Rivera', 'Marco Rivera', 'jury', juryResult as any);
    expect(v.reasoning.startsWith('Not guilty.')).toBe(true);
    expect(isThinWriteup(v.reasoning)).toBe(false);
  });

  it('keeps a long decision whose JSON was broken by raw line breaks', async () => {
    const broken = `{\n "outcome": "lose",\n "reasoning": "${long.replace(/\n\n/g, '\n\n')}",\n "evidence_cited": [],\n "score": 30\n}`;
    generate.mockResolvedValueOnce({ text: broken });
    const v = await generateVerdict([], [], 'State v. Rivera', 'Marco Rivera', 'jury', juryResult as any);
    expect(isThinWriteup(v.reasoning)).toBe(false);
    expect(v.reasoning).toMatch(/What decided it was doubt/);
    expect(generate.callCount).toBe(1);
  });
});
