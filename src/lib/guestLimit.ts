// Guests can try the game, then need an account. A guest account is just a browser session: clearing the
// browser loses it, and it can't be used for payments or restored on another phone. So after a few games
// we ask them to sign up (their guest progress is kept: see upgradeGuest in AuthContext).
export const GUEST_GAME_LIMIT = 3;

const KEY = 'cq:guestGames';

/** Games a guest has started on this browser, across every guest account made here. */
export function guestGamesOnDevice(): number {
  try {
    const n = Number(window.localStorage.getItem(KEY));
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  } catch {
    return 0;
  }
}

export function recordGuestGame(): void {
  try {
    window.localStorage.setItem(KEY, String(guestGamesOnDevice() + 1));
  } catch {
    /* storage blocked: the per-account count still applies */
  }
}

/** True when this is a guest who has used up their free guest games. Real accounts are never blocked. */
export function guestNeedsAccount(
  user: { is_anonymous?: boolean } | null | undefined,
  profile: { trial_count?: number; is_admin?: boolean } | null | undefined
): boolean {
  if (!user?.is_anonymous || profile?.is_admin) return false;
  return Math.max(profile?.trial_count ?? 0, guestGamesOnDevice()) >= GUEST_GAME_LIMIT;
}
