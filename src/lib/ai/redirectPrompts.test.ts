import { beforeEach, describe, expect, it, vi } from 'vitest';

let requests: Array<{ system?: string; user?: string }> = [];
let reply = '{"action":"rest"}';
vi.mock('./providerFactory', () => ({
  getAIProvider: () => ({
    isAvailable: () => true,
    generate: async (request: { system?: string; user?: string }) => {
      requests.push(request);
      return { text: reply };
    }
  })
}));

import { generateObjectionRuling, generateProsecutionAction, generateWitnessResponse } from './trialAI';

beforeEach(() => { requests = []; reply = '{"action":"rest"}'; });

const counsel = (phase: string) => ({
  role: 'prosecution' as const,
  side: 'prosecution' as const,
  phase,
  time_remaining_seconds: 30,
  current_witness: 'Dr. Lee',
  available_witnesses: [{ id: 'w1', name: 'Dr. Lee' }],
  available_evidence: [],
  recent_transcript: 'Cross-examination of Dr. Lee...',
  allowed_actions: [{ action: 'ask_question', description: 'Ask a question' }, { action: 'rest', description: 'Rest' }],
  trial_duration: 15,
  witnesses_called_count: 1
});

describe('redirect prompts', () => {
  it('tells the AI counsel to redirect only to repair damage, with one question about what the cross raised', async () => {
    await generateProsecutionAction(counsel('Prosecution Witness 1 - Redirect') as any);
    const system = requests[0].system ?? '';
    expect(system).toContain('REDIRECT EXAMINATION');
    expect(system).toContain('exactly ONE short question');
    expect(system).toContain('did not hurt your witness');
    expect(system).toContain('choose "rest"');
    expect(system).toContain('Never open a new topic');
  });

  it('does not add the redirect rules to other phases', async () => {
    await generateProsecutionAction(counsel('Prosecution Witness 1 - Cross-Examination') as any);
    expect(requests[0].system ?? '').not.toContain('REDIRECT EXAMINATION');
  });

  it('keeps the witness consistent with what they said on cross when their own counsel redirects', async () => {
    reply = 'I only meant that the door was open.';
    const witness = { id: 'w1', name: 'Dr. Lee', role: 'Witness', personality_traits: {}, knowledge_scope: null } as any;
    await generateWitnessResponse(witness, 'What did you mean?', [], 'own_counsel_redirect');
    const system = requests[0].system ?? '';
    expect(system).toContain('redirect examination');
    expect(system).toContain('consistent with everything you already said under cross-examination');
  });

  it('lets the judge rule on an outside-the-scope objection against what the cross raised', async () => {
    reply = '{"ruling":"sustained","reasoning":"New topic."}';
    await generateObjectionRuling({
      objection_by: 'defense',
      objection_reason: 'Outside the scope of cross-examination',
      questioned_statement: 'Where did you grow up?',
      current_phase: 'Prosecution Witness 1 - Redirect',
      recent_transcript: 'Cross: ...'
    }).catch(() => undefined);
    const system = requests[0].system ?? '';
    expect(system).toContain('Outside the scope of cross-examination');
    expect(system).toContain('opens a new topic the cross-examination did not raise');
  });
});
