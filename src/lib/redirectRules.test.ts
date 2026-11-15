import { describe, expect, it } from 'vitest';
import { REDIRECT_MAX_CHARS, redirectAnswered, redirectQuestionAsked, redirectQuestionProblem } from './redirectRules';

describe('redirectQuestionProblem', () => {
  it('accepts one short question', () => {
    expect(redirectQuestionProblem('Why did you leave the building at nine?')).toBeNull();
    expect(redirectQuestionProblem('  Tell the court what you meant by that  ')).toBeNull();
  });

  it('refuses several questions in one', () => {
    expect(redirectQuestionProblem('Where were you? And who was with you?')).toMatch(/one question only/);
  });

  it('refuses a long question', () => {
    expect(redirectQuestionProblem('a'.repeat(REDIRECT_MAX_CHARS + 1))).toMatch(/short question/);
    expect(redirectQuestionProblem('a'.repeat(REDIRECT_MAX_CHARS))).toBeNull();
  });
});

describe('redirect progress', () => {
  const question = { speaker_role: 'prosecution', metadata: { phase: 12, examination_type: 'redirect' } };
  const answer = { speaker_role: 'witness', metadata: { phase: 12, examination_type: 'redirect' } };
  const crossQuestion = { speaker_role: 'defense', metadata: { phase: 11, examination_type: 'cross' } };

  it('is not asked until the counsel puts the question, and not answered until the witness replies', () => {
    expect(redirectQuestionAsked([crossQuestion], 12)).toBe(false);
    expect(redirectAnswered([crossQuestion], 12)).toBe(false);
    expect(redirectQuestionAsked([crossQuestion, question], 12)).toBe(true);
    expect(redirectAnswered([crossQuestion, question], 12)).toBe(false);
    expect(redirectAnswered([crossQuestion, question, answer], 12)).toBe(true);
  });

  it('ignores the cross-examination and other phases', () => {
    expect(redirectQuestionAsked([question], 13)).toBe(false);
    expect(redirectAnswered([{ speaker_role: 'witness', metadata: { phase: 11, examination_type: 'cross' } }], 11)).toBe(false);
  });
});


import { examinationLabel, generateTranscript } from './transcriptGenerator';
import { buildTranscriptSummary } from './ai/trialAI';

describe('redirect in the transcript', () => {
  it('labels cross-examination and redirect, and leaves direct examination alone', () => {
    expect(examinationLabel({ examination_type: 'cross' })).toBe(' (cross-examination)');
    expect(examinationLabel({ examination_type: 'redirect' })).toBe(' (redirect)');
    expect(examinationLabel({ examination_type: 'direct' })).toBe('');
    expect(examinationLabel(undefined)).toBe('');
  });

  it('shows the redirect after the cross it answers, in the written transcript and the summary', () => {
    const events = [
      { id: '1', event_type: 'witness_examination', speaker_role: 'defense', speaker_name: 'Defense', content: 'Were you there?', timestamp: '2026-11-13T10:00:00Z', event_order: 1, metadata: { examination_type: 'cross', phase: 11 } },
      { id: '2', event_type: 'witness_examination', speaker_role: 'prosecution', speaker_name: 'Prosecution', content: 'What did you mean by that?', timestamp: '2026-11-13T10:01:00Z', event_order: 2, metadata: { examination_type: 'redirect', phase: 12 } }
    ] as any[];
    const transcript = generateTranscript(events);
    expect(transcript).toContain('DEFENSE (cross-examination): Were you there?');
    expect(transcript.indexOf('(cross-examination)')).toBeLessThan(transcript.indexOf('(redirect)'));
    expect(transcript).toContain('PROSECUTION (redirect): What did you mean by that?');
    expect(buildTranscriptSummary(events)).toContain('[PROSECUTION (REDIRECT)] What did you mean by that?');
  });
});
