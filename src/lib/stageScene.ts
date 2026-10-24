import type { StageSceneId } from '../components/stage/types';
import { DEFAULT_SCENE } from '../components/stage/scenes';

const KEY = 'cq-stage-scene';

/** The virtual courtroom is switched off for now (not ready). Set to true to bring it, and ?scene=virtual, back. */
export const VIRTUAL_COURTROOM_ENABLED = false;

/**
 * Which scene draws the trial. The avatar scene stays the default until the courtroom art is in;
 * to preview the virtual courtroom open any case with ?scene=virtual (remembered), or ?scene=avatars to go back.
 */
export function pickStageScene(search: string = typeof window !== 'undefined' ? window.location.search : ''): StageSceneId {
  if (!VIRTUAL_COURTROOM_ENABLED) return DEFAULT_SCENE; // always the avatars, whatever an old visit saved
  const asked = new URLSearchParams(search).get('scene');
  try {
    if (asked === 'virtual' || asked === 'avatars') {
      window.localStorage.setItem(KEY, asked);
      return asked;
    }
    const saved = typeof window !== 'undefined' ? window.localStorage.getItem(KEY) : null;
    if (saved === 'virtual' || saved === 'avatars') return saved;
  } catch {
    if (asked === 'virtual' || asked === 'avatars') return asked;
  }
  return DEFAULT_SCENE;
}

/** Remember the scene the player picked with the in-trial button. */
export function saveStageScene(scene: StageSceneId): void {
  try {
    window.localStorage.setItem(KEY, scene);
  } catch {
    /* storage unavailable: the choice just lasts for this visit */
  }
}
