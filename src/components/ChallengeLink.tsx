import { Trans, useTranslation } from 'react-i18next';
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
  /** Go to the case file section (My games), where waiting and running challenges live */
  onViewGames?: () => void;
}

const BIG_GOLD =
  'font-game text-2xl bg-[#FFD43B] hover:bg-[#ffdc5e] text-black rounded-xl border-b-[5px] border-[#B8860B] active:translate-y-1 active:border-b-2 transition-all disabled:opacity-40 disabled:grayscale';
const PANEL = 'rounded-3xl bg-black/65 border border-white/15 p-5 backdrop-blur-sm';

function SideBadge({ role }: { role: PlayerRole }) {
  const { t } = useTranslation();
  return role === 'defense' ? (
    <span className="inline-flex items-center gap-1 text-blue-400 font-semibold"><Shield className="w-4 h-4" /> {t('roles.defense')}</span>
  ) : (
    <span className="inline-flex items-center gap-1 text-red-400 font-semibold"><Gavel className="w-4 h-4" /> {t('roles.prosecution')}</span>
  );
}

/**
 * Where a challenge link lands. Anyone with the link can accept, as a guest or with an account,
 * so there is no email step. Shows the case and which side you would play, then joins.
 */
export default function ChallengeLink({ challengeId, userId, onPlayAsGuest, onSignIn, onAccepted, onDismiss, onViewGames }: Props) {
  const { t } = useTranslation();
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
        if (!cancelled) setError(t('challengeLink.errOpen'));
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [challengeId, userId]);

  const accept = async () => {
    if (!userId) return;
    setWorking(true);
    setError(null);
    try {
      const session = await db.challenges.joinChallenge(challengeId);
      onAccepted(session);
    } catch (err: any) {
      console.error('Failed to accept the challenge:', err);
      setError(err?.message || t('challengeLink.errAccept'));
    } finally {
      setWorking(false);
    }
  };

  // The challenge is already accepted and I'm one of the two players: go into the game.
  const openGame = async () => {
    if (!preview?.session_id) return;
    setWorking(true);
    setError(null);
    try {
      const session = await db.sessions.getSession(preview.session_id);
      if (!session) throw new Error('missing');
      onAccepted(session);
    } catch (err) {
      console.error('Failed to open the accepted game:', err);
      setError(t('challengeLink.errGame'));
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
      <ScreenShell wrapTitle title={t('challengeLink.title')} subtitle={t('challengeLink.subGuest')} onBack={onDismiss}>
        <div className={PANEL}>
          <p className="text-white/80 mb-5">
            {t('challengeLink.guestBody')}
          </p>
          <button onClick={guest} disabled={working} className={`w-full px-4 py-3 mb-3 ${BIG_GOLD}`}>
            {working ? t('challengeLink.oneMoment') : t('challengeLink.playGuest')}
          </button>
          <button
            onClick={onSignIn}
            className="w-full px-4 py-3 rounded-xl bg-white/10 hover:bg-white/15 border border-white/20 text-white font-bold transition-colors"
          >
            {t('challengeLink.signInCreate')}
          </button>
        </div>
      </ScreenShell>
    );
  }

  const open = preview?.status === 'open';
  const accepted = preview?.status === 'matched';
  const isPlayer = !!preview && (preview.is_mine || !!preview.is_opponent);
  const opponentRole: PlayerRole | null = preview ? (preview.creator_role === 'defense' ? 'prosecution' : 'defense') : null;

  return (
    <ScreenShell wrapTitle title={t('challengeLink.title')} subtitle={t('challengeLink.subAccept')} onBack={onDismiss}>
      <div className={PANEL}>
        {loading ? (
          <p className="flex items-center gap-2 text-white/70"><Loader2 className="w-4 h-4 animate-spin" /> {t('challengeLink.opening')}</p>
        ) : !preview ? (
          <>
            <p className="text-white mb-4">{error || t('challengeLink.notFound')}</p>
            <button onClick={onDismiss} className={`w-full px-4 py-3 ${BIG_GOLD}`}>{t('ui.ok')}</button>
          </>
        ) : accepted ? (
          <>
            <p className="text-emerald-300 text-xs font-black tracking-wider mb-1">{t('challengeLink.accepted')}</p>
            <p className="text-white font-semibold mb-1">{preview.case_title || t('challengeLink.caseFallback')}</p>
            {isPlayer ? (
              <>
                <p className="text-white/70 text-sm mb-4">
                  {preview.is_mine
                    ? t('challengeLink.acceptedMine', { name: preview.opponent_name || t('speakers.opponent') })
                    : t('challengeLink.acceptedYou')}
                </p>
                {error && (
                  <div className="bg-red-500/10 border border-red-500/30 text-red-300 text-sm rounded-lg p-3 mb-4">{error}</div>
                )}
                <button onClick={openGame} disabled={working || !preview.session_id} className={`w-full px-4 py-3 mb-3 ${BIG_GOLD}`}>
                  {working ? t('challengeLink.openingShort') : t('pretrial.continue')}
                </button>
                <button
                  onClick={onViewGames || onDismiss}
                  className="w-full px-4 py-3 rounded-xl bg-white/10 hover:bg-white/15 border border-white/20 text-white font-bold transition-colors"
                >
                  {t('ui.notNow')}
                </button>
              </>
            ) : (
              <>
                <p className="text-white/70 text-sm mb-4">{t('challengeLink.alreadyAccepted')}</p>
                <button onClick={onDismiss} className={`w-full px-4 py-3 ${BIG_GOLD}`}>{t('ui.ok')}</button>
              </>
            )}
          </>
        ) : !open ? (
          <>
            <p className="text-white font-semibold mb-1">{preview.case_title || t('challengeLink.caseFallback')}</p>
            <p className="text-white/70 text-sm mb-4">{t('challengeLink.cancelled')}</p>
            <button onClick={onDismiss} className={`w-full px-4 py-3 ${BIG_GOLD}`}>{t('ui.ok')}</button>
          </>
        ) : preview.is_mine ? (
          <>
            <p className="text-white font-semibold mb-1">{preview.case_title || t('challengeLink.caseFallback')}</p>
            <p className="text-white/70 text-sm mb-4">
              {t('challengeLink.ownLink')}
            </p>
            <button onClick={onViewGames || onDismiss} className={`w-full px-4 py-3 ${BIG_GOLD}`}>{t('challengeLink.viewGames')}</button>
          </>
        ) : (
          <>
            <h2 className="font-game text-3xl text-white leading-none mb-2">{preview.case_title || t('challengeLink.caseFallback')}</h2>
            <p className="text-white/70 text-sm mb-1">
              <Trans
                i18nKey="challengeLink.friendPlays"
                components={{
                  name: preview.creator_name ? <span className="text-white font-semibold">{preview.creator_name}</span> : <span>{t('challengeLink.friendFallback')}</span>,
                  badge: <SideBadge role={preview.creator_role} />
                }}
              />
            </p>
            <p className="text-white/70 text-sm mb-5">
              <Trans i18nKey="challengeLink.youPlay" components={{ badge: opponentRole ? <SideBadge role={opponentRole} /> : <span /> }} />
            </p>
            {error && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-300 text-sm rounded-lg p-3 mb-4">{error}</div>
            )}
            <button onClick={accept} disabled={working} className={`w-full px-4 py-3 mb-3 ${BIG_GOLD}`}>
              {working ? t('challengeLink.joining') : t('challengeLink.accept')}
            </button>
            <button
              onClick={onDismiss}
              className="w-full px-4 py-3 rounded-xl bg-white/10 hover:bg-white/15 border border-white/20 text-white font-bold transition-colors"
            >
              {t('ui.notNow')}
            </button>
          </>
        )}
      </div>
    </ScreenShell>
  );
}
