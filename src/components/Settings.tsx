import { useState } from 'react';
import { ArrowLeft, X, Feather, Scale as ScaleIcon, Flame, Check } from 'lucide-react';
import { db } from '../lib/database';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { getPublicName } from '../lib/userName';
import { DIFFICULTY_INFO } from '../lib/trialConfig';
import type { Difficulty, UserProfile } from '../types';

interface Props {
  userId: string;
  userProfile: UserProfile;
  onBack: () => void;
  onProfileUpdated: (profile: UserProfile) => void;
  /** Render as a compact popup body (no full-page chrome) — used from the home screen */
  popup?: boolean;
}

const TIER_STYLE: Record<Difficulty, { icon: typeof Feather; accent: string; ring: string; glow: string }> = {
  easy: {
    icon: Feather,
    accent: 'text-green-400',
    ring: 'border-green-500',
    glow: 'from-green-500/20 to-emerald-500/20'
  },
  medium: {
    icon: ScaleIcon,
    accent: 'text-amber-400',
    ring: 'border-amber-500',
    glow: 'from-amber-500/20 to-orange-500/20'
  },
  hard: {
    icon: Flame,
    accent: 'text-red-400',
    ring: 'border-red-500',
    glow: 'from-red-500/20 to-rose-500/20'
  }
};

export default function Settings({ userId, userProfile, onBack, onProfileUpdated, popup = false }: Props) {
  const [selected, setSelected] = useState<Difficulty>(userProfile.difficulty || 'medium');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const tiers: Difficulty[] = ['easy', 'medium', 'hard'];
  const { user, signOut } = useAuth();
  const isGuest = !!user?.is_anonymous;
  const [nickname, setNickname] = useState(user?.user_metadata?.nickname || '');
  const [nameStatus, setNameStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [nameError, setNameError] = useState('');
  const [confirmSignOut, setConfirmSignOut] = useState(false);

  const handleSaveNickname = async () => {
    const value = nickname.trim().replace(/\s+/g, ' ');
    if (value.length < 2 || value.length > 20) {
      setNameError('Use 2–20 characters.');
      setNameStatus('error');
      return;
    }
    if (!/^[A-Za-z0-9 _.-]+$/.test(value)) {
      setNameError('Letters, numbers, spaces, _ - . only.');
      setNameStatus('error');
      return;
    }
    setNameStatus('saving');
    setNameError('');
    const { error } = await supabase.auth.updateUser({ data: { nickname: value } });
    if (error) {
      console.error('Failed to save nickname:', error);
      setNameError('Could not save. Try again.');
      setNameStatus('error');
      return;
    }
    setNickname(value);
    setNameStatus('saved');
    setTimeout(() => setNameStatus('idle'), 2000);
  };

  const handleSelect = async (tier: Difficulty) => {
    setSelected(tier);
    setSaving(true);
    setSaved(false);
    try {
      const updated = await db.users.updateProfile(userId, { difficulty: tier });
      onProfileUpdated(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (error) {
      console.error('Failed to save difficulty:', error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={popup ? 'p-4 sm:p-6' : 'min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-4 sm:p-6'}>
      <div className="max-w-2xl mx-auto">
        {popup ? (
          <button onClick={onBack} aria-label="Close settings" className="ml-auto flex items-center justify-center w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors mb-2">
            <X className="w-5 h-5" />
          </button>
        ) : (
          <button onClick={onBack} className="flex items-center gap-2 text-white/60 hover:text-white transition-colors mb-6 text-sm">
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
        )}

        <h1 className="text-2xl font-bold text-white mb-2">Settings</h1>
        <p className="text-white/60 text-sm mb-8">These apply to every case you play until you change them.</p>

        <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
          <h2 className="text-white font-semibold mb-1">Difficulty</h2>
          <p className="text-white/50 text-sm mb-5">
            Changes how the judge and prosecution behave — not the case itself. Applies to every trial from now on; come back here anytime to change it.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {tiers.map((tier) => {
              const info = DIFFICULTY_INFO[tier];
              const style = TIER_STYLE[tier];
              const Icon = style.icon;
              const isSelected = selected === tier;
              return (
                <button
                  key={tier}
                  onClick={() => handleSelect(tier)}
                  disabled={saving}
                  className={`relative bg-white/5 hover:bg-white/10 border-2 rounded-lg p-4 text-left transition-all disabled:opacity-60 ${isSelected ? style.ring : 'border-white/10'}`}
                >
                  {isSelected && (
                    <div className={`absolute top-3 right-3 w-5 h-5 rounded-full flex items-center justify-center bg-gradient-to-br ${style.glow}`}>
                      <Check className={`w-3 h-3 ${style.accent}`} />
                    </div>
                  )}
                  <div className={`w-9 h-9 flex items-center justify-center rounded-lg bg-gradient-to-br ${style.glow} mb-3`}>
                    <Icon className={`w-5 h-5 ${style.accent}`} />
                  </div>
                  <h3 className="text-white font-bold text-sm mb-1">{info.label}</h3>
                  <p className={`text-xs font-semibold mb-2 ${style.accent}`}>{info.tagline}</p>
                  <p className="text-white/60 text-xs leading-relaxed">{info.description}</p>
                </button>
              );
            })}
          </div>

          {saved && (
            <p className="text-green-400 text-sm mt-4 flex items-center gap-1">
              <Check className="w-4 h-4" /> Saved
            </p>
          )}
        </div>

        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 mt-4">
          <h2 className="text-white font-semibold mb-1">Nickname</h2>
          <p className="text-white/50 text-sm mb-4">
            Shown on leaderboards and as your name in court. Your email is never shown. Right now you appear as <span className="text-white/80 font-semibold">{getPublicName(user)}</span>.
          </p>
          <div className="flex gap-2">
            <input
              value={nickname}
              onChange={e => { setNickname(e.target.value); if (nameStatus !== 'idle') setNameStatus('idle'); }}
              maxLength={20}
              placeholder="Pick a nickname"
              className="flex-1 min-w-0 rounded-lg bg-black/40 border border-white/15 px-3 py-2.5 text-white placeholder:text-white/30 focus:outline-none focus:border-amber-500"
            />
            <button
              onClick={handleSaveNickname}
              disabled={nameStatus === 'saving' || !nickname.trim()}
              className="rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-black font-bold px-4"
            >
              {nameStatus === 'saving' ? '…' : 'Save'}
            </button>
          </div>
          {nameStatus === 'saved' && (
            <p className="text-green-400 text-sm mt-3 flex items-center gap-1"><Check className="w-4 h-4" /> Saved</p>
          )}
          {nameStatus === 'error' && <p className="text-red-400 text-sm mt-3">{nameError}</p>}
        </div>

        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 mt-4">
          <h2 className="text-white font-semibold mb-1">Account</h2>
          {isGuest && (
            <p className="text-amber-300/90 text-sm mb-4">
              You're playing as a guest. Signing out will permanently lose your progress and wins.
            </p>
          )}
          {!confirmSignOut ? (
            <button
              onClick={() => (isGuest ? setConfirmSignOut(true) : signOut())}
              className="rounded-lg bg-white/10 hover:bg-white/15 border border-white/15 text-white font-semibold px-4 py-2.5"
            >
              Sign out
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={() => signOut()}
                className="rounded-lg bg-red-600 hover:bg-red-500 text-white font-semibold px-4 py-2.5"
              >
                Yes, lose my progress
              </button>
              <button
                onClick={() => setConfirmSignOut(false)}
                className="rounded-lg bg-white/10 hover:bg-white/15 border border-white/15 text-white font-semibold px-4 py-2.5"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
