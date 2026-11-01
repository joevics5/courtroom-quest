/**
 * Read-out time after each witness answer during witness examination.
 *
 * There is no cap on how many questions a side may ask (the time pool is the only limit). After each
 * answer the questioning counsel waits a fixed 20 seconds while the answer is read out. The trial clock
 * is stopped for it, so it never costs anyone examination time, and it gives the other side time to object.
 */
export const READOUT_SECONDS = 20;

/** Seconds counsel must wait after a witness answer before the next question. Same in every mode. */
export function questionRestSeconds(_trialDuration?: number | null): number {
  return READOUT_SECONDS;
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
