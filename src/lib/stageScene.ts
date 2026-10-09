import type { StageSceneId } from '../components/stage/types';
import { DEFAULT_SCENE } from '../components/stage/scenes';

const KEY = 'cq-stage-scene';

/**
 * Which scene draws the trial. The avatar scene stays the default until the courtroom art is in;
 * to preview the virtual courtroom open any case with ?scene=virtual (remembered), or ?scene=avatars to go back.
 */
export function pickStageScene(search: string = typeof window !== 'undefined' ? window.location.search : ''): StageSceneId {
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
