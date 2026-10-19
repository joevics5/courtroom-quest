import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Radio, Trophy, XCircle, ChevronRight, Tv } from 'lucide-react';
import { supabase } from '../integrations/supabase/client';
import type { CaseSession, Case, Outcome } from '../types';
import { didPlayerWin, verdictLabel } from '../lib/verdictUtils';
import ScreenShell from './ScreenShell';
import { PANEL_SOFT, gameButton } from './ui';

interface ListedSession extends CaseSession {
  cases?: Case;
  outcome?: Outcome;
}

function SectionTitle({ children, icon }: { children: string; icon?: React.ReactNode }) {
  return (
    <h2 className="flex items-center gap-2 font-game text-2xl leading-none text-white mb-3 uppercase">
      {icon}
      {children}
    </h2>
  );
}

function EmptyCard({ icon, children }: { icon: React.ReactNode; children: string }) {
  return (
    <div className={`${PANEL_SOFT} p-6 text-center mb-8`}>
      <div className="mx-auto mb-2 w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white/50">{icon}</div>
      <p className="text-white/55 text-sm">{children}</p>
    </div>
  );
}

export default function WatchBoard() {
  const navigate = useNavigate();
  const [live, setLive] = useState<ListedSession[]>([]);
  const [recent, setRecent] = useState<ListedSession[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [{ data: liveRows }, { data: recentRows }] = await Promise.all([
          supabase
            .from('case_sessions')
            .select('*, cases(*)')
            .eq('allow_spectators', true)
            .is('completed_at', null)
            .order('updated_at', { ascending: false })
            .limit(20),
          supabase
            .from('case_sessions')
            .select('*, cases(*), verdicts(outcome)')
            .eq('is_shared', true)
            .not('completed_at', 'is', null)
            .order('completed_at', { ascending: false })
            .limit(20)
        ]);

        setLive((liveRows as ListedSession[]) || []);
        setRecent(
          ((recentRows as any[]) || []).map(row => ({
            ...row,
            outcome: row.verdicts?.[0]?.outcome
          }))
        );
      } catch (error) {
        console.error('Failed to load watch board:', error);
      } finally {
        setLoading(false);
      }
    };

    load();
    const interval = setInterval(load, 8000);
    return () => clearInterval(interval);
  }, []);

  return (
    <ScreenShell
      title="WATCH"
      subtitle="Follow a trial as it happens, or catch up on ones that already wrapped."
      onBack={() => navigate('/')}
    >
      {loading ? (
        <div className="space-y-3" role="status" aria-label="Loading trials">
          {[0, 1, 2].map(i => (
            <div key={i} className={`${PANEL_SOFT} h-16 animate-pulse`} />
          ))}
        </div>
      ) : (
        <>
          <SectionTitle icon={<Radio className="w-5 h-5 text-red-400" />}>Live Now</SectionTitle>
          {live.length === 0 ? (
            <EmptyCard icon={<Tv className="w-5 h-5" />}>No live trials open to spectators right now.</EmptyCard>
          ) : (
            <div className="space-y-3 lg:space-y-0 lg:grid lg:grid-cols-2 lg:gap-4 mb-8">
              {live.map((s) => (
                <Link
                  key={s.id}
                  to={`/share/${s.id}`}
                  className={`${PANEL_SOFT} flex items-center gap-3 p-4 border-red-400/40 active:bg-white/10 transition-colors`}
                >
                  <p className="flex-1 min-w-0 text-white font-semibold truncate">{s.cases?.title || 'Trial'}</p>
                  <span className="flex items-center gap-1.5 px-2.5 py-1 bg-red-500/20 border border-red-400/50 rounded-full text-red-300 text-xs font-black shrink-0">
                    <Radio className="w-3 h-3 animate-pulse" />
                    LIVE
                  </span>
                  <ChevronRight className="w-5 h-5 text-white/40 shrink-0" />
                </Link>
              ))}
            </div>
          )}

          <SectionTitle>Recently Finished</SectionTitle>
          {recent.length === 0 ? (
            <EmptyCard icon={<Trophy className="w-5 h-5" />}>No shared trials yet — finish a trial and choose to share it to see it here.</EmptyCard>
          ) : (
            <div className="space-y-3 lg:space-y-0 lg:grid lg:grid-cols-2 lg:gap-4 mb-8">
              {recent.map((s) => (
                <Link
                  key={s.id}
                  to={`/share/${s.id}`}
                  className={`${PANEL_SOFT} flex items-center gap-3 p-4 active:bg-white/10 transition-colors`}
                >
                  <p className="flex-1 min-w-0 text-white font-semibold truncate">{s.cases?.title || 'Trial'}</p>
                  {s.outcome && (() => {
                    const sessionPlayerRole = (s.session_state as any)?.playerRole || 'defense';
                    const playerWon = didPlayerWin(s.outcome, sessionPlayerRole);
                    return (
                      <span className={`flex items-center gap-1.5 text-xs font-black shrink-0 ${playerWon ? 'text-[#FFD43B]' : 'text-white/50'}`}>
                        {playerWon ? <Trophy className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                        {verdictLabel(s.outcome)}
                      </span>
                    );
                  })()}
                  <ChevronRight className="w-5 h-5 text-white/40 shrink-0" />
                </Link>
              ))}
            </div>
          )}
        </>
      )}

      <div className="text-center pt-2 pb-6">
        <Link to="/" className={`${gameButton('gold', 'md')} w-full sm:w-auto`}>
          PLAY COURTROOM QUEST
        </Link>
      </div>
    </ScreenShell>
  );
}
