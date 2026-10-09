import AvatarFace from '../AvatarFace';
import JurorAvatar from '../avatars/JurorAvatar';
import { TurnPill } from '../ui';
import { useRecentPulse } from './signals';
import { COURTROOM_LAYOUT, JURY_SEATS, type Seat } from './courtroomLayout';
import type { SceneProps, StageParticipant } from './types';

/** Simple painted-style room, used until the real courtroom art is added to the layout. */
function PlaceholderRoom() {
  return (
    <svg className="absolute inset-0 w-full h-full" viewBox="0 0 160 90" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id="cr-wall" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#5b3b22" />
          <stop offset="1" stopColor="#2f1d10" />
        </linearGradient>
        <linearGradient id="cr-floor" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#8a5a33" />
          <stop offset="1" stopColor="#4a2e18" />
        </linearGradient>
        <radialGradient id="cr-light" cx="0.5" cy="0.2" r="0.7">
          <stop offset="0" stopColor="#ffd98a" stopOpacity="0.55" />
          <stop offset="1" stopColor="#ffd98a" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="160" height="90" fill="url(#cr-wall)" />
      <rect y="52" width="160" height="38" fill="url(#cr-floor)" />
      {[14, 44, 116, 146].map(x => (
        <rect key={x} x={x - 6} y="6" width="12" height="30" rx="6" fill="#9ec9e8" opacity="0.55" />
      ))}
      <rect x="52" y="30" width="56" height="16" rx="2" fill="#3a2414" />
      <rect x="52" y="30" width="56" height="3" fill="#c8923f" />
      <rect x="112" y="34" width="26" height="14" rx="2" fill="#4a2e18" />
      <rect x="6" y="14" width="40" height="30" rx="2" fill="#3a2414" opacity="0.9" />
      <rect x="14" y="60" width="38" height="12" rx="2" fill="#3a2414" />
      <rect x="108" y="60" width="38" height="12" rx="2" fill="#3a2414" />
      <rect x="14" y="60" width="38" height="2.5" fill="#c8923f" />
      <rect x="108" y="60" width="38" height="2.5" fill="#c8923f" />
      <rect width="160" height="90" fill="url(#cr-light)" />
    </svg>
  );
}

function Person({
  seat,
  participant,
  role,
  active,
  talking,
  visible = true,
  stands = false
}: {
  seat: Seat;
  participant?: StageParticipant;
  role: string;
  active: boolean;
  talking: boolean;
  visible?: boolean;
  /** Counsel stand up to speak; the judge and witness just glow. */
  stands?: boolean;
}) {
  if (!participant) return null;
  const lift = active && stands ? 'translate(-50%, -62%) scale(1.14)' : 'translate(-50%, -50%)';
  return (
    <div
      className="absolute transition-all duration-300 ease-out"
      style={{
        left: `${seat.x}%`,
        top: `${seat.y}%`,
        width: `${seat.w}%`,
        transform: lift,
        opacity: visible ? 1 : 0,
        pointerEvents: visible ? 'auto' : 'none',
        zIndex: active ? 20 : 10
      }}
      aria-current={active ? 'true' : undefined}
      aria-hidden={visible ? undefined : true}
      data-seat={role}
    >
      <div
        className={`aspect-square rounded-2xl overflow-hidden bg-black/30 transition-all duration-200 ${
          active ? 'ring-4 ring-[#FFD43B] shadow-[0_0_26px_rgba(255,212,59,0.6)]' : 'ring-1 ring-white/25 brightness-90'
        }`}
      >
        <AvatarFace config={participant.avatar} speaking={active && talking} rank={participant.rank} label={`${role}: ${participant.name}`} />
      </div>
      <p className="mt-0.5 text-center text-white text-[10px] sm:text-xs font-medium truncate drop-shadow">{participant.name}</p>
    </div>
  );
}

/**
 * The virtual courtroom: one fixed room. The judge, both counsel and (when called) the witness
 * sit in set places. The side holding the floor stands up and glows, the witness fades onto the
 * stand only in witness phases, and the jury sits in their box. Seat positions live in
 * courtroomLayout.ts.
 */
export default function CourtroomScene({ cast, active, talking, phaseName, turn, compact, witness, jurors = [], jurorVotes }: SceneProps) {
  const L = COURTROOM_LAYOUT;
  const phaseFlash = useRecentPulse(phaseName, 2800);
  const juryActive = active === 'jury';
  const seated = jurors.slice(0, JURY_SEATS);
  const perRow = Math.ceil(JURY_SEATS / 2);

  return (
    <div className={`relative w-full mx-auto ${compact ? 'max-w-[18rem]' : 'max-w-3xl'} px-3 py-2`}>
      <div className="relative w-full overflow-hidden rounded-2xl ring-1 ring-white/20 bg-[#2f1d10]" style={{ aspectRatio: String(L.aspect) }}>
        {L.background ? <img src={L.background} alt="" className="absolute inset-0 w-full h-full object-cover" draggable={false} /> : <PlaceholderRoom />}

        <div className="absolute top-1.5 left-1.5 right-1.5 flex items-start justify-between gap-2 pointer-events-none z-30">
          {turn ? <TurnPill turn={turn} /> : <span />}
          {phaseName && phaseFlash && (
            <span className="rounded-full bg-black/70 text-white font-game text-sm leading-none px-3 py-1 animate-in fade-in">{phaseName}</span>
          )}
        </div>

        <Person seat={L.judge} participant={cast.judge} role="Judge" active={active === 'judge'} talking={talking} />
        <Person seat={L.witness} participant={witness} role="Witness" active={active === 'witness'} talking={talking} visible={!!witness} />
        <Person seat={L.prosecution} participant={cast.prosecution} role="Prosecution" active={active === 'prosecution'} talking={talking} stands />
        <Person seat={L.defense} participant={cast.defense} role="Defense" active={active === 'defense'} talking={talking} stands />

        <div
          data-seat="jury"
          aria-current={juryActive ? 'true' : undefined}
          className={`absolute grid gap-[2%] rounded-xl p-1 transition-all duration-200 ${
            juryActive ? 'ring-2 ring-[#FFD43B] shadow-[0_0_20px_rgba(255,212,59,0.5)] bg-black/30' : 'bg-black/20'
          }`}
          style={{
            left: `${L.jury.x}%`,
            top: `${L.jury.y}%`,
            width: `${L.jury.w}%`,
            height: `${L.jury.h}%`,
            gridTemplateColumns: `repeat(${perRow}, minmax(0, 1fr))`
          }}
        >
          {seated.map(j => {
            const vote = jurorVotes?.[j.id];
            return (
              <div key={j.id} className="relative aspect-square min-w-0">
                <JurorAvatar seed={j.id} name={j.name} size="xs" className="!w-full !h-full" />
                {vote && (
                  <span
                    data-vote={vote}
                    className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-black/60 ${vote === 'GUILTY' ? 'bg-red-500' : 'bg-blue-500'}`}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
