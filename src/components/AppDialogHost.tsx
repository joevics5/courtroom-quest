import { useEffect, useRef, useSyncExternalStore } from 'react';
import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react';
import { getCurrentDialog, resolveCurrentDialog, subscribeDialogs, type DialogTone } from '../lib/appDialog';
import { PANEL, gameButton } from './ui';

const TONE: Record<DialogTone, { icon: typeof Info; ring: string; defaultTitle: string; primary: 'gold' | 'danger' }> = {
  info: { icon: Info, ring: 'bg-blue-500/20 border-blue-400/50 text-blue-300', defaultTitle: 'HEADS UP', primary: 'gold' },
  success: { icon: CheckCircle2, ring: 'bg-green-500/20 border-green-400/50 text-green-300', defaultTitle: 'DONE', primary: 'gold' },
  error: { icon: XCircle, ring: 'bg-red-500/20 border-red-400/50 text-red-300', defaultTitle: 'SOMETHING WENT WRONG', primary: 'gold' },
  danger: { icon: AlertTriangle, ring: 'bg-amber-500/20 border-amber-400/50 text-amber-300', defaultTitle: 'ARE YOU SURE?', primary: 'danger' }
};

/** Draws the game's own alert / confirm dialogs (see lib/appDialog). Mount once near the app root. */
export default function AppDialogHost() {
  const dialog = useSyncExternalStore(subscribeDialogs, getCurrentDialog, getCurrentDialog);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const okRef = useRef<HTMLButtonElement>(null);

  // Escape = cancel (or just dismiss an alert). Focus the safe button first: Cancel for questions, OK for alerts.
  useEffect(() => {
    if (!dialog) return;
    (dialog.kind === 'confirm' ? cancelRef.current : okRef.current)?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); resolveCurrentDialog(false); }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [dialog]);

  if (!dialog) return null;
  const tone = TONE[dialog.tone];
  const Icon = tone.icon;
  const titleId = `dialog-title-${dialog.id}`;
  const bodyId = `dialog-body-${dialog.id}`;

  return (
    <div
      className="fixed inset-0 z-[300] flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-sm p-4"
      onClick={() => { if (dialog.kind === 'alert') resolveCurrentDialog(false); }}
    >
      <div
        role={dialog.kind === 'confirm' ? 'alertdialog' : 'dialog'}
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        className={`${PANEL} w-full max-w-sm text-center !bg-[#14161f] shadow-2xl`}
        onClick={e => e.stopPropagation()}
      >
        <div className={`mx-auto w-14 h-14 rounded-full border-2 flex items-center justify-center ${tone.ring}`}>
          <Icon className="w-7 h-7" />
        </div>
        <h2 id={titleId} className="logo-gold font-game text-3xl leading-none mt-4">{dialog.title || tone.defaultTitle}</h2>
        <p id={bodyId} className="text-white/80 leading-relaxed mt-3 mb-6 whitespace-pre-line">{dialog.message}</p>
        {dialog.kind === 'confirm' ? (
          <div className="grid grid-cols-2 gap-3">
            <button ref={cancelRef} type="button" onClick={() => resolveCurrentDialog(false)} className={gameButton('ghost', 'md')}>
              {dialog.cancelLabel}
            </button>
            <button ref={okRef} type="button" onClick={() => resolveCurrentDialog(true)} className={gameButton(tone.primary, 'md')}>
              {dialog.confirmLabel}
            </button>
          </div>
        ) : (
          <button ref={okRef} type="button" onClick={() => resolveCurrentDialog(true)} className={`w-full ${gameButton('gold', 'md')}`}>
            {dialog.confirmLabel}
          </button>
        )}
      </div>
    </div>
  );
}
