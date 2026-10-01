import { useState, useEffect } from 'react';
import { Crown, Star, Loader2 } from 'lucide-react';
import { db } from '../lib/database';
import { getCaseOfTheWeek } from '../lib/trialConfig';
import { maskPublicName } from '../lib/userName';
import { playGavelTap } from '../lib/soundEffects';
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
          const scores = await db.caseWinners.getCaseLeaderboard(featured.id, 3);
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
      <div className="rounded-3xl bg-black/60 border border-white/10 p-8 flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-white/50 animate-spin" />
      </div>
    );
  }

  if (!featuredCase) return null;

  return (
    <div className="rounded-3xl bg-black/65 border-2 border-[#F2B705]/70 p-5 backdrop-blur-sm">
      <div className="inline-flex items-center gap-1.5 rounded-full bg-[#FFD43B] text-black px-3 py-1 text-[11px] font-black tracking-[0.15em]">
        <Star className="w-3.5 h-3.5 fill-black" />
        CASE OF THE WEEK
      </div>

      <h3 className="font-game text-4xl text-white leading-none mt-3">{featuredCase.title}</h3>
      <p className="text-white/70 text-sm mt-2 line-clamp-2">{featuredCase.description}</p>

      {leaderboard.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {leaderboard.map((winner, i) => (
            <span key={winner.id} className="inline-flex items-center gap-1.5 rounded-full bg-white/10 border border-white/10 px-3 py-1 text-xs text-white">
              {i === 0 && <Crown className="w-3.5 h-3.5 text-[#FFD43B]" />}
              <span className="font-semibold">{maskPublicName(winner.username)}</span>
              <span className="text-[#FFD43B] font-bold">{winner.verdict_score}</span>
            </span>
          ))}
        </div>
      )}

      <button
        onClick={() => {
          playGavelTap();
          onPlayCase(featuredCase.id);
        }}
        className="mt-5 w-full rounded-2xl bg-[#FFD43B] text-black font-game text-3xl py-3 border-b-[6px] border-[#B8860B] active:translate-y-1 active:border-b-2 transition-all"
      >
        PLAY THIS CASE
      </button>
    </div>
  );
}
