import { supabase } from './supabase';
import { AvatarConfig, parseAvatar } from './avatars';

export interface SaveProfileResult {
  ok: boolean;
  /** Set when the database change is not applied yet (nothing was saved there). */
  skipped?: boolean;
  error?: 'taken' | 'invalid' | 'failed';
}

/** True when the database does not have the function yet (migration not applied). */
function isMissingFunction(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return error.code === 'PGRST202' || /could not find the function|does not exist/i.test(error.message ?? '');
}

/**
 * Saves the player's public username and/or avatar so other players can see them.
 * The username is unique (ignoring case). If the database change has not been
 * applied yet, this reports ok (skipped) so signup never breaks.
 */
export async function savePublicProfile(input: { username?: string; avatar?: AvatarConfig }): Promise<SaveProfileResult> {
  const { data, error } = await (supabase as any).rpc('set_public_profile', {
    p_username: input.username ?? null,
    p_avatar: input.avatar ?? null
  });
  if (error) {
    if (isMissingFunction(error)) return { ok: true, skipped: true };
    console.error('set_public_profile failed:', error);
    return { ok: false, error: 'failed' };
  }
  if (data && data.ok) return { ok: true };
  if (data?.error === 'taken') return { ok: false, error: 'taken' };
  if (data?.error === 'invalid') return { ok: false, error: 'invalid' };
  return { ok: false, error: 'failed' };
}

/** Quick check before saving. Errs on the side of "available": saving is the real check. */
export async function isUsernameAvailable(name: string): Promise<boolean> {
  const { data, error } = await (supabase as any).rpc('username_available', { p_name: name });
  if (error) return true;
  return data !== false;
}

export interface PublicProfile {
  username: string | null;
  avatar: AvatarConfig | null;
  /** 1 to 10, from their wins. */
  rank: number | null;
}

/** Another player's public name and avatar, or null if they have none on file. */
export async function fetchPublicProfile(userId: string): Promise<PublicProfile | null> {
  const { data, error } = await (supabase as any)
    .from('public_profiles')
    .select('username, avatar, rank_level')
    .eq('user_id', userId)
    .maybeSingle();
  if (error || !data) return null;
  return {
    username: data.username ?? null,
    avatar: parseAvatar(data.avatar),
    rank: typeof data.rank_level === 'number' ? Math.min(10, Math.max(1, data.rank_level)) : null
  };
}
