import type { Outcome, PlayerRole } from '../types';

/**
 * The AI judge's `outcome` field is absolute, not player-relative:
 * 'win'  = guilty verdict (the prosecution proved its case)
 * 'lose' = not guilty verdict (the prosecution failed to prove its case)
 * 'partial' = mixed / some charges
 *
 * This has nothing to do with which side the human played. A defense
 * player "wins" their case exactly when the verdict is 'lose' (their
 * client is acquitted), and "loses" when it's 'win' (their client is
 * convicted) — the opposite of a prosecution player. Every place that
 * shows a win/loss result to the player, or that tracks their win count,
 * needs to go through here rather than checking `outcome === 'win'`
 * directly, or it silently shows the wrong result for defense sessions.
 */
export function didPlayerWin(outcome: Outcome, playerRole: PlayerRole): boolean {
  if (outcome === 'partial') return false;
  const guiltyVerdict = outcome === 'win';
  return playerRole === 'prosecution' ? guiltyVerdict : !guiltyVerdict;
}

/** Human-readable verdict label — independent of who's playing. */
export function verdictLabel(outcome: Outcome): 'Guilty' | 'Not Guilty' | 'Partial Verdict' {
  if (outcome === 'win') return 'Guilty';
  if (outcome === 'lose') return 'Not Guilty';
  return 'Partial Verdict';
}
