import { useState, useEffect, useCallback } from 'react';
import { Swords, Plus, Shield, Gavel, X, Users, Loader2 } from 'lucide-react';
import { db } from '../lib/database';
import type { Case, CaseChallenge, PlayerRole, CaseSession } from '../types';

interface Props {
  userId: string;
  onBack: () => void;
  onMatched: (session: CaseSession) => void;
}

export default function ChallengeBoard({ userId, onBack, onMatched }: Props) {
  const [openChallenges, setOpenChallenges] = useState<CaseChallenge[]>([]);
  const [myChallenges, setMyChallenges] = useState<CaseChallenge[]>([]);
  const [cases, setCases] = useState<Case[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedCaseId, setSelectedCaseId] = useState<string>('');
  const [selectedRole, setSelectedRole] = useState<PlayerRole>('defense');
  const [creating, setCreating] = useState(false);
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  useEffect(() => {
    db.cases.getPresetCases().then(setCases).catch(err => console.error('Failed to load cases:', err));
    refresh();
    const interval = setInterval(refresh, 4000);
    return () => clearInterval(interval);
  }, [refresh]);

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

  const myOpenChallenge = myChallenges.find(c => c.status === 'open' && c.creator_user_id === userId);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-4 sm:p-6">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="text-white/60 hover:text-white transition-colors">
              ← Back
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500/20 to-blue-500/20 flex items-center justify-center">
            <Swords className="w-5 h-5 text-purple-400" />
          </div>
          <h1 className="text-2xl font-bold text-white">Challenge Board</h1>
        </div>
        <p className="text-white/60 text-sm mb-6">
          Pick a case and a side, open a challenge, and wait for another player to take the opposing side. No AI counsel — just you against another real player.
        </p>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-300 text-sm rounded-lg p-3 mb-4">
            {error}
          </div>
        )}

        {myOpenChallenge ? (
          <div className="bg-white/5 border border-purple-500/30 rounded-lg p-4 mb-6 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Loader2 className="w-5 h-5 text-purple-400 animate-spin shrink-0" />
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
            className="w-full mb-6 flex items-center justify-center gap-2 px-4 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors font-semibold"
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
                    className="shrink-0 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-lg transition-colors text-sm font-semibold"
                  >
                    {joiningId === challenge.id ? 'Joining...' : 'Join'}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showCreate && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-6 max-w-md w-full border border-white/10 shadow-2xl">
            <h2 className="text-xl font-bold text-white mb-4">Open a Challenge</h2>

            <label className="block text-white/60 text-xs font-semibold mb-2">Case</label>
            <select
              value={selectedCaseId}
              onChange={(e) => setSelectedCaseId(e.target.value)}
              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white mb-4 focus:outline-none focus:ring-2 focus:ring-purple-500"
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
                className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-lg transition-colors text-sm font-semibold"
              >
                {creating ? 'Creating...' : 'Open Challenge'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
