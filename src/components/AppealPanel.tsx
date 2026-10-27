import { Gavel, Loader2, RotateCcw, ScrollText } from 'lucide-react';
import { gameButton, PANEL_SOFT } from './ui';
import type { Appeal } from '../lib/appeals';
import type { AppealBusy } from '../lib/useVerdictAppeal';

interface AppealPanelProps {
  last?: Appeal;
  active: Appeal | null;
  grantedPending: boolean;
  canStartAppeal: boolean;
  remaining: number;
  busy: AppealBusy;
  error: string;
  onAppeal: () => void;
  onAccept: () => void;
  onReopen: () => void;
  onRetry: () => void;
}

/** The "Accept Verdict / Appeal Verdict" choice, and what happens after an appeal is sent. */
export default function AppealPanel(p: AppealPanelProps) {
  const waitingText =
    p.active?.status === 'awaiting_ruling'
      ? 'The judge is reviewing your appeal…'
      : 'Opposing counsel is responding to your appeal…';

  return (
    <section className={`${PANEL_SOFT} p-5 space-y-4`} aria-label="Appeal">
      {p.last?.ruling && !p.active && (
        <div className={`rounded-xl border p-4 ${p.last.ruling.granted ? 'bg-[#2EC4B6]/10 border-[#2EC4B6]/40' : 'bg-[#E5484D]/10 border-[#E5484D]/40'}`}>
          <h3 className={`font-game text-2xl leading-none mb-2 ${p.last.ruling.granted ? 'text-[#5EEAD4]' : 'text-[#FF9A9D]'}`}>
            {p.last.ruling.granted ? 'APPEAL GRANTED' : `APPEAL ${p.last.number > 1 ? p.last.number + ' ' : ''}DENIED`}
          </h3>
          <p className="text-white/90 leading-relaxed">{p.last.ruling.reasoning}</p>
        </div>
      )}

      {p.active && (
        <div className="space-y-3">
          <h3 className="font-game text-2xl leading-none text-white">YOUR APPEAL IS IN</h3>
          {p.active.response && (
            <div className="rounded-xl bg-black/35 border border-white/10 p-3 text-sm text-white/80">
              <span className="font-semibold text-white">Opposing counsel {p.active.response.decision === 'accept' ? 'agrees the case can be reconsidered' : 'opposes'}:</span>{' '}
              {p.active.response.explanation}
            </div>
          )}
          {!p.error && (
            <p role="status" className="flex items-center gap-2 text-white/70">
              <Loader2 className="w-5 h-5 animate-spin" /> {waitingText}
            </p>
          )}
        </div>
      )}

      {p.error && (
        <div className="space-y-2">
          <p role="alert" className="text-[#FF9A9D] text-sm">{p.error}</p>
          {(p.active || p.grantedPending) && p.active && (
            <button onClick={p.onRetry} className={`${gameButton('outline', 'sm')} w-full`}>
              <RotateCcw className="w-5 h-5" /> TRY AGAIN
            </button>
          )}
        </div>
      )}

      {p.grantedPending && (
        <div className="space-y-2">
          <p className="text-white/80 text-sm">The court will hear the case again, with the same jurors and the same record.</p>
          <button onClick={p.onReopen} disabled={p.busy === 'reopen'} className={`${gameButton('gold', 'md')} w-full`}>
            <ScrollText className="w-6 h-6" />
            {p.busy === 'reopen' ? 'REOPENING…' : 'REOPEN THE CASE'}
          </button>
        </div>
      )}

      {p.canStartAppeal && (
        <div className="space-y-3">
          {!p.last && (
            <p className="text-white/80">You believe the jury got it wrong. You can ask the court to hear your case again.</p>
          )}
          <div className="grid grid-cols-1 gap-3">
            <button onClick={p.onAppeal} disabled={p.busy !== null} className={`${gameButton('gold', 'md')} w-full`}>
              <Gavel className="w-6 h-6" />
              APPEAL VERDICT
            </button>
            <button onClick={p.onAccept} disabled={p.busy !== null} className={`${gameButton('ghost', 'md')} w-full`}>
              {p.busy === 'accept' ? 'SAVING…' : 'ACCEPT VERDICT'}
            </button>
          </div>
          <p className="text-center text-xs text-white/50">
            Accepting ends the case and shows your performance review. {p.remaining} {p.remaining === 1 ? 'appeal' : 'appeals'} left.
          </p>
        </div>
      )}
    </section>
  );
}
