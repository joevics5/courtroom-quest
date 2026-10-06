import { useEffect, useState } from 'react';
import {
  ATTIRE_COLORS,
  AvatarConfig,
  BACKDROPS,
  HAIR_COLORS,
  SKIN_TONES
} from '../lib/avatars';

const WIG_COLOR = '#e5e1d8';
const INK = '#1a1410';

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false
  );
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => setReduced(query.matches);
    query.addEventListener?.('change', onChange);
    return () => query.removeEventListener?.('change', onChange);
  }, []);
  return reduced;
}

/** Hair drawn behind the head (long hair, buns, afros, wig sides). */
function HairBack({ style, color }: { style: AvatarConfig['hairStyle']; color: string }) {
  switch (style) {
    case 'long':
      return <path d="M58 90 C52 40 148 40 142 90 L146 150 L54 150 Z" fill={color} />;
    case 'afro':
      return <circle cx="100" cy="74" r="54" fill={color} />;
    case 'curly':
      return (
        <g fill={color}>
          <circle cx="62" cy="80" r="16" />
          <circle cx="138" cy="80" r="16" />
          <circle cx="68" cy="58" r="16" />
          <circle cx="132" cy="58" r="16" />
        </g>
      );
    case 'wig':
      return (
        <g fill={WIG_COLOR}>
          <path d="M56 70 C40 90 40 128 58 140 L66 110 Z" />
          <path d="M144 70 C160 90 160 128 142 140 L134 110 Z" />
        </g>
      );
    default:
      return null;
  }
}

/** Hair drawn over the top of the head. */
function HairFront({ style, color }: { style: AvatarConfig['hairStyle']; color: string }) {
  const cap = 'M62 82 C58 38 142 38 138 82 C128 66 116 60 100 60 C84 60 72 66 62 82 Z';
  switch (style) {
    case 'bald':
      return null;
    case 'short':
    case 'long':
      return <path d={cap} fill={color} />;
    case 'bun':
      return (
        <g fill={color}>
          <path d={cap} />
          <circle cx="100" cy="38" r="14" />
        </g>
      );
    case 'curly':
      return (
        <g fill={color}>
          <path d={cap} />
          <circle cx="82" cy="52" r="12" />
          <circle cx="100" cy="46" r="13" />
          <circle cx="118" cy="52" r="12" />
        </g>
      );
    case 'afro':
      return <path d={cap} fill={color} />;
    case 'wig':
      return (
        <g fill={WIG_COLOR}>
          <path d={cap} />
          <circle cx="76" cy="56" r="11" />
          <circle cx="100" cy="50" r="12" />
          <circle cx="124" cy="56" r="11" />
        </g>
      );
    default:
      return null;
  }
}

function Attire({ type, color }: { type: AvatarConfig['attire']; color: string }) {
  return (
    <g>
      <path d="M18 200 C18 160 54 148 100 148 C146 148 182 160 182 200 Z" fill={color} />
      {type === 'robe' && (
        <g>
          <path d="M82 150 L100 186 L118 150 Z" fill="#0d0d12" opacity="0.55" />
          {/* white bands at the neck */}
          <rect x="92" y="150" width="7" height="22" rx="1.5" fill="#f4f1ea" />
          <rect x="101" y="150" width="7" height="22" rx="1.5" fill="#f4f1ea" />
        </g>
      )}
      {type === 'suit' && (
        <g>
          <path d="M84 150 L100 188 L116 150 Z" fill="#f4f1ea" />
          <path d="M96 156 L104 156 L106 190 L100 196 L94 190 Z" fill="#7c1d1d" />
          <path d="M84 150 L100 188 L70 200 L66 160 Z" fill={color} opacity="0.85" />
          <path d="M116 150 L100 188 L130 200 L134 160 Z" fill={color} opacity="0.85" />
        </g>
      )}
      {type === 'blazer' && (
        <g>
          <path d="M86 150 L100 182 L114 150 Z" fill="#e9e4da" />
          <path d="M86 150 L100 184 L76 200 L68 162 Z" fill={color} opacity="0.8" />
          <path d="M114 150 L100 184 L124 200 L132 162 Z" fill={color} opacity="0.8" />
        </g>
      )}
      {type === 'collar' && (
        <g>
          <path d="M84 150 L100 172 L116 150 L108 148 L100 160 L92 148 Z" fill="#f4f1ea" />
          <rect x="98" y="164" width="4" height="36" fill="#f4f1ea" opacity="0.7" />
        </g>
      )}
    </g>
  );
}

interface AvatarFaceProps {
  config: AvatarConfig;
  /** Moves the mouth while true. */
  speaking?: boolean;
  /** Text read by screen readers, e.g. the person's name. */
  label?: string;
  className?: string;
}

/**
 * A bust-style avatar drawn as layered SVG. Scales to its container
 * (width: 100%, square). The mouth is its own layer so it can move while the
 * character is speaking; with reduced-motion on it opens and holds instead.
 */
export default function AvatarFace({ config, speaking = false, label, className = '' }: AvatarFaceProps) {
  const reducedMotion = usePrefersReducedMotion();
  const skin = SKIN_TONES[config.skin];
  const hair = HAIR_COLORS[config.hairColor];
  const attire = config.attire === 'robe' ? '#16161d' : ATTIRE_COLORS[config.attireColor];
  const shade = 'rgba(0,0,0,0.12)';

  return (
    <svg
      viewBox="0 0 200 200"
      role="img"
      aria-label={label ?? 'Avatar'}
      className={className}
      style={{ display: 'block', width: '100%', height: '100%' }}
      preserveAspectRatio="xMidYMid slice"
    >
      <rect width="200" height="200" fill={BACKDROPS[config.backdrop]} />
      <HairBack style={config.hairStyle} color={hair} />
      <Attire type={config.attire} color={attire} />
      {/* neck */}
      <path d="M86 118 L86 154 C92 162 108 162 114 154 L114 118 Z" fill={skin} />
      <path d="M86 138 C94 146 106 146 114 138 L114 154 C108 162 92 162 86 154 Z" fill={shade} />
      {/* ears */}
      <circle cx="64" cy="98" r="7" fill={skin} />
      <circle cx="136" cy="98" r="7" fill={skin} />
      {/* head */}
      <ellipse cx="100" cy="94" rx="36" ry="43" fill={skin} />
      <HairFront style={config.hairStyle} color={hair} />
      {/* brows and eyes */}
      <g stroke={config.hairStyle === 'wig' ? '#6b6b6b' : hair} strokeWidth="3" strokeLinecap="round" fill="none">
        <path d="M78 80 Q86 76 94 80" />
        <path d="M106 80 Q114 76 122 80" />
      </g>
      <circle cx="86" cy="92" r="3.6" fill={INK} />
      <circle cx="114" cy="92" r="3.6" fill={INK} />
      {/* nose */}
      <path d="M100 96 Q96 108 101 109" stroke="rgba(0,0,0,0.28)" strokeWidth="2.4" fill="none" strokeLinecap="round" />
      {config.glasses && (
        <g stroke="#2a2a2a" strokeWidth="2.6" fill="rgba(255,255,255,0.08)">
          <circle cx="86" cy="92" r="11" />
          <circle cx="114" cy="92" r="11" />
          <path d="M97 91 L103 91" fill="none" />
        </g>
      )}
      {/* facial hair */}
      {config.beard === 'stubble' && (
        <path d="M66 104 C68 138 132 138 134 104 C124 122 76 122 66 104 Z" fill={hair} opacity="0.3" />
      )}
      {config.beard === 'full' && (
        <path d="M64 100 C62 146 138 146 136 100 C130 122 118 118 100 118 C82 118 70 122 64 100 Z" fill={hair} />
      )}
      {/* mouth */}
      {speaking ? (
        <ellipse cx="100" cy="124" rx="9" ry={reducedMotion ? 5 : 2} fill="#5a1e1e">
          {!reducedMotion && (
            <animate
              attributeName="ry"
              values="2;7;3;8;2;6;3"
              dur="0.55s"
              repeatCount="indefinite"
            />
          )}
        </ellipse>
      ) : (
        <path d="M89 122 Q100 128 111 122" stroke="#5a1e1e" strokeWidth="3" fill="none" strokeLinecap="round" />
      )}
    </svg>
  );
}
