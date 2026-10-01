/**
 * Derives a readable display name from an email address.
 *
 * Fallback only — prefer getUserDisplayName(user) below, which uses the
 * name entered at signup when available. This is what accounts created
 * before that field existed fall back to.
 *
 * "joevics5@gmail.com"  -> "Joevics5"
 * "jane.doe@x.com"      -> "Jane Doe"
 * "j_smith99@x.com"     -> "J Smith99"
 */
export function getDisplayName(email: string | null | undefined): string {
  if (!email) return 'Defense Counsel';

  const localPart = email.split('@')[0];
  if (!localPart) return 'Defense Counsel';

  const words = localPart
    .split(/[._-]+/)
    .filter(Boolean)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1));

  return words.length > 0 ? words.join(' ') : 'Defense Counsel';
}

type NameUser = {
  id?: string;
  email?: string | null;
  is_anonymous?: boolean;
  user_metadata?: { full_name?: string; nickname?: string };
};

/** Stable short tag for players without a name, e.g. "4F2A" — derived from their user id. */
export function getGuestTag(id: string | null | undefined): string {
  const hex = (id || '').replace(/-/g, '');
  return (hex.slice(-4) || '0000').toUpperCase();
}

/**
 * Name shown PUBLICLY (leaderboards, winners, the player chip). Never an
 * email address: nickname → name entered at signup → "Guest 4F2A".
 */
export function getPublicName(user: NameUser | null | undefined): string {
  const nickname = user?.user_metadata?.nickname?.trim();
  if (nickname) return nickname;
  const fullName = user?.user_metadata?.full_name?.trim();
  if (fullName) return fullName;
  return `${user?.is_anonymous ? 'Guest' : 'Player'} ${getGuestTag(user?.id)}`;
}

/**
 * Older winner rows saved the player's raw email as their name. Mask any
 * email-looking value for display ("joevicspro@gmail.com" -> "joe***").
 */
export function maskPublicName(raw: string | null | undefined): string {
  if (!raw) return 'Anonymous';
  if (!raw.includes('@')) return raw;
  const local = raw.split('@')[0] || '';
  return `${local.slice(0, 3)}***`;
}

/**
 * Name used inside the trial itself (counsel name): nickname, then the name
 * entered at signup, then one derived from their email for older accounts,
 * and "Guest XXXX" for guests who have no email.
 */
export function getUserDisplayName(user: NameUser | null | undefined): string {
  const nickname = user?.user_metadata?.nickname?.trim();
  if (nickname) return nickname;
  const fullName = user?.user_metadata?.full_name?.trim();
  if (fullName) return fullName;
  if (!user?.email) return `Guest ${getGuestTag(user?.id)}`;
  return getDisplayName(user.email);
}
