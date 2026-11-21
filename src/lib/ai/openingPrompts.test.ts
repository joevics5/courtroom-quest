import { beforeEach, describe, expect, it, vi } from 'vitest';

let requests: Array<{ system?: string; user?: string; temperature?: number }> = [];
vi.mock('./providerFactory', () => ({
  getAIProvider: () => ({
    isAvailable: () => true,
    generate: async (request: { system?: string; user?: string; temperature?: number }) => {
      requests.push(request);
      return { text: 'Members of the court...' };
    }
  })
}));

import { generateProsecutionOpeningStatement } from './trialAI';

beforeEach(() => { requests = []; });

const context = (side: 'prosecution' | 'defense') => ({
  caseTitle: 'The Office Lunch Thief',
  prosecutorName: 'DA Harrison',
  side,
  defendantName: 'Gary Whitlock',
  caseDescription: 'A lunch went missing from the breakroom fridge.',
  timeLimitMinutes: 2,
  availableEvidence: [],
  availableWitnesses: [],
  investigationEvidenceSummary: 'Camera still shows Gary at the fridge.',
  investigationWitnessTranscripts: 'Maya: my lunch vanished.'
});

describe('opening statement prompt', () => {
  it('keeps the prosecution to the case file and forbids inventing what the defense said', async () => {
    await generateProsecutionOpeningStatement(context('prosecution'));
    const system = requests[0].system ?? '';
    expect(system).toContain('OPENING STATEMENT RULES');
    expect(system).toContain('The other side has NOT spoken yet');
    expect(system).toContain('the defense says');
    expect(system).toContain('Never invent');
    expect(system).toContain('Witnesses have not testified yet');
  });

  it('holds the defense to the same rules, with the prosecution as the other side', async () => {
    await generateProsecutionOpeningStatement(context('defense'));
    const system = requests[0].system ?? '';
    expect(system).toContain('the prosecution says');
    expect(system).not.toContain('the defense says');
  });

  it('writes openings at a lower temperature than the rest of counsel\'s work', async () => {
    await generateProsecutionOpeningStatement(context('prosecution'));
    expect(requests[0].temperature).toBe(0.5);
  });
});
