import { useTranslation } from 'react-i18next';
import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronRight, UserPlus, UserRound, X } from 'lucide-react';

interface AccessGateProps {
  onSignUp: () => void;
  onGuest: () => void;
  onSignIn: () => void;
  onClose: () => void;
  busy?: boolean;
}

/** Shown when someone who is not signed in taps Play: create an account, or play as a guest. */
export default function AccessGate({ onSignUp, onGuest, onSignIn, onClose, busy = false }: AccessGateProps) {
  const { t } = useTranslation();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/75" onClick={onClose} role="dialog" aria-modal="true" aria-label={t('accessGate.aria')}>
      <div
        className="relative w-full max-w-md max-h-[90dvh] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-[#14161f] border border-white/10 p-5 pb-7"
        onClick={e => e.stopPropagation()}
      >
        <button type="button" onClick={onClose} aria-label={t('common.close')} className="absolute top-3 right-3 z-10 flex items-center justify-center w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 active:bg-white/25 text-white touch-manipulation">
          <X className="w-5 h-5" />
        </button>
        <h2 className="logo-gold font-game text-4xl leading-none mb-5 pr-10">{t('accessGate.heading')}</h2>

        <div className="space-y-4">
          <button
            type="button"
            onClick={onSignUp}
            disabled={busy}
            className="w-full flex items-center gap-4 rounded-2xl border-b-4 border-[#B8860B] bg-[#FFD43B] px-4 py-4 text-left text-black active:translate-y-0.5 active:border-b-2 transition-all disabled:opacity-60"
          >
            <UserPlus className="w-7 h-7 flex-none" />
            <span className="flex-1">
              <span className="block font-game text-3xl leading-none">{t('accessGate.signUp')}</span>
              <span className="block mt-1 text-sm font-semibold text-black/70">{t('accessGate.signUpSub')}</span>
            </span>
            <ChevronRight className="w-5 h-5 flex-none" />
          </button>

          <button
            type="button"
            onClick={onGuest}
            disabled={busy}
            className="w-full flex items-center gap-4 rounded-2xl border-b-4 border-white/20 border-x border-t border-x-white/10 border-t-white/10 bg-black/60 px-4 py-4 text-left text-white active:translate-y-0.5 active:border-b-2 transition-all disabled:opacity-60"
          >
            <UserRound className="w-7 h-7 flex-none text-white/80" />
            <span className="flex-1">
              <span className="block font-game text-3xl leading-none">{busy ? t('accessGate.starting') : t('accessGate.guest')}</span>
              <span className="block mt-1 text-sm text-white/60">{t('accessGate.guestSub')}</span>
            </span>
            <ChevronRight className="w-5 h-5 flex-none text-white/60" />
          </button>
        </div>

        <p className="mt-5 text-center text-sm text-white/60">
          {t('accessGate.haveAccount')}{' '}
          <button type="button" onClick={onSignIn} className="font-bold text-[#FFD43B] underline underline-offset-2">{t('accessGate.signIn')}</button>
        </p>
      </div>
    </div>,
    document.body
  );
}
