import { useState, useEffect } from 'react';
import { ArrowLeft, Trophy, RefreshCw, Briefcase, Play } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../lib/database';
import CaseWinners from './CaseWinners';
import type { Case } from '../types';

interface CaseBoardProps {
  onBack: () => void;
  onSelectCase: (caseId: string) => void;
  onContinueCase?: (caseId: string) => void;
}

interface OngoingCase extends Case {
  current_phase: string;
  session_id: string;
}

export default function CaseBoard({ onBack, onSelectCase, onContinueCase }: CaseBoardProps) {
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
      const [preset, ongoing] = await Promise.all([
        db.cases.getPresetCases(),
        db.sessions.getOngoingSessions(user.id)
      ]);

      // Get case IDs that have ongoing sessions
      const ongoingCaseIds = new Set(ongoing.map(session => session.case_id));

      // Create a set of preset case IDs
      const presetCaseIds = new Set(preset.map(caseItem => caseItem.id));

      // Filter ongoing sessions to only include preset cases
      const presetOngoingSessions = ongoing.filter(session => presetCaseIds.has(session.case_id));

      // Filter out cases that are already in progress
      const availableCases = preset.filter(caseItem => !presetOngoingSessions.some(session => session.case_id === caseItem.id));

      setCases(availableCases);
      setOngoingCases(presetOngoingSessions.map(session => ({
        ...session.cases,
        current_phase: session.current_phase,
        session_id: session.id
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
    onSelectCase(caseItem.id);
  };


  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4 sm:p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={onBack}
            className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
          <button
            onClick={loadCases}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Load Cases
          </button>
        </div>


        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">
            Case Board
          </h1>
          <p className="text-slate-400 mb-4">
            Your legal practice dashboard. New opportunities and ongoing cases at a glance.
          </p>

          <div className="flex gap-2">
            <button
              onClick={() => setSortBy('all')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                sortBy === 'all'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              All Cases ({cases.length + ongoingCases.length})
            </button>
            <button
              onClick={() => setSortBy('new')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                sortBy === 'new'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              New Cases ({cases.length})
            </button>
            <button
              onClick={() => setSortBy('ongoing')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                sortBy === 'ongoing'
                  ? 'bg-amber-600 text-white'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              Ongoing Cases ({ongoingCases.length})
            </button>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-20 text-slate-400">Loading cases...</div>
        ) : (cases.length === 0 && ongoingCases.length === 0) ? (
          <div className="text-center py-20">
            <p className="text-slate-400 mb-4">No cases available</p>
            <button
              onClick={loadCases}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              Refresh Cases
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 lg:gap-6">
            {/* Ongoing Cases - Show First (if not filtered) */}
            {sortBy !== 'new' && ongoingCases.map((ongoingCase) => (
              <div
                key={`ongoing-${ongoingCase.session_id}`}
                className="bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/30 rounded-lg p-6"
              >
                <div className="mb-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xl font-semibold text-white">
                      {ongoingCase.title}
                    </h3>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedCaseForWinners(ongoingCase);
                        setShowWinnersModal(true);
                      }}
                      className="p-2 text-slate-400 hover:text-amber-400 hover:bg-amber-500/10 rounded-lg transition-colors"
                      title="View winners"
                    >
                      <Trophy className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                <p className="text-slate-300 text-sm line-clamp-2 mb-4">
                  "{ongoingCase.description}"
                </p>

                <div className="space-y-3 mb-4">
                  <div className="text-sm">
                    <span className="text-slate-500">Defendant: </span>
                    <span className="text-slate-300">{ongoingCase.defendant_name || (ongoingCase.truth_state as any)?.defendant_name || 'Unknown'}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    {ongoingCase.difficulty && (
                      <div className="flex items-center gap-2">
                        <span className="text-slate-500 text-sm">Difficulty:</span>
                        <span className={`text-xs px-3 py-1 rounded-full border font-medium uppercase tracking-wide ${getDifficultyColor(ongoingCase.difficulty)}`}>
                          {ongoingCase.difficulty}
                        </span>
                      </div>
                    )}
                    <div className="px-2 py-1 bg-amber-500/20 border border-amber-500/40 rounded text-xs text-amber-300 font-medium">
                      {ongoingCase.current_phase.replace('_', ' ').toUpperCase()}
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => (onContinueCase || onSelectCase)(ongoingCase.id)}
                  className="w-full px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-colors font-medium"
                >
                  Continue Case
                </button>
              </div>
            ))}

            {/* New Cases (if not filtered) */}
            {sortBy !== 'ongoing' && cases.map((caseItem) => (
              <div
                key={`new-${caseItem.id}`}
                className="bg-slate-800 border border-slate-700 rounded-lg p-6 hover:border-slate-600 transition-all group"
              >
                <div className="flex items-start justify-between mb-4">
                  <h3 className="text-xl font-bold text-white group-hover:text-blue-400 transition-colors">
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

                <p className="text-slate-300 text-sm line-clamp-2 mb-4">
                  "{caseItem.description}"
                </p>

                <div className="space-y-3 mb-4">
                  <div className="text-sm">
                    <span className="text-slate-500">Defendant: </span>
                    <span className="text-slate-300">{caseItem.defendant_name || 'Unknown'}</span>
                  </div>
                  {caseItem.difficulty && (
                    <div className="flex items-center gap-2">
                      <span className="text-slate-500 text-sm">Difficulty:</span>
                      <span className={`text-xs px-3 py-1 rounded-full border font-medium uppercase tracking-wide ${getDifficultyColor(caseItem.difficulty)}`}>
                        {caseItem.difficulty}
                      </span>
                    </div>
                  )}
                  <div className="text-xs text-slate-500 italic">
                    New Case - Awaiting Counsel
                  </div>
                </div>

                <button
                  onClick={() => handleReviewCase(caseItem)}
                  className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium"
                >
                  Review Case
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
    </div>
  );
}
