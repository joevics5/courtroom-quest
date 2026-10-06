import { resolveJurorAvatar, type JurorAvatarAttributes } from '../../lib/avatars/jurorAvatar';

const SIZES = {
  xs: 'w-8 h-8',
  sm: 'w-10 h-10',
  md: 'w-12 h-12',
  lg: 'w-16 h-16',
  xl: 'w-20 h-20',
} as const;

interface Props {
  /** Any stable identifier for the juror (DB uuid, numeric id, or name). The
   * same seed always renders the same portrait. */
  seed: string | number;
  size?: keyof typeof SIZES;
  className?: string;
  /** Accessible label, e.g. the juror's display name. */
  name?: string;
  /** Dims/desaturates the portrait — used for a juror not yet seated. */
  muted?: boolean;
}

function HeadShape({ attrs }: { attrs: JurorAvatarAttributes }) {
  switch (attrs.headShape) {
    case 'round':
      return <circle cx={32} cy={26} r={15} fill={attrs.skinTone} />;
    case 'square':
      return <rect x={18} y={11} width={28} height={30} rx={9} fill={attrs.skinTone} />;
    default:
      return <ellipse cx={32} cy={26} rx={14} ry={17} fill={attrs.skinTone} />;
  }
}

function HairBack({ attrs }: { attrs: JurorAvatarAttributes }) {
  if (attrs.hairStyle === 'long') {
    return (
      <>
        <rect x={14} y={14} width={6} height={30} rx={3} fill={attrs.hairColor} />
        <rect x={44} y={14} width={6} height={30} rx={3} fill={attrs.hairColor} />
      </>
    );
  }
  if (attrs.hairStyle === 'afro') {
    return <circle cx={32} cy={17} r={19} fill={attrs.hairColor} />;
  }
  return null;
}

function HairTop({ attrs }: { attrs: JurorAvatarAttributes }) {
  switch (attrs.hairStyle) {
    case 'bald':
      return null;
    case 'buzz':
      return <ellipse cx={32} cy={14} rx={14} ry={7} fill={attrs.hairColor} />;
    case 'side-part':
      return (
        <>
          <ellipse cx={32} cy={14} rx={15} ry={9} fill={attrs.hairColor} />
          <rect x={18} y={19} width={3} height={8} rx={1.5} fill={attrs.hairColor} />
          <rect x={43} y={19} width={3} height={8} rx={1.5} fill={attrs.hairColor} />
          <line x1={25} y1={8} x2={29} y2={15} stroke={attrs.skinTone} strokeWidth={1.2} />
        </>
      );
    case 'curly':
      return (
        <>
          <circle cx={20} cy={15} r={5.5} fill={attrs.hairColor} />
          <circle cx={28} cy={10} r={6} fill={attrs.hairColor} />
          <circle cx={36} cy={10} r={6} fill={attrs.hairColor} />
          <circle cx={44} cy={15} r={5.5} fill={attrs.hairColor} />
          <circle cx={32} cy={8} r={5.5} fill={attrs.hairColor} />
        </>
      );
    case 'bun':
      return (
        <>
          <ellipse cx={32} cy={14} rx={15} ry={9} fill={attrs.hairColor} />
          <rect x={18} y={19} width={3} height={8} rx={1.5} fill={attrs.hairColor} />
          <rect x={43} y={19} width={3} height={8} rx={1.5} fill={attrs.hairColor} />
          <circle cx={32} cy={6} r={5} fill={attrs.hairColor} />
        </>
      );
    case 'afro':
      // The big silhouette is drawn behind the head (see HairBack); nothing extra on top.
      return null;
    case 'long':
    case 'short':
    default:
      return (
        <>
          <ellipse cx={32} cy={15} rx={15} ry={10} fill={attrs.hairColor} />
          <rect x={18} y={20} width={3} height={8} rx={1.5} fill={attrs.hairColor} />
          <rect x={43} y={20} width={3} height={8} rx={1.5} fill={attrs.hairColor} />
        </>
      );
  }
}

function FacialHair({ attrs }: { attrs: JurorAvatarAttributes }) {
  switch (attrs.facialHair) {
    case 'mustache':
      return <ellipse cx={32} cy={32} rx={5} ry={1.4} fill={attrs.hairColor} />;
    case 'goatee':
      return <ellipse cx={32} cy={38} rx={3.5} ry={3} fill={attrs.hairColor} />;
    case 'beard':
      return <ellipse cx={32} cy={35} rx={10} ry={7} fill={attrs.hairColor} opacity={0.92} />;
    default:
      return null;
  }
}

function GlassesLayer({ attrs }: { attrs: JurorAvatarAttributes }) {
  if (attrs.glasses === 'none') return null;
  const rx = attrs.glasses === 'round' ? 5 : 2;
  const Shape = attrs.glasses === 'round' ? 'circle' : 'rect';
  return (
    <g stroke="#2b2b2b" strokeWidth={1.4} fill="none">
      {Shape === 'circle' ? (
        <>
          <circle cx={26} cy={27} r={5} />
          <circle cx={38} cy={27} r={5} />
        </>
      ) : (
        <>
          <rect x={21} y={23} width={10} height={7} rx={rx} />
          <rect x={33} y={23} width={10} height={7} rx={rx} />
        </>
      )}
      <line x1={31} y1={27} x2={33} y2={27} />
    </g>
  );
}

/**
 * Procedurally rendered juror portrait — deterministic from `seed`, so the
 * same juror looks identical every time without storing or fetching an
 * image. See src/lib/avatars/jurorAvatar.ts for how attributes are derived.
 */
export default function JurorAvatar({ seed, size = 'md', className = '', name, muted = false }: Props) {
  const attrs = resolveJurorAvatar(seed);

  return (
    <svg
      viewBox="0 0 64 64"
      role="img"
      aria-label={name ? `Juror portrait: ${name}` : 'Juror portrait'}
      className={`flex-none rounded-full ${SIZES[size]} ${muted ? 'opacity-40 saturate-[0.4]' : ''} ${className}`}
    >
      <circle cx={32} cy={32} r={32} fill="#E9E4D8" />
      <path d="M8,64 L20,45 L44,45 L56,64 Z" fill={attrs.attireColor} />
      <rect x={29} y={44} width={6} height={16} fill="#F5F2E8" opacity={0.85} />
      <HairBack attrs={attrs} />
      <HeadShape attrs={attrs} />
      <circle cx={26} cy={27} r={1.6} fill="#2b2b2b" />
      <circle cx={38} cy={27} r={1.6} fill="#2b2b2b" />
      <path d="M27,34 Q32,36.5 37,34" stroke="#6b4a3a" strokeWidth={1.3} fill="none" strokeLinecap="round" />
      <HairTop attrs={attrs} />
      <FacialHair attrs={attrs} />
      <GlassesLayer attrs={attrs} />
    </svg>
  );
}
