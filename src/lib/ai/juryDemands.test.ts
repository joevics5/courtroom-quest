import { beforeEach, describe, expect, it, vi } from 'vitest';

let calls: string[] = [];
let reply: (index: number, system: string) => string = () => '';

vi.mock('./providerFactory', () => ({
  getAIProvider: () => ({
    isAvailable: () => true,
    generate: async (req: { system?: string }) => {
      const i = calls.length;
      calls.push(req.system ?? '');
      return { text: reply(i, req.system ?? '') };
    }
  })
}));

import { generateJuryDeliberation, type JurorProfile } from './trialAI';
import { reliefDemands } from '../requestedRelief';

const jurors: JurorProfile[] = Array.from({ length: 12 }, (_, i) => ({ id: `j${i}`, name: `Juror ${i + 1}` }));
const relief = { primary: 'Order Tyler to pay for the steak', financial: '$300 plus $200 in legal costs', additional: ['Order Tyler to leave within 14 days'] };
const demands = reliefDemands(relief);
const base = { jurors, events: [], evidence: [], caseTitle: 'Roommate From Hell' };

beforeEach(() => { calls = []; });

describe('reliefDemands', () => {
  it('gives each demand a stable id, main first', () => {
    expect(demands.map(d => d.id)).toEqual(['main', 'money', 'also1']);
    expect(reliefDemands({ primary: 'A', additional: ['B', 'C'] }).map(d => d.id)).toEqual(['main', 'also1', 'also2']);
    expect(reliefDemands(null)).toEqual([]);
  });
});

describe('jury votes on every demand inside the existing juror call', () => {
  it('makes no extra calls: one per juror per round', async () => {
    reply = () => JSON.stringify({ vote: 'GUILTY', reason: 'ate it', demands: { money: true, also1: true } });
    const result = await generateJuryDeliberation({ ...base, demands });
    expect(calls).toHaveLength(12); // unanimous on the main request in round 1, so it stops
    expect(result.rounds).toHaveLength(1);
  });

  it('shows each juror the demands and asks for a vote on each one', async () => {
    reply = () => JSON.stringify({ vote: 'GUILTY', reason: 'x', demands: { money: true, also1: true } });
    await generateJuryDeliberation({ ...base, demands });
    expect(calls[0]).toContain('[main] Order Tyler to pay for the steak');
    expect(calls[0]).toContain('[money] $300 plus $200 in legal costs');
    expect(calls[0]).toContain('"demands": {"money": true or false, "also1": true or false}');
  });

  it('tallies each demand from the same ballot, and the main request decides the outcome', async () => {
    // main: 12-0 guilty. money: 7 grant / 5 refuse. extra order: 4 grant / 8 refuse.
    reply = (i) => JSON.stringify({ vote: 'GUILTY', reason: 'r', demands: { money: i < 7, also1: i < 4 } });
    const result = await generateJuryDeliberation({ ...base, demands });
    expect(result.outcome).toBe('win');
    const byId = Object.fromEntries(result.demands!.map(d => [d.id, d]));
    expect(byId.main).toMatchObject({ grant: 12, deny: 0, granted: true });
    expect(byId.money).toMatchObject({ grant: 7, deny: 5, granted: true });
    expect(byId.also1).toMatchObject({ grant: 4, deny: 8, granted: false });
  });

  it('a tie on a demand means not granted', async () => {
    reply = (i) => JSON.stringify({ vote: 'GUILTY', reason: 'r', demands: { money: i < 6, also1: true } });
    const result = await generateJuryDeliberation({ ...base, demands });
    expect(result.demands!.find(d => d.id === 'money')).toMatchObject({ grant: 6, deny: 6, granted: false });
  });

  it('a juror who leaves a demand out counts as refusing it', async () => {
    reply = (i) => JSON.stringify(i === 0 ? { vote: 'GUILTY', reason: 'r' } : { vote: 'GUILTY', reason: 'r', demands: { money: true, also1: true } });
    const result = await generateJuryDeliberation({ ...base, demands });
    expect(result.demands!.find(d => d.id === 'money')).toMatchObject({ grant: 11, deny: 1 });
  });

  it('only the main request decides when voting stops, so a split on money does not add rounds', async () => {
    reply = (i) => JSON.stringify({ vote: 'GUILTY', reason: 'r', demands: { money: i % 2 === 0, also1: i % 3 === 0 } });
    const result = await generateJuryDeliberation({ ...base, demands });
    expect(result.rounds).toHaveLength(1);
    expect(calls).toHaveLength(12);
  });

  it('keeps running rounds as before when the main request is split', async () => {
    reply = (i) => JSON.stringify({ vote: i % 12 < 8 ? 'GUILTY' : 'NOT_GUILTY', reason: 'r', demands: { money: true, also1: false } });
    const result = await generateJuryDeliberation({ ...base, demands });
    expect(result.rounds).toHaveLength(3);
    expect(calls).toHaveLength(36);
    expect(result.outcome).toBe('win');
    expect(result.demands!.find(d => d.id === 'main')).toMatchObject({ grant: 8, deny: 4 });
  });

  it('refusing the main request is a loss and the other results are still reported', async () => {
    reply = () => JSON.stringify({ vote: 'NOT_GUILTY', reason: 'r', demands: { money: true, also1: false } });
    const result = await generateJuryDeliberation({ ...base, demands });
    expect(result.outcome).toBe('lose');
    expect(result.demands!.find(d => d.id === 'money')!.granted).toBe(true);
  });
});

describe('cases with no demand are unchanged', () => {
  it('asks the same question and reports no demand results', async () => {
    reply = () => JSON.stringify({ vote: 'NOT_GUILTY', reason: 'doubt' });
    const result = await generateJuryDeliberation(base);
    expect(calls[0]).not.toContain('ASKING THE COURT TO GRANT');
    expect(calls[0]).not.toContain('"demands"');
    expect(result.demands).toBeUndefined();
    expect(result.outcome).toBe('lose');
  });
});
