import { useEffect, useState } from 'react';
import AvatarFace from './AvatarFace';
import type { AvatarConfig } from '../lib/avatars';

type Speaker = 'judge' | 'prosecution' | 'defense' | 'witness' | 'jury';

interface Participant {
  name: string;
  avatar: AvatarConfig;
}

interface TrialStageProps {
  currentSpeaker: Speaker;
  phaseName?: string;
  judge: Participant;
  prosecution: Participant;
  defense: Participant;
}

const TTS_SUPPORTED = typeof window !== 'undefined' && 'speechSynthesis' in window;

/** True while the browser is reading text aloud. */
function useTtsSpeaking(): boolean {
  const [speaking, setSpeaking] = useState(false);
  useEffect(() => {
    if (!TTS_SUPPORTED) return;
    const id = window.setInterval(() => setSpeaking(window.speechSynthesis.speaking), 150);
    return () => window.clearInterval(id);
  }, []);
  return speaking;
}

function Tile({
  role,
  participant,
  active,
  moving
}: {
  role: string;
  participant: Participant;
  active: boolean;
  moving: boolean;
}) {
  return (
    <div
      className={`relative min-w-0 rounded-xl overflow-hidden bg-slate-800 transition-shadow duration-200 ${
        active ? 'ring-4 ring-emerald-400 shadow-[0_0_24px_rgba(52,211,153,0.45)]' : 'ring-1 ring-slate-600'
      }`}
      aria-current={active ? 'true' : undefined}
    >
      <AvatarFace config={participant.avatar} speaking={moving} label={`${role}: ${participant.name}`} />
      <div className="absolute inset-x-0 bottom-0 px-2 py-1.5 bg-gradient-to-t from-slate-950/90 to-transparent">
        <p className="text-white text-xs sm:text-sm font-medium truncate">{participant.name}</p>
        <p className="text-slate-300 text-[11px] truncate">{role}</p>
      </div>
    </div>
  );
}

/**
 * Three tiles like a video call: prosecution, judge, defense. The person
 * speaking gets a glowing outline and a moving mouth. The mouth moves while
 * the browser is reading aloud; when speech is unavailable it moves for as
 * long as that person holds the floor.
 */
export default function TrialStage({ currentSpeaker, phaseName, judge, prosecution, defense }: TrialStageProps) {
  const ttsSpeaking = useTtsSpeaking();
  const mouthMoves = (role: Speaker) => currentSpeaker === role && (TTS_SUPPORTED ? ttsSpeaking : true);
  const floorLabel =
    currentSpeaker === 'witness' ? 'Witness speaking' : currentSpeaker === 'jury' ? 'Jury deliberating' : null;

  return (
    <div className="relative w-full h-full bg-slate-900 p-3 flex flex-col justify-center">
      <div className="grid grid-cols-3 gap-2 sm:gap-3 items-center max-h-full">
        <Tile role="Prosecution" participant={prosecution} active={currentSpeaker === 'prosecution'} moving={mouthMoves('prosecution')} />
        <Tile role="Judge" participant={judge} active={currentSpeaker === 'judge'} moving={mouthMoves('judge')} />
        <Tile role="Defense" participant={defense} active={currentSpeaker === 'defense'} moving={mouthMoves('defense')} />
      </div>
      {(phaseName || floorLabel) && (
        <div className="absolute top-2 left-3 right-3 flex justify-between gap-2 pointer-events-none">
          {phaseName && <p className="bg-slate-900/85 text-white text-xs sm:text-sm px-3 py-1 rounded-lg truncate">{phaseName}</p>}
          {floorLabel && <p className="bg-emerald-500/90 text-white text-xs sm:text-sm px-3 py-1 rounded-lg">{floorLabel}</p>}
        </div>
      )}
    </div>
  );
}
