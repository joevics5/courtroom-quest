import { hasSeen, markSeen } from './firstVisit';

const FEATURE = 'tutorial';
const DEVICE = 'device';
// The wizard shipped on this date; any account older than that has never needed it.
const WIZARD_SHIPPED_AT = Date.parse('2026-08-08T00:00:00Z');

type TutorialUser = {
  id: string;
  created_at?: string;
  is_anonymous?: boolean;
  user_metadata?: { tutorial_done?: boolean } | null;
};
type TutorialProfile = {
  tutorial_completed?: boolean;
  trial_count?: number;
  wins_count?: number;
};

/**
 * The intro wizard is for brand-new players, exactly once. It counts as seen
 * if ANY of these says so, so one failed save can never bring it back:
 * the database flag, the account's own metadata, this browser's own record,
 * or the player already having played (accounts older than the wizard).
 * Guests also get one device-wide record, because every guest is a fresh account.
 */
export function tutorialAlreadySeen(profile: TutorialProfile, user: TutorialUser): boolean {
  if (profile.tutorial_completed) return true;
  if (user.user_metadata?.tutorial_done) return true;
  if (hasSeen(FEATURE, user.id)) return true;
  if (user.is_anonymous && hasSeen(FEATURE, DEVICE)) return true;
  if ((profile.trial_count ?? 0) > 0 || (profile.wins_count ?? 0) > 0) return true;
  const createdMs = user.created_at ? Date.parse(user.created_at) : NaN;
  if (Number.isFinite(createdMs) && createdMs < WIZARD_SHIPPED_AT) return true;
  return false;
}

/** Records the wizard as seen in this browser (instant, works offline). */
export function markTutorialSeen(user: TutorialUser): void {
  markSeen(FEATURE, user.id);
  if (user.is_anonymous) markSeen(FEATURE, DEVICE);
}
