import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Scale, Radio, Trophy, XCircle, Loader2 } from 'lucide-react';
import { supabase } from '../integrations/supabase/client';
import type { CaseSession, Case } from '../types';

interface ListedSession extends CaseSession {
  cases?: Case;
  outcome?: 'win' | 'loss';
}

export default function WatchBoard() {
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
    <div className="min-h-screen bg-slate-900">
      <div className="max-w-3xl mx-auto p-4 sm:p-6">
        <div className="flex items-center gap-2 mb-2">
          <Scale className="w-5 h-5 text-amber-400" />
          <h1 className="text-white text-xl font-bold">Watch Courtroom Quest</h1>
        </div>
        <p className="text-white/50 text-sm mb-8">
          Follow a trial as it happens, or catch up on ones that already wrapped.
        </p>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-8 h-8 text-white/40 animate-spin" />
          </div>
        ) : (
          <>
            <h2 className="text-white/80 font-semibold text-sm mb-3 flex items-center gap-2">
              <Radio className="w-4 h-4 text-red-400" />
              Live Now
            </h2>
            {live.length === 0 ? (
              <div className="bg-white/5 border border-white/10 rounded-lg p-6 text-center mb-8">
                <p className="text-white/50 text-sm">No live trials open to spectators right now.</p>
              </div>
            ) : (
              <div className="space-y-3 mb-8">
                {live.map((s) => (
                  <Link
                    key={s.id}
                    to={`/share/${s.id}`}
                    className="block bg-white/5 hover:bg-white/10 border border-red-500/20 rounded-lg p-4 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-white font-semibold text-sm truncate">{s.cases?.title || 'Trial'}</p>
                      <span className="flex items-center gap-1.5 px-2 py-0.5 bg-red-500/15 border border-red-500/30 rounded-full text-red-400 text-xs font-semibold shrink-0">
                        <Radio className="w-3 h-3 animate-pulse" />
                        LIVE
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}

            <h2 className="text-white/80 font-semibold text-sm mb-3">Recently Finished</h2>
            {recent.length === 0 ? (
              <div className="bg-white/5 border border-white/10 rounded-lg p-6 text-center">
                <p className="text-white/50 text-sm">No shared trials yet — finish a trial and choose to share it to see it here.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {recent.map((s) => (
                  <Link
                    key={s.id}
                    to={`/share/${s.id}`}
                    className="block bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg p-4 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-white font-semibold text-sm truncate">{s.cases?.title || 'Trial'}</p>
                      {s.outcome && (
                        <span className={`flex items-center gap-1.5 text-xs font-semibold shrink-0 ${s.outcome === 'win' ? 'text-amber-400' : 'text-slate-400'}`}>
                          {s.outcome === 'win' ? <Trophy className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                          {s.outcome === 'win' ? 'Not Guilty' : 'Guilty'}
                        </span>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </>
        )}

        <div className="text-center pt-8 pb-8">
          <Link to="/" className="inline-block px-6 py-3 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-semibold text-sm transition-colors">
            Play Courtroom Quest
          </Link>
        </div>
      </div>
    </div>
  );
}
