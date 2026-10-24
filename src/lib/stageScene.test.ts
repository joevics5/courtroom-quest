import { beforeEach, describe, expect, it } from 'vitest';
import { pickStageScene, saveStageScene, VIRTUAL_COURTROOM_ENABLED } from './stageScene';

describe('pickStageScene (virtual courtroom switched off)', () => {
  beforeEach(() => window.localStorage.clear());

  it('is switched off for now', () => expect(VIRTUAL_COURTROOM_ENABLED).toBe(false));
  it('always gives the avatar scene', () => expect(pickStageScene('')).toBe('avatars'));
  it('ignores ?scene=virtual', () => expect(pickStageScene('?scene=virtual')).toBe('avatars'));
  it('ignores a virtual choice an earlier visit saved', () => {
    saveStageScene('virtual');
    expect(pickStageScene('')).toBe('avatars');
  });
});
