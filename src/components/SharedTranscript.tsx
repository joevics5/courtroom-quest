import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Scale, Trophy, XCircle, Loader2, Radio } from 'lucide-react';
import { supabase } from '../integrations/supabase/client';
import type { TrialEvent, Verdict, CaseSession, Case } from '../types';

function getSpeakerDisplayName(event: TrialEvent, isLive: boolean) {
  // Live trials hide real account names from spectators — only the
  // players themselves see who's who while it's in progress. Finished,
  // explicitly-shared trials still show whatever name was recorded.
  if (isLive && (event.speaker_role === 'prosecution' || event.speaker_role === 'defense')) {
    return event.speaker_role === 'prosecution' ? 'Prosecution' : 'Defense';
  }
  if (event.speaker_name) return event.speaker_name;
  switch (event.speaker_role) {
    case 'judge': return 'Judge';
    case 'prosecution': return 'Prosecution';
    case 'defense': return 'Defense';
    case 'witness': return 'Witness';
    case 'jury': return 'Jury';
    default: return 'Unknown';
  }
}

function getRoleColor(role: string) {
  switch (role) {
    case 'judge': return 'bg-purple-500/20 text-purple-300 border-purple-500/30';
    case 'prosecution': return 'bg-red-500/20 text-red-300 border-red-500/30';
    case 'defense': return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
    case 'witness': return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30';
    case 'jury': return 'bg-green-500/20 text-green-300 border-green-500/30';
    default: return 'bg-slate-500/20 text-slate-300 border-slate-500/30';
  }
}

export default function SharedTranscript() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [session, setSession] = useState<CaseSession | null>(null);
  const [caseData, setCaseData] = useState<Case | null>(null);
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [events, setEvents] = useState<TrialEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  // Ref mirror of session so the polling interval (set up once) always
  // checks the latest completed_at without needing to be re-created.
  const sessionRef = useRef<CaseSession | null>(null);

  const load = useCallback(async (isInitial: boolean) => {
    if (!sessionId) return;
    try {
      // No explicit is_shared/allow_spectators filter here — RLS already
      // only returns this row at all if one of those flags is true, so
      // this naturally covers both "finished & shared" and "live &
      // spectatable" without needing to know which case it is up front.
      const { data: sessionData, error: sessionError } = await supabase
        .from('case_sessions')
        .select('*')
        .eq('id', sessionId)
        .single();

      if (sessionError || !sessionData) {
        if (isInitial) setNotFound(true);
        return;
      }
      setSession(sessionData as CaseSession);
      sessionRef.current = sessionData as CaseSession;

      const [{ data: caseRow }, { data: verdictRow }, { data: eventRows }] = await Promise.all([
        isInitial ? supabase.from('cases').select('*').eq('id', sessionData.case_id).single() : Promise.resolve({ data: caseData }),
        supabase.from('verdicts').select('*').eq('session_id', sessionId).maybeSingle(),
        supabase.from('trial_events').select('*').eq('session_id', sessionId).order('event_order', { ascending: true })
      ]);

      if (isInitial) setCaseData((caseRow as Case) || null);
      setVerdict((verdictRow as Verdict) || null);
      setEvents((eventRows as TrialEvent[]) || []);
    } catch (error) {
      console.error('Failed to load shared transcript:', error);
      if (isInitial) setNotFound(true);
    } finally {
      if (isInitial) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  useEffect(() => {
    load(true);
  }, [load]);

  useEffect(() => {
    // Keep polling for new events while the trial hasn't concluded yet —
    // same lightweight polling approach the rest of the app already uses
    // for multiplayer sync, rather than adding a realtime subscription.
    const interval = setInterval(() => {
      if (!sessionRef.current?.completed_at) {
        load(false);
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [load]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-white/40 animate-spin" />
      </div>
    );
  }

  if (notFound || !session) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="text-center max-w-sm">
          <Scale className="w-12 h-12 text-white/30 mx-auto mb-4" />
          <h1 className="text-white text-xl font-bold mb-2">Transcript Not Found</h1>
          <p className="text-white/50 text-sm mb-6">This trial either doesn't exist or isn't shared publicly.</p>
          <Link to="/" className="inline-block px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-semibold text-sm transition-colors">
            Play Courtroom Quest
          </Link>
        </div>
      </div>
    );
  }

  const isWin = verdict?.outcome === 'win';
  const isLive = !session.completed_at;

  return (
    <div className="min-h-screen bg-slate-900">
      <div className="max-w-3xl mx-auto p-4 sm:p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Scale className="w-5 h-5 text-amber-400" />
            <span className="text-white/50 text-sm">Courtroom Quest — {isLive ? 'Live Trial' : 'Shared Trial'}</span>
          </div>
          {isLive && (
            <span className="flex items-center gap-1.5 px-2.5 py-1 bg-red-500/15 border border-red-500/30 rounded-full text-red-400 text-xs font-semibold">
              <Radio className="w-3 h-3 animate-pulse" />
              LIVE
            </span>
          )}
        </div>

        {verdict && (
          <div className={`rounded-2xl p-6 mb-6 border-2 ${isWin ? 'bg-gradient-to-br from-amber-600/20 to-yellow-500/10 border-amber-500/40' : 'bg-gradient-to-br from-slate-700/40 to-slate-800/40 border-slate-600/40'}`}>
            <div className="flex items-center gap-3 mb-3">
              {isWin ? <Trophy className="w-8 h-8 text-amber-400" /> : <XCircle className="w-8 h-8 text-slate-400" />}
              <div>
                <h1 className="text-white text-xl font-bold">{caseData?.title || 'Trial'}</h1>
                <p className={`text-sm font-semibold ${isWin ? 'text-amber-400' : 'text-slate-400'}`}>
                  Verdict: {isWin ? 'Not Guilty' : 'Guilty'}{verdict.score !== undefined ? ` — Score: ${verdict.score}/100` : ''}
                </p>
              </div>
            </div>
            {verdict.reasoning && (
              <p className="text-white/70 text-sm leading-relaxed">{verdict.reasoning}</p>
            )}
          </div>
        )}

        {isLive && !verdict && (
          <div className="mb-6">
            <h1 className="text-white text-xl font-bold">{caseData?.title || 'Trial'}</h1>
            <p className="text-white/50 text-sm mt-1">This trial is in progress — new statements will appear below as they happen.</p>
          </div>
        )}

        <h2 className="text-white/80 font-semibold text-sm mb-3">Full Transcript</h2>
        <div className="space-y-3 mb-8">
          {events.map((event) => (
            <div key={event.id} className="bg-white/5 border border-white/10 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className={`text-xs font-semibold px-2 py-0.5 rounded border ${getRoleColor(event.speaker_role)}`}>
                  {getSpeakerDisplayName(event, isLive)}
                </span>
              </div>
              <p className="text-white/80 text-sm leading-relaxed whitespace-pre-wrap">{event.content}</p>
            </div>
          ))}
          {events.length === 0 && (
            <p className="text-white/40 text-sm text-center py-8">
              {isLive ? 'The trial is just getting started — check back in a moment.' : 'No transcript events recorded for this trial.'}
            </p>
          )}
        </div>

        <div className="text-center pb-8">
          <Link to="/" className="inline-block px-6 py-3 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-semibold text-sm transition-colors">
            Play Courtroom Quest
          </Link>
        </div>
      </div>
    </div>
  );
}
