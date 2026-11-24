import { useEffect, useState } from 'react';
import { Gavel, Scale, Users } from 'lucide-react';
import type { JuryRound } from '../lib/ai/trialAI';
import JurorAvatar from './avatars/JurorAvatar';
import AvatarFace from './AvatarFace';
import { gameButton } from './ui';
import { useTranslation } from 'react-i18next';
import { verdictText } from '../lib/verdictUtils';
import type { StageParticipant } from './stage/types';

export interface DeliberationState {
  mode: 'jury' | 'judge';
  jurors: { id: string; name: string; occupation: string }[];
  rounds: JuryRound[];
  /** round currently being voted on (null between rounds / once finished) */
  votingRound: number | null;
  stage: 'voting' | 'foreperson' | 'done';
  result?: { outcome: 'win' | 'lose'; guiltyVotes: number; notGuiltyVotes: number; unanimous: boolean };
}

const REVEAL_CSS = `
@keyframes seatReveal { from { opacity: 0; transform: scale(.85); } to { opacity: 1; transform: scale(1); } }
`;

/** Compact "how did they vote" history: one row of dots per round. */
export function JuryVoteHistory({ rounds }: { rounds: JuryRound[] }) {
  const { t } = useTranslation();
  if (!rounds || rounds.length === 0) return null;
  return (
    <div className="space-y-2">
      {rounds.map(r => (
        <div key={r.round} className="flex items-center gap-3">
          <span className="text-xs text-white/55 w-14 shrink-0">{t('deliberation.round', { round: r.round })}</span>
          <div className="flex flex-wrap gap-1 flex-1">
            {r.votes.map(v => (
              <span
                key={v.jurorId}
                title={`${v.name}: ${v.vote === 'GUILTY' ? verdictText('win') : verdictText('lose')}`}
                className={`w-4 h-4 rounded-full ${v.vote === 'GUILTY' ? 'bg-red-500' : 'bg-blue-500'}`}
              />
            ))}
            {Array.from({ length: r.absent ?? 0 }, (_, i) => (
              <span key={`absent-${i}`} title={t('deliberation.couldntReach')} data-absent="true" className="w-4 h-4 rounded-full border border-dashed border-white/40" />
            ))}
          </div>
          <span className="text-xs font-semibold text-white/85 shrink-0">
            <span className="text-red-400">{r.guilty}</span>
            <span className="text-white/45"> – </span>
            <span className="text-blue-400">{r.notGuilty}</span>
          </span>
        </div>
      ))}
      <div className="flex gap-4 text-[11px] text-white/55 pt-1">
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-red-500" /> {verdictText('win')}</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-blue-500" /> {verdictText('lose')}</span>
        {rounds.some(r => (r.absent ?? 0) > 0) && (
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full border border-dashed border-white/40" /> {t('deliberation.notReached')}</span>
        )}
      </div>
    </div>
  );
}

export default function JuryDeliberation({ state, onContinue, judge }: { state: DeliberationState; onContinue: () => void; /** The presiding judge, shown while they deliberate */ judge?: StageParticipant }) {
  const { t, i18n } = useTranslation();
  const judgeLines = t('deliberation.judgeLines', { returnObjects: true }) as string[];
  const [lineIndex, setLineIndex] = useState(0);

  useEffect(() => {
    if (state.mode !== 'judge') return;
    const timer = setInterval(() => setLineIndex(i => (i + 1) % judgeLines.length), 2500);
    return () => clearInterval(timer);
  }, [state.mode]);

  if (state.mode === 'judge') {
    return (
      <div className="fixed inset-0 z-[60] bg-black/90 backdrop-blur-sm flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          {judge ? (
            <div className="relative w-36 h-36 mx-auto mb-5">
              <div className="absolute inset-0 rounded-3xl overflow-hidden border-4 border-[#FFD43B] shadow-[0_8px_0_#B8860B,0_0_36px_rgba(255,212,59,0.35)]" data-testid="judge-avatar">
                <AvatarFace config={judge.avatar} rank={judge.rank} label={t('deliberation.judgeAria', { name: judge.name })} />
              </div>
              <div className="absolute -bottom-3 -right-3 w-11 h-11 rounded-full bg-slate-950 border border-amber-500/50 flex items-center justify-center animate-pulse">
                <Scale className="w-5 h-5 text-amber-400" />
              </div>
            </div>
          ) : (
            <div className="w-20 h-20 mx-auto mb-5 rounded-full bg-amber-500/15 border border-amber-500/40 flex items-center justify-center animate-pulse">
              <Scale className="w-10 h-10 text-amber-400" />
            </div>
          )}
          <h2 className="logo-gold font-game text-4xl leading-none mb-2">{judge ? t('deliberation.judgeDeliberating', { name: judge.name }) : t('deliberation.theJudgeDeliberating')}</h2>
          <p className="text-amber-200/80 text-sm min-h-[1.25rem]">{judgeLines[lineIndex]}</p>
          <div className="mt-6 flex justify-center">
            <div className="animate-spin rounded-full h-6 w-6 border-2 border-amber-400 border-t-transparent" />
          </div>
        </div>
      </div>
    );
  }

  const latest = state.rounds[state.rounds.length - 1];
  const voting = state.votingRound !== null && state.stage === 'voting';
  const showLatest = !voting && latest;
  const verdictWord = state.result ? verdictText(state.result.outcome).toLocaleUpperCase(i18n.resolvedLanguage) : '';

  let headline = t('deliberation.retired');
  let sub = t('deliberation.casting');
  if (voting) sub = t('deliberation.roundVoting', { round: state.votingRound });
  else if (state.stage === 'voting' && latest) sub = t('deliberation.roundCounted', { round: latest.round });
  if (state.stage === 'foreperson') {
    headline = t('deliberation.reached');
    sub = t('deliberation.foreperson');
  }
  if (state.stage === 'done' && state.result) {
    headline = t('deliberation.verdict', { word: verdictWord });
    const hi = Math.max(state.result.guiltyVotes, state.result.notGuiltyVotes);
    const lo = Math.min(state.result.guiltyVotes, state.result.notGuiltyVotes);
    sub = state.result.unanimous ? t('deliberation.unanimous', { n: hi }) : t('deliberation.byVote', { a: hi, b: lo });
  }

  const voteFor = (jurorId: string) => (showLatest ? latest.votes.find(v => v.jurorId === jurorId) : undefined);

  return (
    <div className="fixed inset-0 z-[60] bg-black/90 backdrop-blur-sm overflow-y-auto">
      <style>{REVEAL_CSS}</style>
      <div className="max-w-md mx-auto p-4 pb-8">
        <div className="text-center pt-4 mb-4">
          <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-amber-500/15 border border-amber-500/40 flex items-center justify-center">
            <Gavel className="w-7 h-7 text-amber-400" />
          </div>
          <h2 className="logo-gold font-game text-4xl leading-none">{headline}</h2>
          <p className="text-amber-200/80 text-sm mt-1">{sub}</p>
        </div>

        {/* Jury box */}
        <div className="rounded-3xl border border-white/15 bg-black/65 backdrop-blur-sm p-3">
          <div className="flex items-center gap-2 text-white/55 text-xs mb-2">
            <Users className="w-4 h-4" />
            <span className="uppercase tracking-wider">{t('deliberation.juryBox')}</span>
            {showLatest && <span className="ml-auto">{t('deliberation.round', { round: latest.round })}: <span className="text-red-400 font-semibold">{latest.guilty}</span> – <span className="text-blue-400 font-semibold">{latest.notGuilty}</span></span>}
          </div>
          <div className="grid grid-cols-3 gap-2">
            {state.jurors.map((j, i) => {
              const v = voteFor(j.id);
              return (
                <div
                  key={`${j.id}-${v ? latest.round : 'wait'}`}
                  style={v ? { animation: 'seatReveal .35s ease-out both', animationDelay: `${i * 120}ms` } : undefined}
                  className={`rounded-2xl border px-2 py-2 text-center transition-colors ${
                    v
                      ? v.vote === 'GUILTY'
                        ? 'bg-red-500/15 border-red-500/60'
                        : 'bg-blue-500/15 border-blue-500/60'
                      : 'bg-white/[0.06] border-white/15 ' + (voting ? 'animate-pulse' : '')
                  }`}
                >
                  <div className="text-[10px] text-white/45">Juror {i + 1}</div>
                  <div className="flex justify-center my-1">
                    <JurorAvatar
                      seed={j.id}
                      name={j.name}
                      size="md"
                      muted={!v}
                      className={`ring-2 ${v ? (v.vote === 'GUILTY' ? 'ring-red-500/70' : 'ring-blue-500/70') : 'ring-white/20'}`}
                    />
                  </div>
                  <div className="text-xs text-white/85 font-medium truncate">{j.name}</div>
                  <div className="text-[10px] text-white/55 truncate">{j.occupation}</div>
                  <div className={`mt-1 text-[11px] font-bold ${v ? (v.vote === 'GUILTY' ? 'text-red-400' : 'text-blue-400') : 'text-white/45'}`}>
                    {v ? (v.vote === 'GUILTY' ? verdictText('win') : verdictText('lose')).toLocaleUpperCase(i18n.resolvedLanguage) : voting ? '…' : '—'}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {state.rounds.length > 0 && (
          <div className="mt-4 rounded-3xl border border-white/15 bg-black/65 p-3">
            <div className="text-xs uppercase tracking-wider text-white/55 mb-2">{t('deliberation.ballots')}</div>
            <JuryVoteHistory rounds={state.rounds} />
          </div>
        )}

        {state.stage === 'foreperson' && (
          <div className="mt-5 flex justify-center">
            <div className="animate-spin rounded-full h-6 w-6 border-2 border-amber-400 border-t-transparent" />
          </div>
        )}

        {state.stage === 'done' && (
          <button
            onClick={onContinue}
            className={`mt-5 w-full ${gameButton('gold', 'md')}`}
          >
            {t('deliberation.hear')}
          </button>
        )}
      </div>
    </div>
  );
}
