import { pickActiveSpeaker, type StageSpeaker, type TurnBadge } from '../lib/stageSpeaker';
import { DEFAULT_SCENE, STAGE_SCENES } from './stage/scenes';
import { TTS_SUPPORTED, useRecentPulse, useTtsSpeaking } from './stage/signals';
import type { StageParticipant, StageSceneId } from './stage/types';

interface TrialStageProps {
  /** Fallback when nothing else says who is speaking. */
  currentSpeaker: StageSpeaker;
  /** Speaker role of the latest message in the transcript. */
  lastRole?: string | null;
  /** Changes whenever a new message arrives (used to animate when there is no speech). */
  lastEventKey?: string | null;
  /** Whose turn it is to speak next (from the trial's turn-by-turn switch). */
  floor?: StageSpeaker | null;
  phaseName?: string;
  judge: StageParticipant;
  prosecution: StageParticipant;
  defense: StageParticipant;
  playerRole?: 'prosecution' | 'defense';
  turn?: TurnBadge;
  compact?: boolean;
  /** Which scene draws the courtroom. */
  scene?: StageSceneId;
}

/**
 * The stage slot of the trial screen. It works out who is active and who is talking, then hands
 * plain props to the chosen scene (see stage/types.ts for the contract).
 */
export default function TrialStage({
  currentSpeaker,
  lastRole,
  lastEventKey,
  floor,
  phaseName,
  judge,
  prosecution,
  defense,
  playerRole,
  turn,
  compact,
  scene = DEFAULT_SCENE
}: TrialStageProps) {
  const ttsSpeaking = useTtsSpeaking();
  const recentMessage = useRecentPulse(lastEventKey, 3500);
  const talking = TTS_SUPPORTED ? ttsSpeaking : recentMessage;
  const active = pickActiveSpeaker({ lastRole: lastRole ?? currentSpeaker, floor, ttsSpeaking: talking });
  const Scene = STAGE_SCENES[scene] ?? STAGE_SCENES[DEFAULT_SCENE];

  return (
    <Scene
      cast={{ judge, prosecution, defense }}
      active={active}
      talking={talking}
      phaseName={phaseName}
      playerRole={playerRole}
      turn={turn}
      compact={compact}
    />
  );
}
