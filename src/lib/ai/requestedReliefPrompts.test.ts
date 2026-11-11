import { beforeEach, describe, expect, it, vi } from 'vitest';

const seen: Array<{ system?: string; user?: string }> = [];
vi.mock('./providerFactory', () => ({
  getAIProvider: () => ({
    isAvailable: () => true,
    generate: async (req: { system?: string; user?: string }) => {
      seen.push(req);
      return { text: JSON.stringify({ outcome: 'lose', reasoning: 'x', evidence_cited: [], score: 40, action: 'rest' }) };
    }
  })
}));

import { generateProsecutionAction, generateProsecutionOpeningStatement, generateClosingArgument, generateVerdict } from './trialAI';
import { reliefPromptBlock } from '../requestedRelief';

const relief = { primary: 'Order Tyler Brandt to pay for the steak', financial: '$300 plus $200 in legal costs', additional: ['Order Tyler to leave within 14 days'] };

beforeEach(() => { seen.length = 0; });

describe('the demand reaches the AI', () => {
  it('shows the prosecuting AI the demand in the opening statement', async () => {
    await generateProsecutionOpeningStatement({
      caseTitle: 'Roommate From Hell', prosecutorName: 'P', side: 'prosecution', caseDescription: 'desc', timeLimitMinutes: 5,
      availableEvidence: [], availableWitnesses: [], investigationEvidenceSummary: '', investigationWitnessTranscripts: '',
      requestedRelief: reliefPromptBlock(relief, 'prosecution')
    });
    expect(seen[0].system).toContain('$300 plus $200 in legal costs');
    expect(seen[0].system).toContain('arguing for exactly this relief');
  });

  it('tells a defending AI to challenge it in the closing', async () => {
    await generateClosingArgument({
      caseTitle: 'Roommate From Hell', prosecutorName: 'D', side: 'defense', caseDescription: 'desc', timeLimitMinutes: 5,
      trialTranscriptSummary: '', evidenceSubmitted: [], witnessesCalled: [], requestedRelief: reliefPromptBlock(relief, 'defense')
    });
    expect(seen[0].system).toContain('Order Tyler to leave within 14 days');
    expect(seen[0].system).toContain('Challenge it');
  });

  it('gives the AI counsel the demand while it picks actions', async () => {
    await generateProsecutionAction({
      role: 'prosecution', side: 'prosecution', phase: 'Direct', time_remaining_seconds: 100, current_witness: null,
      available_witnesses: [], available_evidence: [], recent_transcript: '', allowed_actions: ['rest'] as any,
      trial_duration: 30, witnesses_called_count: 0, requestedRelief: reliefPromptBlock(relief, 'prosecution')
    });
    expect(seen[0].system).toContain('Order Tyler Brandt to pay for the steak');
  });

  it('lets the judge see the demand before deciding, without being bound by it', async () => {
    await generateVerdict([], [], 'Roommate From Hell', 'Tyler', 'judge', undefined, reliefPromptBlock(relief, 'judge'));
    expect(seen[0].system).toContain('$300 plus $200 in legal costs');
    expect(seen[0].system).toContain('you may grant less than asked');
  });

  it('leaves the prompts unchanged when the case has no demand', async () => {
    await generateVerdict([], [], 'Old Case', 'X', 'judge', undefined, reliefPromptBlock(null, 'judge'));
    expect(seen[0].system).not.toContain('ASKING THE COURT TO GRANT');
  });
});
