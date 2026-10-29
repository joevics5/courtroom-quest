import { beforeEach, describe, expect, it } from 'vitest';
import {
  buildChallengeLink,
  captureChallengeLink,
  challengeShareText,
  clearPendingChallenge,
  isChallengeId,
  readChallengeIdFromSearch,
  readPendingChallenge,
  rememberPendingChallenge,
  stripChallengeParam
} from './challengeLink';

const ID = '3f2b8c1e-5d4a-4e6f-9a7b-1c2d3e4f5a6b';

describe('challenge links', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.history.replaceState(null, '', '/');
  });

  it('builds a link that reads back to the same id', () => {
    const link = buildChallengeLink(ID, 'https://example.com/');
    expect(link).toBe(`https://example.com/?challenge=${ID}`);
    expect(readChallengeIdFromSearch(new URL(link).search)).toBe(ID);
  });

  it('only accepts real ids', () => {
    expect(isChallengeId(ID)).toBe(true);
    expect(isChallengeId('not-an-id')).toBe(false);
    expect(isChallengeId('')).toBe(false);
    expect(readChallengeIdFromSearch('?challenge=abc')).toBeNull();
    expect(readChallengeIdFromSearch('?other=1')).toBeNull();
    expect(readChallengeIdFromSearch('')).toBeNull();
  });

  it('removes only the challenge parameter from the address', () => {
    expect(stripChallengeParam(`?challenge=${ID}`)).toBe('');
    expect(stripChallengeParam(`?scene=virtual&challenge=${ID}`)).toBe('?scene=virtual');
  });

  it('remembers a link across sign-in, and forgets it when cleared or too old', () => {
    rememberPendingChallenge(ID, 1_000);
    expect(readPendingChallenge(2_000)).toBe(ID);
    clearPendingChallenge();
    expect(readPendingChallenge(2_000)).toBeNull();

    rememberPendingChallenge(ID, 0);
    expect(readPendingChallenge(4 * 24 * 60 * 60 * 1000)).toBeNull();
  });

  it('picks the link out of the address bar, keeps it for later and cleans the address', () => {
    window.history.replaceState(null, '', `/?challenge=${ID}`);
    expect(captureChallengeLink()).toBe(ID);
    expect(window.location.search).toBe('');
    // a second call (or a reload) still finds it, from what was remembered
    expect(captureChallengeLink()).toBe(ID);
  });

  it('finds nothing when there is no link', () => {
    expect(captureChallengeLink()).toBeNull();
  });

  it('names the side the friend would play in the share text', () => {
    expect(challengeShareText('The Vault Job', 'defense')).toContain('You\'d play the prosecution');
    expect(challengeShareText(null, 'prosecution')).toContain('You\'d play the defense');
  });
});
