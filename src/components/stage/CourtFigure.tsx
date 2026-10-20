/**
 * THE ONE COURTROOM CHARACTER. A plain, faceless, gender-neutral human drawn full length.
 * Everyone in the virtual courtroom is this same figure; only the clothes change (outfit colour,
 * tie/trim colour, a robe and a hat for the judge). No faces, no lips: the stage highlights and
 * zooms to whoever has the floor instead.
 *
 * Two poses share the same top edge, so a figure can rise from its chair in place:
 *  - seated:   head to waist in a square 100x100 box (the desk hides everything below).
 *  - standing: the full body in a 100x190 box.
 */
export type FigurePose = 'seated' | 'standing';

export interface FigureStyle {
  /** Jacket / robe colour. */
  outfit: string;
  /** Tie or collar trim colour. */
  trim: string;
  /** Trouser colour (standing pose only). */
  trousers?: string;
  /** A judge wears a robe and a flat cap. */
  judge?: boolean;
}

const SKIN = '#d9a77c';
const SKIN_SHADE = '#c38f66';

/** Outfit per courtroom role: change a colour here and it changes everywhere. */
export const ROLE_STYLE: Record<'judge' | 'prosecution' | 'defense' | 'witness', FigureStyle> = {
  judge: { outfit: '#16161c', trim: '#d4a72c', trousers: '#16161c', judge: true },
  prosecution: { outfit: '#1f3a68', trim: '#c8362f', trousers: '#16233f' },
  defense: { outfit: '#4a2f55', trim: '#e0b43a', trousers: '#2c1b34' },
  witness: { outfit: '#6b7f86', trim: '#e9e4d6', trousers: '#4a585d' }
};

/** Twelve jacket colours, so the jury box does not look like a uniform. */
export const JUROR_OUTFITS = ['#8d5a44', '#3f7d6b', '#c27c2c', '#5b6fa8', '#a8475a', '#6f8f3f', '#8a6fb0', '#3d8da3', '#b7684a', '#677085', '#a89a45', '#7a4a6d'];

export function jurorStyle(index: number): FigureStyle {
  const outfit = JUROR_OUTFITS[((index % 12) + 12) % 12];
  return { outfit, trim: '#f2efe6' };
}

export default function CourtFigure({
  pose = 'seated',
  style,
  label,
  className
}: {
  pose?: FigurePose;
  style: FigureStyle;
  label?: string;
  className?: string;
}) {
  const standing = pose === 'standing';
  const h = standing ? 190 : 100;
  const { outfit, trim, judge } = style;
  const trousers = style.trousers ?? outfit;
  return (
    <svg
      viewBox={`0 0 100 ${h}`}
      className={className}
      style={{ display: 'block', width: '100%', height: 'auto', overflow: 'visible' }}
      role="img"
      aria-label={label}
      data-pose={pose}
    >
      {standing && (
        <g>
          {/* legs and shoes */}
          <rect x="32" y="100" width="16" height="78" rx="6" fill={trousers} />
          <rect x="52" y="100" width="16" height="78" rx="6" fill={trousers} />
          <ellipse cx="38" cy="182" rx="12" ry="5" fill="#111" />
          <ellipse cx="62" cy="182" rx="12" ry="5" fill="#111" />
        </g>
      )}
      {/* torso: a judge's robe is wider and longer */}
      <path d={judge ? 'M20 50 Q50 38 80 50 L90 ' + (standing ? 176 : 102) + ' L10 ' + (standing ? 176 : 102) + ' Z' : 'M24 50 Q50 40 76 50 L80 106 L20 106 Z'} fill={outfit} />
      {/* arms: down at the sides when standing, resting forward when seated */}
      <path d={standing ? 'M22 54 L15 112' : 'M22 54 L14 96'} stroke={outfit} strokeWidth="12" strokeLinecap="round" fill="none" />
      <path d={standing ? 'M78 54 L85 112' : 'M78 54 L86 96'} stroke={outfit} strokeWidth="12" strokeLinecap="round" fill="none" />
      <circle cx={standing ? 15 : 14} cy={standing ? 116 : 99} r="6" fill={SKIN} />
      <circle cx={standing ? 85 : 86} cy={standing ? 116 : 99} r="6" fill={SKIN} />
      {/* shirt front and tie (counsel and jurors) or the judge's white bands */}
      {judge ? (
        <path d="M44 46 L50 66 L56 46 Z" fill="#f4f1e8" />
      ) : (
        <>
          <path d="M42 46 L50 70 L58 46 Z" fill="#f4f1e8" />
          <path d="M48 52 L52 52 L53 76 L50 80 L47 76 Z" fill={trim} />
        </>
      )}
      {judge && <rect x="46" y="44" width="8" height="3" fill={trim} />}
      {/* neck and head: smooth and featureless */}
      <rect x="44" y="36" width="12" height="14" rx="4" fill={SKIN_SHADE} />
      <ellipse cx="50" cy="26" rx="14" ry="16" fill={SKIN} />
      <ellipse cx="50" cy="30" rx="14" ry="12" fill={SKIN_SHADE} opacity="0.18" />
      {judge && (
        <g>
          {/* the judge's flat black cap with a gold band */}
          <path d="M33 14 Q50 -6 67 14 Z" fill="#16161c" />
          <rect x="31" y="12" width="38" height="5" rx="2.5" fill="#16161c" />
          <rect x="33" y="12" width="34" height="2" fill={trim} />
        </g>
      )}
    </svg>
  );
}
