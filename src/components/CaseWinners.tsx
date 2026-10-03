import { useState, useEffect } from 'react';
import { Trophy, X } from 'lucide-react';
import { db } from '../lib/database';
import { maskPublicName } from '../lib/userName';
import type { CaseWinner } from '../types';

interface CaseWinnersProps {
  caseId: string;
  caseTitle: string;
  onClose: () => void;
}

const RANK_STYLE = [
  'bg-[#FFD43B] text-black',          // 1st – gold
  'bg-slate-300 text-black',          // 2nd – silver
  'bg-amber-600 text-white'           // 3rd – bronze
];

export default function CaseWinners({ caseId, caseTitle, onClose }: CaseWinnersProps) {
  const [winners, setWinners] = useState<CaseWinner[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setWinners(await db.caseWinners.getCaseWinners(caseId));
      } catch (error) {
        console.error('Failed to load winners:', error);
      } finally {
        setLoading(false);
      }
    })();
  }, [caseId]);

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

  return (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-black/75" onClick={onClose}>
      <div
        className="relative w-full max-w-md max-h-[85dvh] flex flex-col rounded-t-3xl sm:rounded-3xl bg-[#14161f] border border-white/10 text-white"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start gap-3 p-5 pb-3">
          <span className="flex-none flex items-center justify-center w-12 h-12 rounded-xl bg-[#FFD43B]">
            <Trophy className="w-6 h-6 text-black" />
          </span>
          <div className="flex-1 min-w-0">
            <h2 className="logo-gold font-game text-4xl leading-none">TOP SCORES</h2>
            <p className="text-sm text-white/60 mt-1 truncate">{caseTitle}</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="flex-none flex items-center justify-center w-9 h-9 rounded-full bg-white/10 hover:bg-white/20">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-5 pb-6 overflow-y-auto">
          {loading ? (
            <div className="text-center py-10 text-white/50">Loading…</div>
          ) : winners.length === 0 ? (
            <div className="text-center py-10">
              <Trophy className="w-10 h-10 mx-auto text-white/25 mb-3" />
              <p className="font-game text-2xl text-white/80">NO WINNERS YET</p>
              <p className="text-sm text-white/50 mt-1">Win this case and your name goes up here.</p>
            </div>
          ) : (
            <ol className="space-y-2.5">
              {winners.map((winner, index) => (
                <li
                  key={winner.id}
                  className={`flex items-center gap-3 rounded-2xl border p-3 ${
                    index === 0 ? 'bg-[#FFD43B]/10 border-[#F2B705]/60' : 'bg-white/5 border-white/15'
                  }`}
                >
                  <span className={`flex-none flex items-center justify-center w-10 h-10 rounded-full font-game text-xl ${RANK_STYLE[index] ?? 'bg-white/15 text-white'}`}>
                    {index + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold truncate">{maskPublicName(winner.username)}</div>
                    <div className="flex items-center gap-2 mt-0.5 text-xs text-white/55">
                      <span className="rounded-full bg-white/10 px-2 py-0.5 text-white/75 capitalize">{winner.level_achieved}</span>
                      <span>{formatDate(winner.won_at)}</span>
                    </div>
                  </div>
                  <div className="flex-none text-right leading-none">
                    <span className="font-game text-3xl text-[#FFD43B]">{winner.verdict_score}</span>
                    <span className="block text-[10px] font-bold tracking-wider text-white/40 mt-0.5">/ 100</span>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </div>
  );
}
