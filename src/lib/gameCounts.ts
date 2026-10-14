/**
 * One rule for "how many games do I have", used by the homepage Dashboard card, the
 * Play popup's "My games" card and the Case Board tabs, so the numbers always match
 * what the Case Board actually lists.
 *
 * The Case Board lists games on the preset cases only (custom-case games live under
 * Custom cases), so the counts must skip the rest too.
 */
interface SessionLike {
  case_id: string;
  cases?: { is_preset?: boolean | null } | null;
}

/** The ongoing sessions the Case Board shows. */
export function boardSessions<T extends SessionLike>(sessions: T[], presetIds?: Set<string>): T[] {
  return sessions.filter(s => (presetIds ? presetIds.has(s.case_id) : s.cases?.is_preset === true));
}

interface ChallengeLike { status: string; creator_user_id: string }
interface InvitationLike { status: string; inviter_user_id: string }

/** Challenges and invites I sent that nobody has joined yet. */
export function countWaitingSent(userId: string, challenges: ChallengeLike[], invitations: InvitationLike[]): number {
  return (
    challenges.filter(c => c.status === 'open' && c.creator_user_id === userId).length +
    invitations.filter(i => i.status === 'pending' && i.inviter_user_id === userId).length
  );
}

export function countMyGames(args: {
  userId: string;
  ongoing: SessionLike[];
  challenges: ChallengeLike[];
  invitations: InvitationLike[];
  presetIds?: Set<string>;
}): { ongoing: number; waitingSent: number; myGames: number } {
  const ongoing = boardSessions(args.ongoing, args.presetIds).length;
  const waitingSent = countWaitingSent(args.userId, args.challenges, args.invitations);
  return { ongoing, waitingSent, myGames: ongoing + waitingSent };
}
