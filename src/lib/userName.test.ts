import { describe, expect, it } from 'vitest';
import { getPublicName, getUserDisplayName } from './userName';

const user = (meta: Record<string, string>, email: string | null = 'joevicspro@gmail.com') => ({ id: 'abcd-1234', email, user_metadata: meta });

describe('names', () => {
  it('in the trial the player is called by their own name, not the nickname', () => {
    expect(getUserDisplayName(user({ full_name: 'Victor Joshua', nickname: 'Joevicspro' }))).toBe('Victor Joshua');
  });
  it('falls back to the nickname, then the email name, then a guest tag', () => {
    expect(getUserDisplayName(user({ nickname: 'Joevicspro' }))).toBe('Joevicspro');
    expect(getUserDisplayName(user({}))).toBe('Joevicspro');
    expect(getUserDisplayName(user({}, null))).toBe('Guest 1234');
  });
  it('leaderboards still show the nickname', () => {
    expect(getPublicName(user({ full_name: 'Victor Joshua', nickname: 'Joevicspro' }))).toBe('Joevicspro');
  });
});
