import type { StageSceneId } from '../components/stage/types';
import { DEFAULT_SCENE } from '../components/stage/scenes';
import { webglAvailable } from '../components/court3d/support';

const KEY = 'cq-stage-scene';

/** The painted 2D virtual courtroom is switched off (not ready). */
export const VIRTUAL_COURTROOM_ENABLED = false;

/** The 3D courtroom is the default trial scene wherever the browser can draw WebGL. */
export const COURT3D_ENABLED = true;

type Pick = 'avatars' | 'court3d';

/**
 * Which scene draws the trial and pre-trial.
 *  - The 3D courtroom by default when the device supports WebGL.
 *  - ?scene=avatars switches back to the avatar tiles (remembered), ?scene=court3d switches to 3D again.
 *  - The old painted 2D scene stays off.
 */
export function pickStageScene(search: string = typeof window !== 'undefined' ? window.location.search : ''): StageSceneId {
  const canDo3D = COURT3D_ENABLED && webglAvailable();
  const asked = new URLSearchParams(search).get('scene');
  const valid = (v: string | null): v is Pick => v === 'avatars' || v === 'court3d';
  let choice: Pick | null = null;
  try {
    if (valid(asked)) {
      window.localStorage.setItem(KEY, asked);
      choice = asked;
    } else {
      const saved = typeof window !== 'undefined' ? window.localStorage.getItem(KEY) : null;
      if (valid(saved)) choice = saved;
    }
  } catch {
    if (valid(asked)) choice = asked;
  }
  if (choice === 'avatars') return 'avatars';
  return canDo3D ? 'court3d' : DEFAULT_SCENE;
}

/** Remember the scene the player picked with the in-trial button. */
export function saveStageScene(scene: StageSceneId): void {
  try {
    window.localStorage.setItem(KEY, scene);
  } catch {
    /* storage unavailable: the choice just lasts for this visit */
  }
}
