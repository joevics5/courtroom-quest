import type { ComponentType } from 'react';
import AvatarScene from './AvatarScene';
import type { SceneProps, StageSceneId } from './types';

/**
 * Every scene the trial can show. Add the virtual courtroom here, e.g.
 *   virtual: VirtualCourtroomScene,
 * (and add 'virtual' to StageSceneId in types.ts), then pick it with <TrialStage scene="virtual" />.
 */
export const STAGE_SCENES: Record<StageSceneId, ComponentType<SceneProps>> = {
  avatars: AvatarScene
};

export const DEFAULT_SCENE: StageSceneId = 'avatars';
