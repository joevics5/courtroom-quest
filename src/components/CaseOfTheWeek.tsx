import { useState, useEffect } from 'react';
import { Star, Trophy, Loader2 } from 'lucide-react';
import { db } from '../lib/database';
import { getCaseOfTheWeek } from '../lib/trialConfig';
import { playGavelTap } from '../lib/soundEffects';
import CaseWinners from './CaseWinners';
import type { Case } from '../types';

interface Props {
  onPlayCase: (caseId: string) => void;
}

export default function CaseOfTheWeek({ onPlayCase }: Props) {
  const [featuredCase, setFeaturedCase] = useState<Case | null>(null);
  const [loading, setLoading] = useState(true);
  const [showWinners, setShowWinners] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const cases = await db.cases.getPresetCases();
        setFeaturedCase(getCaseOfTheWeek(cases));
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
      <div className="flex items-center justify-between gap-3">
        <div className="inline-flex items-center gap-1.5 rounded-full bg-[#FFD43B] text-black px-3 py-1 text-[11px] font-black tracking-[0.15em]">
          <Star className="w-3.5 h-3.5 fill-black" />
          CASE OF THE WEEK
        </div>
        <button
          onClick={() => setShowWinners(true)}
          aria-label="View winners"
          title="View winners"
          className="flex-none flex items-center justify-center w-10 h-10 rounded-full bg-white/10 border border-white/15 text-[#FFD43B] hover:bg-white/15 transition-colors"
        >
          <Trophy className="w-5 h-5" />
        </button>
      </div>

      <h3 className="font-game text-4xl text-white leading-none mt-3">{featuredCase.title}</h3>
      <p className="text-white/70 text-sm mt-2 line-clamp-2">{featuredCase.description}</p>

      <button
        onClick={() => {
          playGavelTap();
          onPlayCase(featuredCase.id);
        }}
        className="mt-5 w-full rounded-2xl bg-[#FFD43B] text-black font-game text-3xl py-3 border-b-[6px] border-[#B8860B] active:translate-y-1 active:border-b-2 transition-all"
      >
        PLAY THIS CASE
      </button>

      {showWinners && (
        <CaseWinners caseId={featuredCase.id} caseTitle={featuredCase.title} onClose={() => setShowWinners(false)} />
      )}
    </div>
  );
}
