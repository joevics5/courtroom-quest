import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { gameButton } from './ui';

interface GuestSavePromptProps {
  title: string;
  message: string;
  primaryLabel: string;
  onPrimary: () => void;
  /** Label for the quiet dismiss button, e.g. "Not now". */
  closeLabel?: string;
  onClose: () => void;
}

/** A guest is asked to make an account: a soft nudge after the first game, and the wall after a few. */
export default function GuestSavePrompt({ title, message, primaryLabel, onPrimary, closeLabel = 'Not now', onClose }: GuestSavePromptProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4" onClick={onClose} role="dialog" aria-modal="true" aria-label={title}>
      <div className="relative w-full max-w-sm rounded-3xl bg-[#14161f] border border-white/10 p-6 text-center" onClick={e => e.stopPropagation()}>
        <button type="button" onClick={onClose} aria-label="Close" className="absolute top-3 right-3 flex items-center justify-center w-10 h-10 rounded-full bg-white/10 text-white touch-manipulation">
          <X className="w-5 h-5" />
        </button>
        <h2 className="logo-gold font-game text-3xl leading-none mb-3 px-8 uppercase">{title}</h2>
        <p className="text-white/75 text-sm leading-relaxed mb-5">{message}</p>
        <button type="button" onClick={onPrimary} className={`${gameButton('gold', 'md')} w-full mb-2`}>{primaryLabel}</button>
        <button type="button" onClick={onClose} className="w-full py-2 text-sm text-white/55 active:text-white">{closeLabel}</button>
      </div>
    </div>,
    document.body
  );
}
