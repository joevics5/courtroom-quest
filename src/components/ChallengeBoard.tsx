import { useState, useEffect, useCallback } from 'react';
import { Swords, Plus, Shield, Gavel, X, Users, Loader2, Mail, Check, Clock } from 'lucide-react';
import { db } from '../lib/database';
import ScreenShell from './ScreenShell';
import type { Case, CaseChallenge, CaseInvitation, PlayerRole, CaseSession } from '../types';

interface Props {
  userId: string;
  userEmail: string;
  onBack: () => void;
  onMatched: (session: CaseSession) => void;
}

type Tab = 'quick' | 'invite' | 'local';

export default function ChallengeBoard({ userId, userEmail, onBack, onMatched }: Props) {
  const [tab, setTab] = useState<Tab>('quick');
  const [cases, setCases] = useState<Case[]>([]);

  // --- Quick match (open lobby) state ---
  const [openChallenges, setOpenChallenges] = useState<CaseChallenge[]>([]);
  const [myChallenges, setMyChallenges] = useState<CaseChallenge[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedCaseId, setSelectedCaseId] = useState<string>('');
  const [selectedRole, setSelectedRole] = useState<PlayerRole>('defense');
  const [creating, setCreating] = useState(false);
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // --- Invite a friend state ---
  const [sentInvites, setSentInvites] = useState<CaseInvitation[]>([]);
  const [receivedInvites, setReceivedInvites] = useState<CaseInvitation[]>([]);
  const [invitesLoading, setInvitesLoading] = useState(true);
  const [inviteCaseId, setInviteCaseId] = useState<string>('');
  const [inviteRole, setInviteRole] = useState<PlayerRole>('defense');
  const [inviteeEmail, setInviteeEmail] = useState('');
  const [inviteAllowSpectators, setInviteAllowSpectators] = useState(false);
  const [sendingInvite, setSendingInvite] = useState(false);
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);

  // --- Pass & play (same device) state ---
  const [localCaseId, setLocalCaseId] = useState<string>('');
  const [localCreatorRole, setLocalCreatorRole] = useState<PlayerRole>('defense');
  const [localAllowSpectators, setLocalAllowSpectators] = useState(false);
  const [startingLocal, setStartingLocal] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [open, mine] = await Promise.all([
        db.challenges.listOpenChallenges(),
        db.challenges.getMyChallenges(userId)
      ]);
      setOpenChallenges(open.filter((c: CaseChallenge) => c.creator_user_id !== userId));
      setMyChallenges(mine);

      // If one of my own challenges just got matched, jump straight into
      // the trial — this is the "creator finds out they've been joined"
      // mechanism, kept simple as polling rather than a realtime channel.
      const justMatched = mine.find((c: CaseChallenge) => c.status === 'matched' && c.session_id && c.creator_user_id === userId);
      if (justMatched?.session_id) {
        const session = await db.sessions.getSession(justMatched.session_id);
        if (session) {
          onMatched(session);
          return;
        }
      }
    } catch (err) {
      console.error('Failed to refresh challenge board:', err);
    } finally {
      setLoading(false);
    }
  }, [userId, onMatched]);

  const refreshInvites = useCallback(async () => {
    try {
      const [sent, received] = await Promise.all([
        db.invitations.getInvitationsByUser(userId),
        db.invitations.getInvitationsByEmail(userEmail)
      ]);
      setSentInvites(sent.filter(i => i.inviter_user_id === userId));
      setReceivedInvites(received);

      // If an invite I sent was just accepted, jump into the trial —
      // mirrors the challenge board's "matched" polling above.
      const justAccepted = sent.find(i => i.inviter_user_id === userId && i.status === 'accepted' && i.session_id);
      if (justAccepted?.session_id) {
        const session = await db.sessions.getSession(justAccepted.session_id);
        if (session) {
          onMatched(session);
          return;
        }
      }
    } catch (err) {
      console.error('Failed to refresh invitations:', err);
    } finally {
      setInvitesLoading(false);
    }
  }, [userId, userEmail, onMatched]);

  useEffect(() => {
    db.cases.getPresetCases().then(setCases).catch(err => console.error('Failed to load cases:', err));
    refresh();
    const interval = setInterval(refresh, 4000);
    return () => clearInterval(interval);
  }, [refresh]);

  useEffect(() => {
    refreshInvites();
    const interval = setInterval(refreshInvites, 4000);
    return () => clearInterval(interval);
  }, [refreshInvites]);

  const handleCreate = async () => {
    if (!selectedCaseId) return;
    setCreating(true);
    setError(null);
    try {
      await db.challenges.createChallenge(selectedCaseId, userId, selectedRole);
      setShowCreate(false);
      setSelectedCaseId('');
      await refresh();
    } catch (err) {
      console.error('Failed to create challenge:', err);
      setError('Could not create the challenge. Try again.');
    } finally {
      setCreating(false);
    }
  };

  const handleJoin = async (challengeId: string) => {
    setJoiningId(challengeId);
    setError(null);
    try {
      const session = await db.challenges.joinChallenge(challengeId, userId);
      onMatched(session);
    } catch (err: any) {
      console.error('Failed to join challenge:', err);
      setError(err?.message || 'Could not join this challenge.');
      await refresh();
    } finally {
      setJoiningId(null);
    }
  };

  const handleCancel = async (challengeId: string) => {
    try {
      await db.challenges.cancelChallenge(challengeId);
      await refresh();
    } catch (err) {
      console.error('Failed to cancel challenge:', err);
    }
  };

  const handleSendInvite = async () => {
    if (!inviteCaseId || !inviteeEmail.trim()) return;
    if (inviteeEmail.trim().toLowerCase() === userEmail.trim().toLowerCase()) {
      setInviteError("You can't invite yourself.");
      return;
    }
    setSendingInvite(true);
    setInviteError(null);
    try {
      await db.invitations.createInvitation(inviteCaseId, userId, inviteRole, inviteeEmail.trim(), inviteAllowSpectators);
      setInviteCaseId('');
      setInviteeEmail('');
      setInviteAllowSpectators(false);
      await refreshInvites();
    } catch (err) {
      console.error('Failed to send invitation:', err);
      setInviteError('Could not send the invite. Try again.');
    } finally {
      setSendingInvite(false);
    }
  };

  const handleAcceptInvite = async (invitationId: string) => {
    setRespondingId(invitationId);
    setInviteError(null);
    try {
      const session = await db.invitations.acceptInvitation(invitationId, userId);
      onMatched(session);
    } catch (err: any) {
      console.error('Failed to accept invitation:', err);
      setInviteError(err?.message || 'Could not accept this invitation.');
      await refreshInvites();
    } finally {
      setRespondingId(null);
    }
  };

  const handleDeclineInvite = async (invitationId: string) => {
    setRespondingId(invitationId);
    try {
      await db.invitations.declineInvitation(invitationId, userId);
      await refreshInvites();
    } catch (err) {
      console.error('Failed to decline invitation:', err);
    } finally {
      setRespondingId(null);
    }
  };

  const handleCancelInvite = async (invitationId: string) => {
    try {
      await db.invitations.cancelInvitation(invitationId);
      await refreshInvites();
    } catch (err) {
      console.error('Failed to cancel invitation:', err);
    }
  };

  const handleStartLocal = async () => {
    if (!localCaseId) return;
    setStartingLocal(true);
    setLocalError(null);
    try {
      const session = await db.sessions.createSameDevicePlaySession(localCaseId, userId, localCreatorRole, localAllowSpectators);
      onMatched(session);
    } catch (err) {
      console.error('Failed to start pass & play session:', err);
      setLocalError('Could not start the match. Try again.');
    } finally {
      setStartingLocal(false);
    }
  };

  const myOpenChallenge = myChallenges.find(c => c.status === 'open' && c.creator_user_id === userId);
  const pendingSentInvites = sentInvites.filter(i => i.status === 'pending');

  return (
    <ScreenShell
      title="CHALLENGE BOARD"
      subtitle="No AI counsel — just you against another real player. Match with a stranger on the open board, or invite a specific friend."
      onBack={onBack}
    >
      <div>
        <div className="flex gap-1 mb-6 bg-black/55 border border-white/15 rounded-full p-1 w-fit">
          <button
            onClick={() => setTab('quick')}
            className={`px-4 py-2 rounded-full text-sm font-bold transition-colors ${tab === 'quick' ? 'bg-[#FFD43B] text-black' : 'text-white/60 hover:text-white'}`}
          >
            Quick Match
          </button>
          <button
            onClick={() => setTab('invite')}
            className={`px-4 py-2 rounded-full text-sm font-bold transition-colors flex items-center gap-2 ${tab === 'invite' ? 'bg-[#FFD43B] text-black' : 'text-white/60 hover:text-white'}`}
          >
            Invite a Friend
            {receivedInvites.length > 0 && (
              <span className="w-5 h-5 flex items-center justify-center bg-red-500 text-white text-[10px] font-bold rounded-full">
                {receivedInvites.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setTab('local')}
            className={`px-4 py-2 rounded-full text-sm font-bold transition-colors ${tab === 'local' ? 'bg-[#FFD43B] text-black' : 'text-white/60 hover:text-white'}`}
          >
            Pass & Play
          </button>
        </div>

        {tab === 'quick' && (
          <>
            {error && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-300 text-sm rounded-lg p-3 mb-4">
                {error}
              </div>
            )}

            {myOpenChallenge ? (
              <div className="bg-white/5 border border-purple-500/30 rounded-lg p-4 mb-6 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <Loader2 className="w-5 h-5 text-[#FFD43B] animate-spin shrink-0" />
                  <div>
                    <p className="text-white font-semibold text-sm">
                      Waiting for an opponent — {myOpenChallenge.case_title}
                    </p>
                    <p className="text-white/50 text-xs">
                      You're playing {myOpenChallenge.creator_role}. This screen updates automatically when someone joins.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => handleCancel(myOpenChallenge.id)}
                  className="text-white/40 hover:text-white transition-colors shrink-0"
                  title="Cancel challenge"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowCreate(true)}
                className="w-full mb-6 flex items-center justify-center gap-2 px-4 py-3 bg-[#FFD43B] hover:bg-[#ffdc5e] text-black font-bold rounded-lg transition-colors"
              >
                <Plus className="w-5 h-5" />
                Open a Challenge
              </button>
            )}

            <h2 className="text-white/80 font-semibold text-sm mb-3 flex items-center gap-2">
              <Users className="w-4 h-4" />
              Open Challenges
            </h2>

            {loading ? (
              <p className="text-white/40 text-sm">Loading...</p>
            ) : openChallenges.length === 0 ? (
              <div className="bg-white/5 border border-white/10 rounded-lg p-6 text-center">
                <p className="text-white/50 text-sm">No open challenges right now. Be the first to open one.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {openChallenges.map((challenge) => {
                  const opponentRole: PlayerRole = challenge.creator_role === 'defense' ? 'prosecution' : 'defense';
                  return (
                    <div key={challenge.id} className="bg-white/5 border border-white/10 rounded-lg p-4 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-white font-semibold text-sm truncate">{challenge.case_title || 'Case'}</p>
                        <p className="text-white/50 text-xs flex items-center gap-1 mt-1">
                          Creator is playing {challenge.creator_role === 'defense'
                            ? <span className="inline-flex items-center gap-1 text-blue-400"><Shield className="w-3 h-3" /> Defense</span>
                            : <span className="inline-flex items-center gap-1 text-red-400"><Gavel className="w-3 h-3" /> Prosecution</span>
                          }
                          — you'd play {opponentRole}
                        </p>
                      </div>
                      <button
                        onClick={() => handleJoin(challenge.id)}
                        disabled={joiningId === challenge.id}
                        className="shrink-0 px-4 py-2 bg-[#FFD43B] hover:bg-[#ffdc5e] text-black font-bold disabled:bg-slate-700 disabled:text-slate-500 rounded-lg transition-colors text-sm"
                      >
                        {joiningId === challenge.id ? 'Joining...' : 'Join'}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {tab === 'invite' && (
          <>
            {inviteError && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-300 text-sm rounded-lg p-3 mb-4">
                {inviteError}
              </div>
            )}

            {receivedInvites.length > 0 && (
              <div className="mb-6">
                <h2 className="text-white/80 font-semibold text-sm mb-3 flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  Invitations For You
                </h2>
                <div className="space-y-3">
                  {receivedInvites.map((invite) => {
                    const myRole: PlayerRole = invite.inviter_role === 'defense' ? 'prosecution' : 'defense';
                    return (
                      <div key={invite.id} className="bg-white/5 border border-blue-500/30 rounded-lg p-4 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-white font-semibold text-sm truncate">{invite.case_title || 'Case'}</p>
                          <p className="text-white/50 text-xs mt-1">
                            You'd play {myRole === 'defense'
                              ? <span className="inline-flex items-center gap-1 text-blue-400"><Shield className="w-3 h-3" /> Defense</span>
                              : <span className="inline-flex items-center gap-1 text-red-400"><Gavel className="w-3 h-3" /> Prosecution</span>
                            }
                          </p>
                        </div>
                        <div className="flex gap-2 shrink-0">
                          <button
                            onClick={() => handleDeclineInvite(invite.id)}
                            disabled={respondingId === invite.id}
                            className="px-3 py-2 text-white/60 hover:text-white transition-colors text-sm"
                          >
                            Decline
                          </button>
                          <button
                            onClick={() => handleAcceptInvite(invite.id)}
                            disabled={respondingId === invite.id}
                            className="px-4 py-2 bg-[#FFD43B] hover:bg-[#ffdc5e] text-black font-bold disabled:bg-slate-700 disabled:text-slate-500 rounded-lg transition-colors text-sm flex items-center gap-1"
                          >
                            <Check className="w-4 h-4" />
                            {respondingId === invite.id ? 'Joining...' : 'Accept'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="bg-white/5 border border-white/10 rounded-lg p-4 mb-6">
              <h2 className="text-white font-semibold text-sm mb-3">Invite a Friend</h2>
              <label className="block text-white/60 text-xs font-semibold mb-2">Case</label>
              <select
                value={inviteCaseId}
                onChange={(e) => setInviteCaseId(e.target.value)}
                className="w-full px-3 py-2 bg-black/40 border border-white/20 rounded-lg text-white mb-4 focus:outline-none focus:ring-2 focus:ring-[#FFD43B]"
              >
                <option value="">Select a case...</option>
                {cases.map(c => (
                  <option key={c.id} value={c.id}>{c.title}</option>
                ))}
              </select>

              <label className="block text-white/60 text-xs font-semibold mb-2">Your side</label>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <button
                  onClick={() => setInviteRole('defense')}
                  className={`p-3 rounded-lg border-2 flex flex-col items-center gap-1 transition-colors ${inviteRole === 'defense' ? 'border-blue-500 bg-blue-500/10' : 'border-white/10 bg-white/5'}`}
                >
                  <Shield className="w-5 h-5 text-blue-400" />
                  <span className="text-white text-sm font-semibold">Defense</span>
                </button>
                <button
                  onClick={() => setInviteRole('prosecution')}
                  className={`p-3 rounded-lg border-2 flex flex-col items-center gap-1 transition-colors ${inviteRole === 'prosecution' ? 'border-red-500 bg-red-500/10' : 'border-white/10 bg-white/5'}`}
                >
                  <Gavel className="w-5 h-5 text-red-400" />
                  <span className="text-white text-sm font-semibold">Prosecution</span>
                </button>
              </div>

              <label className="block text-white/60 text-xs font-semibold mb-2">Friend's email</label>
              <input
                type="email"
                value={inviteeEmail}
                onChange={(e) => setInviteeEmail(e.target.value)}
                placeholder="friend@example.com"
                className="w-full px-3 py-2 bg-black/40 border border-white/20 rounded-lg text-white mb-4 focus:outline-none focus:ring-2 focus:ring-[#FFD43B]"
              />
              <p className="text-white/40 text-xs mb-4">
                They'll see this invite waiting for them the next time they open the Invite a Friend tab while signed in with that email. They'll play the opposite side.
              </p>

              <label className="flex items-center gap-2 mb-4 cursor-pointer">
                <input
                  type="checkbox"
                  checked={inviteAllowSpectators}
                  onChange={(e) => setInviteAllowSpectators(e.target.checked)}
                  className="w-4 h-4 rounded accent-purple-600"
                />
                <span className="text-white/70 text-sm">Let people watch this trial live</span>
              </label>

              <button
                onClick={handleSendInvite}
                disabled={!inviteCaseId || !inviteeEmail.trim() || sendingInvite}
                className="w-full px-4 py-2 bg-[#FFD43B] hover:bg-[#ffdc5e] text-black font-bold disabled:bg-slate-700 disabled:text-slate-500 rounded-lg transition-colors text-sm"
              >
                {sendingInvite ? 'Sending...' : 'Send Invite'}
              </button>
            </div>

            <h2 className="text-white/80 font-semibold text-sm mb-3 flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Invites You've Sent
            </h2>
            {invitesLoading ? (
              <p className="text-white/40 text-sm">Loading...</p>
            ) : pendingSentInvites.length === 0 ? (
              <div className="bg-white/5 border border-white/10 rounded-lg p-6 text-center">
                <p className="text-white/50 text-sm">No pending invites. Send one above.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {pendingSentInvites.map((invite) => (
                  <div key={invite.id} className="bg-white/5 border border-white/10 rounded-lg p-4 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-white font-semibold text-sm truncate">{invite.case_title || 'Case'}</p>
                      <p className="text-white/50 text-xs mt-1">
                        Waiting on {invite.invitee_email} — you're playing {invite.inviter_role}
                      </p>
                    </div>
                    <button
                      onClick={() => handleCancelInvite(invite.id)}
                      className="text-white/40 hover:text-white transition-colors shrink-0"
                      title="Cancel invite"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {tab === 'local' && (
          <>
            {localError && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-300 text-sm rounded-lg p-3 mb-4">
                {localError}
              </div>
            )}
            <div className="bg-white/5 border border-white/10 rounded-lg p-4">
              <h2 className="text-white font-semibold text-sm mb-1">Play Together on This Device</h2>
              <p className="text-white/50 text-xs mb-4">
                Both of you share this phone or laptop and pass it back and forth on each turn — no second account needed.
                Best for text-based back-and-forth; things like objections that need split-second timing work best across two devices.
              </p>

              <label className="block text-white/60 text-xs font-semibold mb-2">Case</label>
              <select
                value={localCaseId}
                onChange={(e) => setLocalCaseId(e.target.value)}
                className="w-full px-3 py-2 bg-black/40 border border-white/20 rounded-lg text-white mb-4 focus:outline-none focus:ring-2 focus:ring-[#FFD43B]"
              >
                <option value="">Select a case...</option>
                {cases.map(c => (
                  <option key={c.id} value={c.id}>{c.title}</option>
                ))}
              </select>

              <label className="block text-white/60 text-xs font-semibold mb-2">Who goes first (Player 1)</label>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <button
                  onClick={() => setLocalCreatorRole('defense')}
                  className={`p-3 rounded-lg border-2 flex flex-col items-center gap-1 transition-colors ${localCreatorRole === 'defense' ? 'border-blue-500 bg-blue-500/10' : 'border-white/10 bg-white/5'}`}
                >
                  <Shield className="w-5 h-5 text-blue-400" />
                  <span className="text-white text-sm font-semibold">Defense</span>
                </button>
                <button
                  onClick={() => setLocalCreatorRole('prosecution')}
                  className={`p-3 rounded-lg border-2 flex flex-col items-center gap-1 transition-colors ${localCreatorRole === 'prosecution' ? 'border-red-500 bg-red-500/10' : 'border-white/10 bg-white/5'}`}
                >
                  <Gavel className="w-5 h-5 text-red-400" />
                  <span className="text-white text-sm font-semibold">Prosecution</span>
                </button>
              </div>
              <p className="text-white/40 text-xs mb-4">
                Player 2 automatically gets the other side. The app will prompt you to pass the device at every turn change.
              </p>

              <label className="flex items-center gap-2 mb-4 cursor-pointer">
                <input
                  type="checkbox"
                  checked={localAllowSpectators}
                  onChange={(e) => setLocalAllowSpectators(e.target.checked)}
                  className="w-4 h-4 rounded accent-purple-600"
                />
                <span className="text-white/70 text-sm">Let people watch this trial live</span>
              </label>

              <button
                onClick={handleStartLocal}
                disabled={!localCaseId || startingLocal}
                className="w-full px-4 py-2 bg-[#FFD43B] hover:bg-[#ffdc5e] text-black font-bold disabled:bg-slate-700 disabled:text-slate-500 rounded-lg transition-colors text-sm"
              >
                {startingLocal ? 'Starting...' : 'Start Match'}
              </button>
            </div>
          </>
        )}
      </div>

      {showCreate && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#14161f] rounded-2xl p-6 max-w-md w-full border border-white/15 shadow-2xl">
            <h2 className="font-game text-3xl text-white mb-4 leading-none">OPEN A CHALLENGE</h2>

            <label className="block text-white/60 text-xs font-semibold mb-2">Case</label>
            <select
              value={selectedCaseId}
              onChange={(e) => setSelectedCaseId(e.target.value)}
              className="w-full px-3 py-2 bg-black/40 border border-white/20 rounded-lg text-white mb-4 focus:outline-none focus:ring-2 focus:ring-[#FFD43B]"
            >
              <option value="">Select a case...</option>
              {cases.map(c => (
                <option key={c.id} value={c.id}>{c.title}</option>
              ))}
            </select>

            <label className="block text-white/60 text-xs font-semibold mb-2">Your side</label>
            <div className="grid grid-cols-2 gap-3 mb-6">
              <button
                onClick={() => setSelectedRole('defense')}
                className={`p-3 rounded-lg border-2 flex flex-col items-center gap-1 transition-colors ${selectedRole === 'defense' ? 'border-blue-500 bg-blue-500/10' : 'border-white/10 bg-white/5'}`}
              >
                <Shield className="w-5 h-5 text-blue-400" />
                <span className="text-white text-sm font-semibold">Defense</span>
              </button>
              <button
                onClick={() => setSelectedRole('prosecution')}
                className={`p-3 rounded-lg border-2 flex flex-col items-center gap-1 transition-colors ${selectedRole === 'prosecution' ? 'border-red-500 bg-red-500/10' : 'border-white/10 bg-white/5'}`}
              >
                <Gavel className="w-5 h-5 text-red-400" />
                <span className="text-white text-sm font-semibold">Prosecution</span>
              </button>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowCreate(false)}
                className="flex-1 px-4 py-2 text-white/60 hover:text-white transition-colors text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={!selectedCaseId || creating}
                className="flex-1 px-4 py-2 bg-[#FFD43B] hover:bg-[#ffdc5e] text-black font-bold disabled:bg-slate-700 disabled:text-slate-500 rounded-lg transition-colors text-sm"
              >
                {creating ? 'Creating...' : 'Open Challenge'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ScreenShell>
  );
}
