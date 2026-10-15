import { beforeEach, describe, expect, it } from 'vitest';
import { pickStageScene, saveStageScene } from './stageScene';

describe('pickStageScene', () => {
  beforeEach(() => window.localStorage.clear());
  it('defaults to the avatar scene', () => expect(pickStageScene('')).toBe('avatars'));
  it('?scene=virtual switches and is remembered', () => {
    expect(pickStageScene('?scene=virtual')).toBe('virtual');
    expect(pickStageScene('')).toBe('virtual');
  });
  it('?scene=avatars switches back', () => {
    pickStageScene('?scene=virtual');
    expect(pickStageScene('?scene=avatars')).toBe('avatars');
    expect(pickStageScene('')).toBe('avatars');
  });
  it('ignores unknown values', () => expect(pickStageScene('?scene=bogus')).toBe('avatars'));
  it('saveStageScene remembers the button choice for the next visit', () => {
    saveStageScene('virtual');
    expect(pickStageScene('')).toBe('virtual');
    saveStageScene('avatars');
    expect(pickStageScene('')).toBe('avatars');
  });
});
