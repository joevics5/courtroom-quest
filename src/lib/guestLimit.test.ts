// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { GUEST_GAME_LIMIT, guestGamesOnDevice, guestNeedsAccount, recordGuestGame } from './guestLimit';

const guest = { is_anonymous: true };

describe('guest game limit', () => {
  beforeEach(() => window.localStorage.clear());

  it('lets a guest play until the limit, then asks for an account', () => {
    expect(guestNeedsAccount(guest, { trial_count: GUEST_GAME_LIMIT - 1 })).toBe(false);
    expect(guestNeedsAccount(guest, { trial_count: GUEST_GAME_LIMIT })).toBe(true);
  });

  it('counts games on the device, so a fresh guest account does not reset it', () => {
    for (let i = 0; i < GUEST_GAME_LIMIT; i++) recordGuestGame();
    expect(guestGamesOnDevice()).toBe(GUEST_GAME_LIMIT);
    expect(guestNeedsAccount(guest, { trial_count: 0 })).toBe(true);
  });

  it('never blocks a real account or an admin', () => {
    for (let i = 0; i < GUEST_GAME_LIMIT; i++) recordGuestGame();
    expect(guestNeedsAccount({ is_anonymous: false }, { trial_count: 99 })).toBe(false);
    expect(guestNeedsAccount(guest, { trial_count: 99, is_admin: true })).toBe(false);
    expect(guestNeedsAccount(null, null)).toBe(false);
  });
});
