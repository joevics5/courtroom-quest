import { useState, useEffect } from 'react';
import { Plus, Briefcase, ChevronRight, Shield, Edit, RefreshCw, Trophy, Play, CheckCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useSession } from '../contexts/SessionContext';
import { db } from '../lib/database';
import ScreenShell from './ScreenShell';
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
  const { user } = useAuth();
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
        className={`w-full rounded-2xl p-5 transition-all group cursor-pointer ${
          isOngoing
            ? 'bg-[#F2B705]/10 border border-[#F2B705]/50 hover:bg-[#F2B705]/15'
            : 'bg-white/5 border border-white/15 hover:border-white/30 hover:bg-white/10'
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
    <ScreenShell
      title="MY CASES"
      subtitle="Create, manage and play your own custom cases."
      onBack={onBack}
      maxWidth="max-w-5xl"
      right={onOpenAdmin ? (
        <button
          onClick={onOpenAdmin}
          className="flex-none flex items-center gap-1.5 rounded-full bg-[#FFD43B] text-black px-4 h-11 text-xs font-black tracking-wide"
        >
          <Shield className="w-4 h-4" />
          ADMIN
        </button>
      ) : undefined}
    >
      <div>
        <div className="rounded-2xl bg-black/55 border border-white/15 backdrop-blur-sm overflow-hidden">
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
                  className="w-full bg-[#FFD43B]/10 hover:bg-[#FFD43B]/20 text-[#FFD43B] rounded-2xl p-3 sm:p-5 flex items-center justify-center gap-3 transition-colors border-2 border-dashed border-[#FFD43B]/70"
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
    </ScreenShell>
  );
}
