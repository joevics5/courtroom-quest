// Proves an AI-parsed custom case reaches the SAME trial AI as a case-board case, in the shape that AI reads.
// The provider is mocked so we can inspect exactly what would be sent to the model. No trial code is changed.
import { vi } from 'vitest';

const sent = vi.hoisted(() => ({ requests: [] as { system: string; user: string }[] }));
vi.mock('../ai/providerFactory', () => ({
  getAIProvider: () => ({
    name: 'mock', isAvailable: () => true,
    generate: async (r: { system: string; user: string }) => { sent.requests.push(r); return { text: 'ok' }; },
  }),
}));

import { generateProsecutionOpeningStatement, generateWitnessResponse } from '../ai/trialAI';
import { derivePersonality, deriveKnowledgeScope } from './save';
import type { DraftEvidence, DraftWitness } from './types';
import type { Witness } from '../../types';

const witness = {
  code: 'W1', name: 'Ada Obi', age: 34, occupation: 'Teacher', role: 'Neighbour', relationship: 'Lives next door',
  background: 'Lives opposite the shop.', base_testimony: 'I saw a car outside around nine.',
  personality_traits: ['guarded'],
  secret: {
    communication_style: 'terse', reliability: '', bias: 'Dislikes the defendant', motivation: '', emotional_state: 'nervous',
    wants: '', fears: '', protecting: '', truthfulness: 'withholding',
    knowledge: [
      { fact_id: 'F1', state: 'knows', text: 'The car was a grey saloon', reveal_trigger: '' },
      { fact_id: 'F2', state: 'hidden', text: 'She had argued with the owner the week before', reveal_trigger: 'asked about prior disputes' },
      { fact_id: 'F3', state: 'unknown', text: 'Who held the spare keys', reveal_trigger: '' },
    ],
    opinions: ['It looked planned'], suspicions: [], secrets: [], motivated_omissions: [], limitations: [],
    sample_questions: { prosecution: [], defence: [], damaging: ['Did you see the driver?'] },
  },
} as unknown as DraftWitness;

const evidence = [
  { code: 'E1', title: 'CCTV still', secret: { witnesses: [{ witness_code: 'W1', role: 'authenticates' }] } },
] as unknown as DraftEvidence[];

const asDbWitness = (): Witness => ({
  id: 'w-1', case_id: 'c-1', name: witness.name, role: witness.role, background: witness.background,
  base_testimony: witness.base_testimony, use_ai: true, created_at: '',
  personality_traits: derivePersonality(witness), knowledge_scope: deriveKnowledgeScope(witness, evidence),
}) as unknown as Witness;

beforeEach(() => { sent.requests.length = 0; });

describe('AI-parsed custom case through the existing trial AI', () => {
  it('witness interviews use the structured knowledge model, with hidden knowledge gated', async () => {
    await generateWitnessResponse(asDbWitness(), 'What did you see?', []);
    const { system } = sent.requests[0];
    expect(system).toContain('YOUR KNOWLEDGE');
    expect(system).toContain('The car was a grey saloon');
    expect(system).toMatch(/ONLY REVEAL IF SPECIFICALLY, SKILLFULLY ASKED[\s\S]*She had argued with the owner[\s\S]*asked about prior disputes/);
    expect(system).toMatch(/GENUINELY DO NOT KNOW[\s\S]*Who held the spare keys/);
    expect(system).toContain('defensive and guarded');           // personality derived from the parsed traits
    expect(system).toContain('EVIDENCE YOU CAN AUTHENTICATE');
    expect(system).toContain('CCTV still');
  });

  it('does not leak the lawyer-facing analysis into what a witness is told', async () => {
    await generateWitnessResponse(asDbWitness(), 'Tell me everything', []);
    const { system } = sent.requests[0];
    expect(system).not.toContain('Did you see the driver?');     // "damaging" sample question is playbook-only
    expect(system).not.toContain('Dislikes the defendant');      // secret.bias stays in witness_secrets
  });

  it('opposing counsel is given the custom case description, evidence and witnesses like any case-board case', async () => {
    await generateProsecutionOpeningStatement({
      caseTitle: 'State v. Doe', prosecutorName: 'Counsel', side: 'prosecution', difficulty: 'medium', defendantName: 'Doe',
      caseDescription: 'Doe is charged with fraud over missing funds in March.',
      timeLimitMinutes: 5,
      availableEvidence: [{ id: 'e-1', title: 'CCTV still', description: 'A still frame', exhibit_label: 'Exhibit A' }],
      availableWitnesses: [{ id: 'w-1', name: 'Ada Obi', role: 'Neighbour' }],
      investigationEvidenceSummary: '', investigationWitnessTranscripts: '',
    });
    const { system } = sent.requests[0];
    expect(system).toContain('Doe is charged with fraud over missing funds in March.');
    expect(system).toContain('Exhibit A');
    expect(system).toContain('Ada Obi');
  });
});
