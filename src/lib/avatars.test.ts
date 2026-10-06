import { describe, expect, it } from 'vitest';
import {
  COUNSEL_AVATARS,
  JUDGE_AVATARS,
  avatarFromSeed,
  getUserAvatar,
  hasSavedAvatar,
  parseAvatar,
  randomAvatar,
  validateUsername
} from './avatars';

describe('avatars', () => {
  it('ships 10 judges and 10 opposing counsel, all valid', () => {
    expect(JUDGE_AVATARS).toHaveLength(10);
    expect(COUNSEL_AVATARS).toHaveLength(10);
    for (const a of [...JUDGE_AVATARS, ...COUNSEL_AVATARS]) expect(parseAvatar(a)).toEqual(a);
  });

  it('judges wear robes', () => {
    expect(JUDGE_AVATARS.every(a => a.attire === 'robe')).toBe(true);
  });

  it('gives the same face for the same name', () => {
    expect(avatarFromSeed('Hon. Marsh', 'judge')).toEqual(avatarFromSeed('Hon. Marsh', 'judge'));
    expect(randomAvatar('abc')).toEqual(randomAvatar('abc'));
  });

  it('gives the judges and counsel clearly different faces', () => {
    const face = (a: (typeof JUDGE_AVATARS)[number]) =>
      [a.headShape, a.eyeShape, a.noseShape, a.mouthShape, a.browShape].join('-');
    expect(new Set(JUDGE_AVATARS.map(face)).size).toBeGreaterThanOrEqual(8);
    expect(new Set(COUNSEL_AVATARS.map(face)).size).toBeGreaterThanOrEqual(8);
  });

  it('accepts avatars saved before the face options existed', () => {
    const old = {
      skin: 2,
      hairStyle: 'short',
      hairColor: 1,
      attire: 'suit',
      attireColor: 0,
      beard: 'none',
      glasses: false,
      backdrop: 0
    };
    const parsed = parseAvatar(old);
    expect(parsed).not.toBeNull();
    expect(parsed).toEqual(parseAvatar(old));
    expect(parsed!.headShape).toBeGreaterThanOrEqual(0);
  });

  it('rejects bad stored data', () => {
    expect(parseAvatar(null)).toBeNull();
    expect(parseAvatar({ skin: 99 })).toBeNull();
    expect(parseAvatar({ ...randomAvatar('x'), hairStyle: 'mohawk' })).toBeNull();
  });

  it('falls back to a stable random avatar when none is saved', () => {
    const guest = { id: 'guest-1', user_metadata: {} };
    expect(hasSavedAvatar(guest)).toBe(false);
    expect(getUserAvatar(guest)).toEqual(getUserAvatar(guest));
    const saved = { id: 'u', user_metadata: { avatar: JUDGE_AVATARS[0] } };
    expect(hasSavedAvatar(saved)).toBe(true);
    expect(getUserAvatar(saved)).toEqual(JUDGE_AVATARS[0]);
  });

  it('validates usernames', () => {
    expect(validateUsername('ab')).not.toBeNull();
    expect(validateUsername('a@b.com')).not.toBeNull();
    expect(validateUsername('x'.repeat(21))).not.toBeNull();
    expect(validateUsername('Counsel Ada')).toBeNull();
  });
});
