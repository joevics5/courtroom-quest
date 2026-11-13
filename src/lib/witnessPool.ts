/**
 * The witness stage runs on one shared pool of time instead of a fixed clock per phase.
 *
 *   pool = trial length - the four statements' standard time - judge deliberation (+ any time left over from the openings)
 *
 * The statements now run on their own, longer clocks (see statementMinutes) that sit outside the pool, so the
 * witness stage is exactly as long as it was before they were lengthened.
 *
 * The pool is split in two halves: the prosecution's case (its witnesses and the defense's cross-examinations
 * of them) comes first, the defense's case second. What the prosecution leaves unused rolls into the defense's
 * half, because it is one pool.
 *
 * When a witness is called, a fifth of what is left in that half is set aside for the other side's
 * cross-examination (4:1). Direct examination may use the rest; when its clock runs out, cross-examination
 * starts. Anything not used by either goes back into the pool, so one or several witnesses fit without knowing
 * the number in advance. The cross-examination reserve is never taken away by a long direct.
 *
 * The pool lives in the saved phase clocks under reserved negative keys, so it is saved and restored with
 * the rest of the trial clock and never collides with a phase number.
 */

/** Seconds left in the whole witness stage that nobody has been given yet. */
export const POOL_KEY = -1;
/** Seconds of the pool set aside for the defense's half while the prosecution's case is running. */
export const DEFENSE_HALF_KEY = -2;
/** Seconds set aside for the cross-examination of the witness now being examined. */
export const CROSS_RESERVE_KEY = -3;

/** Pause at every change of counsel, so a question sent at the last second can still be answered. */
export const HANDOFF_SECONDS = 10;
/** Read time after every opening and closing statement (the player can skip it). Like the witness read-out, the clock is stopped. */
export const STATEMENT_READ_SECONDS = 20;
/** Pause after each witness answer while it is read out. The clock does not run during it. */
export const READOUT_SECONDS = 20;

/**
 * Minutes each opening and each closing statement gets (the same for both). The clock stops at zero until
 * the statement is given, so running out never costs anyone anything. The 5-minute trial keeps its short
 * statements.
 */
export function statementMinutes(duration: number): number {
  if (duration === 60) return 6;
  if (duration === 30) return 3;
  if (duration === 15) return 1.5;
  return 0.5;
}

/**
 * Minutes each opening statement gets: the same as a closing, except in the 5-minute trial, which keeps its
 * extra minute on openings. None of it comes out of the witness pool.
 */
export function openingMinutes(duration: number): number {
  return duration === 5 ? statementMinutes(duration) + 1 : statementMinutes(duration);
}

/**
 * The statement time the witness pool is sized from. This is what the standard statement used to be, kept
 * as it was so that lengthening the statements does not shorten the witness stage.
 */
function poolStatementMinutes(duration: number): number {
  if (duration === 60) return 3;
  if (duration === 30) return 1.5;
  return 0.5;
}

/** Minutes of judge deliberation. */
export function deliberationMinutes(duration: number): number {
  if (duration === 5) return 0.5;
  if (duration === 15) return 1;
  if (duration === 30) return 3;
  return 5;
}

/**
 * The witness stage's pool in seconds, before any time saved in the openings is added. It is sized from the
 * pool's own statement allowance (poolStatementMinutes), so longer statement clocks leave the witness stage
 * exactly as long as before.
 */
export function basePoolSeconds(duration: number): number {
  return Math.round((duration - 4 * poolStatementMinutes(duration) - deliberationMinutes(duration)) * 60);
}

/** Shortest direct or cross worth starting. */
export function floorSeconds(duration: number): number {
  return duration === 5 ? 15 : 20;
}

/** Witness slots each side has. Time, not this number, is what actually limits the witnesses. */
export function witnessSlotsPerSide(duration: number): number {
  if (duration === 5) return 1;
  if (duration === 15) return 2;
  return 3;
}

/** Seconds set aside for cross-examination out of `available` seconds of a half. */
export function crossReserve(available: number, duration: number): number {
  return Math.min(available, Math.max(floorSeconds(duration), Math.ceil(available / 5)));
}

/** Is there enough time left in the half to call another witness? */
export function canCallWitness(available: number, duration: number): boolean {
  return available >= 2 * floorSeconds(duration);
}

/** Seconds direct examination may use: everything except the cross-examination reserve. */
export function directAllotment(available: number, duration: number): number {
  return Math.max(0, available - crossReserve(available, duration));
}

/** Redirect (60-minute trials only) is a short fixed turn paid from the pool. */
export const REDIRECT_SECONDS = 30;

export type Clocks = Record<number, number>;

/** Time left in the half that is being used now. */
export function availableInHalf(clocks: Clocks): number {
  return Math.max(0, (clocks[POOL_KEY] ?? 0) - (clocks[DEFENSE_HALF_KEY] ?? 0));
}

/**
 * Sets the pool up when the first witness phase begins: the base pool plus whatever the openings did not use,
 * with the defense's half held back.
 */
export function startPool(clocks: Clocks, duration: number, openingPhases: number[]): Clocks {
  if (clocks[POOL_KEY] !== undefined) return clocks;
  const saved = openingPhases.reduce((sum, p) => sum + Math.max(0, clocks[p] ?? 0), 0);
  const total = basePoolSeconds(duration) + saved;
  const next: Clocks = { ...clocks, [POOL_KEY]: total, [DEFENSE_HALF_KEY]: Math.floor(total / 2), [CROSS_RESERVE_KEY]: 0 };
  for (const p of openingPhases) next[p] = 0;
  return next;
}

/** Gives back the unused part of a witness phase's clock when that phase ends. */
export function settlePhase(clocks: Clocks, phase: number): Clocks {
  const left = Math.max(0, clocks[phase] ?? 0);
  if (clocks[POOL_KEY] === undefined) return clocks;
  return { ...clocks, [POOL_KEY]: clocks[POOL_KEY] + left, [phase]: 0 };
}

/** The defense's case has begun: its half is whatever is left, so nothing is held back any more. */
export function releaseDefenseHalf(clocks: Clocks): Clocks {
  if ((clocks[DEFENSE_HALF_KEY] ?? 0) === 0) return clocks;
  return { ...clocks, [DEFENSE_HALF_KEY]: 0 };
}

/** Hands a direct examination its clock, keeping the cross-examination reserve in the pool. Null: no time left. */
export function beginDirect(clocks: Clocks, phase: number, duration: number): Clocks | null {
  const available = availableInHalf(clocks);
  if (!canCallWitness(available, duration)) return null;
  const reserve = crossReserve(available, duration);
  const allot = available - reserve;
  return {
    ...clocks,
    [POOL_KEY]: clocks[POOL_KEY] - allot,
    [CROSS_RESERVE_KEY]: reserve,
    [phase]: allot
  };
}

/** Hands the cross-examination the reserve that was kept for it. */
export function beginCross(clocks: Clocks, phase: number): Clocks {
  const allot = Math.min(clocks[CROSS_RESERVE_KEY] ?? 0, clocks[POOL_KEY] ?? 0);
  return {
    ...clocks,
    [POOL_KEY]: (clocks[POOL_KEY] ?? 0) - allot,
    [CROSS_RESERVE_KEY]: 0,
    [phase]: allot
  };
}

/** Hands a redirect its short turn. Null: not enough time left. */
export function beginRedirect(clocks: Clocks, phase: number): Clocks | null {
  const available = availableInHalf(clocks);
  const allot = Math.min(REDIRECT_SECONDS, available);
  if (allot < 15) return null;
  return { ...clocks, [POOL_KEY]: clocks[POOL_KEY] - allot, [phase]: allot };
}

/** The saved clocks for phases only, without the pool's reserved keys. */
export function phaseClocksOnly(clocks: Clocks): Clocks {
  return Object.fromEntries(Object.entries(clocks).filter(([k]) => Number(k) > 0)) as Clocks;
}

/**
 * Does this side's statement count as given? Anything the player sent does ("hi" is enough). The automatic
 * "rests" line written by the Rest button or the clock does not.
 */
export function statementGiven(
  events: Array<{ speaker_role?: string | null; metadata?: unknown }>,
  speaker: 'prosecution' | 'defense',
  phase: number
): boolean {
  return events.some(e => {
    const meta = (e.metadata ?? {}) as { phase?: number; rested?: boolean };
    return e.speaker_role === speaker && meta.phase === phase && !meta.rested;
  });
}

/** A statement typed by a player has to be at least this many words before their side can rest. */
export const MIN_STATEMENT_WORDS = 50;

export function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/** Words a side has sent in this statement phase so far (the automatic "rests" line does not count). */
export function statementWordCount(
  events: Array<{ speaker_role?: string | null; metadata?: unknown; content?: string | null }>,
  speaker: 'prosecution' | 'defense',
  phase: number
): number {
  return events.reduce((sum, e) => {
    const meta = (e.metadata ?? {}) as { phase?: number; rested?: boolean };
    if (e.speaker_role !== speaker || meta.phase !== phase || meta.rested) return sum;
    return sum + wordCount(e.content ?? '');
  }, 0);
}

/**
 * Is this side's statement complete? What a player types has to reach MIN_STATEMENT_WORDS (over one or
 * several sends). A side the computer plays only has to have spoken.
 */
export function statementComplete(
  events: Array<{ speaker_role?: string | null; metadata?: unknown; content?: string | null }>,
  speaker: 'prosecution' | 'defense',
  phase: number,
  playedByHuman: boolean
): boolean {
  return playedByHuman
    ? statementWordCount(events, speaker, phase) >= MIN_STATEMENT_WORDS
    : statementGiven(events, speaker, phase);
}

/**
 * What the statement clock used to be. Only the AI's statement-length hint reads it, so shortening the
 * clocks does not change what the AI writes.
 */
export function legacyStatementMinutes(duration: number): number {
  if (duration === 5) return 0.5;
  if (duration === 15) return 2;
  if (duration === 30) return 3;
  return 5;
}
