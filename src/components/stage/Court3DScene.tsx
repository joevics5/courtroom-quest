import { Suspense, lazy, useState } from 'react';
import AvatarScene from './AvatarScene';
import { TurnPill } from '../ui';
import { useRecentPulse } from './signals';
import type { SceneProps } from './types';

const Court3D = lazy(() => import('../court3d/Court3D'));

/**
 * The 3D courtroom as a trial scene: the same stage contract as the avatar tiles. Whoever holds the
 * floor stands (counsel) or speaks, the camera cuts to them, and the witness walks into the box in
 * witness phases. Falls back to the avatar tiles when WebGL is not available.
 */
export default function Court3DScene(props: SceneProps) {
  const { cast, active, talking, phaseName, turn, compact, witness, jurors = [], jurorVotes, playerRole } = props;
  const [failed, setFailed] = useState(false);
  const phaseFlash = useRecentPulse(phaseName, 2800);
  if (failed) return <AvatarScene {...props} />;
  return (
    <div className={`relative w-full mx-auto px-3 py-2 ${compact ? 'max-w-[20rem]' : 'max-w-3xl'}`}>
      <Suspense fallback={<div className="w-full aspect-[16/10] rounded-2xl bg-black/40 ring-1 ring-white/15 grid place-items-center text-white/60 text-sm">Entering the courtroom...</div>}>
        <Court3D
          mode="trial"
          className={`w-full rounded-2xl ring-1 ring-white/20 ${compact ? 'aspect-[16/9] max-h-[24dvh]' : 'aspect-[16/10] max-h-[46dvh]'}`}
          judge={cast.judge}
          prosecution={cast.prosecution}
          defense={cast.defense}
          bailiff={cast.bailiff}
          playerRole={playerRole}
          active={active}
          talking={talking}
          witness={witness}
          jurors={jurors}
          jurorVotes={jurorVotes}
          onFailed={() => setFailed(true)}
        >
          <div className="absolute top-1.5 left-1.5 right-1.5 flex items-start justify-between gap-2 pointer-events-none z-20">
            {turn ? <TurnPill turn={turn} /> : <span />}
            {phaseName && phaseFlash && <span className="rounded-full bg-black/70 text-white font-game text-sm leading-none px-3 py-1">{phaseName}</span>}
          </div>
        </Court3D>
      </Suspense>
    </div>
  );
}
