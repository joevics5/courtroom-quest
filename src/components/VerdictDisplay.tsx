import { useState, useEffect } from 'react';
import { CheckCircle, FileText, Home, Share2, XCircle } from 'lucide-react';
import type { Verdict, TrialEvent, PlayerRole } from '../types';
import { db } from '../lib/database';
import { didPlayerWin, verdictLabel } from '../lib/verdictUtils';
import TranscriptViewer from './TranscriptViewer';
import { JuryVoteHistory } from './JuryDeliberation';
import AvatarFace from './AvatarFace';
import SceneBackdrop from './SceneBackdrop';
import { gameButton, PANEL_SOFT } from './ui';
import { useAuth } from '../contexts/AuthContext';
import { getUserAvatar } from '../lib/avatars';
import { LEVELS, getLevelForWins, getNextLevel, getRankProgress } from '../lib/levels';
import type { JuryRound } from '../lib/ai/trialAI';

interface VerdictDisplayProps {
  verdict: Verdict;
  caseTitle: string;
  currentLevel: string;
  playerRole: PlayerRole;
  /** Cases won so far (after this one): shows rank progress and a NEW RANK badge. */
  wins?: number;
  onReturnHome: () => void;
}

export default function VerdictDisplay({ verdict, caseTitle, currentLevel, playerRole, wins, onReturnHome }: VerdictDisplayProps) {
  const { user } = useAuth();
  // isWin reflects whether the PLAYER won their case, not the raw AI
  // outcome field (which is an absolute guilty/not-guilty call and means
  // the opposite thing for a defense player vs. a prosecution player).
  const isWin = didPlayerWin(verdict.outcome, playerRole);
  const verdictWord = verdictLabel(verdict.outcome);
  const [shareMessage, setShareMessage] = useState('');
  const [showTranscript, setShowTranscript] = useState(false);
  const [transcriptEvents, setTranscriptEvents] = useState<TrialEvent[]>([]);
  const [loadingTranscript, setLoadingTranscript] = useState(false);
  const [juryRounds, setJuryRounds] = useState<JuryRound[]>([]);

  // Jury trials record each juror's ballot per round — show how they voted.
  useEffect(() => {
    let cancelled = false;
    db.sessions.getSession(verdict.session_id)
      .then(sess => {
        const votes = (sess?.session_state as any)?.juryVotes;
        if (!cancelled && Array.isArray(votes)) setJuryRounds(votes as JuryRound[]);
      })
      .catch(err => console.error('Failed to load jury votes:', err));
    return () => { cancelled = true; };
  }, [verdict.session_id]);

  const loadTranscript = async () => {
    if (transcriptEvents.length > 0) {
      setShowTranscript(true);
      return;
    }

    try {
      setLoadingTranscript(true);
      const events = await db.trialEvents.getSessionEvents(verdict.session_id);
      setTranscriptEvents(events);
      setShowTranscript(true);
    } catch (error) {
      console.error('Failed to load transcript:', error);
      alert('Failed to load transcript. Please try again.');
    } finally {
      setLoadingTranscript(false);
    }
  };

  const handleShare = async () => {
    // Mark the session shared so the public /share/:id route can read it —
    // best-effort; if it fails we still share the text-only summary.
    let shareUrl = '';
    try {
      await db.sessions.updateSession(verdict.session_id, { is_shared: true });
      shareUrl = `${window.location.origin}/share/${verdict.session_id}`;
    } catch (error) {
      console.error('Failed to enable transcript sharing:', error);
    }

    const shareText = `🏛️ CASE WON!\n\n${caseTitle}\nVerdict: ${verdictWord}\nRank Achieved: ${currentLevel}\nScore: ${verdict.score || 0}/100\n\nPlay AI Courtroom now!${shareUrl ? `\n\nSee the full trial: ${shareUrl}` : ''}`;

    if (navigator.share) {
      try {
        await navigator.share({ text: shareText, url: shareUrl || undefined });
      } catch (err) {
        console.log('Share cancelled');
      }
    } else {
      navigator.clipboard.writeText(shareText);
      setShareMessage('Copied to clipboard!');
      setTimeout(() => setShareMessage(''), 2000);
    }
  };

  // ---- what the player sees ----
  const myAvatar = getUserAvatar(user);
  const rankTitle = wins !== undefined ? getLevelForWins(wins).title : currentLevel;
  const rankLevel = wins !== undefined ? getLevelForWins(wins).level : Math.max(1, LEVELS.findIndex(l => l.title === currentLevel) + 1);
  // Wins is already counted for this case, so landing exactly on a rank's threshold means just promoted.
  const rankedUp = isWin && wins !== undefined && LEVELS.some(l => l.level > 1 && l.wins === wins);
  const next = wins !== undefined ? getNextLevel(wins) : null;
  const hasScore = typeof verdict.score === 'number';

  return (
    <div className="relative min-h-[100dvh] bg-[#0b0d14] overflow-x-hidden">
      <SceneBackdrop />
      <div
        className="relative z-10 px-4 sm:px-6"
        style={{ paddingTop: 'max(env(safe-area-inset-top), 20px)', paddingBottom: 'max(env(safe-area-inset-bottom), 32px)' }}
      >
        <div className="max-w-2xl mx-auto space-y-5">
          {/* result */}
          <section className="text-center">
            <div
              className={`mx-auto w-40 h-40 sm:w-48 sm:h-48 rounded-3xl overflow-hidden border-4 ${
                isWin
                  ? 'border-[#FFD43B] shadow-[0_8px_0_#B8860B,0_0_44px_rgba(255,212,59,0.5)]'
                  : 'border-white/30 shadow-[0_8px_0_rgba(0,0,0,0.5)]'
              }`}
            >
              <div className={isWin ? 'w-full h-full' : 'w-full h-full saturate-50 brightness-90'}>
                <AvatarFace config={myAvatar} rank={rankLevel} label="Your avatar" />
              </div>
            </div>
            <h1
              className={`mt-6 font-game text-6xl sm:text-7xl leading-none ${
                isWin ? 'logo-gold' : 'text-[#FF7A7E] drop-shadow-[0_3px_0_rgba(0,0,0,0.6)]'
              }`}
            >
              {isWin ? 'VICTORY' : 'DEFEAT'}
            </h1>
            <p className="mt-2 text-white/60">The court has delivered its verdict</p>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              <span className="rounded-full bg-black/55 border border-white/20 px-4 py-1.5 font-game text-xl leading-none text-white">
                {rankTitle}
              </span>
              {rankedUp && (
                <span className="rounded-full bg-[#FFD43B] px-3 py-1.5 font-game text-xl leading-none text-black shadow-[0_0_18px_rgba(255,212,59,0.55)]">
                  NEW RANK!
                </span>
              )}
            </div>
            {next && (
              <div className="mt-3 mx-auto max-w-xs">
                <div className="h-2 rounded-full bg-white/15 overflow-hidden" aria-hidden="true">
                  <div className="h-full rounded-full bg-[#FFD43B]" style={{ width: `${Math.round(getRankProgress(wins!) * 100)}%` }} />
                </div>
                <p className="mt-1.5 text-xs text-white/60">
                  {next.winsNeeded} more {next.winsNeeded === 1 ? 'win' : 'wins'} to {next.nextTitle}
                </p>
              </div>
            )}
          </section>

          {/* the decision */}
          <section className={`${PANEL_SOFT} overflow-hidden`}>
            <div className="px-5 py-4 border-b border-white/10">
              <p className="text-xs uppercase tracking-wider text-white/50">Case</p>
              <h2 className="text-lg font-semibold text-white leading-snug">{caseTitle}</h2>
            </div>

            <div className="p-5 space-y-6">
              <div>
                <h3 className="font-game text-xl text-white/90 leading-none mb-2">OUTCOME</h3>
                <div
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl border ${
                    isWin ? 'bg-[#2EC4B6]/10 border-[#2EC4B6]/40 text-[#5EEAD4]' : 'bg-[#E5484D]/10 border-[#E5484D]/40 text-[#FF9A9D]'
                  }`}
                >
                  {isWin ? <CheckCircle className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
                  <span className="font-semibold">
                    {verdictWord} — {isWin ? 'You Won' : 'You Lost'}
                  </span>
                </div>
              </div>

              {hasScore && (
                <div>
                  <h3 className="font-game text-xl text-white/90 leading-none mb-2">PERFORMANCE SCORE</h3>
                  <div className="flex items-center gap-4">
                    <div className="flex-1 bg-white/15 rounded-full h-3 overflow-hidden">
                      <div
                        className={`h-full transition-all ${
                          verdict.score! >= 80 ? 'bg-[#2EC4B6]' : verdict.score! >= 60 ? 'bg-[#FFD43B]' : 'bg-[#E5484D]'
                        }`}
                        style={{ width: `${Math.min(100, Math.max(0, verdict.score!))}%` }}
                      />
                    </div>
                    <span className="font-game text-4xl leading-none text-white">{verdict.score}</span>
                  </div>
                </div>
              )}

              <div>
                <h3 className="font-game text-xl text-white/90 leading-none mb-2">THE JUDGE'S REASONING</h3>
                <div className="rounded-xl bg-black/35 border border-white/10 p-4">
                  <p className="text-white/90 leading-relaxed whitespace-pre-line">{verdict.reasoning}</p>
                </div>
              </div>

              {juryRounds.length > 0 && (
                <div>
                  <h3 className="font-game text-xl text-white/90 leading-none mb-2">HOW THE JURY VOTED</h3>
                  <div className="rounded-xl bg-black/35 border border-white/10 p-4">
                    <JuryVoteHistory rounds={juryRounds} />
                  </div>
                </div>
              )}

              {verdict.evidence_cited && verdict.evidence_cited.length > 0 && (
                <div>
                  <h3 className="font-game text-xl text-white/90 leading-none mb-2">EVIDENCE CITED</h3>
                  <div className="flex flex-wrap gap-2">
                    {verdict.evidence_cited.map((exhibit, idx) => (
                      <span key={idx} className="px-3 py-1 rounded-full bg-[#8B5CF6]/15 border border-[#8B5CF6]/40 text-[#C4B5FD] text-sm font-medium">
                        {exhibit}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {verdict.missed_opportunities && verdict.missed_opportunities.length > 0 && (
                <div>
                  <h3 className="font-game text-xl text-[#FFD43B] leading-none mb-2">MISSED OPPORTUNITIES</h3>
                  <div className="rounded-xl bg-[#FFD43B]/10 border border-[#FFD43B]/30 p-4">
                    <ul className="space-y-2">
                      {verdict.missed_opportunities.map((opportunity, idx) => (
                        <li key={idx} className="text-white/90 text-sm flex items-start gap-2">
                          <span className="text-[#FFD43B] mt-0.5">•</span>
                          <span>{opportunity}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* what next */}
          <div className="space-y-3">
            <button onClick={onReturnHome} className={`${gameButton('gold', 'md')} w-full`}>
              <Home className="w-6 h-6" />
              RETURN TO CASES
            </button>
            <div className={`grid gap-3 ${isWin ? 'grid-cols-2' : 'grid-cols-1'}`}>
              {isWin && (
                <button onClick={handleShare} className={gameButton('outline', 'sm')}>
                  <Share2 className="w-5 h-5" />
                  SHARE VICTORY
                </button>
              )}
              <button onClick={loadTranscript} disabled={loadingTranscript} className={gameButton('ghost', 'sm')}>
                <FileText className="w-5 h-5" />
                {loadingTranscript ? 'LOADING...' : 'VIEW TRANSCRIPT'}
              </button>
            </div>
            {shareMessage && (
              <p role="status" className="text-center text-[#FFD43B] text-sm">
                {shareMessage}
              </p>
            )}
          </div>
        </div>
      </div>

      {showTranscript && (
        <TranscriptViewer events={transcriptEvents} caseTitle={caseTitle} onClose={() => setShowTranscript(false)} />
      )}
    </div>
  );
}
