import { useState } from 'react';
import { ArrowLeft, Feather, Scale as ScaleIcon, Flame, Check } from 'lucide-react';
import { db } from '../lib/database';
import { DIFFICULTY_INFO } from '../lib/trialConfig';
import type { Difficulty, UserProfile } from '../types';

interface Props {
  userId: string;
  userProfile: UserProfile;
  onBack: () => void;
  onProfileUpdated: (profile: UserProfile) => void;
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

export default function Settings({ userId, userProfile, onBack, onProfileUpdated }: Props) {
  const [selected, setSelected] = useState<Difficulty>(userProfile.difficulty || 'medium');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const tiers: Difficulty[] = ['easy', 'medium', 'hard'];

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
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-4 sm:p-6">
      <div className="max-w-2xl mx-auto">
        <button onClick={onBack} className="flex items-center gap-2 text-white/60 hover:text-white transition-colors mb-6 text-sm">
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>

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
      </div>
    </div>
  );
}
