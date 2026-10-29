import { useEffect, useState } from 'react';
import { Gavel, Loader2, Shield } from 'lucide-react';
import ScreenShell from './ScreenShell';
import { db, type ChallengePreview } from '../lib/database';
import type { CaseSession, PlayerRole } from '../types';

interface Props {
  challengeId: string;
  /** null while nobody is signed in yet */
  userId: string | null;
  /** Start a guest account and continue (no email needed) */
  onPlayAsGuest: () => Promise<void>;
  onSignIn: () => void;
  onAccepted: (session: CaseSession) => void;
  onDismiss: () => void;
}

const BIG_GOLD =
  'font-game text-2xl bg-[#FFD43B] hover:bg-[#ffdc5e] text-black rounded-xl border-b-[5px] border-[#B8860B] active:translate-y-1 active:border-b-2 transition-all disabled:opacity-40 disabled:grayscale';
const PANEL = 'rounded-3xl bg-black/65 border border-white/15 p-5 backdrop-blur-sm';

function SideBadge({ role }: { role: PlayerRole }) {
  return role === 'defense' ? (
    <span className="inline-flex items-center gap-1 text-blue-400 font-semibold"><Shield className="w-4 h-4" /> Defense</span>
  ) : (
    <span className="inline-flex items-center gap-1 text-red-400 font-semibold"><Gavel className="w-4 h-4" /> Prosecution</span>
  );
}

/**
 * Where a challenge link lands. Anyone with the link can accept, as a guest or with an account,
 * so there is no email step. Shows the case and which side you would play, then joins.
 */
export default function ChallengeLink({ challengeId, userId, onPlayAsGuest, onSignIn, onAccepted, onDismiss }: Props) {
  const [preview, setPreview] = useState<ChallengePreview | null>(null);
  const [loading, setLoading] = useState(!!userId);
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    db.challenges
      .getChallengePreview(challengeId)
      .then(p => { if (!cancelled) setPreview(p); })
      .catch(err => {
        console.error('Failed to read the challenge link:', err);
        if (!cancelled) setError('We could not open this challenge. Check your connection and try again.');
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [challengeId, userId]);

  const accept = async () => {
    if (!userId) return;
    setWorking(true);
    setError(null);
    try {
      const session = await db.challenges.joinChallenge(challengeId, userId);
      onAccepted(session);
    } catch (err: any) {
      console.error('Failed to accept the challenge:', err);
      setError(err?.message || 'Could not accept this challenge.');
    } finally {
      setWorking(false);
    }
  };

  const guest = async () => {
    setWorking(true);
    try {
      await onPlayAsGuest();
    } finally {
      setWorking(false);
    }
  };

  // Not signed in yet: explain, and offer the quickest way in.
  if (!userId) {
    return (
      <ScreenShell title="YOU'VE BEEN CHALLENGED" subtitle="A friend wants to face you in court." onBack={onDismiss}>
        <div className={PANEL}>
          <p className="text-white/80 mb-5">
            Accept the challenge and you'll take the opposite side in a real two-player trial. No email needed: play as a guest
            in one tap, or sign in to keep your games and rank.
          </p>
          <button onClick={guest} disabled={working} className={`w-full px-4 py-3 mb-3 ${BIG_GOLD}`}>
            {working ? 'One moment…' : 'PLAY AS GUEST'}
          </button>
          <button
            onClick={onSignIn}
            className="w-full px-4 py-3 rounded-xl bg-white/10 hover:bg-white/15 border border-white/20 text-white font-bold transition-colors"
          >
            Sign in or create an account
          </button>
        </div>
      </ScreenShell>
    );
  }

  const open = preview?.status === 'open';
  const opponentRole: PlayerRole | null = preview ? (preview.creator_role === 'defense' ? 'prosecution' : 'defense') : null;

  return (
    <ScreenShell title="YOU'VE BEEN CHALLENGED" subtitle="Accept to start a two-player trial." onBack={onDismiss}>
      <div className={PANEL}>
        {loading ? (
          <p className="flex items-center gap-2 text-white/70"><Loader2 className="w-4 h-4 animate-spin" /> Opening the challenge…</p>
        ) : !preview ? (
          <>
            <p className="text-white mb-4">{error || "This challenge couldn't be found. The link may be wrong or incomplete."}</p>
            <button onClick={onDismiss} className={`w-full px-4 py-3 ${BIG_GOLD}`}>OK</button>
          </>
        ) : preview.is_mine ? (
          <>
            <p className="text-white font-semibold mb-1">{preview.case_title || 'Case'}</p>
            <p className="text-white/70 text-sm mb-4">
              This is your own challenge link. Send it to your friend; they'll be the one to accept it. You'll find the game under My games once they do.
            </p>
            <button onClick={onDismiss} className={`w-full px-4 py-3 ${BIG_GOLD}`}>OK</button>
          </>
        ) : !open ? (
          <>
            <p className="text-white font-semibold mb-1">{preview.case_title || 'Case'}</p>
            <p className="text-white/70 text-sm mb-4">This challenge is no longer open: it was already accepted or cancelled.</p>
            <button onClick={onDismiss} className={`w-full px-4 py-3 ${BIG_GOLD}`}>OK</button>
          </>
        ) : (
          <>
            <h2 className="font-game text-3xl text-white leading-none mb-2">{preview.case_title || 'Case'}</h2>
            <p className="text-white/70 text-sm mb-1">
              {preview.creator_name ? <span className="text-white font-semibold">{preview.creator_name}</span> : 'Your friend'} will play{' '}
              <SideBadge role={preview.creator_role} />.
            </p>
            <p className="text-white/70 text-sm mb-5">
              You'd play {opponentRole && <SideBadge role={opponentRole} />}. A real person decides every move on both sides, so a game can take a while:
              it waits for whoever's turn it is.
            </p>
            {error && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-300 text-sm rounded-lg p-3 mb-4">{error}</div>
            )}
            <button onClick={accept} disabled={working} className={`w-full px-4 py-3 mb-3 ${BIG_GOLD}`}>
              {working ? 'Joining…' : 'ACCEPT CHALLENGE'}
            </button>
            <button
              onClick={onDismiss}
              className="w-full px-4 py-3 rounded-xl bg-white/10 hover:bg-white/15 border border-white/20 text-white font-bold transition-colors"
            >
              Not now
            </button>
          </>
        )}
      </div>
    </ScreenShell>
  );
}
