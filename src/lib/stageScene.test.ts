import { beforeEach, describe, expect, it, vi } from 'vitest';

let webgl = false;
vi.mock('../components/court3d/support', () => ({ webglAvailable: () => webgl }));

import { pickStageScene, saveStageScene, VIRTUAL_COURTROOM_ENABLED } from './stageScene';

describe('pickStageScene', () => {
  beforeEach(() => { window.localStorage.clear(); webgl = false; });

  it('keeps the old painted 2D courtroom switched off', () => expect(VIRTUAL_COURTROOM_ENABLED).toBe(false));
  it('uses the avatar tiles when the browser has no WebGL', () => expect(pickStageScene('')).toBe('avatars'));
  it('uses the 3D courtroom by default when WebGL works', () => {
    webgl = true;
    expect(pickStageScene('')).toBe('court3d');
  });
  it('?scene=avatars opts out and is remembered', () => {
    webgl = true;
    expect(pickStageScene('?scene=avatars')).toBe('avatars');
    expect(pickStageScene('')).toBe('avatars');
    expect(pickStageScene('?scene=court3d')).toBe('court3d');
  });
  it('never gives 3D without WebGL, even if asked', () => expect(pickStageScene('?scene=court3d')).toBe('avatars'));
  it('ignores ?scene=virtual and an old saved virtual choice', () => {
    webgl = true;
    expect(pickStageScene('?scene=virtual')).toBe('court3d');
    saveStageScene('virtual');
    expect(pickStageScene('')).toBe('court3d');
  });
});
