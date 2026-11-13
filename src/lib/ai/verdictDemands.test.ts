import { beforeEach, describe, expect, it, vi } from 'vitest';

let prompts: string[] = [];
let reply: Record<string, unknown> = {};

vi.mock('./providerFactory', () => ({
  getAIProvider: () => ({
    isAvailable: () => true,
    generate: async (req: { system?: string }) => {
      prompts.push(req.system ?? '');
      return { text: JSON.stringify(reply) };
    }
  })
}));

import { generateVerdict, type JuryDeliberationResult } from './trialAI';
import { benchRulings, reliefDemands } from '../requestedRelief';

const paragraph = 'The Court has weighed the testimony of each witness and the exhibits admitted during the trial, and it has measured both against the standard that applies to this claim. '.repeat(4);
const decision = [paragraph, paragraph, paragraph, paragraph].join('\n\n');
const demands = reliefDemands({ primary: 'Order Tyler to pay for the steak', financial: '$300 plus $200 in legal costs', additional: ['Order Tyler to leave within 14 days'] });

beforeEach(() => { prompts = []; });

describe('the judge rules on every demand in the one verdict call', () => {
  it('asks for a ruling on each demand and returns them', async () => {
    reply = { outcome: 'win', reasoning: decision, evidence_cited: [], score: 70, demands: { money: true, also1: false } };
    const v = await generateVerdict([], [], 'Roommate From Hell', 'Tyler', 'judge', undefined, undefined, demands);
    expect(prompts).toHaveLength(1);
    expect(prompts[0]).toContain('RULE ON EACH DEMAND');
    expect(prompts[0]).toContain('[money] $300 plus $200 in legal costs');
    expect(prompts[0]).toContain('"demands": {"money": true or false, "also1": true or false}');
    expect(v.outcome).toBe('win');
    expect(v.demands!.map(d => [d.id, d.granted])).toEqual([['main', true], ['money', true], ['also1', false]]);
    expect(v.demands![1]).toMatchObject({ grant: 1, deny: 0 });
    expect((v as any).rulings).toBeUndefined();
  });

  it('a refused main request fails the other demands too', async () => {
    reply = { outcome: 'lose', reasoning: decision, evidence_cited: [], score: 30, demands: { money: true, also1: true } };
    const v = await generateVerdict([], [], 'Roommate From Hell', 'Tyler', 'judge', undefined, undefined, demands);
    expect(v.outcome).toBe('lose');
    expect(v.demands!.every(d => !d.granted)).toBe(true);
  });

  it('never returns partial when there is a main request', async () => {
    reply = { outcome: 'partial', reasoning: decision, evidence_cited: [], score: 50, demands: { money: true } };
    const v = await generateVerdict([], [], 'Roommate From Hell', 'Tyler', 'judge', undefined, undefined, demands);
    expect(v.outcome).toBe('lose');
  });

  it('a demand the judge leaves out counts as refused', async () => {
    reply = { outcome: 'win', reasoning: decision, evidence_cited: [], score: 70 };
    const v = await generateVerdict([], [], 'Roommate From Hell', 'Tyler', 'judge', undefined, undefined, demands);
    expect(v.demands!.map(d => d.granted)).toEqual([true, false, false]);
  });
});

describe('the foreperson states the jury findings without changing them', () => {
  const juryResult = {
    outcome: 'win', guiltyVotes: 8, notGuiltyVotes: 4, unanimous: false, rounds: [{ round: 1, votes: [], guilty: 8, notGuilty: 4 }],
    demands: demands.map((d, i) => ({ id: d.id, kind: d.kind, label: d.label, text: d.text, grant: [8, 7, 3][i], deny: [4, 5, 9][i], granted: [true, true, false][i] }))
  } as unknown as JuryDeliberationResult;

  it('shows the tally for each demand and returns the jury results as they are', async () => {
    reply = { outcome: 'lose', reasoning: decision, evidence_cited: [], score: 60 };
    const v = await generateVerdict([], [], 'Roommate From Hell', 'Tyler', 'jury', juryResult, undefined, demands);
    expect(prompts[0]).toContain("THE JURY'S FINDINGS ON EACH DEMAND");
    expect(prompts[0]).toContain('$300 plus $200 in legal costs: GRANTED (7 to 5)');
    expect(prompts[0]).toContain('Order Tyler to leave within 14 days: NOT GRANTED (3 to 9)');
    expect(prompts[0]).not.toContain('RULE ON EACH DEMAND');
    expect(v.outcome).toBe('win');
    expect(v.demands).toEqual(juryResult.demands);
  });
});

describe('without a demand nothing changes', () => {
  it('keeps the old prompt and outcome options', async () => {
    reply = { outcome: 'partial', reasoning: decision, evidence_cited: [], score: 50 };
    const v = await generateVerdict([], [], 'Old Case', 'X', 'judge');
    expect(prompts[0]).not.toContain('RULE ON EACH DEMAND');
    expect(prompts[0]).toContain('"win" or "lose" or "partial"');
    expect(v.outcome).toBe('partial');
    expect(v.demands).toBeUndefined();
  });
});

describe('benchRulings', () => {
  it('derives the outcome from the main request', () => {
    expect(benchRulings(demands, { money: true }, 'win').outcome).toBe('win');
    expect(benchRulings(demands, {}, 'lose').outcome).toBe('lose');
  });
});
