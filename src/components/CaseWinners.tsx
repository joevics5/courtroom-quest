import { useState, useEffect } from 'react';
import { Trophy, X } from 'lucide-react';
import { db } from '../lib/database';
import type { CaseWinner } from '../types';

interface CaseWinnersProps {
  caseId: string;
  caseTitle: string;
  onClose: () => void;
}

export default function CaseWinners({ caseId, caseTitle, onClose }: CaseWinnersProps) {
  const [winners, setWinners] = useState<CaseWinner[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadWinners();
  }, [caseId]);

  const loadWinners = async () => {
    try {
      setLoading(true);
      const data = await db.caseWinners.getCaseWinners(caseId);
      setWinners(data);
    } catch (error) {
      console.error('Failed to load winners:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-6 z-50">
      <div className="bg-slate-800 rounded-xl border border-slate-700 max-w-2xl w-full max-h-[80vh] overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <Trophy className="w-6 h-6 text-amber-400" />
            <div>
              <h2 className="text-xl font-bold text-white">Previous Winners</h2>
              <p className="text-sm text-slate-400">{caseTitle}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(80vh-120px)]">
          {loading ? (
            <div className="text-center py-8 text-slate-400">Loading winners...</div>
          ) : winners.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              No one has won this case yet. Be the first!
            </div>
          ) : (
            <div className="space-y-2">
              {winners.map((winner, index) => (
                <div
                  key={winner.id}
                  className="bg-slate-750 rounded-lg p-4 border border-slate-600 hover:border-slate-500 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 flex-1">
                      <div className={`flex items-center justify-center w-10 h-10 rounded-full ${
                        index === 0 ? 'bg-amber-500' : index === 1 ? 'bg-slate-400' : index === 2 ? 'bg-amber-700' : 'bg-slate-600'
                      }`}>
                        <span className="text-white font-bold">
                          {index + 1}
                        </span>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-white font-semibold">{winner.username}</span>
                          <span className="text-xs px-2 py-1 rounded bg-blue-500/10 text-blue-400 border border-blue-500/30">
                            {winner.level_achieved}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-sm text-slate-400">
                          <span>Score: {winner.verdict_score}/100</span>
                          <span>•</span>
                          <span>{formatDate(winner.won_at)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
