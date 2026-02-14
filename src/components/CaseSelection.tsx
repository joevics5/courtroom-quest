import { useState, useEffect } from 'react';
import { Plus, Briefcase, ChevronRight, Scale, Shield, Edit, RefreshCw, Trophy, Play, CheckCircle, ArrowLeft } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useSession } from '../contexts/SessionContext';
import { db } from '../lib/database';
import CaseWinners from './CaseWinners';
import type { Case } from '../types';

interface CaseSelectionProps {
  onSelectCase: (caseId: string, isCustom: boolean) => void;
  onCreateCustomCase: () => void;
  onEditCustomCase: (caseId: string) => void;
  onOpenAdmin?: () => void;
  onBack?: () => void;
}

type CaseWithSessionStatus = Case & {
  has_sessions: boolean;
  has_completed_sessions: boolean;
  current_phase?: string;
};

export default function CaseSelection({ onSelectCase, onCreateCustomCase, onEditCustomCase, onOpenAdmin, onBack }: CaseSelectionProps) {
  const { user, signOut } = useAuth();
  const [userCases, setUserCases] = useState<CaseWithSessionStatus[]>([]);
  const [loading, setLoading] = useState(false);
  const [showWinnersModal, setShowWinnersModal] = useState(false);
  const [selectedCaseForWinners, setSelectedCaseForWinners] = useState<Case | null>(null);

  useEffect(() => {
    loadCases();
  }, []);

  const loadCases = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const customCasesWithStatus = await db.cases.getUserCasesWithSessionStatus(user.id);
      setUserCases(customCasesWithStatus);
    } catch (error: any) {
      console.error('Failed to load cases:', error);
    } finally {
      setLoading(false);
    }
  };

  const getDifficultyColor = (difficulty?: string) => {
    switch (difficulty) {
      case 'easy': return 'text-green-400 bg-green-500/10';
      case 'medium': return 'text-yellow-400 bg-yellow-500/10';
      case 'hard': return 'text-red-400 bg-red-500/10';
      default: return 'text-slate-400 bg-slate-500/10';
    }
  };

  const renderCaseCard = (caseItem: CaseWithSessionStatus) => {
    const isOngoing = caseItem.has_sessions;

    return (
      <div
        key={caseItem.id}
        onClick={() => onSelectCase(caseItem.id, true)}
        className={`w-full rounded-lg p-6 transition-all group cursor-pointer ${
          isOngoing
            ? 'bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/30 hover:bg-gradient-to-br hover:from-amber-500/20 hover:to-orange-500/20'
            : 'bg-slate-800 border border-slate-700 hover:border-slate-600 hover:bg-slate-700/50'
        }`}
      >
        <div className="relative mb-3">
          <div className="flex items-start justify-between">
            <div className="flex-1 pr-12">
              <h3 className="text-lg font-semibold text-white">
                {caseItem.title}
              </h3>
              <p className="text-sm text-slate-400 mt-1 capitalize">{caseItem.case_type}</p>
            </div>
            <div className="absolute top-0 right-0 flex items-center gap-2">
              <Trophy className="w-4 h-4 text-yellow-400" />
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onEditCustomCase(caseItem.id);
                }}
                className="p-2 text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors"
                title="Edit case"
              >
                <Edit className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        <p className="text-slate-300 text-sm line-clamp-2 mb-3">
          {caseItem.description}
        </p>

        <div className="flex items-center gap-2">
          {caseItem.difficulty && (
            <>
              <span className="text-xs text-slate-400">Difficulty:</span>
              <span className={`text-xs px-2 py-1 rounded font-medium ${getDifficultyColor(caseItem.difficulty)}`}>
                {caseItem.difficulty.toUpperCase()}
              </span>
            </>
          )}
          {isOngoing && (
            <span className="text-xs px-2 py-1 rounded font-medium text-yellow-400 bg-yellow-500/10">
              {(caseItem.current_phase || 'investigation').toUpperCase()}
            </span>
          )}
        </div>
      </div>
    );
  };
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4 sm:p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            {onBack && (
              <button
                onClick={onBack}
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
                title="Back"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            <div className="flex items-center justify-center w-12 h-12 bg-blue-600 rounded-full">
              <Scale className="w-6 h-6 text-white" />
            </div>
          </div>
          <div className="flex items-center gap-3">
            {loading && (
              <div className="flex items-center gap-2 px-4 py-2 text-slate-400 text-sm">
                <RefreshCw className="w-4 h-4 animate-spin" />
                Loading Cases...
              </div>
            )}
            {onOpenAdmin && (
              <button
                onClick={onOpenAdmin}
                className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-colors text-sm"
              >
                <Shield className="w-4 h-4" />
                Admin
              </button>
            )}
            <button
              onClick={signOut}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors text-sm"
            >
              Sign Out
            </button>
          </div>
        </div>

        <div className="mb-6">
          <h1 className="text-3xl font-bold text-white">My Custom Cases</h1>
          <p className="text-slate-400 text-sm">Manage and play your custom cases</p>
        </div>

        <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
          <div className="p-6">
            {loading ? (
              <div className="text-center py-12 text-slate-400">
                {loading && (
                  <div className="flex items-center gap-2 px-4 py-2 text-slate-400 text-sm">
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Loading Cases...
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {/* Create New Case Button */}
                <button
                  onClick={onCreateCustomCase}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-lg p-3 sm:p-6 flex items-center justify-center gap-3 transition-colors border-2 border-dashed border-blue-500"
                >
                  <Plus className="w-5 h-5" />
                  <span className="font-medium">Create New Custom Case</span>
                </button>

                {/* All Custom Cases */}
                {userCases.length === 0 ? (
                  <div className="text-center py-12 text-slate-400">
                    No custom cases yet. Create your first case above.
                  </div>
                ) : (
                  userCases.map(c => renderCaseCard(c))
                )}
              </div>
            )}
          </div>
        </div>
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
