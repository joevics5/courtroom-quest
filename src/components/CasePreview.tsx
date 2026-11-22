import { useTranslation } from 'react-i18next';
import { reliefRows } from '../lib/requestedRelief';
import type { RequestedRelief } from '../types';
import { useEffect, useState } from 'react';
import { Shield, Gavel, FileText, ArrowLeft, X, ChevronDown, ChevronUp, FileStack, Users, Loader2, Scale } from 'lucide-react';
import { db } from '../lib/database';
import { useAuth } from '../contexts/AuthContext';
import AvatarFace from './AvatarFace';
import CoinAmount from './CoinAmount';
import { hasFee, type CaseFee } from '../lib/coins';
import { gameButton, PANEL } from './ui';
import { getUserAvatar } from '../lib/avatars';
import { getLevelForWins } from '../lib/levels';
import { withCaseSuffix } from '../lib/caseName';
import type { PlayerRole, Evidence, Witness } from '../types';

interface Props {
  caseId: string;
  caseTitle: string;
  caseText: string;
  defendantName?: string;
  /** What the prosecution / claimant is asking the judge to grant. */
  relief?: RequestedRelief | null;
  onSelect: (role: PlayerRole) => void;
  onCancel: () => void;
  /** Switch this case to a two-player mode instead of playing the AI */
  onSwitchMode?: (mode: 'online' | 'local') => void;
  /** Custom cases can't be played online (an opponent can't load them) */
  onlineDisabled?: boolean;
  /** Cases won so far: dresses your avatar in your rank outfit on the briefing. */
  playerWins?: number;
  /** Quick Start game: solo only (no mode switch) and a way back to the Quick Start list. */
  quickStart?: boolean;
}

type Step = 'browse' | 'confirm-prosecute' | 'confirm-defend';

const ROLE_STYLE = {
  defense: {
    labelKey: 'preview.roleDefense',
    frame: 'border-[#3B82F6] shadow-[0_8px_0_#1e4fa8,0_0_36px_rgba(59,130,246,0.4)]'
  },
  prosecution: {
    labelKey: 'preview.roleProsecution',
    frame: 'border-[#E5484D] shadow-[0_8px_0_#9b1c22,0_0_36px_rgba(229,72,77,0.4)]'
  }
};

export default function CasePreview({ caseId, caseTitle, caseText, defendantName, relief, onSelect, onCancel, onSwitchMode, onlineDisabled, playerWins = 0, quickStart = false }: Props) {
  const { t, i18n } = useTranslation();
  const lower = (text: string) => text.toLocaleLowerCase(i18n.resolvedLanguage);
  const { user } = useAuth();
  const myAvatar = getUserAvatar(user);
  const myRank = getLevelForWins(playerWins);
  const [step, setStep] = useState<Step>('browse');
  const [filesExpanded, setFilesExpanded] = useState(false);
  const [chargesExpanded, setChargesExpanded] = useState(false);
  const [filesLoading, setFilesLoading] = useState(false);
  const [filesLoaded, setFilesLoaded] = useState(false);
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [witnesses, setWitnesses] = useState<Witness[]>([]);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const defendant = defendantName || t('preview.theDefendant');
  const defendantCap = defendant.charAt(0).toLocaleUpperCase(i18n.resolvedLanguage) + defendant.slice(1);
  const [fee, setFee] = useState<CaseFee | undefined>();

  // What each side pays for a win. Nothing shows if the board can't be read.
  useEffect(() => {
    let cancelled = false;
    db.coins.getFeeBoard()
      .then(board => { if (!cancelled) setFee(board[caseId]); })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [caseId]);

  const toggleItem = (id: string) => {
    setExpandedItems(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleToggleFiles = async () => {
    const next = !filesExpanded;
    setFilesExpanded(next);
    if (next && !filesLoaded) {
      setFilesLoading(true);
      try {
        const [evidenceData, witnessData] = await Promise.all([
          db.evidence.getCaseEvidence(caseId),
          db.witnesses.getCaseWitnesses(caseId)
        ]);
        setEvidence(evidenceData);
        setWitnesses(witnessData);
        setFilesLoaded(true);
      } catch (error) {
        console.error('Failed to load case files:', error);
      } finally {
        setFilesLoading(false);
      }
    }
  };

  if (step === 'confirm-prosecute' || step === 'confirm-defend') {
    const role: PlayerRole = step === 'confirm-prosecute' ? 'prosecution' : 'defense';
    const style = ROLE_STYLE[role];
    const briefing = role === 'prosecution'
      ? t('preview.briefingProsecution', { caseName: withCaseSuffix(caseTitle), title: caseTitle, defendant })
      : t('preview.briefingDefense', { caseName: withCaseSuffix(caseTitle), title: caseTitle, defendant: defendantCap });

    return (
      <div className="fixed inset-0 bg-black/75 lg:bg-[#0b0d14] backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div role="dialog" aria-label={t('preview.briefingAria', { role: t(style.labelKey) })} className={`${PANEL} max-w-md w-full text-center`}>
          <p className="font-game text-xl leading-none text-white/55 mb-4">{t('preview.assignment')}</p>
          <div className={`mx-auto w-32 h-32 rounded-3xl overflow-hidden border-4 ${style.frame}`}>
            <AvatarFace config={myAvatar} rank={myRank.level} label={t('preview.yourAvatar')} />
          </div>
          <h2 className="logo-gold font-game text-4xl leading-none mt-6">{t(style.labelKey)}</h2>
          <p className="text-white/60 text-sm mt-2">{t(`ranks.${myRank.level}`)}</p>
          <p className="text-white/85 leading-relaxed mt-4 mb-6">{briefing}</p>
          {hasFee(fee) && (
            <p className="-mt-3 mb-6 text-sm text-white/70">
              {t('preview.winAs', { role: lower(t(role === 'prosecution' ? 'roles.prosecution' : 'roles.defense')) })}{' '}
              <CoinAmount amount={role === 'prosecution' ? fee.prosecution : fee.defense} />
              {fee.repeat && <span className="text-white/45">{t('preview.repeatWin')}</span>}
            </p>
          )}
          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => setStep('browse')} className={gameButton('ghost', 'md')}>
              {t('preview.reject')}
            </button>
            <button onClick={() => onSelect(role)} className={gameButton('gold', 'md')}>
              {t('preview.accept')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // step === 'browse'
  return (
    <div className="fixed inset-0 bg-black/75 lg:bg-[#0b0d14] backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className={`${PANEL} relative max-w-2xl lg:max-w-3xl w-full max-h-[90dvh] overflow-y-auto`}>
        <button
          type="button"
          onClick={onCancel}
          aria-label={t('common.close')}
          className="absolute top-3 right-3 z-10 flex items-center justify-center w-11 h-11 rounded-full bg-white/10 active:bg-white/20 text-white touch-manipulation"
        >
          <X className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2 mb-3 pr-12">
          <FileText className="w-6 h-6 text-[#FFD43B]" />
          <span className="font-game text-2xl leading-none text-[#FFD43B]">{t('preview.caseFile')}</span>
        </div>

        <h2 className="text-2xl font-bold text-white mb-3 leading-snug">{caseTitle}</h2>
        <p className="text-white/80 leading-relaxed whitespace-pre-line mb-5">{caseText}</p>

        {reliefRows(relief).length > 0 && (
          <>
            <button
              onClick={() => setChargesExpanded(open => !open)}
              aria-expanded={chargesExpanded}
              className="w-full flex items-center justify-between px-4 py-3 mb-5 bg-white/10 active:bg-white/15 border border-white/15 rounded-xl text-white/90 text-sm font-medium transition-colors"
            >
              <span className="flex items-center gap-2">
                <Scale className="w-4 h-4" />
                Prosecution&apos;s requested relief
              </span>
              {chargesExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {chargesExpanded && (
              <div className="mb-5 rounded-xl border border-red-400/40 bg-red-500/10 p-4">
                <ul className="space-y-2.5">
                  {reliefRows(relief).map((r, i) => (
                    <li key={i} className="flex gap-3 items-start">
                      <span className="flex-none mt-0.5 w-[4.5rem] text-[10px] font-black tracking-wider text-[#FFD43B]">{r.label}</span>
                      <span className="text-white/90 text-sm leading-snug">{r.text}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}

        <button
          onClick={handleToggleFiles}
          className="w-full flex items-center justify-between px-4 py-3 mb-5 bg-white/10 active:bg-white/15 border border-white/15 rounded-xl text-white/90 text-sm font-medium transition-colors"
        >
          <span className="flex items-center gap-2">
            <FileStack className="w-4 h-4" />
            {t('preview.viewFiles')}
          </span>
          {filesLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : filesExpanded ? (
            <ChevronUp className="w-4 h-4" />
          ) : (
            <ChevronDown className="w-4 h-4" />
          )}
        </button>

        {filesExpanded && filesLoaded && (
          <div className="mb-6 space-y-4">
            <div>
              <p className="text-white/50 text-xs font-semibold uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <FileStack className="w-3.5 h-3.5" />
                Evidence ({evidence.length})
              </p>
              {evidence.length > 0 ? (
                <div className="space-y-1.5">
                  {evidence.map((e) => {
                    const isOpen = expandedItems.has(e.id);
                    const hasDetail = !!(e.description || e.content);
                    return (
                      <div key={e.id} className="bg-white/5 border border-white/10 rounded-lg overflow-hidden">
                        <button
                          onClick={() => hasDetail && toggleItem(e.id)}
                          className={`w-full flex items-center justify-between px-3 py-2.5 text-left ${hasDetail ? 'cursor-pointer hover:bg-white/5' : 'cursor-default'}`}
                        >
                          <span className="text-sm">
                            <span className="text-[#FFD43B] font-medium">{e.exhibit_label || t('preview.exhibit')}:</span>{' '}
                            <span className="text-white/80">{e.title}</span>
                          </span>
                          {hasDetail && (isOpen ? <ChevronUp className="w-4 h-4 text-white/40 shrink-0" /> : <ChevronDown className="w-4 h-4 text-white/40 shrink-0" />)}
                        </button>
                        {isOpen && hasDetail && (
                          <div className="px-3 pb-3 pt-0 space-y-2 border-t border-white/10">
                            {e.description && (
                              <p className="text-white/60 text-xs leading-relaxed whitespace-pre-line pt-2">{e.description}</p>
                            )}
                            {e.content && (
                              <p className="text-white/80 text-sm leading-relaxed whitespace-pre-line bg-black/20 rounded p-2.5">{e.content}</p>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-white/40 text-sm italic">{t('preview.noEvidence')}</p>
              )}
            </div>

            <div>
              <p className="text-white/50 text-xs font-semibold uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5" />
                Witnesses ({witnesses.length})
              </p>
              {witnesses.length > 0 ? (
                <div className="space-y-1.5">
                  {witnesses.map((w) => {
                    const isOpen = expandedItems.has(w.id);
                    const hasDetail = !!(w.background || w.base_testimony);
                    return (
                      <div key={w.id} className="bg-white/5 border border-white/10 rounded-lg overflow-hidden">
                        <button
                          onClick={() => hasDetail && toggleItem(w.id)}
                          className={`w-full flex items-center justify-between px-3 py-2.5 text-left ${hasDetail ? 'cursor-pointer hover:bg-white/5' : 'cursor-default'}`}
                        >
                          <span className="text-sm">
                            <span className="text-white font-medium">{w.name}</span>{' '}
                            <span className="text-white/50">— {w.role}</span>
                          </span>
                          {hasDetail && (isOpen ? <ChevronUp className="w-4 h-4 text-white/40 shrink-0" /> : <ChevronDown className="w-4 h-4 text-white/40 shrink-0" />)}
                        </button>
                        {isOpen && hasDetail && (
                          <div className="px-3 pb-3 pt-0 space-y-2 border-t border-white/10">
                            {w.background && (
                              <div className="pt-2">
                                <p className="text-white/40 text-xs font-semibold uppercase tracking-wide mb-1">{t('preview.background')}</p>
                                <p className="text-white/60 text-xs leading-relaxed whitespace-pre-line">{w.background}</p>
                              </div>
                            )}
                            {w.base_testimony && (
                              <div>
                                <p className="text-white/40 text-xs font-semibold uppercase tracking-wide mb-1">{t('preview.statement')}</p>
                                <p className="text-white/80 text-sm leading-relaxed whitespace-pre-line bg-black/20 rounded p-2.5">{w.base_testimony}</p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-white/40 text-sm italic">{t('preview.noWitnesses')}</p>
              )}
            </div>
          </div>
        )}

        <p className="font-game text-2xl leading-none text-white mb-3">{t('preview.chooseSide')}</p>
        <div className="grid grid-cols-2 gap-3 mb-5">
          <button
            onClick={() => setStep('confirm-prosecute')}
            className="rounded-2xl border-2 border-[#E5484D]/60 bg-[#E5484D]/10 active:bg-[#E5484D]/25 py-5 flex flex-col items-center gap-2 transition-colors"
          >
            <Gavel className="w-8 h-8 text-[#FF7A7E]" />
            <span className="font-game text-3xl leading-none text-white">{t('preview.prosecute')}</span>
            {hasFee(fee) && <span className="text-sm" aria-label={t('preview.coinsForWin', { count: fee.prosecution })}><CoinAmount amount={fee.prosecution} /></span>}
          </button>
          <button
            onClick={() => setStep('confirm-defend')}
            className="rounded-2xl border-2 border-[#3B82F6]/60 bg-[#3B82F6]/10 active:bg-[#3B82F6]/25 py-5 flex flex-col items-center gap-2 transition-colors"
          >
            <Shield className="w-8 h-8 text-[#7FB2FF]" />
            <span className="font-game text-3xl leading-none text-white">{t('preview.defend')}</span>
            {hasFee(fee) && <span className="text-sm" aria-label={t('preview.coinsForWin', { count: fee.defense })}><CoinAmount amount={fee.defense} /></span>}
          </button>
        </div>


        {onSwitchMode && !quickStart && (
          <div className="flex items-center justify-center gap-2 flex-wrap mb-3 text-xs text-white/50">
            <span className="rounded-full bg-white/10 px-2.5 py-1 font-semibold text-white/80">{t('preview.playingSolo')}</span>
            <span>{t('preview.switchTo')}</span>
            {!onlineDisabled && (
              <button onClick={() => onSwitchMode('online')} className="font-semibold text-[#FFD43B] underline underline-offset-2">
                {t('preview.onlinePlayer')}
              </button>
            )}
            <button onClick={() => onSwitchMode('local')} className="font-semibold text-[#FFD43B] underline underline-offset-2">
              {t('preview.sameDevice')}
            </button>
          </div>
        )}

        <div className="flex justify-center">
          <button
            onClick={onCancel}
            className="flex items-center gap-1 px-4 py-2 text-white/70 active:text-white transition-colors text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            {quickStart ? t('preview.backToList') : t('preview.differentCase')}
          </button>
        </div>
      </div>
    </div>
  );
}
