import { useState } from 'react';
import { Shield, Gavel } from 'lucide-react';
import type { PlayerRole } from '../types';

interface Props {
  caseTitle: string;
  defendantName?: string;
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

function getBriefing(role: PlayerRole, caseTitle: string, defendantName?: string): string {
  const defendant = defendantName || 'the defendant';
  if (role === 'defense') {
    return `${defendant} has been charged in ${caseTitle} and needs representation. The evidence against them is serious, but everyone deserves a defense. Will you take the case?`;
  }
  return `You've been selected to lead the prosecution in ${caseTitle}. The State is counting on you to prove the case against ${defendant} beyond a reasonable doubt. Will you take the case?`;
}

export default function RoleSelector({ caseTitle, defendantName, onSelect, onCancel }: Props) {
  const roles: PlayerRole[] = ['defense', 'prosecution'];
  const [pendingRole, setPendingRole] = useState<PlayerRole | null>(null);

  if (pendingRole) {
    const info = ROLE_INFO[pendingRole];
    const Icon = info.icon;
    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-6 max-w-md w-full border border-white/10 shadow-2xl">
          <div className={`w-14 h-14 mx-auto flex items-center justify-center rounded-full bg-gradient-to-br ${info.glow} mb-4`}>
            <Icon className={`w-7 h-7 ${info.accent}`} />
          </div>
          <h2 className="text-xl font-bold text-white mb-3 text-center">{info.label} Counsel</h2>
          <p className="text-white/80 text-sm leading-relaxed text-center mb-6">
            {getBriefing(pendingRole, caseTitle, defendantName)}
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => setPendingRole(null)}
              className="flex-1 px-4 py-3 bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 rounded-lg transition-colors font-semibold"
            >
              Reject
            </button>
            <button
              onClick={() => onSelect(pendingRole)}
              className={`flex-1 px-4 py-3 text-white rounded-lg transition-colors font-semibold ${pendingRole === 'defense' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-red-600 hover:bg-red-700'}`}
            >
              Accept
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-6 max-w-3xl w-full max-h-[90vh] overflow-y-auto border border-white/10 shadow-2xl">
        <h2 className="text-2xl font-bold text-white mb-2 text-center">Choose Your Side</h2>
        <p className="text-white/60 text-center mb-6 text-sm">
          Which side of the courtroom will you argue in {caseTitle}?
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          {roles.map((role) => {
            const info = ROLE_INFO[role];
            const Icon = info.icon;
            return (
              <button
                key={role}
                onClick={() => setPendingRole(role)}
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
