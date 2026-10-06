import { useEffect, useId, useState } from 'react';
import {
  ACCENT_COLORS,
  ATTIRE_COLORS,
  AvatarConfig,
  BACKDROPS,
  EYE_COLORS,
  HAIR_COLORS,
  SKIN_TONES
} from '../lib/avatars';

const INK = '#1a1410';
const WIG = '#ece7dc';
const GLASSES = ['#2a2a33', '#8b5a2b', '#c9a227'];

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
function mix(hex: string, target: string, t: number): string {
  const a = hexToRgb(hex);
  const b = hexToRgb(target);
  const c = a.map((v, i) => Math.round(v + (b[i] - v) * t));
  return `#${c.map(v => v.toString(16).padStart(2, '0')).join('')}`;
}
const lighten = (hex: string, t: number) => mix(hex, '#ffffff', t);
const darken = (hex: string, t: number) => mix(hex, '#000000', t);

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

/** Head outlines: temple half-width, jaw half-width, chin y. */
const HEADS = [
  { tw: 34, jw: 24, chin: 140 }, // oval
  { tw: 38, jw: 30, chin: 135 }, // round
  { tw: 36, jw: 35, chin: 138 }, // square jaw
  { tw: 32, jw: 17, chin: 148 } // long
];

const EYES = [
  { rx: 7.6, ry: 5.6, lift: 0 }, // round
  { rx: 8.8, ry: 4.8, lift: 1.6 }, // almond
  { rx: 8.6, ry: 3.9, lift: 0 }, // narrow
  { rx: 7, ry: 6.6, lift: 0 } // wide
];

const BROWS = [
  'M-10 1 Q0 -1 10 0', // straight
  'M-10 2 Q-1 -5 10 0', // arched
  'M-10 -2 Q0 -2 10 4', // stern
  'M-10 1 Q0 -4 10 -1' // raised
];

const NOSES = [
  { bridge: 'M99 99 Q95 109 97 112', tip: 'M95 113 Q100 116 105 113', spread: 3.4 },
  { bridge: 'M99 99 Q93 110 93 113', tip: 'M93 114 Q100 119 107 114', spread: 5 },
  { bridge: 'M99 98 Q96 108 95 112', tip: 'M96 112 Q100 115 103 111', spread: 2.8 },
  { bridge: 'M99 100 Q96 108 97 111', tip: 'M95 112 Q100 117 105 112', spread: 3.8 }
];

const MOUTHS = [
  { w: 11, c: 3.2 }, // gentle smile
  { w: 14, c: 5.4 }, // broad smile
  { w: 9, c: 0.6 } // neutral
];

function headPath(h: (typeof HEADS)[number]): string {
  const { tw, jw, chin } = h;
  return (
    `M${100 - tw} 92 C${100 - tw} 40 ${100 + tw} 40 ${100 + tw} 92 ` +
    `C${100 + tw} ${chin - 22} ${100 + jw} ${chin - 4} 100 ${chin} ` +
    `C${100 - jw} ${chin - 4} ${100 - tw} ${chin - 22} ${100 - tw} 92 Z`
  );
}

interface HairProps {
  style: AvatarConfig['hairStyle'];
  fill: string;
  light: string;
  tw: number;
}

/** Hair drawn behind the head and shoulders. */
function HairBack({ style, fill, tw }: HairProps) {
  const L = 100 - tw;
  const R = 100 + tw;
  switch (style) {
    case 'long':
      return (
        <path
          d={`M${L - 6} 92 C${L - 14} 40 ${R + 14} 40 ${R + 6} 92 L${R + 14} 170 L${L - 14} 170 Z`}
          fill={fill}
        />
      );
    case 'bob':
      return (
        <path
          d={`M${L - 5} 88 C${L - 12} 40 ${R + 12} 40 ${R + 5} 88 C${R + 12} 120 ${R + 8} 146 ${R - 6} 150 L${L + 6} 150 C${L - 8} 146 ${L - 12} 120 ${L - 5} 88 Z`}
          fill={fill}
        />
      );
    case 'afro':
      return <circle cx="100" cy="78" r="58" fill={fill} />;
    case 'curly':
      return (
        <g fill={fill}>
          <circle cx={L - 6} cy="86" r="17" />
          <circle cx={R + 6} cy="86" r="17" />
          <circle cx={L - 3} cy="62" r="17" />
          <circle cx={R + 3} cy="62" r="17" />
          <circle cx={L - 4} cy="108" r="13" />
          <circle cx={R + 4} cy="108" r="13" />
        </g>
      );
    case 'wig':
      return (
        <g fill={fill}>
          <circle cx={L - 6} cy="84" r="13" />
          <circle cx={L - 8} cy="104" r="13" />
          <circle cx={L - 4} cy="124" r="12" />
          <circle cx={R + 6} cy="84" r="13" />
          <circle cx={R + 8} cy="104" r="13" />
          <circle cx={R + 4} cy="124" r="12" />
        </g>
      );
    default:
      return null;
  }
}

/** Hair over the top of the head (hairline, fringe, curls). */
function HairFront({ style, fill, light, tw }: HairProps) {
  const L = 100 - tw - 2;
  const R = 100 + tw + 2;
  const sweep = `M${L} 94 C${L - 5} 36 ${R + 5} 36 ${R} 94 C${R - 1} 80 ${R - 8} 68 112 64 C100 57 86 62 78 70 C72 76 ${L + 3} 82 ${L} 94 Z`;
  const part = `M${L} 94 C${L - 5} 36 ${R + 5} 36 ${R} 94 C${R - 2} 78 ${R - 10} 66 100 62 C90 66 ${L + 10} 78 ${L} 94 Z`;
  const streak = <path d="M78 56 Q100 46 124 58" stroke={light} strokeWidth="3.2" strokeLinecap="round" fill="none" opacity="0.5" />;
  switch (style) {
    case 'bald':
      return <ellipse cx="88" cy="64" rx="12" ry="6" fill="#fff" opacity="0.16" transform="rotate(-18 88 64)" />;
    case 'short':
      return (
        <g>
          <path d={sweep} fill={fill} />
          {streak}
        </g>
      );
    case 'slick':
      return (
        <g>
          <path
            d={`M${L} 94 C${L - 4} 34 ${R + 4} 34 ${R} 94 C${R - 2} 76 ${R - 8} 62 100 58 C${L + 8} 62 ${L + 3} 78 ${L} 94 Z`}
            fill={fill}
          />
          <path d="M80 54 Q100 44 122 56" stroke={light} strokeWidth="3.4" strokeLinecap="round" fill="none" opacity="0.55" />
        </g>
      );
    case 'bob':
      return (
        <g>
          <path d={sweep} fill={fill} />
          <path d={`M${L + 2} 92 C${L + 4} 70 ${L + 12} 64 ${L + 22} 62 C${L + 14} 74 ${L + 12} 84 ${L + 10} 100 Z`} fill={fill} />
          {streak}
        </g>
      );
    case 'long':
      return (
        <g>
          <path d={part} fill={fill} />
          {streak}
        </g>
      );
    case 'bun':
      return (
        <g>
          <circle cx="100" cy="36" r="15" fill={fill} />
          <circle cx="95" cy="32" r="5" fill={light} opacity="0.4" />
          <path d={part} fill={fill} />
          {streak}
        </g>
      );
    case 'curly':
      return (
        <g fill={fill}>
          <path d={part} />
          <circle cx="78" cy="56" r="13" />
          <circle cx="100" cy="48" r="14" />
          <circle cx="122" cy="56" r="13" />
          <circle cx="92" cy="52" r="3.5" fill={light} opacity="0.4" />
        </g>
      );
    case 'afro':
      return (
        <g>
          <path d={part} fill={fill} />
          <circle cx="86" cy="50" r="5" fill={light} opacity="0.3" />
        </g>
      );
    case 'wig':
      return (
        <g fill={fill}>
          <path d={part} />
          <circle cx="76" cy="58" r="12" />
          <circle cx="100" cy="50" r="13" />
          <circle cx="124" cy="58" r="12" />
          <g stroke="#bdb6a6" strokeWidth="1.4" fill="none" opacity="0.8">
            <path d="M64 100 q-8 4 -2 12" />
            <path d="M136 100 q8 4 2 12" />
            <path d="M70 58 q6 6 12 0" />
            <path d="M94 50 q6 6 12 0" />
            <path d="M118 58 q6 6 12 0" />
          </g>
        </g>
      );
    default:
      return null;
  }
}

function Attire({
  type,
  color,
  accent,
  uid
}: {
  type: AvatarConfig['attire'];
  color: string;
  accent: string;
  uid: string;
}) {
  const body = 'M14 200 C14 166 52 152 100 152 C148 152 186 166 186 200 Z';
  return (
    <g>
      <path d={body} fill={`url(#${uid}-body)`} />
      <path d="M14 200 C14 176 30 164 50 158 L50 200 Z" fill="#000" opacity="0.12" />
      {type === 'robe' && (
        <g>
          <path d="M80 152 L100 192 L120 152 Z" fill="#0b0b10" />
          <path d="M80 152 L100 192" stroke={accent} strokeWidth="3.4" strokeLinecap="round" />
          <path d="M120 152 L100 192" stroke={accent} strokeWidth="3.4" strokeLinecap="round" />
          <path d="M30 168 C44 160 62 156 80 152" stroke={accent} strokeWidth="2.4" fill="none" opacity="0.8" />
          <path d="M170 168 C156 160 138 156 120 152" stroke={accent} strokeWidth="2.4" fill="none" opacity="0.8" />
          <rect x="91" y="152" width="8" height="26" rx="1.6" fill="#f6f3ec" />
          <rect x="101" y="152" width="8" height="26" rx="1.6" fill="#f6f3ec" />
          <rect x="99" y="152" width="2" height="26" fill="#cfc9bb" />
        </g>
      )}
      {type === 'suit' && (
        <g>
          <path d="M83 152 L100 194 L117 152 Z" fill="#f6f3ec" />
          <path d="M92 152 L108 152 L100 160 Z" fill="#e4dfd2" />
          <path d="M96 160 L104 160 L106 192 L100 198 L94 192 Z" fill={accent} />
          <path d="M94 156 Q100 164 106 156 L104 162 L96 162 Z" fill={darken(accent, 0.25)} />
          <path d="M83 152 L100 196 L66 200 L60 164 Z" fill={darken(color, 0.12)} />
          <path d="M117 152 L100 196 L134 200 L140 164 Z" fill={darken(color, 0.12)} />
          <path d="M66 176 L82 174 L80 180 L66 182 Z" fill={accent} opacity="0.9" />
        </g>
      )}
      {type === 'blazer' && (
        <g>
          <path d="M85 152 L100 184 L115 152 Z" fill={accent} />
          <path d="M85 152 L100 186 L74 200 L66 164 Z" fill={darken(color, 0.1)} />
          <path d="M115 152 L100 186 L126 200 L134 164 Z" fill={darken(color, 0.1)} />
          <circle cx="100" cy="190" r="2.4" fill={lighten(color, 0.35)} />
        </g>
      )}
      {type === 'collar' && (
        <g>
          <path d="M82 152 L100 176 L118 152 L110 150 L100 162 L90 150 Z" fill="#f6f3ec" />
          <path d="M100 176 L100 200" stroke={darken(color, 0.25)} strokeWidth="1.6" />
          <circle cx="100" cy="186" r="2" fill={accent} />
          <circle cx="100" cy="196" r="2" fill={accent} />
          <path d="M70 160 Q100 150 130 160" stroke={accent} strokeWidth="3" fill="none" opacity="0.9" />
        </g>
      )}
    </g>
  );
}

function Eye({
  cx,
  cy,
  shape,
  iris,
  uid,
  side,
  lid
}: {
  cx: number;
  cy: number;
  shape: (typeof EYES)[number];
  iris: string;
  uid: string;
  side: 'l' | 'r';
  lid: string;
}) {
  const { rx, ry, lift } = shape;
  const outer = side === 'l' ? -1 : 1;
  const clipId = `${uid}-eye-${side}`;
  const irisR = Math.min(ry - 0.1, 4.6);
  return (
    <g>
      <clipPath id={clipId}>
        <ellipse cx={cx} cy={cy} rx={rx} ry={ry} />
      </clipPath>
      <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="#fdfcfa" />
      <g clipPath={`url(#${clipId})`}>
        <circle cx={cx + 0.4} cy={cy + 0.4} r={irisR} fill={iris} />
        <circle cx={cx + 0.4} cy={cy + 0.4} r={irisR * 0.5} fill="#0d0907" />
        <ellipse cx={cx} cy={cy - ry} rx={rx} ry={ry * 0.7} fill={lid} opacity="0.35" />
      </g>
      <circle cx={cx - 1.2} cy={cy - 1.4} r="1.3" fill="#fff" />
      <path
        d={`M${cx - rx - 0.6} ${cy + 0.2} Q${cx} ${cy - ry * 1.7} ${cx + rx + 0.6} ${cy + 0.2}`}
        stroke={INK}
        strokeWidth="2.3"
        strokeLinecap="round"
        fill="none"
        transform={lift ? `rotate(${outer * -lift} ${cx} ${cy})` : undefined}
      />
      <path
        d={`M${cx - rx + 1} ${cy + ry * 0.7} Q${cx} ${cy + ry * 1.15} ${cx + rx - 1} ${cy + ry * 0.7}`}
        stroke={lid}
        strokeWidth="1"
        fill="none"
        opacity="0.45"
      />
    </g>
  );
}

interface AvatarFaceProps {
  config: AvatarConfig;
  /** Moves the mouth while true. */
  speaking?: boolean;
  /** Text read by screen readers, e.g. the person's name. */
  label?: string;
  /** "face" zooms in on the head, for small pickers. */
  crop?: 'full' | 'face';
  className?: string;
}

/**
 * A shaded, colourful bust drawn as layered SVG. Scales to its container.
 * The mouth is its own layer so it can move while the character is speaking;
 * with reduced motion on it opens and holds instead.
 */
export default function AvatarFace({ config, speaking = false, label, crop = 'full', className = '' }: AvatarFaceProps) {
  const reducedMotion = usePrefersReducedMotion();
  const uid = `av${useId().replace(/[^a-zA-Z0-9]/g, '')}`;

  const head = HEADS[config.headShape] ?? HEADS[0];
  const eye = EYES[config.eyeShape] ?? EYES[0];
  const mouth = MOUTHS[config.mouthShape] ?? MOUTHS[0];
  const nose = NOSES[config.noseShape] ?? NOSES[0];

  const skin = SKIN_TONES[config.skin];
  const skinHi = lighten(skin, 0.14);
  const skinLo = darken(skin, 0.2);
  const lid = darken(skin, 0.3);
  const lip = mix(skin, '#a23a3f', 0.55);
  const isWig = config.hairStyle === 'wig';
  const hairBase = HAIR_COLORS[config.hairColor];
  const hairFill = isWig ? WIG : hairBase;
  const hairLight = lighten(hairFill, isWig ? 0.4 : 0.3);
  const beardFill = hairBase;
  const accent = ACCENT_COLORS[config.accent];
  const attire = config.attire === 'robe' ? '#1b1b24' : ATTIRE_COLORS[config.attireColor];
  const backdrop = BACKDROPS[config.backdrop];
  const iris = EYE_COLORS[config.eyeColor];
  const browColor = isWig || config.hairColor === 4 ? '#7d7a74' : darken(hairBase, 0.1);
  const { tw, jw, chin } = head;
  const old = config.age >= 2;
  const mid = config.age >= 1;
  const glassesColor = GLASSES[config.attireColor % GLASSES.length];
  const viewBox = crop === 'face' ? '40 22 120 120' : '0 0 200 200';
  const mouthW = mouth.w;

  const speakValues = reducedMotion ? '1 0.7' : '1 0.25;1 1;1 0.45;1 0.95;1 0.3;1 0.8;1 0.25';

  return (
    <svg
      viewBox={viewBox}
      role="img"
      aria-label={label ?? 'Avatar'}
      className={className}
      style={{ display: 'block', width: '100%', height: '100%' }}
      preserveAspectRatio="xMidYMid slice"
    >
      <defs>
        <linearGradient id={`${uid}-bg`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={lighten(backdrop, 0.3)} />
          <stop offset="1" stopColor={darken(backdrop, 0.4)} />
        </linearGradient>
        <radialGradient id={`${uid}-glow`} cx="0.5" cy="0.42" r="0.5">
          <stop offset="0" stopColor="#fff6dc" stopOpacity="0.5" />
          <stop offset="1" stopColor="#fff6dc" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${uid}-body`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={lighten(attire, 0.22)} />
          <stop offset="0.55" stopColor={attire} />
          <stop offset="1" stopColor={darken(attire, 0.35)} />
        </linearGradient>
        <radialGradient id={`${uid}-face`} cx="0.4" cy="0.34" r="0.8">
          <stop offset="0" stopColor={skinHi} />
          <stop offset="0.55" stopColor={skin} />
          <stop offset="1" stopColor={skinLo} />
        </radialGradient>
        <linearGradient id={`${uid}-neck`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={darken(skin, 0.42)} />
          <stop offset="0.5" stopColor={darken(skin, 0.12)} />
          <stop offset="1" stopColor={skin} />
        </linearGradient>
        <linearGradient id={`${uid}-hair`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={lighten(hairFill, 0.12)} />
          <stop offset="1" stopColor={darken(hairFill, 0.3)} />
        </linearGradient>
        <linearGradient id={`${uid}-rim`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#ffd9a0" stopOpacity="0.32" />
          <stop offset="0.45" stopColor="#ffd9a0" stopOpacity="0" />
        </linearGradient>
        <clipPath id={`${uid}-head`}>
          <path d={headPath(head)} />
        </clipPath>
        <clipPath id={`${uid}-mouth`}>
          <ellipse cx="0" cy="4" rx={mouthW * 0.78} ry="6.5" />
        </clipPath>
      </defs>

      {/* backdrop */}
      <rect width="200" height="200" fill={`url(#${uid}-bg)`} />
      <circle cx="30" cy="40" r="22" fill={accent} opacity="0.14" />
      <circle cx="176" cy="64" r="16" fill={accent} opacity="0.12" />
      <circle cx="160" cy="26" r="8" fill="#fff" opacity="0.1" />
      <rect width="200" height="200" fill={`url(#${uid}-glow)`} />

      {/* hair behind */}
      <g fill={`url(#${uid}-hair)`}>
        <HairBack style={config.hairStyle} fill={`url(#${uid}-hair)`} light={hairLight} tw={tw} />
      </g>

      {/* neck and outfit */}
      <path d="M85 118 L85 158 C92 166 108 166 115 158 L115 118 Z" fill={`url(#${uid}-neck)`} />
      <Attire type={config.attire} color={attire} accent={accent} uid={uid} />

      {/* ears */}
      <g>
        <ellipse cx={100 - tw} cy="98" rx="6.5" ry="9" fill={skin} />
        <ellipse cx={100 + tw} cy="98" rx="6.5" ry="9" fill={skin} />
        <ellipse cx={100 - tw} cy="99" rx="3" ry="5" fill={skinLo} opacity="0.55" />
        <ellipse cx={100 + tw} cy="99" rx="3" ry="5" fill={skinLo} opacity="0.55" />
      </g>

      {/* head */}
      <path d={headPath(head)} fill={`url(#${uid}-face)`} />
      <g clipPath={`url(#${uid}-head)`}>
        <rect x="0" y="0" width="200" height="200" fill={`url(#${uid}-rim)`} />
        <ellipse cx="78" cy="119" rx="10" ry="6.5" fill="#e0556a" opacity={config.skin >= 4 ? 0.1 : 0.17} />
        <ellipse cx="122" cy="119" rx="10" ry="6.5" fill="#e0556a" opacity={config.skin >= 4 ? 0.1 : 0.17} />
        <ellipse cx="94" cy="72" rx="16" ry="7" fill="#fff" opacity="0.1" />
        <ellipse cx="100" cy={chin + 2} rx={jw + 6} ry="9" fill={lid} opacity="0.18" />
      </g>

      {/* hair front */}
      <HairFront style={config.hairStyle} fill={`url(#${uid}-hair)`} light={hairLight} tw={tw} />

      {/* age lines */}
      {mid && (
        <g stroke={lid} strokeWidth="1.3" strokeLinecap="round" fill="none" opacity="0.32">
          <path d="M82 74 Q100 71 118 74" />
          {old && <path d="M84 79 Q100 76 116 79" />}
          <path d={`M${86 - eye.rx - 3} 92 l-4 -2 M${86 - eye.rx - 3} 95 l-4 1`} />
          <path d={`M${114 + eye.rx + 3} 92 l4 -2 M${114 + eye.rx + 3} 95 l4 1`} />
        </g>
      )}
      {old && (
        <g stroke={lid} strokeWidth="1.4" strokeLinecap="round" fill="none" opacity="0.38">
          <path d="M90 112 Q86 122 89 131" />
          <path d="M110 112 Q114 122 111 131" />
          <path d={`M${86 - eye.rx} ${99 + eye.ry} Q86 ${103 + eye.ry} ${86 + eye.rx} ${99 + eye.ry}`} />
          <path d={`M${114 - eye.rx} ${99 + eye.ry} Q114 ${103 + eye.ry} ${114 + eye.rx} ${99 + eye.ry}`} />
        </g>
      )}

      {/* brows */}
      <g stroke={browColor} strokeWidth={old ? 4.4 : 3.8} strokeLinecap="round" fill="none">
        <path d={BROWS[config.browShape] ?? BROWS[0]} transform="translate(86 83)" />
        <path d={BROWS[config.browShape] ?? BROWS[0]} transform="translate(114 83) scale(-1 1)" />
      </g>

      {/* eyes */}
      <Eye cx={86} cy={95} shape={eye} iris={iris} uid={uid} side="l" lid={lid} />
      <Eye cx={114} cy={95} shape={eye} iris={iris} uid={uid} side="r" lid={lid} />

      {/* nose */}
      <g fill="none" strokeLinecap="round">
        <path d={nose.bridge} stroke={lid} strokeWidth="2.2" opacity="0.5" />
        <path d={nose.tip} stroke={lid} strokeWidth="2" opacity="0.55" />
        <ellipse cx={100 - nose.spread} cy="113" rx="1.5" ry="1" fill={darken(skin, 0.5)} opacity="0.6" stroke="none" />
        <ellipse cx={100 + nose.spread} cy="113" rx="1.5" ry="1" fill={darken(skin, 0.5)} opacity="0.6" stroke="none" />
        <ellipse cx="101" cy="109" rx="2.6" ry="3.4" fill="#fff" opacity="0.14" stroke="none" />
      </g>

      {/* glasses */}
      {config.glasses && (
        <g>
          <g fill="rgba(190,225,255,0.14)" stroke={glassesColor} strokeWidth="2.6">
            <rect x={86 - 13} y="84" width="26" height="21" rx="8" />
            <rect x={114 - 13} y="84" width="26" height="21" rx="8" />
          </g>
          <path d="M99 91 Q100 89 101 91" stroke={glassesColor} strokeWidth="2.4" fill="none" />
          <path d={`M${73} 92 L${100 - tw} 94 M${127} 92 L${100 + tw} 94`} stroke={glassesColor} strokeWidth="2.2" />
          <path d="M77 88 L84 86 M105 88 L112 86" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" opacity="0.5" />
        </g>
      )}

      {/* facial hair */}
      {config.beard === 'stubble' && (
        <path
          d={`M${100 - tw + 2} 102 C${100 - tw} ${chin - 12} ${100 - jw} ${chin + 4} 100 ${chin + 5} C${100 + jw} ${chin + 4} ${100 + tw} ${chin - 12} ${100 + tw - 2} 102 C${100 + tw - 10} 120 ${100 - tw + 10} 120 ${100 - tw + 2} 102 Z`}
          fill={beardFill}
          opacity="0.28"
        />
      )}
      {config.beard === 'full' && (
        <g fill={beardFill}>
          <path d={`M${100 - tw + 1} 98 C${100 - tw - 2} ${chin - 6} ${100 - jw} ${chin + 10} 100 ${chin + 12} C${100 + jw} ${chin + 10} ${100 + tw + 2} ${chin - 6} ${100 + tw - 1} 98 C${100 + tw - 6} 116 ${100 + 16} 114 100 116 C${100 - 16} 114 ${100 - tw + 6} 116 ${100 - tw + 1} 98 Z`} />
          <path d="M86 122 Q100 113 114 122 Q100 125 86 122 Z" />
        </g>
      )}
      {config.beard === 'goatee' && (
        <g fill={beardFill}>
          <path d={`M91 ${chin - 8} Q100 ${chin - 14} 109 ${chin - 8} Q108 ${chin + 8} 100 ${chin + 9} Q92 ${chin + 8} 91 ${chin - 8} Z`} />
          <path d="M87 122 Q100 114 113 122 Q100 125 87 122 Z" />
        </g>
      )}

      {/* mouth */}
      <g transform="translate(100 127)">
        {speaking ? (
          <g>
            <g>
              <animateTransform attributeName="transform" type="scale" values={speakValues} dur="0.6s" repeatCount={reducedMotion ? '1' : 'indefinite'} />
              <ellipse cx="0" cy="4" rx={mouthW * 0.78} ry="6.5" fill="#4a1414" stroke={lip} strokeWidth="2.6" />
              <g clipPath={`url(#${uid}-mouth)`}>
                <path d={`M${-mouthW * 0.6} -2 Q0 -4 ${mouthW * 0.6} -2 L${mouthW * 0.56} 2 Q0 0 ${-mouthW * 0.56} 2 Z`} fill="#fff" />
                <ellipse cx="0" cy="8.5" rx={mouthW * 0.42} ry="3" fill="#c4545e" />
              </g>
            </g>
            <path
              d={`M${-mouthW} 0 Q${-mouthW * 0.45} -3.6 0 -2.6 Q${mouthW * 0.45} -3.6 ${mouthW} 0 Q0 ${mouth.c * 0.5} ${-mouthW} 0 Z`}
              fill={darken(lip, 0.08)}
            />
          </g>
        ) : (
          <g>
            <path d={`M${-mouthW} 0 Q0 ${mouth.c + 7.5} ${mouthW} 0 Q0 ${mouth.c} ${-mouthW} 0 Z`} fill={lighten(lip, 0.08)} />
            <path
              d={`M${-mouthW} 0 Q${-mouthW * 0.45} -3.6 0 -2.6 Q${mouthW * 0.45} -3.6 ${mouthW} 0 Q0 ${mouth.c} ${-mouthW} 0 Z`}
              fill={darken(lip, 0.1)}
            />
            <path d={`M${-mouthW} 0 Q0 ${mouth.c} ${mouthW} 0`} stroke={darken(lip, 0.45)} strokeWidth="1.1" fill="none" strokeLinecap="round" />
          </g>
        )}
      </g>
    </svg>
  );
}
