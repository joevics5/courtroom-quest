import { beforeEach, describe, expect, it } from 'vitest';
import { pickStageScene } from './stageScene';

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
});
