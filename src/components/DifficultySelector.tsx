import { Feather, Scale as ScaleIcon, Flame } from 'lucide-react';
import type { Difficulty } from '../types';
import { DIFFICULTY_INFO } from '../lib/trialConfig';

interface Props {
  onSelect: (difficulty: Difficulty) => void;
  onCancel: () => void;
}

const TIER_STYLE: Record<Difficulty, { icon: typeof Feather; accent: string; ring: string; glow: string }> = {
  easy: {
    icon: Feather,
    accent: 'text-green-400',
    ring: 'border-green-500',
    glow: 'from-green-500/20 to-emerald-500/20 group-hover:from-green-500/30 group-hover:to-emerald-500/30'
  },
  medium: {
    icon: ScaleIcon,
    accent: 'text-amber-400',
    ring: 'border-amber-500',
    glow: 'from-amber-500/20 to-orange-500/20 group-hover:from-amber-500/30 group-hover:to-orange-500/30'
  },
  hard: {
    icon: Flame,
    accent: 'text-red-400',
    ring: 'border-red-500',
    glow: 'from-red-500/20 to-rose-500/20 group-hover:from-red-500/30 group-hover:to-rose-500/30'
  }
};

export default function DifficultySelector({ onSelect, onCancel }: Props) {
  const tiers: Difficulty[] = ['easy', 'medium', 'hard'];

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-6 max-w-3xl w-full max-h-[90vh] overflow-y-auto border border-white/10 shadow-2xl">
        <h2 className="text-2xl font-bold text-white mb-2 text-center">Choose Your Difficulty</h2>
        <p className="text-white/60 text-center mb-6 text-sm">
          This changes how the judge and prosecution behave — not the case itself
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          {tiers.map((tier) => {
            const info = DIFFICULTY_INFO[tier];
            const style = TIER_STYLE[tier];
            const Icon = style.icon;
            return (
              <button
                key={tier}
                onClick={() => onSelect(tier)}
                className={`bg-white/5 hover:bg-white/10 border-2 border-white/10 hover:${style.ring} rounded-lg p-4 text-left transition-all group flex flex-col`}
              >
                <div className={`w-10 h-10 flex items-center justify-center rounded-lg bg-gradient-to-br ${style.glow} transition-all mb-3`}>
                  <Icon className={`w-5 h-5 ${style.accent}`} />
                </div>
                <h3 className="text-lg font-bold text-white mb-1">{info.label}</h3>
                <p className={`text-xs font-semibold mb-2 ${style.accent}`}>{info.tagline}</p>
                <p className="text-white/70 text-xs leading-relaxed">{info.description}</p>
              </button>
            );
          })}
        </div>

        <div className="flex justify-center">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-white/60 hover:text-white transition-colors text-sm"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
