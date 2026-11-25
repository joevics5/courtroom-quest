import i18n from '../i18n';
/** Redirect examination is one short question from the counsel who called the witness, after the cross. */
export const REDIRECT_MAX_CHARS = 200;

/** Why this redirect question can't be sent, or null when it is fine. */
export function redirectQuestionProblem(text: string): string | null {
  const question = text.trim();
  if (question.length > REDIRECT_MAX_CHARS) return i18n.t('court.redirectShort', { max: REDIRECT_MAX_CHARS });
  if ((question.match(/\?/g) ?? []).length > 1) return i18n.t('court.redirectOne');
  return null;
}

type RedirectEvent = { speaker_role?: string | null; metadata?: unknown };
const inRedirect = (e: RedirectEvent, phase: number) => {
  const meta = (e.metadata ?? {}) as { phase?: number; examination_type?: string };
  return meta.phase === phase && meta.examination_type === 'redirect';
};

/** Has the counsel put this redirect's one question? */
export function redirectQuestionAsked(events: RedirectEvent[], phase: number): boolean {
  return events.some(e => e.speaker_role !== 'witness' && inRedirect(e, phase));
}

/** Has the witness answered it? (Then the redirect is over once the answer has been read.) */
export function redirectAnswered(events: RedirectEvent[], phase: number): boolean {
  return events.some(e => e.speaker_role === 'witness' && inRedirect(e, phase));
}

