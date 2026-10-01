// Blank templates used by the "Add" buttons in the review screen.
import type { DraftEvidence, DraftWitness } from './types';

export const BLANK_WITNESS = (n: number): DraftWitness => ({
  code: `W${n}`, name: '', age: null, occupation: '', role: '', relationship: '', background: '',
  base_testimony: '', personality_traits: [],
  secret: {
    communication_style: '', reliability: '', bias: '', motivation: '', emotional_state: '',
    wants: '', fears: '', protecting: '', truthfulness: 'truthful',
    knowledge: [], opinions: [], suspicions: [], secrets: [], motivated_omissions: [], limitations: [],
    sample_questions: { prosecution: [], defence: [], damaging: [] },
  },
});

export const BLANK_EVIDENCE = (n: number): DraftEvidence => ({
  code: `E${n}`, title: '', evidence_type: 'documents', description: '', content: '', date_created: '', is_hidden: false,
  secret: {
    classification: 'ambiguous', origin: '', possessed_by: '', how_available: '', proves: '', does_not_prove: '',
    prosecution_interpretation: '', defence_interpretation: '', alternative_interpretation: '',
    hidden_implications: '', contradictions: [], potential_objections: [], authentication: '',
    importance: 3, discovery_difficulty: 'medium', fact_ids: [], related_evidence_codes: [], witnesses: [],
    generation: { kind: 'none', image_prompt: '', must_show: [], subtle_details: [], must_not_show: [] },
  },
});

export const BLANKS: Record<string, () => any> = {
  facts: () => ({ id: '', text: '', status: 'confirmed', public: false }),
  timeline: () => ({ when: '', where: '', people: [], event: '', fact_ids: [], status: 'confirmed', visibility: 'public' }),
  loopholes: () => ({
    id: '', side: 'prosecution', type: '', description: '', discoverable_by: '', evidence_codes: [], witness_codes: [],
    fact_ids: [], sample_questions: [], argument: '', counterargument: '', how_opponent_neutralizes: '', difficulty: 'medium',
  }),
  red_herrings: () => ({ id: '', description: '', why_it_looks_important: '', real_explanation: '', evidence_codes: [], witness_codes: [] }),
  contradictions: () => ({
    id: '', source_a: '', statement_a: '', source_b: '', statement_b: '', evidence_codes: [],
    true_position: '', how_discovered: '', impact: '', benefits: 'neither',
  }),
  legal_issues: () => ({
    issue: '', why_it_matters: '', benefits: '', evidence_codes: [], witness_codes: [], possible_objections: [], counterarguments: [],
  }),
  objections: () => ({ type: '', trigger: '', example: '', why_valid: '', likely_ruling: '' }),
  investigation: () => ({ level: 'easy', discovery: '', how_found: '', evidence_codes: [] }),
  verdict_issues: () => ({ issue: '', prosecution_support: '', defence_support: '', unresolved: '' }),
  knowledge: () => ({ fact_id: '', state: 'knows', text: '', reveal_trigger: '' }),
  'secret.witnesses': () => ({ witness_code: '', role: 'knows' }),
};
