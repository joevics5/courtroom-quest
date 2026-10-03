import { buildPlaybook, otherSide } from './playbook';
import type { Draft } from './types';

const base = {
  witnesses: [
    { code: 'W1', name: 'Ada Obi', secret: { sample_questions: { damaging: ['Did you see his face?'] } } },
    { code: 'W2', name: 'Sgt. Bello', secret: { sample_questions: { damaging: [] } } },
  ],
  evidence: [
    { code: 'E1', title: 'CCTV still', secret: { prosecution_interpretation: 'Shows the defendant', defence_interpretation: 'Face not visible', potential_objections: ['Authenticity'], contradictions: [], authentication: 'Security officer' } },
    { code: 'E2', title: 'Receipt', secret: { prosecution_interpretation: '', defence_interpretation: '', potential_objections: [], contradictions: [], authentication: '' } },
  ],
  loopholes: [
    { id: 'L1', side: 'prosecution', type: 'timeline problem', description: 'Alibi gap at 9pm', argument: 'You cannot account for 9pm', sample_questions: ['Where were you at 9?'], witness_codes: ['W1'], evidence_codes: ['E1'], counterargument: 'Phone log places him elsewhere', how_opponent_neutralizes: 'Call the carrier', difficulty: 'hard' },
    { id: 'L2', side: 'prosecution', description: 'Minor', difficulty: 'easy', witness_codes: [], evidence_codes: [], sample_questions: [] },
    { id: 'L3', side: 'defence', description: 'Unreliable ID', difficulty: 'medium', witness_codes: [], evidence_codes: [], sample_questions: [] },
  ],
  contradictions: [
    { id: 'C1', source_a: 'W1', statement_a: 'Saw him at 9', source_b: 'E1', statement_b: 'Timestamp 8:15', benefits: 'prosecution', impact: 'Damages alibi', how_discovered: 'Cross' },
    { id: 'C2', source_a: 'W2', statement_a: 'x', source_b: 'W2', statement_b: 'y', benefits: 'defence' },
  ],
  objections: [{ type: 'hearsay', example: 'Relaying what a neighbour said', likely_ruling: 'sustained' }],
  legal_issues: [{ issue: 'Chain of custody', why_it_matters: 'Photo handling', benefits: 'prosecution' }, { issue: 'Other', benefits: 'defence' }],
  theories: { defence: { weak_points: ['No alibi witness'], facts_opponent_can_exploit: ['Seen near scene'] }, prosecution: {}, alternative: {} },
} as unknown as Draft;

describe('buildPlaybook', () => {
  it('flips sides', () => {
    expect(otherSide('defence')).toBe('prosecution');
    expect(otherSide('prosecution')).toBe('defence');
  });

  it('when you defend, only prosecution lines of attack are listed, subtle ones first', () => {
    const p = buildPlaybook(base, 'defence');
    expect(p.opponent).toBe('prosecution');
    expect(p.attacks.map((a) => a.title)).toEqual(['Alibi gap at 9pm', 'Minor']);
    expect(p.attacks[0].hardToSpot).toBe(true);
    expect(p.attacks[0].involves).toEqual(['Ada Obi', 'CCTV still']);
    expect(p.attacks[0].yourAnswer).toContain('Phone log places him elsewhere');
    expect(p.attacks[0].yourAnswer).toContain('Call the carrier');
  });

  it('shows the weak points of YOUR theory and contradictions that hurt you, with names resolved', () => {
    const p = buildPlaybook(base, 'defence');
    expect(p.weakPoints).toEqual(['No alibi witness']);
    expect(p.exploitableFacts).toEqual(['Seen near scene']);
    expect(p.contradictions).toHaveLength(1);
    expect(p.contradictions[0].a).toBe('Ada Obi: Saw him at 9');
    expect(p.contradictions[0].b).toBe('CCTV still: Timestamp 8:15');
  });

  it('uses the opponent reading of each exhibit and only lists exhibits with something to attack', () => {
    const p = buildPlaybook(base, 'defence');
    expect(p.exhibitsAtRisk.map((e) => e.title)).toEqual(['CCTV still']);
    expect(p.exhibitsAtRisk[0].theirReading).toBe('Shows the defendant');
    expect(p.exhibitsAtRisk[0].challenges).toContain('Authenticity');
    const asPros = buildPlaybook(base, 'prosecution');
    expect(asPros.exhibitsAtRisk[0].theirReading).toBe('Face not visible');
  });

  it('collects backfire questions, objections, and legal issues in the opponent favour', () => {
    const p = buildPlaybook(base, 'defence');
    expect(p.backfireQuestions).toEqual([{ witness: 'Ada Obi', questions: ['Did you see his face?'] }]);
    expect(p.objections[0]).toMatchObject({ type: 'hearsay', ruling: 'sustained' });
    expect(p.legalIssues.map((l) => l.issue)).toEqual(['Chain of custody']);
  });

  it('flags an empty playbook instead of crashing on a sparse draft', () => {
    const p = buildPlaybook({ ...base, loopholes: [], contradictions: [], theories: { prosecution: {}, defence: {}, alternative: {} } } as unknown as Draft, 'defence');
    expect(p.isEmpty).toBe(true);
  });
});
