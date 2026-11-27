import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { gameButton } from './ui';
import { startProCheckout } from '../lib/credits';

interface Props {
  title: string;
  message: string;
  /** Show the "Go Pro" button (the player has an account). */
  canUpgrade: boolean;
  /** A guest: ask them to make a free account first. */
  needsAccount: boolean;
  onCreateAccount: () => void;
  onClose: () => void;
  /** Where the Paystack checkout is opened. Replaceable so tests don't navigate. */
  openCheckout?: (url: string) => void;
}

const PERKS = ['100 credits every month', '20 and 30 minute trials', 'Jury trials', 'Hard and famous cases'];

/** Shown when a plan limit stops a trial: out of credits, or a Pro length, court or case. */
export default function UpgradePrompt({ title, message, canUpgrade, needsAccount, onCreateAccount, onClose, openCheckout }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const goPro = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    const result = await startProCheckout();
    if ('url' in result) {
      (openCheckout ?? ((url: string) => window.location.assign(url)))(result.url);
      return; // the page is leaving; keep the button busy
    }
    setBusy(false);
    if (result.error === 'account_required') onCreateAccount();
    else if (result.error === 'already_pro') setError('You already have Pro. Pull to refresh and try again.');
    else if (result.error === 'not_ready') setError('Payments are not open yet. Please check back soon.');
    else setError("We couldn't open the payment page. Please try again.");
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4" onClick={onClose} role="dialog" aria-modal="true" aria-label={title}>
      <div className="relative w-full max-w-sm rounded-3xl bg-[#14161f] border border-white/10 p-6 text-center" onClick={e => e.stopPropagation()}>
        <button type="button" onClick={onClose} aria-label="Close" className="absolute top-3 right-3 flex items-center justify-center w-10 h-10 rounded-full bg-white/10 text-white touch-manipulation">
          <X className="w-5 h-5" />
        </button>
        <h2 className="logo-gold font-game text-3xl leading-none mb-3 px-8 uppercase">{title}</h2>
        <p className="text-white/75 text-sm leading-relaxed mb-4">{message}</p>

        {canUpgrade && (
          <ul className="mb-5 space-y-1.5 text-left text-sm text-white/85" aria-label="What Pro includes">
            {PERKS.map(perk => (
              <li key={perk} className="flex items-center gap-2">
                <span className="flex-none w-1.5 h-1.5 rounded-full bg-[#FFD43B]" aria-hidden="true" />
                {perk}
              </li>
            ))}
          </ul>
        )}

        {error && <p role="alert" className="mb-3 text-sm text-amber-300">{error}</p>}

        {needsAccount && (
          <button type="button" onClick={onCreateAccount} className={`${gameButton('gold', 'md')} w-full mb-2`}>CREATE A FREE ACCOUNT</button>
        )}
        {canUpgrade && (
          <button type="button" onClick={goPro} disabled={busy} className={`${gameButton('gold', 'md')} w-full mb-2 disabled:opacity-70`}>
            {busy ? 'OPENING PAYMENT…' : 'GO PRO'}
          </button>
        )}
        <button type="button" onClick={onClose} className="w-full py-2 text-sm text-white/55 active:text-white">Maybe later</button>
      </div>
    </div>,
    document.body
  );
}
