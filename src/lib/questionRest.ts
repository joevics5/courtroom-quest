/**
 * Rest time between questions during witness examination.
 *
 * There is no cap on how many questions a side may ask (the phase clock is the only limit). Instead,
 * after each witness answer the questioning counsel has to wait before asking the next one. That
 * wait is what lets the answer be heard and gives the opposing counsel time to object.
 *
 * Longer trials get a slightly longer pause. Always between 10 and 20 seconds.
 */
const REST_SECONDS: Record<number, number> = { 5: 10, 15: 12, 30: 15, 60: 20 };

/** Seconds counsel must wait after a witness answer before the next question. */
export function questionRestSeconds(trialDuration: number | null | undefined): number {
  if (!trialDuration) return 15;
  return REST_SECONDS[trialDuration] ?? 15;
}

/** Minimum objection window left after the answer has finished being heard (or a ruling was read). */
export const OBJECTION_WINDOW_SECONDS = 5;

/** What the player sees while they wait: "Next question in 0:12". */
export function questionRestLabel(secondsLeft: number | null): string | null {
  if (secondsLeft === null || secondsLeft <= 0) return null;
  const m = Math.floor(secondsLeft / 60);
  const s = String(secondsLeft % 60).padStart(2, '0');
  return `Next question in ${m}:${s}`;
}
