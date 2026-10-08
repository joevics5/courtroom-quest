/**
 * Shared look for the game screens: black glass panels, gold chunky buttons, the comic title font.
 * One place for the styles that were copied into several files, so a new screen (or a new
 * stage scene) matches without re-inventing them.
 */
import type { TurnBadge } from '../lib/stageSpeaker';

export const GOLD = '#FFD43B';
export const GOLD_DARK = '#B8860B';

/** Big content card (home, settings, creator). */
export const PANEL = 'rounded-3xl bg-black/65 border border-white/15 p-5 backdrop-blur-sm';
/** Lighter card for in-game surfaces that sit on the scene. */
export const PANEL_SOFT = 'rounded-2xl bg-black/55 border border-white/10 backdrop-blur-sm';
/** Text field. */
export const INPUT =
  'w-full rounded-xl bg-black/50 border border-white/20 px-3 py-3 text-white placeholder:text-white/35 focus:outline-none focus:border-[#FFD43B] disabled:opacity-50';

type ButtonVariant = 'gold' | 'ghost' | 'danger' | 'outline';
type ButtonSize = 'md' | 'sm';

const BUTTON_BASE =
  'inline-flex items-center justify-center gap-2 rounded-xl font-game leading-none transition-all active:translate-y-0.5 disabled:cursor-not-allowed';
const BUTTON_SIZE: Record<ButtonSize, string> = {
  md: 'text-2xl px-5 py-3',
  sm: 'text-xl px-4 py-2.5'
};
const BUTTON_VARIANT: Record<ButtonVariant, string> = {
  gold: 'bg-[#FFD43B] text-black border-b-4 border-[#B8860B] active:border-b-2 disabled:bg-white/15 disabled:text-white/40 disabled:border-white/10',
  ghost: 'bg-white/10 text-white border border-white/20 disabled:text-white/35 disabled:bg-white/5',
  danger: 'bg-[#E5484D] text-white border-b-4 border-[#9b1c22] active:border-b-2 disabled:bg-white/15 disabled:text-white/40 disabled:border-white/10',
  outline: 'bg-transparent text-[#FFD43B] border-2 border-[#FFD43B]/70 disabled:text-white/35 disabled:border-white/15'
};

/** Class string for a game button: `className={gameButton('gold')}` */
export function gameButton(variant: ButtonVariant = 'gold', size: ButtonSize = 'md'): string {
  return `${BUTTON_BASE} ${BUTTON_SIZE[size]} ${BUTTON_VARIANT[variant]}`;
}

/** Round icon button for headers and toolbars. */
export const ICON_BUTTON =
  'flex-none flex items-center justify-center w-10 h-10 rounded-full bg-black/55 border border-white/15 text-white transition-colors active:bg-white/15';

/** The "whose turn" pill. Gold when it is the player's turn. */
export function TurnPill({ turn, className = '' }: { turn: TurnBadge; className?: string }) {
  if (turn.kind === 'none' || !turn.label) return null;
  const tone =
    turn.kind === 'you'
      ? 'bg-[#FFD43B] text-black shadow-[0_0_16px_rgba(255,212,59,0.45)]'
      : turn.kind === 'judge'
        ? 'bg-white/90 text-black'
        : 'bg-black/60 text-white border border-white/20';
  return (
    <span
      role="status"
      aria-live="polite"
      className={`inline-flex items-center rounded-full px-3 py-1 font-game text-lg leading-none tracking-wide ${tone} ${className}`}
    >
      {turn.label}
    </span>
  );
}
