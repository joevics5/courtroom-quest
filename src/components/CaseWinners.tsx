import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Trophy, X } from 'lucide-react';
import { db } from '../lib/database';
import { useAuth } from '../contexts/AuthContext';
import { maskPublicName } from '../lib/userName';
import type { CaseTopWinner } from '../types';

interface CaseWinnersProps {
  caseId: string;
  caseTitle: string;
  onClose: () => void;
}

const RANK_STYLE = [
  'bg-[#FFD43B] text-black', // 1st – gold
  'bg-slate-300 text-black', // 2nd – silver
  'bg-amber-600 text-white'  // 3rd – bronze
];

/**
 * Previous winners of a case: one row per player, with how many times they've
 * won it. Most wins first; ties go to whoever won most recently. Rendered in a
 * portal on <body> so it is always a true full-screen popup — inside a card
 * with a blur/transform it would otherwise be trapped in that card and unable
 * to scroll.
 */
export default function CaseWinners({ caseId, caseTitle, onClose }: CaseWinnersProps) {
  const { user } = useAuth();
  const [winners, setWinners] = useState<CaseTopWinner[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setFailed(false);
        setWinners(await db.caseWinners.getCaseTopWinners(caseId));
      } catch (error) {
        console.error('Failed to load winners:', error);
        setFailed(true);
      } finally {
        setLoading(false);
      }
    })();
  }, [caseId]);

  // Keep the page behind from scrolling while the popup is open
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/80" onClick={onClose}>
      <div
        className="relative w-full max-w-md max-h-[88dvh] flex flex-col rounded-t-3xl sm:rounded-3xl bg-[#14161f] border border-white/10 text-white shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header (stays put) */}
        <div className="flex items-start gap-3 p-5 pb-4 border-b border-white/10">
          <span className="flex-none flex items-center justify-center w-12 h-12 rounded-xl bg-[#FFD43B]">
            <Trophy className="w-6 h-6 text-black" />
          </span>
          <div className="flex-1 min-w-0">
            <h2 className="logo-gold font-game text-4xl leading-none">PREVIOUS WINNERS</h2>
            <p className="text-sm text-white/60 mt-1 truncate">{caseTitle}</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="flex-none flex items-center justify-center w-9 h-9 rounded-full bg-white/10 hover:bg-white/20">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* List (scrolls) */}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-5" style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 20px)' }}>
          {loading ? (
            <div className="text-center py-10 text-white/50">Loading…</div>
          ) : failed ? (
            <div className="text-center py-10 text-white/60">Couldn't load the winners. Try again in a moment.</div>
          ) : winners.length === 0 ? (
            <div className="text-center py-10">
              <Trophy className="w-10 h-10 mx-auto text-white/25 mb-3" />
              <p className="font-game text-2xl text-white/80">NO WINNERS YET</p>
              <p className="text-sm text-white/50 mt-1">Win this case and your name goes up here.</p>
            </div>
          ) : (
            <>
              <ol className="space-y-2.5">
                {winners.map((winner, index) => {
                  const isYou = winner.user_id === user?.id;
                  return (
                    <li
                      key={winner.user_id}
                      className={`flex items-center gap-3 rounded-2xl border p-3 ${
                        isYou ? 'bg-[#FFD43B]/10 border-[#F2B705]/70' : 'bg-white/5 border-white/15'
                      }`}
                    >
                      <span className={`flex-none flex items-center justify-center w-10 h-10 rounded-full font-game text-xl ${RANK_STYLE[index] ?? 'bg-white/15 text-white'}`}>
                        {index + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold truncate">{maskPublicName(winner.username)}</span>
                          {isYou && <span className="flex-none rounded-full bg-[#FFD43B] text-black text-[10px] font-black px-2 py-0.5">YOU</span>}
                        </div>
                        <div className="text-xs text-white/55 mt-0.5 truncate">
                          {winner.level_achieved} · Last win {formatDate(winner.last_won_at)}
                        </div>
                      </div>
                      <div className="flex-none text-right leading-none">
                        <span className="font-game text-3xl text-[#FFD43B]">{winner.wins}</span>
                        <span className="block text-[10px] font-bold tracking-wider text-white/45 mt-0.5">{winner.wins === 1 ? 'WIN' : 'WINS'}</span>
                      </div>
                    </li>
                  );
                })}
              </ol>
              <p className="text-[11px] text-white/40 text-center mt-4">Most wins first. Ties go to the most recent winner.</p>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
