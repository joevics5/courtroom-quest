import type { Verdict } from '../types';

/** A verdict counts as "just won" for this long after it was delivered. */
export const FRESH_VERDICT_MS = 10 * 60 * 1000;

// Verdicts already celebrated in this browser session, so reopening one doesn't replay the show.
const celebrated = new Set<string>();

/** True for a verdict delivered a moment ago that we haven't celebrated yet. */
export function shouldCelebrate(verdict: Pick<Verdict, 'id' | 'delivered_at'>, now = Date.now()): boolean {
  if (celebrated.has(verdict.id)) return false;
  const delivered = Date.parse(verdict.delivered_at);
  if (!Number.isFinite(delivered)) return false;
  const age = now - delivered;
  return age >= -60_000 && age <= FRESH_VERDICT_MS;
}

export function markCelebrated(verdictId: string): void {
  celebrated.add(verdictId);
}

/** Test helper. */
export function resetCelebrated(): void {
  celebrated.clear();
}
