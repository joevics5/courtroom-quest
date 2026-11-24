import { useTranslation } from 'react-i18next';
import { currentLocale } from '../i18n';
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
    ? d.toLocaleString(currentLocale(), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
    : '';
}

/** The "Accept Verdict / Appeal Verdict" choice, and what happens after an appeal is sent. */
export default function AppealPanel(p: AppealPanelProps) {
  const { t, i18n } = useTranslation();
  const ruling = p.last?.ruling;
  const showRuling = !!ruling && p.stage !== 'working' && p.stage !== 'waiting' && p.stage !== 'handoff' && p.stage !== 'respond';
  const reasonLabel = p.active?.reason
    ? t(`appeal.reasons.${p.active.reason}.label`, { defaultValue: APPEAL_REASONS.find(r => r.id === p.active?.reason)?.label })
    : undefined;

  return (
    <section className={`${PANEL_SOFT} p-5 space-y-4`} aria-label={t('appeal.aria')}>
      {showRuling && ruling && (
        <div className={`rounded-xl border p-4 ${ruling.granted ? 'bg-[#2EC4B6]/10 border-[#2EC4B6]/40' : 'bg-[#E5484D]/10 border-[#E5484D]/40'}`}>
          <h3 className={`font-game text-2xl leading-none mb-2 ${ruling.granted ? 'text-[#5EEAD4]' : 'text-[#FF9A9D]'}`}>
            {ruling.granted ? t('appeal.panel.granted') : p.last!.number > 1 ? t('appeal.panel.deniedN', { n: p.last!.number }) : t('appeal.panel.denied')}
          </h3>
          <p className="text-white/90 leading-relaxed">{ruling.reasoning}</p>
        </div>
      )}

      {p.stage === 'working' && p.active && (
        <div className="space-y-3">
          <h3 className="font-game text-2xl leading-none text-white">{t('appeal.panel.inHead')}</h3>
          {p.active.response && (
            <div className="rounded-xl bg-black/35 border border-white/10 p-3 text-sm text-white/80">
              <span className="font-semibold text-white">
                {p.active.response.decision === 'accept' ? t('appeal.panel.opposingAgrees') : t('appeal.panel.opposingOpposes')}
              </span>{' '}
              {p.active.response.explanation}
            </div>
          )}
          {!p.error && (
            <p role="status" className="flex items-center gap-2 text-white/70">
              <Loader2 className="w-5 h-5 animate-spin" />
              {p.active.status === 'awaiting_ruling' ? t('appeal.panel.reviewing') : t('appeal.panel.responding')}
            </p>
          )}
        </div>
      )}

      {p.stage === 'waiting' && p.active && (
        <div className="space-y-2">
          <h3 className="font-game text-2xl leading-none text-white">{t('appeal.panel.waitHead')}</h3>
          <p className="flex items-start gap-2 text-white/75">
            <Hourglass className="w-5 h-5 mt-0.5 flex-none" />
            <span>
              {t('appeal.panel.waitBody', { due: dueLabel(p.active.response_due_at) })}
            </span>
          </p>
        </div>
      )}

      {p.stage === 'handoff' && p.active && (
        <div className="space-y-3">
          <h3 className="font-game text-2xl leading-none text-white">{t('appeal.panel.passHead')}</h3>
          <p className="text-white/75">{t('appeal.panel.passBody')}</p>
          <button onClick={p.onRespond} className={`${gameButton('gold', 'md')} w-full`}>
            <Scale className="w-6 h-6" /> {t('appeal.panel.respondBtn')}
          </button>
        </div>
      )}

      {p.stage === 'respond' && p.active && (
        <div className="space-y-3">
          <h3 className="font-game text-2xl leading-none text-white">{t('appeal.panel.theyAppealed')}</h3>
          <div className="rounded-xl bg-black/35 border border-white/10 p-3 text-sm text-white/80 space-y-1">
            <p className="text-xs font-bold tracking-widest text-[#FFD43B]">{reasonLabel?.toLocaleUpperCase(i18n.resolvedLanguage)}</p>
            <p className="whitespace-pre-wrap">{p.active.explanation}</p>
          </div>
          <p className="text-white/70 text-sm">
            {t('appeal.panel.pleaseRespond', { due: dueLabel(p.active.response_due_at) })}
          </p>
          <button onClick={p.onRespond} className={`${gameButton('gold', 'md')} w-full`}>
            <Scale className="w-6 h-6" /> {t('appeal.panel.respondAppeal')}
          </button>
        </div>
      )}

      {p.error && (
        <div className="space-y-2">
          <p role="alert" className="text-[#FF9A9D] text-sm">{p.error}</p>
          {p.stage === 'working' && (
            <button onClick={p.onRetry} className={`${gameButton('outline', 'sm')} w-full`}>
              <RotateCcw className="w-5 h-5" /> {t('appeal.panel.tryAgain')}
            </button>
          )}
        </div>
      )}

      {p.stage === 'granted' && (
        <div className="space-y-2">
          <p className="text-white/80 text-sm">{t('appeal.panel.grantedBody')}</p>
          <button onClick={p.onReopen} disabled={p.busy === 'reopen'} className={`${gameButton('gold', 'md')} w-full`}>
            <ScrollText className="w-6 h-6" />
            {p.busy === 'reopen' ? t('appeal.panel.reopening') : t('appeal.panel.reopen')}
          </button>
        </div>
      )}

      {p.stage === 'decide' && (
        <div className="space-y-3">
          {!p.last && (
            <p className="text-white/80">{t('appeal.panel.decideBody')}</p>
          )}
          <div className="grid grid-cols-1 gap-3">
            <button onClick={p.onAppeal} disabled={p.busy !== null} className={`${gameButton('gold', 'md')} w-full`}>
              <Gavel className="w-6 h-6" />
              {t('appeal.panel.appealBtn')}
            </button>
            <button onClick={p.onAccept} disabled={p.busy !== null} className={`${gameButton('ghost', 'md')} w-full`}>
              {p.busy === 'accept' ? t('appeal.panel.saving') : t('appeal.panel.acceptBtn')}
            </button>
          </div>
          <p className="text-center text-xs text-white/50">
            {t('appeal.panel.acceptNote', { count: p.remaining })}
          </p>
        </div>
      )}
    </section>
  );
}
