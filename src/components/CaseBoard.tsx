import { useState, useEffect } from 'react';
import { ArrowLeft, Trophy, RefreshCw, Briefcase, Play } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../lib/database';
import ScreenShell from './ScreenShell';
import CaseWinners from './CaseWinners';
import { getPhaseBadge, getSessionMode, timeAgo } from '../lib/sessionInfo';
import type { Case, CaseSession } from '../types';

interface CaseBoardProps {
  onBack: () => void;
  onSelectCase?: (caseId: string) => void;
  /** Resume one specific game (a player can have several of the same case) */
  onContinueSession?: (sessionId: string) => void;
  /**
   * Picker mode: the board is used to choose a case for a two-player match.
   * Shows only fresh cases, hides ongoing games and filters, and the button
   * hands the chosen case back instead of opening the case file.
   */
  onPick?: (caseItem: Case) => void;
}

interface OngoingCase extends Case {
  current_phase: string;
  session_id: string;
  session_state?: CaseSession['session_state'];
  last_played?: string;
}

export default function CaseBoard({ onBack, onSelectCase, onContinueSession, onPick }: CaseBoardProps) {
  const { user } = useAuth();
  const [cases, setCases] = useState<Case[]>([]);
  const [ongoingCases, setOngoingCases] = useState<OngoingCase[]>([]);
  const [loading, setLoading] = useState(false);
  const [sortBy, setSortBy] = useState<'all' | 'new' | 'ongoing'>('all');
  const [showWinnersModal, setShowWinnersModal] = useState(false);
  const [selectedCaseForWinners, setSelectedCaseForWinners] = useState<Case | null>(null);

  const loadCases = async () => {
    if (!user) return;

    try {
      setLoading(true);
      if (onPick) {
        setCases(await db.cases.getPresetCases());
        setOngoingCases([]);
        return;
      }
      const [preset, ongoing] = await Promise.all([
        db.cases.getPresetCases(),
        db.sessions.getOngoingSessions(user.id)
      ]);

      // Every preset case can always be started again — an existing game
      // of the same case doesn't block it. Ongoing games are listed per
      // session (newest first), so several games of one case can coexist.
      const presetCaseIds = new Set(preset.map(caseItem => caseItem.id));
      const presetOngoingSessions = ongoing.filter(session => presetCaseIds.has(session.case_id));

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
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCases();
    
    // Listen for refresh events (e.g., after case completion)
    const handleRefresh = () => {
      loadCases();
    };
    window.addEventListener('caseBoardRefresh', handleRefresh);
    
    // Also refresh when component becomes visible (e.g., after returning from verdict)
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        loadCases();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      window.removeEventListener('caseBoardRefresh', handleRefresh);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  const getDifficultyColor = (difficulty?: string) => {
    switch (difficulty) {
      case 'easy': return 'text-green-400 bg-green-500/20 border-green-500/30';
      case 'medium': return 'text-yellow-400 bg-yellow-500/20 border-yellow-500/30';
      case 'hard': return 'text-red-400 bg-red-500/20 border-red-500/30';
      default: return 'text-slate-400 bg-slate-500/20 border-slate-500/30';
    }
  };

  const handleReviewCase = (caseItem: Case) => {
    if (onPick) onPick(caseItem);
    else onSelectCase?.(caseItem.id);
  };


  return (
    <ScreenShell
      title={onPick ? 'PICK A CASE' : 'CASE BOARD'}
      subtitle={onPick ? 'Read the case, then tap Choose This Case.' : 'New opportunities and ongoing cases at a glance.'}
      onBack={onBack}
      maxWidth="max-w-6xl"
      right={
        <button
          onClick={loadCases}
          disabled={loading}
          aria-label="Refresh cases"
          className="flex-none flex items-center justify-center w-11 h-11 rounded-full bg-black/55 border border-white/15 text-white disabled:opacity-50"
        >
          <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      }
    >
      <div>
        <div className={`flex gap-2 flex-wrap mb-6 ${onPick ? 'hidden' : ''}`}>
          {([
            ['all', `All (${cases.length + ongoingCases.length})`],
            ['new', `New cases (${cases.length})`],
            ['ongoing', `My games (${ongoingCases.length})`]
          ] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setSortBy(key)}
              className={`px-4 py-2 rounded-full text-sm font-bold transition-colors ${
                sortBy === key ? 'bg-[#FFD43B] text-black' : 'bg-white/10 text-white/70 hover:bg-white/15'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-center py-20 text-slate-400">Loading cases...</div>
        ) : (cases.length === 0 && ongoingCases.length === 0) ? (
          <div className="text-center py-20">
            <p className="text-slate-400 mb-4">No cases available</p>
            <button
              onClick={loadCases}
              className="px-6 py-3 bg-[#FFD43B] hover:bg-[#ffdc5e] text-black font-bold rounded-xl transition-colors"
            >
              Refresh Cases
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 lg:gap-6">
            {/* Ongoing Cases - Show First (if not filtered) */}
            {sortBy !== 'new' && ongoingCases.map((ongoingCase) => {
              const phase = getPhaseBadge(ongoingCase.current_phase);
              const mode = getSessionMode({ session_state: ongoingCase.session_state } as CaseSession);
              return (
                <div
                  key={`ongoing-${ongoingCase.session_id}`}
                  className={`border-2 rounded-2xl p-5 backdrop-blur-sm bg-black/65 ${phase.card}`}
                >
                  <div className="flex items-center gap-2 flex-wrap mb-3">
                    <span className={`px-2.5 py-1 rounded-full border text-[11px] font-black tracking-wide ${phase.badge}`}>{phase.label}</span>
                    <span className={`px-2.5 py-1 rounded-full border text-[11px] font-black tracking-wide ${mode.badge}`}>{mode.label}</span>
                  </div>

                  <div className="flex items-start justify-between gap-2 mb-3">
                    <h3 className="text-xl font-semibold text-white">{ongoingCase.title}</h3>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedCaseForWinners(ongoingCase);
                        setShowWinnersModal(true);
                      }}
                      className="flex-none p-2 text-slate-400 hover:text-amber-400 hover:bg-amber-500/10 rounded-lg transition-colors"
                      title="View winners"
                    >
                      <Trophy className="w-5 h-5" />
                    </button>
                  </div>

                  <p className="text-slate-300 text-sm line-clamp-2 mb-3">"{ongoingCase.description}"</p>

                  <div className="text-xs text-white/50 mb-4">
                    {ongoingCase.last_played ? `Last played ${timeAgo(ongoingCase.last_played)}` : ''}
                  </div>

                  <button
                    onClick={() => onContinueSession?.(ongoingCase.session_id)}
                    className="w-full px-4 py-2.5 bg-[#FFD43B] hover:bg-[#ffdc5e] text-black font-bold rounded-xl border-b-4 border-[#B8860B] active:translate-y-0.5 active:border-b-2 transition-all"
                  >
                    Continue Game
                  </button>
                </div>
              );
            })}

            {/* New Cases (if not filtered) */}
            {sortBy !== 'ongoing' && cases.map((caseItem) => (
              <div
                key={`new-${caseItem.id}`}
                className="bg-black/65 border border-white/15 rounded-2xl p-5 backdrop-blur-sm hover:border-white/30 transition-all group"
              >
                {!onPick && (
                  <span className="inline-block mb-3 px-2.5 py-1 rounded-full border text-[11px] font-black tracking-wide bg-lime-500/20 border-lime-400/60 text-lime-300">
                    NEW CASE
                  </span>
                )}
                <div className="flex items-start justify-between mb-4">
                  <h3 className="text-xl font-bold text-white group-hover:text-[#FFD43B] transition-colors">
                    {caseItem.title}
                  </h3>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedCaseForWinners(caseItem);
                      setShowWinnersModal(true);
                    }}
                    className="p-2 text-slate-400 hover:text-amber-400 hover:bg-amber-500/10 rounded-lg transition-colors"
                    title="View winners"
                  >
                    <Trophy className="w-5 h-5" />
                  </button>
                </div>

                <p className={`text-slate-300 text-sm mb-4 ${onPick ? 'line-clamp-5' : 'line-clamp-2'}`}>
                  "{caseItem.description}"
                </p>

                <div className="space-y-3 mb-4">
                  <div className="text-sm">
                    <span className="text-slate-500">Defendant: </span>
                    <span className="text-slate-300">{caseItem.defendant_name || 'Unknown'}</span>
                  </div>
                  {!onPick && (
                    <div className="text-xs text-slate-500 italic">
                      New Case - Awaiting Counsel
                    </div>
                  )}
                </div>

                <button
                  onClick={() => handleReviewCase(caseItem)}
                  className="w-full px-4 py-2.5 bg-[#FFD43B] hover:bg-[#ffdc5e] text-black font-bold rounded-xl border-b-4 border-[#B8860B] active:translate-y-0.5 active:border-b-2 transition-all"
                >
                  {onPick ? 'Choose This Case' : 'Start New Game'}
                </button>
              </div>
            ))}
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
