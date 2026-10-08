import { useEffect, useState } from 'react';
import AvatarFace from './AvatarFace';
import type { AvatarConfig } from '../lib/avatars';
import { pickActiveSpeaker, type StageSpeaker } from '../lib/stageSpeaker';
import { LEVELS } from '../lib/levels';

type Speaker = StageSpeaker;

interface Participant {
  name: string;
  avatar: AvatarConfig;
  /** 1 to 10: dresses the avatar for this rank and shows the rank title. */
  rank?: number;
}

interface TrialStageProps {
  /** Fallback when nothing else says who is speaking. */
  currentSpeaker: Speaker;
  /** Speaker role of the latest message in the transcript. */
  lastRole?: string | null;
  /** Changes whenever a new message arrives (used to animate when there is no speech). */
  lastEventKey?: string | null;
  /** Whose turn it is to speak next. */
  floor?: Speaker | null;
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
    let holdUntil = 0;
    const id = window.setInterval(() => {
      const now = Date.now();
      if (window.speechSynthesis.speaking) holdUntil = now + 500; // bridge the gap between sentences
      setSpeaking(now < holdUntil);
    }, 150);
    return () => window.clearInterval(id);
  }, []);
  return speaking;
}

/** True for a few seconds after `key` changes (no speech available: animate when a message arrives). */
function useRecentPulse(key: string | null | undefined, ms: number): boolean {
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (!key) return;
    setOn(true);
    const t = window.setTimeout(() => setOn(false), ms);
    return () => window.clearTimeout(t);
  }, [key, ms]);
  return on;
}

function Tile({
  role,
  participant,
  active,
  moving,
  showRank = true
}: {
  role: string;
  participant: Participant;
  active: boolean;
  moving: boolean;
  showRank?: boolean;
}) {
  return (
    <div
      className={`relative min-w-0 aspect-square rounded-xl overflow-hidden bg-slate-800 transition-shadow duration-200 ${
        active ? 'ring-4 ring-[#FFD43B] shadow-[0_0_24px_rgba(255,212,59,0.5)]' : 'ring-1 ring-slate-600'
      }`}
      aria-current={active ? 'true' : undefined}
    >
      <AvatarFace config={participant.avatar} speaking={moving} rank={participant.rank} label={`${role}: ${participant.name}`} />
      <div className="absolute inset-x-0 bottom-0 px-2 py-1.5 bg-gradient-to-t from-slate-950/90 to-transparent">
        <p className="text-white text-xs sm:text-sm font-medium truncate">{participant.name}</p>
        <p className="text-slate-300 text-[11px] truncate">
          {role}
          {showRank && participant.rank ? ` · ${LEVELS[participant.rank - 1].title}` : ''}
        </p>
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
export default function TrialStage({ currentSpeaker, lastRole, lastEventKey, floor, phaseName, judge, prosecution, defense }: TrialStageProps) {
  const ttsSpeaking = useTtsSpeaking();
  const recentMessage = useRecentPulse(lastEventKey, 3500);
  const active = pickActiveSpeaker({ lastRole: lastRole ?? currentSpeaker, floor, ttsSpeaking });
  const talking = TTS_SUPPORTED ? ttsSpeaking : recentMessage;
  const mouthMoves = (role: Speaker) => active === role && talking;
  const floorLabel =
    active === 'witness' ? 'Witness speaking' : active === 'jury' ? 'Jury deliberating' : null;

  return (
    <div className="relative w-full bg-slate-900 px-3 pb-3 pt-10">
      <div className="grid grid-cols-3 gap-2 sm:gap-3 items-center max-w-2xl mx-auto">
        <Tile role="Prosecution" participant={prosecution} active={active === 'prosecution'} moving={mouthMoves('prosecution')} />
        <Tile role="Judge" participant={judge} active={active === 'judge'} moving={mouthMoves('judge')} showRank={false} />
        <Tile role="Defense" participant={defense} active={active === 'defense'} moving={mouthMoves('defense')} />
      </div>
      {(phaseName || floorLabel) && (
        <div className="absolute top-2 left-3 right-3 flex justify-between gap-2 pointer-events-none">
          {phaseName && <p className="bg-slate-900/85 text-white text-xs sm:text-sm px-3 py-1 rounded-lg truncate">{phaseName}</p>}
          {floorLabel && <p className="bg-[#FFD43B] text-black font-bold text-xs sm:text-sm px-3 py-1 rounded-lg">{floorLabel}</p>}
        </div>
      )}
    </div>
  );
}
