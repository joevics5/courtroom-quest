import { describe, expect, it } from 'vitest';
import { MAX_WITNESS_HISTORY, buildExaminationRecap, buildWitnessHistory } from './witnessHistory';

const q = (content: string, w = 'w1', role = 'defense') => ({ event_type: 'witness_examination', speaker_role: role, content, metadata: { witness_id: w } });
const a = (content: string, w = 'w1') => ({ event_type: 'witness_examination', speaker_role: 'witness', content, metadata: { witness_id: w } });

describe('witness history', () => {
  it('pairs each question with the answer that followed', () => {
    const h = buildWitnessHistory([q('Where were you?'), a('At home.'), q('Alone?'), a('Yes.')], 'w1');
    expect(h).toEqual([{ question: 'Where were you?', response: 'At home.' }, { question: 'Alone?', response: 'Yes.' }]);
  });

  it('never lists the witness answers as questions (the old blank-answer bug)', () => {
    const h = buildWitnessHistory([q('Q1'), a('A1')], 'w1');
    expect(h).toHaveLength(1);
    expect(h.every(p => p.response !== '')).toBe(true);
  });

  it('keeps only the last 5 pairs', () => {
    const events = Array.from({ length: 8 }, (_, i) => [q(`Q${i + 1}`), a(`A${i + 1}`)]).flat();
    const h = buildWitnessHistory(events, 'w1');
    expect(h).toHaveLength(MAX_WITNESS_HISTORY);
    expect(h[0].question).toBe('Q4');
    expect(h[4].response).toBe('A8');
  });

  it('only counts this witness, and ignores other kinds of events', () => {
    const events = [q('For w2', 'w2'), a('From w2', 'w2'), { event_type: 'objection', speaker_role: 'defense', content: 'Objection', metadata: { witness_id: 'w1' } }, q('For w1'), a('From w1')];
    expect(buildWitnessHistory(events, 'w1')).toEqual([{ question: 'For w1', response: 'From w1' }]);
  });

  it('marks a question that got no answer (e.g. an objection was sustained)', () => {
    expect(buildWitnessHistory([q('Leading question?')], 'w1')).toEqual([{ question: 'Leading question?', response: '(no answer was given)' }]);
  });

  it('works across both sides: direct and cross questions interleave with answers', () => {
    const h = buildWitnessHistory([q('Direct?', 'w1', 'prosecution'), a('Yes.'), q('Cross?', 'w1', 'defense'), a('No.')], 'w1');
    expect(h.map(p => p.question)).toEqual(['Direct?', 'Cross?']);
  });

  it('gives the AI counsel a readable recap, clipped to a sensible length', () => {
    const recap = buildExaminationRecap([q('Where were you?'), a('x'.repeat(500))], 'w1', 'Dr. Okoro', 5, 50);
    expect(recap).toMatch(/^LAST 1 QUESTION AND ANSWER WITH DR\. OKORO:/);
    expect(recap).toContain('Q: Where were you?');
    expect(recap).toContain('x'.repeat(50) + '...');
    expect(recap).not.toContain('x'.repeat(51));
  });

  it('gives no recap before anything has been asked', () => {
    expect(buildExaminationRecap([], 'w1', 'Dr. Okoro')).toBe('');
  });
});
