/**
 * Derives a readable display name from an email address.
 *
 * There is currently no display_name field on user_profiles, so this is
 * used anywhere the player's name needs to be shown (e.g. "For the
 * defense, <name>, representing the defendant."). Both the pre-trial
 * script and the courtroom must call this the same way so the name
 * shown is consistent throughout a session.
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
