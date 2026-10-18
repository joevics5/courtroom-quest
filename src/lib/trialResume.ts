/**
 * Leaving and coming back to a trial.
 *
 * - Leaving the trial screen pauses the trial and saves exactly where it stood.
 * - Coming back opens it paused; the player resumes on purpose.
 * - If the saved "total time left" is missing, it is rebuilt from the phase clocks instead of
 *   being read as zero, which used to end the trial the moment the player came back.
 */

/** Total trial time left, from what was saved, falling back to the time left in the current and later phases. */
export function restoreTotalTime(savedTotal: unknown, phaseTimes: Record<number, number> | undefined, currentPhase: number): number {
  if (typeof savedTotal === 'number' && savedTotal > 0) return savedTotal;
  const left = Object.entries(phaseTimes || {})
    .filter(([phase]) => Number(phase) >= currentPhase)
    .reduce((sum, [, secs]) => sum + (typeof secs === 'number' && secs > 0 ? secs : 0), 0);
  return left;
}

/** A session comes back paused when it was left (or paused) mid-trial. */
export function startsPaused(session: { timer_paused_at?: string | null }, practiceMode: boolean): boolean {
  return !practiceMode && !!session.timer_paused_at;
}

export interface LeaveSnapshot {
  currentPhase: number;
  phaseTimeRemaining: Record<number, number>;
  totalTimeRemaining: number;
  sessionState: Record<string, unknown> | null | undefined;
  now?: Date;
}

/** What to save when the player leaves mid-trial. */
export function buildLeaveSave(s: LeaveSnapshot) {
  return {
    current_phase: 'trial' as const,
    current_trial_phase: s.currentPhase,
    timer_paused_at: (s.now ?? new Date()).toISOString(),
    session_state: {
      ...(s.sessionState || {}),
      phaseTimeRemaining: s.phaseTimeRemaining,
      totalTimeRemaining: s.totalTimeRemaining
    }
  };
}
