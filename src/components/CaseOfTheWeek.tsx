import { useState, useEffect } from 'react';
import { Trophy, Star, Loader2 } from 'lucide-react';
import { db } from '../lib/database';
import { getCaseOfTheWeek } from '../lib/trialConfig';
import type { Case, CaseWinner } from '../types';

interface Props {
  onPlayCase: (caseId: string) => void;
}

export default function CaseOfTheWeek({ onPlayCase }: Props) {
  const [featuredCase, setFeaturedCase] = useState<Case | null>(null);
  const [leaderboard, setLeaderboard] = useState<CaseWinner[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const cases = await db.cases.getPresetCases();
        const featured = getCaseOfTheWeek(cases);
        setFeaturedCase(featured);
        if (featured) {
          const scores = await db.caseWinners.getCaseLeaderboard(featured.id, 5);
          setLeaderboard(scores);
        }
      } catch (error) {
        console.error('Failed to load Case of the Week:', error);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div className="bg-slate-800/60 backdrop-blur-md border-2 border-slate-700 rounded-2xl p-6 flex items-center justify-center">
        <Loader2 className="w-5 h-5 text-white/40 animate-spin" />
      </div>
    );
  }

  if (!featuredCase) return null;

  return (
    <div className="bg-gradient-to-br from-amber-950/40 to-slate-800/60 backdrop-blur-md border-2 border-amber-600/40 rounded-2xl p-6 sm:p-8">
      <div className="flex items-center gap-2 mb-4">
        <Star className="w-5 h-5 text-amber-400 fill-amber-400" />
        <span className="text-amber-400 text-xs font-bold uppercase tracking-wide">Case of the Week</span>
      </div>

      <h3 className="text-xl sm:text-2xl font-bold text-white mb-2">{featuredCase.title}</h3>
      <p className="text-slate-300 text-sm mb-6 line-clamp-3">{featuredCase.description}</p>

      {leaderboard.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Trophy className="w-4 h-4 text-amber-400" />
            <span className="text-white/70 text-xs font-semibold">Top Scores</span>
          </div>
          <div className="space-y-1.5">
            {leaderboard.map((winner, i) => (
              <div key={winner.id} className="flex items-center justify-between text-sm bg-white/5 rounded-lg px-3 py-2">
                <span className="text-white/80 flex items-center gap-2">
                  <span className="text-white/40 font-mono text-xs w-4">{i + 1}</span>
                  {winner.username || 'Anonymous'}
                </span>
                <span className="text-amber-400 font-semibold">{winner.verdict_score}/100</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <button
        onClick={() => onPlayCase(featuredCase.id)}
        className="w-full px-6 py-3 bg-amber-600 hover:bg-amber-500 text-white font-semibold rounded-lg transition-colors"
      >
        Play This Case
      </button>
    </div>
  );
}
