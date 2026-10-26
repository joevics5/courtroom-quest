import type { PhaseType } from './trialTurnSystem';

/**
 * How many questions one side may ask in a single examination (one witness, one direct / cross / redirect).
 * The phase clock still runs too, so whichever comes first ends the examination.
 *
 *   - Direct and cross get the same number, so neither side has an edge.
 *   - Redirect is half, because it only repairs what cross damaged.
 *   - Longer trials allow more questions, matching their longer clocks.
 *
 * The same limit applies to the AI examiner, which also keeps AI usage per trial bounded.
 */
const LIMITS: Record<15 | 30 | 60, { direct: number; cross: number; redirect: number }> = {
  15: { direct: 4, cross: 4, redirect: 2 },
  30: { direct: 6, cross: 6, redirect: 3 },
  60: { direct: 8, cross: 8, redirect: 4 }
};

/** The question cap for this trial length and examination type, or null when the phase has none. */
export function questionLimitFor(trialDuration: number | null | undefined, phaseType: PhaseType | null | undefined): number | null {
  if (!trialDuration || !phaseType) return null;
  const row = LIMITS[trialDuration as 15 | 30 | 60];
  if (!row) return null;
  if (phaseType === 'direct' || phaseType === 'cross' || phaseType === 'redirect') return row[phaseType];
  return null;
}

/** What the player sees next to the box: "Question 2 of 6", or "Last question". */
export function questionCounterLabel(asked: number, limit: number | null): string | null {
  if (limit === null) return null;
  if (asked >= limit) return 'No questions left';
  if (asked === limit - 1) return 'Last question';
  return `Question ${asked + 1} of ${limit}`;
}
