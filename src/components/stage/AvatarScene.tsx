import AvatarFace from '../AvatarFace';
import { TurnPill } from '../ui';
import { LEVELS } from '../../lib/levels';
import type { SceneProps, StageParticipant } from './types';

function Tile({
  role,
  participant,
  active,
  moving,
  showRank = true,
  compact
}: {
  role: string;
  participant: StageParticipant;
  active: boolean;
  moving: boolean;
  showRank?: boolean;
  compact?: boolean;
}) {
  return (
    <div
      className={`relative min-w-0 aspect-square rounded-2xl overflow-hidden bg-black/40 transition-all duration-200 ${
        active ? 'ring-4 ring-[#FFD43B] shadow-[0_0_28px_rgba(255,212,59,0.55)] scale-[1.03]' : 'ring-1 ring-white/20 opacity-90'
      }`}
      aria-current={active ? 'true' : undefined}
    >
      <AvatarFace config={participant.avatar} speaking={moving} rank={participant.rank} label={`${role}: ${participant.name}`} />
      <div className="absolute inset-x-0 bottom-0 px-2 py-1.5 bg-gradient-to-t from-black/90 to-transparent">
        <p className={`text-white font-medium truncate ${compact ? 'text-[11px]' : 'text-xs sm:text-sm'}`}>{participant.name}</p>
        {!compact && (
          <p className="text-white/70 text-[11px] truncate">
            {role}
            {showRank && participant.rank ? ` · ${LEVELS[participant.rank - 1].title}` : ''}
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * The avatar scene: three tiles like a video call (prosecution, judge, defense) over a turn
 * badge. The active person glows and their mouth moves while they speak.
 */
export default function AvatarScene({ cast, active, talking, turn, compact }: SceneProps) {
  const moving = (role: SceneProps['active']) => active === role && talking;
  const floorLabel =
    active === 'witness' ? 'Witness speaking' : active === 'jury' ? 'Jury deliberating' : active === 'bailiff' ? 'Bailiff speaking' : null;

  return (
    <div className={`relative w-full px-3 ${compact ? 'pb-2 pt-9' : 'pb-3 pt-12'}`}>
      <div className="absolute top-2 left-3 right-3 flex items-center justify-between gap-2 pointer-events-none">
        {turn ? <TurnPill turn={turn} /> : <span />}
        {floorLabel && <span className="rounded-full bg-[#FFD43B] text-black font-game text-lg leading-none px-3 py-1">{floorLabel}</span>}
      </div>
      <div className={`grid grid-cols-3 gap-2 sm:gap-3 items-center mx-auto ${compact ? 'max-w-[15rem]' : 'max-w-2xl'}`}>
        <Tile role="Prosecution" participant={cast.prosecution} active={active === 'prosecution'} moving={moving('prosecution')} compact={compact} />
        <Tile role="Judge" participant={cast.judge} active={active === 'judge'} moving={moving('judge')} showRank={false} compact={compact} />
        <Tile role="Defense" participant={cast.defense} active={active === 'defense'} moving={moving('defense')} compact={compact} />
      </div>
    </div>
  );
}
