import { useTranslation } from 'react-i18next';
import { useState, useEffect, useRef, useMemo } from 'react';
import { ArrowLeft, Trophy, RefreshCw, Briefcase, Play } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../lib/database';
import ScreenShell from './ScreenShell';
import CaseThumb from './CaseThumb';
import CaseWinners from './CaseWinners';
import CoinAmount from './CoinAmount';
import CaseFeeLine from './CaseFeeLine';
import { hasFee, type FeeBoard } from '../lib/coins';
import { getPhaseBadge, getSessionMode, timeAgo } from '../lib/sessionInfo';
import { boardSessions } from '../lib/gameCounts';
import { activeAppeal, appealsEnabled } from '../lib/appeals';
import type { Case, CaseSession } from '../types';

type BoardTab = 'ongoing' | 'new' | 'trendy' | 'popular' | 'quick';

interface CaseBoardProps {
  onBack: () => void;
  /** quick is true when the case was chosen from the Quick Start tab. */
  onSelectCase?: (caseId: string, quick?: boolean) => void;
  /** Resume one specific game (a player can have several of the same case) */
  onContinueSession?: (sessionId: string) => void;
  /** Open a finished game to answer the appeal the other player filed. */
  onOpenAppeal?: (sessionId: string) => void;
  /**
   * Picker mode: the board is used to choose a case for a two-player match.
   * Shows only fresh cases, hides ongoing games and filters, and the button
   * hands the chosen case back instead of opening the case file.
   */
  onPick?: (caseItem: Case) => void;
  /** Which tab to open on (My games when arriving from Play → My games) */
  initialFilter?: BoardTab | 'all';
}

interface OngoingCase extends Case {
  current_phase: string;
  session_id: string;
  session_state?: CaseSession['session_state'];
  last_played?: string;
}

/** An online challenge or friend invite that is still waiting for the other player. */
interface WaitingGame {
  key: string;
  kind: 'challenge' | 'invite';
  id: string;
  title: string;
  role: string;
  created_at?: string;
  /** A challenge only reachable through its link */
  isPrivate?: boolean;
}

export default function CaseBoard({ onBack, onSelectCase, onContinueSession, onOpenAppeal, onPick, initialFilter = 'all' }: CaseBoardProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [cases, setCases] = useState<Case[]>([]);
  const [ongoingCases, setOngoingCases] = useState<OngoingCase[]>([]);
  const [waitingGames, setWaitingGames] = useState<WaitingGame[]>([]);
  // Opponent appeals waiting for this player's answer (shown like an invite).
  const [appealRequests, setAppealRequests] = useState<{ sessionId: string; title: string; due?: string; filed?: string }[]>([]);
  const [cancellingKey, setCancellingKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // Two tabs: My games and New cases. With no tab asked for, open on My games when there is something to
  // continue, otherwise on New cases (decided once, after the first load).
  const [sortBy, setSortBy] = useState<BoardTab>(initialFilter === 'all' ? 'new' : initialFilter);
  const [stats, setStats] = useState<Record<string, { plays: number; week: number }>>({});
  const [fees, setFees] = useState<FeeBoard>({});
  const [balance, setBalance] = useState<number | null>(null);
  const autoPickRef = useRef(initialFilter === 'all' && !onPick);
  const [showWinnersModal, setShowWinnersModal] = useState(false);
  const [selectedCaseForWinners, setSelectedCaseForWinners] = useState<Case | null>(null);

  const loadCases = async (silent = false) => {
    if (!user) return;

    try {
      if (!silent) setLoading(true);
      if (onPick) {
        setCases(await db.cases.getPresetCases());
        setOngoingCases([]);
        setWaitingGames([]);
        setAppealRequests([]);
        return;
      }
      const [preset, ongoing, challenges, invitations, appealRows] = await Promise.all([
        db.cases.getPresetCases(),
        db.sessions.getOngoingSessions(user.id),
        db.challenges.getMyChallenges(user.id).catch(() => []),
        db.invitations.getInvitationsByUser(user.id).catch(() => []),
        appealsEnabled() ? db.sessions.getAppealRequests(user.id).catch(() => []) : Promise.resolve([])
      ]);

      setAppealRequests(appealRows.map(row => {
        const appeal = activeAppeal(row.session_state);
        return { sessionId: row.id, title: row.cases?.title ?? t('board.fallbackCase'), due: appeal?.response_due_at, filed: appeal?.created_at };
      }));

      // Online challenges and friend invites that no one has joined yet are
      // games too — list them until they start (then they become real games).
      setWaitingGames([
        ...challenges
          .filter((c: any) => c.status === 'open' && c.creator_user_id === user.id)
          .map((c: any): WaitingGame => ({ key: `challenge-${c.id}`, kind: 'challenge', id: c.id, title: c.case_title || t('board.fallbackChallenge'), role: c.creator_role, created_at: c.created_at, isPrivate: c.is_public === false })),
        ...invitations
          .filter(i => i.status === 'pending' && i.inviter_user_id === user.id)
          .map((i): WaitingGame => ({ key: `invite-${i.id}`, kind: 'invite', id: i.id, title: i.case_title || t('board.fallbackInvite'), role: i.inviter_role || 'defense', created_at: (i as any).created_at }))
      ]);

      // Every preset case can always be started again — an existing game
      // of the same case doesn't block it. Ongoing games are listed per
      // session (newest first), so several games of one case can coexist.
      const presetCaseIds = new Set(preset.map(caseItem => caseItem.id));
      const presetOngoingSessions = boardSessions(ongoing, presetCaseIds);

      if (autoPickRef.current) {
        autoPickRef.current = false;
        const myGames = presetOngoingSessions.length + (challenges as any[]).filter((c: any) => c.status === 'open' && c.creator_user_id === user.id).length
          + invitations.filter(i => i.status === 'pending' && i.inviter_user_id === user.id).length + appealRows.length;
        setSortBy(myGames > 0 ? 'ongoing' : 'new');
      }

      db.cases.getPlayStats().then(setStats).catch(() => undefined);
      db.coins.getFeeBoard().then(setFees).catch(() => undefined);
      db.coins.getBalance().then(setBalance).catch(() => undefined);

      setCases(preset);
      setOngoingCases(presetOngoingSessions.map(session => ({
        ...(session as any).cases,
        current_phase: session.current_phase,
        session_id: session.id,
        session_state: session.session_state,
        last_played: (session as any).updated_at || (session as any).created_at
      })));
    } catch (error) {
      console.error('Failed to load cases:', error);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const handleCancelWaiting = async (game: WaitingGame) => {
    setCancellingKey(game.key);
    try {
      if (game.kind === 'challenge') await db.challenges.cancelChallenge(game.id);
      else await db.invitations.cancelInvitation(game.id);
      setWaitingGames(prev => prev.filter(g => g.key !== game.key));
    } catch (error) {
      console.error('Failed to cancel:', error);
    } finally {
      setCancellingKey(null);
    }
  };

  useEffect(() => {
    loadCases();
    
    // Listen for refresh events (e.g., after case completion)
    const handleRefresh = () => {
      loadCases();
    };
    window.addEventListener('caseBoardRefresh', handleRefresh);

    // Quietly refresh so a waiting challenge turns into a game when someone joins
    const poll = setInterval(() => {
      if (!document.hidden) loadCases(true);
    }, 8000);
    
    // Also refresh when component becomes visible (e.g., after returning from verdict)
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        loadCases();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      clearInterval(poll);
      window.removeEventListener('caseBoardRefresh', handleRefresh);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  const visibleCases = useMemo(() => {
    const plays = (c: Case) => stats[c.id]?.plays ?? 0;
    const week = (c: Case) => stats[c.id]?.week ?? 0;
    if (sortBy === 'quick') return cases.filter(c => c.quick_start);
    if (sortBy === 'popular') return cases.filter(c => c.case_category === 'popular').sort((a, b) => plays(b) - plays(a));
    if (sortBy === 'trendy') return cases.filter(c => c.case_category === 'trendy').sort((a, b) => week(b) - week(a) || plays(b) - plays(a));
    return cases;
  }, [cases, stats, sortBy]);

  const handleReviewCase = (caseItem: Case) => {
    if (onPick) onPick(caseItem);
    else onSelectCase?.(caseItem.id, sortBy === 'quick');
  };


  return (
    <ScreenShell
      title={onPick ? t('board.pickTitle') : t('board.title')}
      subtitle={onPick ? t('board.pickSub') : t('board.sub')}
      onBack={onBack}
      maxWidth="max-w-6xl"
      right={
        <div className="flex items-center gap-2">
          {balance !== null && !onPick && (
            <span
              className="flex-none flex items-center h-11 px-3 rounded-full bg-black/55 border border-[#FFD43B]/40 text-base"
              aria-label={t('board.coins', { count: balance })}
            >
              <CoinAmount amount={balance} />
            </span>
          )}
          <button
            onClick={() => loadCases()}
            disabled={loading}
            aria-label={t('board.refresh')}
            className="flex-none flex items-center justify-center w-11 h-11 rounded-full bg-black/55 border border-white/15 text-white disabled:opacity-50"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      }
    >
      <div>
        <div className={`sticky top-0 z-20 -mx-4 px-4 py-2 mb-5 bg-[#0b0d14]/90 backdrop-blur-md ${onPick ? 'hidden' : ''}`}>
          <div role="tablist" className="flex gap-2 overflow-x-auto no-scrollbar">
            {([
              ['ongoing', t('board.tabOngoing', { count: ongoingCases.length + waitingGames.length + appealRequests.length })],
              ['quick', t('board.tabQuick')],
              ['new', t('board.tabNew')],
              ['trendy', t('board.tabTrendy')],
              ['popular', t('board.tabPopular')]
            ] as const).map(([key, label]) => (
              <button
                key={key}
                role="tab"
                aria-selected={sortBy === key}
                onClick={() => setSortBy(key)}
                className={`flex-none px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-colors ${
                  sortBy === key ? 'bg-[#FFD43B] text-black' : 'bg-white/10 text-white/70 hover:bg-white/15'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="text-center py-20 text-white/55">{t('board.loading')}</div>
        ) : sortBy === 'ongoing' && ongoingCases.length + waitingGames.length + appealRequests.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-white/55 mb-4">{t('board.emptyOngoing')}</p>
            <button
              onClick={() => setSortBy('new')}
              className="px-6 py-3 bg-[#FFD43B] hover:bg-[#ffdc5e] text-black font-bold rounded-xl transition-colors"
            >
              {t('board.browse')}
            </button>
          </div>
        ) : (sortBy !== 'ongoing' && visibleCases.length === 0) ? (
          <div className="text-center py-20">
            <p className="text-white/55 mb-4">{sortBy === 'quick' ? t('board.emptyQuick') : sortBy === 'trendy' ? t('board.emptyTrendy') : sortBy === 'popular' ? t('board.emptyPopular') : t('board.emptyNone')}</p>
            <button
              onClick={() => loadCases()}
              className="px-6 py-3 bg-[#FFD43B] hover:bg-[#ffdc5e] text-black font-bold rounded-xl transition-colors"
            >
              {t('board.refreshBtn')}
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 lg:gap-6">
            {/* Ongoing Cases - Show First (if not filtered) */}
            {sortBy === 'ongoing' && appealRequests.map((req) => (
              <div
                key={`appeal-${req.sessionId}`}
                className="border-2 border-red-400/70 bg-red-500/[0.08] rounded-2xl p-5 backdrop-blur-sm"
              >
                <div className="flex items-center gap-2 flex-wrap mb-3">
                  <span className="px-2.5 py-1 rounded-full border text-[11px] font-black tracking-wide bg-red-500/20 border-red-400/60 text-red-200">
                    {t('board.appealFiled')}
                  </span>
                  <span className="px-2.5 py-1 rounded-full border text-[11px] font-black tracking-wide bg-rose-500/20 border-rose-400/60 text-rose-200">
                    {t('mode.vsPlayer')}
                  </span>
                </div>
                <h3 className="font-game text-3xl leading-none text-white mb-1">{req.title}</h3>
                <p className="text-sm text-white/65">
                  {t('board.appealBody')}
                </p>
                <div className="text-xs text-white/50 mt-2 mb-4">
                  {req.filed ? t('board.filed', { when: timeAgo(req.filed) }) : ''}
                </div>
                <button
                  onClick={() => onOpenAppeal?.(req.sessionId)}
                  className="w-full px-4 py-2.5 rounded-xl bg-[#FFD43B] text-black font-bold"
                >
                  {t('board.respondAppeal')}
                </button>
              </div>
            ))}

            {sortBy === 'ongoing' && waitingGames.map((game) => (
              <div
                key={game.key}
                className="border-2 border-dashed border-rose-400/60 bg-rose-500/[0.07] rounded-2xl p-5 backdrop-blur-sm"
              >
                <div className="flex items-center gap-2 flex-wrap mb-3">
                  <span className="px-2.5 py-1 rounded-full border text-[11px] font-black tracking-wide bg-amber-500/20 border-amber-400/60 text-amber-300">
                    {game.kind === 'challenge' ? t('board.waitingOpponent') : t('board.waitingFriend')}
                  </span>
                  {game.isPrivate && (
                    <span className="px-2.5 py-1 rounded-full border text-[11px] font-black tracking-wide bg-white/10 border-white/25 text-white/80">
                      {t('board.privateLink')}
                    </span>
                  )}
                  <span className="px-2.5 py-1 rounded-full border text-[11px] font-black tracking-wide bg-rose-500/20 border-rose-400/60 text-rose-200">
                    {t('mode.vsPlayer')}
                  </span>
                </div>
                <h3 className="font-game text-3xl leading-none text-white mb-1">{game.title}</h3>
                <p className="text-sm text-white/65">
                  {t('board.playingRole', { role: t(`roles.${game.role}`) })} {game.kind === 'challenge' ? t('board.startsSoon') : t('board.startsFriend')}
                </p>
                <div className="text-xs text-white/50 mt-2 mb-4">
                  {game.created_at ? t('board.sent', { when: timeAgo(game.created_at) }) : ''}
                </div>
                <button
                  onClick={() => handleCancelWaiting(game)}
                  disabled={cancellingKey === game.key}
                  className="w-full px-4 py-2.5 rounded-xl bg-white/10 border border-white/20 text-white font-bold disabled:opacity-50"
                >
                  {cancellingKey === game.key ? t('board.cancelling') : game.kind === 'challenge' ? t('board.cancelChallenge') : t('board.cancelInvite')}
                </button>
              </div>
            ))}

            {sortBy === 'ongoing' && ongoingCases.map((ongoingCase) => {
              const phase = getPhaseBadge(ongoingCase.current_phase);
              const mode = getSessionMode({ session_state: ongoingCase.session_state } as CaseSession);
              return (
                <div
                  key={`ongoing-${ongoingCase.session_id}`}
                  className={`border-2 rounded-2xl p-5 backdrop-blur-sm bg-black/65 ${phase.card}`}
                >
                  <div className="flex items-center gap-2 flex-wrap mb-3">
                    <span className={`px-2.5 py-1 rounded-full border text-[11px] font-black tracking-wide ${phase.badge}`}>{t(phase.labelKey)}</span>
                    <span className={`px-2.5 py-1 rounded-full border text-[11px] font-black tracking-wide ${mode.badge}`}>{t(mode.labelKey)}</span>
                  </div>

                  <div className="flex items-start gap-3 mb-3">
                    <CaseThumb src={ongoingCase.image_url} />
                    <div className="flex-1 min-w-0 flex items-start justify-between gap-2">
                    <h3 className="font-game text-3xl leading-none text-white">
                      {ongoingCase.title}
                      {ongoingCase.versus && (
                        <span className="block mt-1 font-sans text-sm font-normal tracking-normal text-white/60">({ongoingCase.versus})</span>
                      )}
                    </h3>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedCaseForWinners(ongoingCase);
                        setShowWinnersModal(true);
                      }}
                      className="flex-none p-2 text-white/55 hover:text-[#FFD43B] hover:bg-[#FFD43B]/10 rounded-lg transition-colors"
                      title={t('board.viewWinners')}
                    >
                      <Trophy className="w-5 h-5" />
                    </button>
                    </div>
                  </div>

                  <div className="text-xs text-white/50 mb-4">
                    {ongoingCase.last_played ? t('board.lastPlayed', { when: timeAgo(ongoingCase.last_played) }) : ''}
                  </div>

                  <button
                    onClick={() => onContinueSession?.(ongoingCase.session_id)}
                    className="w-full px-4 py-2.5 bg-[#FFD43B] hover:bg-[#ffdc5e] text-black font-bold rounded-xl border-b-4 border-[#B8860B] active:translate-y-0.5 active:border-b-2 transition-all"
                  >
                    {t('board.continueGame')}
                  </button>
                </div>
              );
            })}

            {/* Cases to start */}
            {sortBy !== 'ongoing' && visibleCases.map((caseItem) => {
              return (
                <div
                  key={`new-${caseItem.id}`}
                  className="flex flex-col bg-black/70 border border-white/15 rounded-2xl p-5 backdrop-blur-sm hover:border-white/30 transition-all group"
                >
                  <div className="flex items-start gap-3 mb-3">
                    <CaseThumb src={caseItem.image_url} />
                    <div className="flex-1 min-w-0 flex items-start justify-between gap-2">
                      <h3 className="font-game text-3xl leading-none text-white group-hover:text-[#FFD43B] transition-colors">
                        {caseItem.title}
                        {caseItem.versus && (
                          <span className="block mt-1.5 font-sans text-sm font-normal tracking-normal text-white/60">{caseItem.versus}</span>
                        )}
                      </h3>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedCaseForWinners(caseItem);
                          setShowWinnersModal(true);
                        }}
                        className="p-2 text-white/55 hover:text-[#FFD43B] hover:bg-[#FFD43B]/10 rounded-lg transition-colors"
                        title={t('board.viewWinners')}
                      >
                        <Trophy className="w-5 h-5" />
                      </button>
                    </div>
                  </div>

                  {/* Only when picking a case for a challenge: there is no details screen there, so the card has to be readable. */}
                  {(onPick || sortBy === 'quick') && caseItem.description && (
                    <p className="text-white/70 text-sm leading-relaxed mb-3 line-clamp-5">
                      {caseItem.description}
                    </p>
                  )}

                  {hasFee(fees[caseItem.id]) && <CaseFeeLine fee={fees[caseItem.id]} className="mb-2 mt-auto" />}

                  <div className={`text-sm text-white/55 mb-4 ${hasFee(fees[caseItem.id]) ? '' : 'mt-auto'}`}>
                    <span className="text-white/40">{t('board.defendant')}</span>
                    <span className="text-white/75">{caseItem.defendant_name || t('board.unknown')}</span>
                  </div>

                  <button
                    onClick={() => handleReviewCase(caseItem)}
                    className="w-full px-4 py-2.5 bg-[#FFD43B] hover:bg-[#ffdc5e] text-black font-bold rounded-xl border-b-4 border-[#B8860B] active:translate-y-0.5 active:border-b-2 transition-all"
                  >
                    {onPick ? t('board.chooseCase') : t('board.caseDetails')}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showWinnersModal && selectedCaseForWinners && (
        <CaseWinners
          caseId={selectedCaseForWinners.id}
          caseTitle={selectedCaseForWinners.title}
          onClose={() => {
            setShowWinnersModal(false);
            setSelectedCaseForWinners(null);
          }}
        />
      )}
    </ScreenShell>
  );
}
