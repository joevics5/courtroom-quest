import CourtFigure, { ROLE_STYLE, jurorStyle } from './CourtFigure';
import { TurnPill } from '../ui';
import { useRecentPulse } from './signals';
import { useEffect, useState } from 'react';
import { COURTROOM_LAYOUT, JURY_SEATS, cameraTransform, focusPoint, type Seat } from './courtroomLayout';
import type { SceneProps, StageParticipant } from './types';

/** True on a phone-sized screen, where the camera zooms in on the speaker. */
function useNarrowScreen() {
  const query = '(max-width: 639px)';
  const get = () => (typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia(query).matches : false);
  const [narrow, setNarrow] = useState(get);
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia(query);
    const on = () => setNarrow(mq.matches);
    on();
    mq.addEventListener?.('change', on);
    return () => mq.removeEventListener?.('change', on);
  }, []);
  return narrow;
}

const PHONE_ZOOM = 2.2;

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
  styleKey,
  active,
  visible = true,
  stands = false
}: {
  seat: Seat;
  participant?: StageParticipant;
  role: string;
  styleKey: keyof typeof ROLE_STYLE;
  active: boolean;
  visible?: boolean;
  /** Counsel stand up to speak; the judge and witness just glow. */
  stands?: boolean;
}) {
  if (!participant) return null;
  const standing = active && stands;
  const rise = standing ? ' translateY(-6%)' : '';
  return (
    <div
      className="absolute transition-all duration-300 ease-out"
      style={{
        left: `${seat.x}%`,
        top: `${seat.y}%`,
        width: `${seat.w}%`,
        transform: `translate(-50%, -50%)${rise}`,
        transformOrigin: 'center bottom',
        opacity: visible ? 1 : 0,
        pointerEvents: visible ? 'auto' : 'none',
        zIndex: active ? 20 : 10
      }}
      aria-current={active ? 'true' : undefined}
      aria-hidden={visible ? undefined : true}
      data-seat={role}
    >
      {/* One shared character, seated at its chair; counsel rise to a full-length standing pose when they speak.
          A soft fade at the waist (seated) or knees (standing) tucks them behind the furniture. */}
      <div
        className="transition-[filter] duration-200"
        style={{
          WebkitMaskImage: `linear-gradient(to bottom, #000 ${standing ? 50 : 76}%, transparent ${standing ? 62 : 98}%)`,
          maskImage: `linear-gradient(to bottom, #000 ${standing ? 50 : 76}%, transparent ${standing ? 62 : 98}%)`,
          filter: active
            ? 'drop-shadow(0 0 7px rgba(255,212,59,0.95)) drop-shadow(0 0 2px rgba(255,212,59,1))'
            : 'drop-shadow(0 3px 4px rgba(0,0,0,0.55)) brightness(0.88)'
        }}
      >
        <CourtFigure pose={standing ? 'standing' : 'seated'} style={ROLE_STYLE[styleKey]} label={`${role}: ${participant.name}`} />
      </div>
      {/* The name is centred on the seat and never cut off: it takes the width it needs, and a long name wraps onto a second line. */}
      <p
        data-testid="seat-name"
        className="relative left-1/2 -translate-x-1/2 -mt-1 w-max max-w-[8.5rem] text-center text-white text-[9px] sm:text-xs font-medium leading-tight [text-shadow:0_1px_3px_#000,0_0_2px_#000]"
      >
        {participant.name}
      </p>
    </div>
  );
}

/**
 * The virtual courtroom: one fixed room. The judge, both counsel and (when called) the witness
 * sit in set places. The side holding the floor stands up and glows, the witness fades onto the
 * stand only in witness phases, and the jury sits in their box. Seat positions live in
 * courtroomLayout.ts.
 */
export default function CourtroomScene({ cast, active, phaseName, turn, compact, witness, jurors = [], jurorVotes }: SceneProps) {
  const L = COURTROOM_LAYOUT;
  const phaseFlash = useRecentPulse(phaseName, 2800);
  const juryActive = active === 'jury';
  const seated = jurors.slice(0, JURY_SEATS);
  const narrow = useNarrowScreen();
  const camera = cameraTransform(focusPoint(active), narrow || compact ? PHONE_ZOOM : 1);

  return (
    <div className={`relative w-full mx-auto ${compact ? 'max-w-[18rem]' : 'max-w-3xl'} px-3 py-2`}>
      <div className="relative w-full overflow-hidden rounded-2xl ring-1 ring-white/20 bg-[#2f1d10]" style={{ aspectRatio: String(L.aspect) }}>
        <div data-camera className="absolute inset-0 transition-transform duration-500 ease-out" style={{ transformOrigin: '0 0', transform: camera }}>
        {L.background ? <img src={L.background} alt="" className="absolute inset-0 w-full h-full object-cover" draggable={false} /> : <PlaceholderRoom />}


        <Person seat={L.judge} participant={cast.judge} role="Judge" styleKey="judge" active={active === 'judge'} />
        <Person seat={L.witness} participant={witness} role="Witness" styleKey="witness" active={active === 'witness'} visible={!!witness} />
        <Person seat={L.prosecution} participant={cast.prosecution} role="Prosecution" styleKey="prosecution" active={active === 'prosecution'} stands />
        <Person seat={L.defense} participant={cast.defense} role="Defense" styleKey="defense" active={active === 'defense'} stands />

        <div data-seat="jury" aria-current={juryActive ? 'true' : undefined} className="absolute inset-0 pointer-events-none">
          {seated.map((j, i) => {
            const seat = L.jury[i];
            if (!seat) return null;
            const vote = jurorVotes?.[j.id];
            return (
              <div
                key={j.id}
                className={`absolute aspect-square overflow-hidden rounded-full transition-all duration-200 bg-black/20 ${
                  juryActive ? 'ring-2 ring-[#FFD43B] shadow-[0_0_10px_rgba(255,212,59,0.6)]' : 'ring-1 ring-black/40'
                }`}
                style={{ left: `${seat.x}%`, top: `${seat.y}%`, width: `${seat.w}%`, transform: 'translate(-50%, -50%)', zIndex: 10 }}
              >
                <CourtFigure style={jurorStyle(i)} label={j.name || `Juror ${i + 1}`} />
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
        <div className="absolute top-1.5 left-1.5 right-1.5 flex items-start justify-between gap-2 pointer-events-none z-30">
          {turn ? <TurnPill turn={turn} /> : <span />}
          {phaseName && phaseFlash && (
            <span className="rounded-full bg-black/70 text-white font-game text-sm leading-none px-3 py-1 animate-in fade-in">{phaseName}</span>
          )}
        </div>
      </div>
    </div>
  );
}
