import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { PANEL } from './ui';

interface ModalSheetProps {
  /** Heading in the game's comic font. */
  title: string;
  /** Small icon shown before the title. */
  icon?: ReactNode;
  /** Short line under the title. */
  subtitle?: string;
  /** Shows the X button and lets Escape / tapping outside close the sheet. */
  onClose?: () => void;
  /** Tailwind max-width class for the panel. */
  maxWidth?: string;
  children: ReactNode;
}

/** Row style for a tappable choice inside a modal (witness, evidence, objection reason...). */
export const CHOICE_ROW =
  'w-full text-left rounded-2xl bg-white/[0.06] border border-white/15 p-4 transition-colors hover:border-[#FFD43B]/60 active:bg-white/10 touch-manipulation';

/**
 * The game's standard popup: a dark glass panel that slides up from the bottom on a phone and sits
 * in the middle on a bigger screen. Drawn into <body> so no page container can clip or cover it.
 */
export default function ModalSheet({ title, icon, subtitle, onClose, maxWidth = 'max-w-2xl', children }: ModalSheetProps) {
  useEffect(() => {
    if (!onClose) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Don't scroll the page behind the popup.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-sm sm:p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={e => e.stopPropagation()}
        className={`${PANEL} !bg-[#14161f] relative w-full ${maxWidth} max-h-[88dvh] overflow-y-auto !rounded-b-none sm:!rounded-3xl`}
        style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}
      >
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="absolute top-3 right-3 z-10 flex items-center justify-center w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 active:bg-white/25 text-white touch-manipulation"
          >
            <X className="w-5 h-5" />
          </button>
        )}
        <div className={`flex items-center gap-2 ${onClose ? 'pr-12' : ''} ${subtitle ? 'mb-1' : 'mb-4'}`}>
          {icon}
          <h2 className="logo-gold font-game text-3xl leading-none uppercase">{title}</h2>
        </div>
        {subtitle && <p className="text-white/60 text-sm mb-4">{subtitle}</p>}
        {children}
      </div>
    </div>,
    document.body
  );
}
