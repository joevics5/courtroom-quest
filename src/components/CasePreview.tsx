import { useState } from 'react';
import { Shield, Gavel, FileText, ArrowLeft, ChevronDown, ChevronUp, FileStack, Users, Loader2 } from 'lucide-react';
import { db } from '../lib/database';
import type { PlayerRole, Evidence, Witness } from '../types';

interface Props {
  caseId: string;
  caseTitle: string;
  caseText: string;
  defendantName?: string;
  onSelect: (role: PlayerRole) => void;
  onCancel: () => void;
}

type Step = 'browse' | 'confirm-prosecute' | 'confirm-defend';

const ROLE_STYLE = {
  defense: { accent: 'text-blue-400', ring: 'border-blue-500', glow: 'from-blue-500/20 to-cyan-500/20' },
  prosecution: { accent: 'text-red-400', ring: 'border-red-500', glow: 'from-red-500/20 to-orange-500/20' }
};

export default function CasePreview({ caseId, caseTitle, caseText, defendantName, onSelect, onCancel }: Props) {
  const [step, setStep] = useState<Step>('browse');
  const [filesExpanded, setFilesExpanded] = useState(false);
  const [filesLoading, setFilesLoading] = useState(false);
  const [filesLoaded, setFilesLoaded] = useState(false);
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [witnesses, setWitnesses] = useState<Witness[]>([]);
  const defendant = defendantName || 'the defendant';

  const handleToggleFiles = async () => {
    const next = !filesExpanded;
    setFilesExpanded(next);
    if (next && !filesLoaded) {
      setFilesLoading(true);
      try {
        const [evidenceData, witnessData] = await Promise.all([
          db.evidence.getCaseEvidence(caseId),
          db.witnesses.getCaseWitnesses(caseId)
        ]);
        setEvidence(evidenceData);
        setWitnesses(witnessData);
        setFilesLoaded(true);
      } catch (error) {
        console.error('Failed to load case files:', error);
      } finally {
        setFilesLoading(false);
      }
    }
  };

  if (step === 'confirm-prosecute' || step === 'confirm-defend') {
    const role: PlayerRole = step === 'confirm-prosecute' ? 'prosecution' : 'defense';
    const style = ROLE_STYLE[role];
    const Icon = role === 'prosecution' ? Gavel : Shield;
    const briefing = role === 'prosecution'
      ? `You've been assigned to lead the prosecution in ${caseTitle}. The State is counting on you to prove the case against ${defendant} beyond a reasonable doubt. Will you take the case?`
      : `${defendant} has asked you to defend them in ${caseTitle}. The evidence against them is serious, but everyone deserves a defense. Will you take the case?`;

    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-6 max-w-md w-full border border-white/10 shadow-2xl">
          <div className={`w-14 h-14 mx-auto flex items-center justify-center rounded-full bg-gradient-to-br ${style.glow} mb-4`}>
            <Icon className={`w-7 h-7 ${style.accent}`} />
          </div>
          <h2 className="text-xl font-bold text-white mb-3 text-center">{role === 'prosecution' ? 'Prosecution' : 'Defense'} Counsel</h2>
          <p className="text-white/80 text-sm leading-relaxed text-center mb-6">{briefing}</p>
          <div className="flex flex-row gap-3">
            <button
              onClick={() => setStep('browse')}
              className="flex-1 px-4 py-3 bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 rounded-lg transition-colors font-semibold"
            >
              Reject
            </button>
            <button
              onClick={() => onSelect(role)}
              className={`flex-1 px-4 py-3 text-white rounded-lg transition-colors font-semibold ${role === 'prosecution' ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'}`}
            >
              Accept
            </button>
          </div>
        </div>
      </div>
    );
  }

  // step === 'browse'
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-white/10 shadow-2xl">
        <div className="flex items-center gap-2 mb-4">
          <FileText className="w-5 h-5 text-amber-400" />
          <span className="text-amber-400 text-xs font-bold uppercase tracking-wide">Case File</span>
        </div>

        <h2 className="text-2xl font-bold text-white mb-4">{caseTitle}</h2>
        <p className="text-white/70 text-sm leading-relaxed whitespace-pre-line mb-4">{caseText}</p>

        <button
          onClick={handleToggleFiles}
          className="w-full flex items-center justify-between px-4 py-2.5 mb-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-white/80 text-sm font-medium transition-colors"
        >
          <span className="flex items-center gap-2">
            <FileStack className="w-4 h-4" />
            View evidence & witnesses
          </span>
          {filesLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : filesExpanded ? (
            <ChevronUp className="w-4 h-4" />
          ) : (
            <ChevronDown className="w-4 h-4" />
          )}
        </button>

        {filesExpanded && filesLoaded && (
          <div className="mb-6 space-y-4">
            <div>
              <p className="text-white/50 text-xs font-semibold uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <FileStack className="w-3.5 h-3.5" />
                Evidence ({evidence.length})
              </p>
              {evidence.length > 0 ? (
                <div className="space-y-1.5">
                  {evidence.map((e) => (
                    <div key={e.id} className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm">
                      <span className="text-amber-400 font-medium">{e.exhibit_label || 'Exhibit'}:</span>{' '}
                      <span className="text-white/80">{e.title}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-white/40 text-sm italic">No evidence listed yet.</p>
              )}
            </div>

            <div>
              <p className="text-white/50 text-xs font-semibold uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5" />
                Witnesses ({witnesses.length})
              </p>
              {witnesses.length > 0 ? (
                <div className="space-y-1.5">
                  {witnesses.map((w) => (
                    <div key={w.id} className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm">
                      <span className="text-white font-medium">{w.name}</span>{' '}
                      <span className="text-white/50">— {w.role}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-white/40 text-sm italic">No witnesses listed yet.</p>
              )}
            </div>
          </div>
        )}

        <div className="flex flex-row gap-3 mb-4">
          <button
            onClick={() => setStep('confirm-prosecute')}
            className="flex-1 p-4 rounded-lg border-2 border-white/10 hover:border-red-500 bg-white/5 hover:bg-white/10 flex flex-col items-center gap-2 transition-colors"
          >
            <Gavel className="w-6 h-6 text-red-400" />
            <span className="text-white font-semibold text-sm">Prosecute</span>
          </button>
          <button
            onClick={() => setStep('confirm-defend')}
            className="flex-1 p-4 rounded-lg border-2 border-white/10 hover:border-blue-500 bg-white/5 hover:bg-white/10 flex flex-col items-center gap-2 transition-colors"
          >
            <Shield className="w-6 h-6 text-blue-400" />
            <span className="text-white font-semibold text-sm">Defend</span>
          </button>
        </div>

        <div className="flex justify-center">
          <button
            onClick={onCancel}
            className="flex items-center gap-1 px-4 py-2 text-white/60 hover:text-white transition-colors text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            Choose a different case
          </button>
        </div>
      </div>
    </div>
  );
}
