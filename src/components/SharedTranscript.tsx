import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Scale, Trophy, XCircle, Radio } from 'lucide-react';
import { supabase } from '../integrations/supabase/client';
import type { TrialEvent, Verdict, CaseSession, Case } from '../types';
import { didPlayerWin, verdictLabel } from '../lib/verdictUtils';
import ScreenShell from './ScreenShell';
import { PANEL, PANEL_SOFT, gameButton } from './ui';

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
    case 'judge': return 'bg-purple-500/20 text-purple-200 border-purple-400/40';
    case 'prosecution': return 'bg-red-500/20 text-red-200 border-red-400/40';
    case 'defense': return 'bg-blue-500/20 text-blue-200 border-blue-400/40';
    case 'witness': return 'bg-yellow-500/20 text-yellow-200 border-yellow-400/40';
    case 'jury': return 'bg-green-500/20 text-green-200 border-green-400/40';
    default: return 'bg-white/10 text-white/70 border-white/20';
  }
}

const ROLE_BAR: Record<string, string> = {
  judge: 'border-l-purple-400/60',
  prosecution: 'border-l-red-400/60',
  defense: 'border-l-blue-400/60',
  witness: 'border-l-yellow-400/60',
  jury: 'border-l-green-400/60'
};

export default function SharedTranscript() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
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
      <ScreenShell title="TRANSCRIPT" onBack={() => navigate('/')} maxWidth="max-w-3xl lg:max-w-4xl">
        <div className="space-y-3" role="status" aria-label="Loading transcript">
          {[0, 1, 2].map(i => <div key={i} className={`${PANEL_SOFT} h-20 animate-pulse`} />)}
        </div>
      </ScreenShell>
    );
  }

  if (notFound || !session) {
    return (
      <ScreenShell title="NOT FOUND" onBack={() => navigate('/')} maxWidth="max-w-md">
        <div className={`${PANEL} text-center`}>
          <div className="mx-auto mb-3 w-14 h-14 rounded-full bg-white/10 flex items-center justify-center">
            <Scale className="w-7 h-7 text-white/50" />
          </div>
          <h2 className="font-game text-3xl leading-none text-white mb-2">TRANSCRIPT NOT FOUND</h2>
          <p className="text-white/60 text-sm mb-6">This trial either doesn't exist or isn't shared publicly.</p>
          <Link to="/" className={`${gameButton('gold', 'md')} w-full`}>PLAY COURTROOM QUEST</Link>
        </div>
      </ScreenShell>
    );
  }

  const sessionPlayerRole = (session.session_state as any)?.playerRole || 'defense';
  const isWin = verdict ? didPlayerWin(verdict.outcome, sessionPlayerRole) : false;
  const isLive = !session.completed_at;

  return (
    <ScreenShell
      title={isLive ? 'LIVE TRIAL' : 'SHARED TRIAL'}
      onBack={() => navigate('/watch')}
      maxWidth="max-w-3xl lg:max-w-4xl"
      right={isLive ? (
        <span className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/20 border border-red-400/50 rounded-full text-red-300 text-xs font-black">
          <Radio className="w-3 h-3 animate-pulse" />
          LIVE
        </span>
      ) : undefined}
    >
      {verdict && (
        <div className={`rounded-3xl p-5 mb-6 border-2 backdrop-blur-sm ${isWin ? 'bg-[#FFD43B]/10 border-[#FFD43B]/60 shadow-[0_0_28px_rgba(255,212,59,0.18)]' : 'bg-black/60 border-white/20'}`}>
          <div className="flex items-center gap-3 mb-3">
            {isWin ? <Trophy className="w-9 h-9 text-[#FFD43B] flex-none" /> : <XCircle className="w-9 h-9 text-white/50 flex-none" />}
            <div className="min-w-0">
              <h2 className="font-game text-3xl leading-none text-white">{caseData?.title || 'Trial'}</h2>
              <p className={`text-sm font-semibold mt-1 ${isWin ? 'text-[#FFD43B]' : 'text-white/60'}`}>
                Verdict: {verdictLabel(verdict.outcome)}{verdict.score !== undefined ? ` — Score: ${verdict.score}/100` : ''}
              </p>
            </div>
          </div>
          {verdict.reasoning && (
            <p className="text-white/75 text-sm leading-relaxed">{verdict.reasoning}</p>
          )}
        </div>
      )}

      {isLive && !verdict && (
        <div className={`${PANEL} mb-6`}>
          <h2 className="font-game text-3xl leading-none text-white">{caseData?.title || 'Trial'}</h2>
          <p className="text-white/60 text-sm mt-2">This trial is in progress — new statements will appear below as they happen.</p>
        </div>
      )}

      <h2 className="font-game text-2xl leading-none text-white mb-3">FULL TRANSCRIPT</h2>
      <div className="space-y-3 mb-8">
        {events.map((event) => (
          <div key={event.id} className={`${PANEL_SOFT} border-l-4 ${ROLE_BAR[event.speaker_role] || 'border-l-white/30'} p-4`}>
            <div className="flex items-center gap-2 mb-2">
              <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${getRoleColor(event.speaker_role)}`}>
                {getSpeakerDisplayName(event, isLive)}
              </span>
            </div>
            <p className="text-white/85 leading-relaxed whitespace-pre-wrap">{event.content}</p>
          </div>
        ))}
        {events.length === 0 && (
          <p className="text-white/50 text-sm text-center py-8">
            {isLive ? 'The trial is just getting started — check back in a moment.' : 'No transcript events recorded for this trial.'}
          </p>
        )}
      </div>

      <div className="text-center pb-4">
        <Link to="/" className={`${gameButton('gold', 'md')} w-full sm:w-auto`}>PLAY COURTROOM QUEST</Link>
      </div>
    </ScreenShell>
  );
}
