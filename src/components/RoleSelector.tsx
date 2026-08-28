import { Shield, Gavel } from 'lucide-react';
import type { PlayerRole } from '../types';

interface Props {
  onSelect: (role: PlayerRole) => void;
  onCancel: () => void;
}

const ROLE_INFO: Record<PlayerRole, { label: string; tagline: string; description: string; icon: typeof Shield; accent: string; ring: string; glow: string }> = {
  defense: {
    label: 'Defense',
    tagline: 'Protect your client',
    description: 'Cross-examine witnesses, raise objections, and create reasonable doubt to win an acquittal.',
    icon: Shield,
    accent: 'text-blue-400',
    ring: 'border-blue-500',
    glow: 'from-blue-500/20 to-cyan-500/20 group-hover:from-blue-500/30 group-hover:to-cyan-500/30'
  },
  prosecution: {
    label: 'Prosecution',
    tagline: 'Prove your case',
    description: 'Build a compelling case, examine witnesses, and prove guilt beyond a reasonable doubt.',
    icon: Gavel,
    accent: 'text-red-400',
    ring: 'border-red-500',
    glow: 'from-red-500/20 to-orange-500/20 group-hover:from-red-500/30 group-hover:to-orange-500/30'
  }
};

export default function RoleSelector({ onSelect, onCancel }: Props) {
  const roles: PlayerRole[] = ['defense', 'prosecution'];

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-6 max-w-3xl w-full max-h-[90vh] overflow-y-auto border border-white/10 shadow-2xl">
        <h2 className="text-2xl font-bold text-white mb-2 text-center">Choose Your Side</h2>
        <p className="text-white/60 text-center mb-6 text-sm">
          Which side of the courtroom will you argue?
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          {roles.map((role) => {
            const info = ROLE_INFO[role];
            const Icon = info.icon;
            return (
              <button
                key={role}
                onClick={() => onSelect(role)}
                className={`bg-white/5 hover:bg-white/10 border-2 border-white/10 hover:${info.ring} rounded-lg p-5 text-left transition-all group flex flex-col`}
              >
                <div className={`w-12 h-12 flex items-center justify-center rounded-lg bg-gradient-to-br ${info.glow} transition-all mb-3`}>
                  <Icon className={`w-6 h-6 ${info.accent}`} />
                </div>
                <h3 className="text-xl font-bold text-white mb-1">{info.label}</h3>
                <p className={`text-xs font-semibold mb-2 ${info.accent}`}>{info.tagline}</p>
                <p className="text-white/70 text-sm leading-relaxed">{info.description}</p>
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
