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

/**
 * Preferred way to get the player's display name: uses the name they
 * entered at signup (stored in Supabase's user_metadata.full_name) when
 * present, falling back to deriving one from their email for accounts
 * created before the name field existed.
 */
export function getUserDisplayName(user: { email?: string | null; user_metadata?: { full_name?: string } } | null | undefined): string {
  const fullName = user?.user_metadata?.full_name?.trim();
  if (fullName) return fullName;
  return getDisplayName(user?.email);
}
