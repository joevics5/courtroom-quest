import { useEffect, useState } from 'react';
import { db } from '../lib/database';

type Stage = 'idle' | 'checking' | 'pro' | 'slow';

/**
 * Shown when Paystack sends the player back after paying (the address carries ?upgrade=success). The payment
 * is confirmed by Paystack's webhook a moment later, so this watches until the plan switches to Pro.
 */
export default function ProWelcomeBanner() {
  const [stage, setStage] = useState<Stage>('idle');

  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get('upgrade') !== 'success') return;
    url.searchParams.delete('upgrade');
    window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
    setStage('checking');

    let tries = 0;
    let stopped = false;
    const timer = setInterval(async () => {
      tries += 1;
      const status = await db.credits.getStatus().catch(() => null);
      if (stopped) return;
      if (status?.tier === 'pro') {
        setStage('pro');
        clearInterval(timer);
      } else if (tries >= 10) {
        setStage('slow');
        clearInterval(timer);
      }
    }, 2000);
    return () => { stopped = true; clearInterval(timer); };
  }, []);

  // Leave the good news on screen for a few seconds, then tidy away.
  useEffect(() => {
    if (stage !== 'pro' && stage !== 'slow') return;
    const t = setTimeout(() => setStage('idle'), 7000);
    return () => clearTimeout(t);
  }, [stage]);

  if (stage === 'idle') return null;
  const text =
    stage === 'checking' ? 'Payment received. Switching on Pro…'
    : stage === 'pro' ? "You're Pro! 100 credits are ready."
    : 'Payment received. Pro switches on within a minute. Reopen the page if you do not see it.';
  return (
    <div role="status" className="fixed top-3 left-1/2 z-[110] max-w-[92vw] -translate-x-1/2 rounded-full border border-[#FFD43B]/60 bg-black/90 px-4 py-2 text-center text-sm font-bold text-white shadow-lg">
      {text}
    </div>
  );
}
