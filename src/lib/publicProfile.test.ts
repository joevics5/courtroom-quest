import { beforeEach, describe, expect, it, vi } from 'vitest';

const rpc = vi.fn();
const maybeSingle = vi.fn();
vi.mock('./supabase', () => ({
  supabase: {
    rpc: (...a: unknown[]) => rpc(...a),
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: () => maybeSingle() }) }) })
  }
}));

import { fetchPublicProfile, isUsernameAvailable, savePublicProfile } from './publicProfile';
import { JUDGE_AVATARS } from './avatars';

describe('publicProfile', () => {
  beforeEach(() => {
    rpc.mockReset();
    maybeSingle.mockReset();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('reports a taken username', async () => {
    rpc.mockResolvedValue({ data: { ok: false, error: 'taken' }, error: null });
    expect(await savePublicProfile({ username: 'Ada' })).toEqual({ ok: false, error: 'taken' });
  });

  it('saves and passes name and avatar to the database function', async () => {
    rpc.mockResolvedValue({ data: { ok: true }, error: null });
    expect((await savePublicProfile({ username: 'Ada', avatar: JUDGE_AVATARS[0] })).ok).toBe(true);
    expect(rpc).toHaveBeenCalledWith('set_public_profile', { p_username: 'Ada', p_avatar: JUDGE_AVATARS[0] });
  });

  it('never blocks signup when the database change is not applied yet', async () => {
    rpc.mockResolvedValue({ data: null, error: { code: 'PGRST202', message: 'Could not find the function' } });
    expect(await savePublicProfile({ username: 'Ada' })).toEqual({ ok: true, skipped: true });
  });

  it('reports a real failure', async () => {
    rpc.mockResolvedValue({ data: null, error: { code: '500', message: 'boom' } });
    expect(await savePublicProfile({ username: 'Ada' })).toEqual({ ok: false, error: 'failed' });
  });

  it('checks availability, and trusts the save when the check itself fails', async () => {
    rpc.mockResolvedValueOnce({ data: false, error: null });
    expect(await isUsernameAvailable('Ada')).toBe(false);
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'down' } });
    expect(await isUsernameAvailable('Ada')).toBe(true);
  });

  it('fetches an opponent profile and validates the avatar', async () => {
    maybeSingle.mockResolvedValue({ data: { username: 'Rival', avatar: JUDGE_AVATARS[2], rank_level: 7 }, error: null });
    const p = await fetchPublicProfile('u2');
    expect(p?.username).toBe('Rival');
    expect(p?.rank).toBe(7);
    expect(p?.avatar).toEqual(JUDGE_AVATARS[2]);
    maybeSingle.mockResolvedValue({ data: { username: 'X', avatar: { bad: true } }, error: null });
    expect((await fetchPublicProfile('u3'))?.avatar).toBeNull();
    expect((await fetchPublicProfile('u3'))?.rank).toBeNull();
    maybeSingle.mockResolvedValue({ data: null, error: null });
    expect(await fetchPublicProfile('u4')).toBeNull();
  });
});
