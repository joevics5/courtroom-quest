/**
 * What a witness (and the AI counsel questioning one) remembers of the examination so far:
 * the last few real question-and-answer pairs, so follow-ups like "you said earlier..." work
 * without sending the whole transcript every time.
 */
export const MAX_WITNESS_HISTORY = 5;

interface ExamEvent {
  event_type?: string;
  speaker_role?: string;
  speaker_name?: string | null;
  content: string;
  metadata?: { witness_id?: string } | null;
}

export interface QA {
  question: string;
  response: string;
}

/** Pairs each question put to this witness with the answer that followed, newest last. */
export function buildWitnessHistory(events: ExamEvent[], witnessId: string, max: number = MAX_WITNESS_HISTORY): QA[] {
  const exam = events.filter(e => e.event_type === 'witness_examination' && e.metadata?.witness_id === witnessId);
  const pairs: QA[] = [];
  for (let i = 0; i < exam.length; i++) {
    const e = exam[i];
    if (e.speaker_role === 'witness') continue; // answers are picked up with their question
    const next = exam[i + 1];
    const answered = next && next.speaker_role === 'witness';
    pairs.push({ question: e.content, response: answered ? next.content : '(no answer was given)' });
  }
  return pairs.slice(-max);
}

/** The same exchange as plain text for the AI counsel, in fuller detail than the general transcript summary. */
export function buildExaminationRecap(events: ExamEvent[], witnessId: string, witnessName: string, max: number = MAX_WITNESS_HISTORY, maxChars = 300): string {
  const pairs = buildWitnessHistory(events, witnessId, max);
  if (pairs.length === 0) return '';
  const clip = (t: string) => (t.length > maxChars ? `${t.slice(0, maxChars)}...` : t);
  const lines = pairs.map((p, i) => `${i + 1}. Q: ${clip(p.question)}\n   A (${witnessName}): ${clip(p.response)}`);
  return `LAST ${pairs.length} QUESTION${pairs.length === 1 ? '' : 'S'} AND ANSWER${pairs.length === 1 ? '' : 'S'} WITH ${witnessName.toUpperCase()}:\n${lines.join('\n')}`;
}
