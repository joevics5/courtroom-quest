import { Gavel, Loader2, RotateCcw, ScrollText, Scale, Hourglass } from 'lucide-react';
import { gameButton, PANEL_SOFT } from './ui';
import { APPEAL_REASONS, type Appeal } from '../lib/appeals';
import type { AppealBusy, AppealStage } from '../lib/useVerdictAppeal';

interface AppealPanelProps {
  stage: AppealStage;
  last?: Appeal;
  active: Appeal | null;
  remaining: number;
  busy: AppealBusy;
  error: string;
  onAppeal: () => void;
  onAccept: () => void;
  onReopen: () => void;
  onRetry: () => void;
  onRespond: () => void;
}

function dueLabel(iso?: string): string {
  const d = iso ? new Date(iso) : null;
  return d && !Number.isNaN(d.getTime())
    ? d.toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
    : '';
}

/** The "Accept Verdict / Appeal Verdict" choice, and what happens after an appeal is sent. */
export default function AppealPanel(p: AppealPanelProps) {
  const ruling = p.last?.ruling;
  const showRuling = !!ruling && p.stage !== 'working' && p.stage !== 'waiting' && p.stage !== 'handoff' && p.stage !== 'respond';
  const reasonLabel = APPEAL_REASONS.find(r => r.id === p.active?.reason)?.label;

  return (
    <section className={`${PANEL_SOFT} p-5 space-y-4`} aria-label="Appeal">
      {showRuling && ruling && (
        <div className={`rounded-xl border p-4 ${ruling.granted ? 'bg-[#2EC4B6]/10 border-[#2EC4B6]/40' : 'bg-[#E5484D]/10 border-[#E5484D]/40'}`}>
          <h3 className={`font-game text-2xl leading-none mb-2 ${ruling.granted ? 'text-[#5EEAD4]' : 'text-[#FF9A9D]'}`}>
            {ruling.granted ? 'APPEAL GRANTED' : `APPEAL ${p.last!.number > 1 ? p.last!.number + ' ' : ''}DENIED`}
          </h3>
          <p className="text-white/90 leading-relaxed">{ruling.reasoning}</p>
        </div>
      )}

      {p.stage === 'working' && p.active && (
        <div className="space-y-3">
          <h3 className="font-game text-2xl leading-none text-white">YOUR APPEAL IS IN</h3>
          {p.active.response && (
            <div className="rounded-xl bg-black/35 border border-white/10 p-3 text-sm text-white/80">
              <span className="font-semibold text-white">
                Opposing counsel {p.active.response.decision === 'accept' ? 'agrees the case can be reconsidered' : 'opposes'}:
              </span>{' '}
              {p.active.response.explanation}
            </div>
          )}
          {!p.error && (
            <p role="status" className="flex items-center gap-2 text-white/70">
              <Loader2 className="w-5 h-5 animate-spin" />
              {p.active.status === 'awaiting_ruling' ? 'The judge is reviewing the appeal…' : 'Opposing counsel is responding…'}
            </p>
          )}
        </div>
      )}

      {p.stage === 'waiting' && p.active && (
        <div className="space-y-2">
          <h3 className="font-game text-2xl leading-none text-white">WAITING FOR YOUR OPPONENT</h3>
          <p className="flex items-start gap-2 text-white/75">
            <Hourglass className="w-5 h-5 mt-0.5 flex-none" />
            <span>
              They have been told about your appeal. If they have not answered by {dueLabel(p.active.response_due_at)}, the judge decides without their answer.
            </span>
          </p>
        </div>
      )}

      {p.stage === 'handoff' && p.active && (
        <div className="space-y-3">
          <h3 className="font-game text-2xl leading-none text-white">PASS THE DEVICE</h3>
          <p className="text-white/75">Your appeal is filed. Hand the phone to opposing counsel so they can respond.</p>
          <button onClick={p.onRespond} className={`${gameButton('gold', 'md')} w-full`}>
            <Scale className="w-6 h-6" /> OPPOSING COUNSEL: RESPOND
          </button>
        </div>
      )}

      {p.stage === 'respond' && p.active && (
        <div className="space-y-3">
          <h3 className="font-game text-2xl leading-none text-white">YOUR OPPONENT HAS APPEALED</h3>
          <div className="rounded-xl bg-black/35 border border-white/10 p-3 text-sm text-white/80 space-y-1">
            <p className="text-xs font-bold tracking-widest text-[#FFD43B]">{reasonLabel?.toUpperCase()}</p>
            <p className="whitespace-pre-wrap">{p.active.explanation}</p>
          </div>
          <p className="text-white/70 text-sm">
            Please respond by {dueLabel(p.active.response_due_at)}. If you do not, the judge decides without your answer.
          </p>
          <button onClick={p.onRespond} className={`${gameButton('gold', 'md')} w-full`}>
            <Scale className="w-6 h-6" /> RESPOND TO APPEAL
          </button>
        </div>
      )}

      {p.error && (
        <div className="space-y-2">
          <p role="alert" className="text-[#FF9A9D] text-sm">{p.error}</p>
          {p.stage === 'working' && (
            <button onClick={p.onRetry} className={`${gameButton('outline', 'sm')} w-full`}>
              <RotateCcw className="w-5 h-5" /> TRY AGAIN
            </button>
          )}
        </div>
      )}

      {p.stage === 'granted' && (
        <div className="space-y-2">
          <p className="text-white/80 text-sm">The court will hear the case again, with the same jurors and the same record.</p>
          <button onClick={p.onReopen} disabled={p.busy === 'reopen'} className={`${gameButton('gold', 'md')} w-full`}>
            <ScrollText className="w-6 h-6" />
            {p.busy === 'reopen' ? 'REOPENING…' : 'REOPEN THE CASE'}
          </button>
        </div>
      )}

      {p.stage === 'decide' && (
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
