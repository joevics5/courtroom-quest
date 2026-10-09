import type { AvatarConfig } from '../../lib/avatars';
import type { StageSpeaker, TurnBadge } from '../../lib/stageSpeaker';

/**
 * THE STAGE CONTRACT.
 *
 * The trial screen draws the courtroom through one "scene". A scene is a plain component that
 * receives SceneProps and draws it however it likes: today avatar tiles, later a virtual
 * courtroom. The trial page never reaches into a scene; it only passes these props, and all
 * the game logic (whose turn, who is talking, ranks, faces) is worked out before a scene
 * sees it. To add a scene: build a component that takes SceneProps, then register it in
 * `scenes.ts`.
 */
export interface StageParticipant {
  name: string;
  avatar: AvatarConfig;
  /** 1 to 10: dresses the avatar for this rank. */
  rank?: number;
}

export interface StageCast {
  judge: StageParticipant;
  prosecution: StageParticipant;
  defense: StageParticipant;
  /** Only present in scenes that include the bailiff (pre-trial). */
  bailiff?: StageParticipant;
}

export interface SceneProps {
  cast: StageCast;
  /** Who has the floor: the one to highlight (judge, a side, witness, jury or bailiff). */
  active: StageSpeaker;
  /** True while the active person is audibly speaking: animate their mouth or lips. */
  talking: boolean;
  /** Current phase, e.g. "Opening Statement - Defense". */
  phaseName?: string;
  /** Which side the human plays, for scenes that frame the player. */
  playerRole?: 'prosecution' | 'defense';
  /** The "your turn / their turn" badge text and tone. */
  turn?: TurnBadge;
  /** A slim version, used while the on-screen keyboard is open. */
  compact?: boolean;
  /** The witness on the stand. Only set during a witness phase; scenes hide the stand otherwise. */
  witness?: StageParticipant;
  /** The seated jury (id is any stable seed, e.g. the juror's database id). */
  jurors?: StageJuror[];
  /** Votes by juror id while the jury deliberates, shown over each seat. */
  jurorVotes?: Record<string, 'GUILTY' | 'NOT_GUILTY'>;
}

export interface StageJuror {
  id: string;
  name?: string;
}

export type StageSceneId = 'avatars' | 'virtual';
