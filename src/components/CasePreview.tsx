import { useState } from 'react';
import { Shield, Gavel, GraduationCap, FileText, ArrowLeft } from 'lucide-react';
import type { PlayerRole } from '../types';

interface Props {
  caseTitle: string;
  caseText: string;
  defendantName?: string;
  onSelect: (role: PlayerRole, practiceMode: boolean) => void;
  onCancel: () => void;
}

type Step = 'browse' | 'confirm-prosecute' | 'confirm-defend' | 'practice-explain' | 'practice-role';

const ROLE_STYLE = {
  defense: { accent: 'text-blue-400', ring: 'border-blue-500', glow: 'from-blue-500/20 to-cyan-500/20' },
  prosecution: { accent: 'text-red-400', ring: 'border-red-500', glow: 'from-red-500/20 to-orange-500/20' }
};

export default function CasePreview({ caseTitle, caseText, defendantName, onSelect, onCancel }: Props) {
  const [step, setStep] = useState<Step>('browse');
  const defendant = defendantName || 'the defendant';

  const Modal = ({ children }: { children: React.ReactNode }) => (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-6 max-w-md w-full border border-white/10 shadow-2xl">
        {children}
      </div>
    </div>
  );

  if (step === 'confirm-prosecute' || step === 'confirm-defend') {
    const role: PlayerRole = step === 'confirm-prosecute' ? 'prosecution' : 'defense';
    const style = ROLE_STYLE[role];
    const Icon = role === 'prosecution' ? Gavel : Shield;
    const briefing = role === 'prosecution'
      ? `You've been selected to lead the prosecution in ${caseTitle}. The State is counting on you to prove the case against ${defendant} beyond a reasonable doubt. Will you take the case?`
      : `${defendant} has been charged in ${caseTitle} and needs representation. The evidence against them is serious, but everyone deserves a defense. Will you take the case?`;

    return (
      <Modal>
        <div className={`w-14 h-14 mx-auto flex items-center justify-center rounded-full bg-gradient-to-br ${style.glow} mb-4`}>
          <Icon className={`w-7 h-7 ${style.accent}`} />
        </div>
        <h2 className="text-xl font-bold text-white mb-3 text-center">{role === 'prosecution' ? 'Prosecution' : 'Defense'} Counsel</h2>
        <p className="text-white/80 text-sm leading-relaxed text-center mb-6">{briefing}</p>
        <div className="flex gap-3">
          <button
            onClick={() => setStep('browse')}
            className="flex-1 px-4 py-3 bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 rounded-lg transition-colors font-semibold"
          >
            Reject
          </button>
          <button
            onClick={() => onSelect(role, false)}
            className={`flex-1 px-4 py-3 text-white rounded-lg transition-colors font-semibold ${role === 'prosecution' ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'}`}
          >
            Accept
          </button>
        </div>
      </Modal>
    );
  }

  if (step === 'practice-explain') {
    return (
      <Modal>
        <div className="w-14 h-14 mx-auto flex items-center justify-center rounded-full bg-gradient-to-br from-amber-500/20 to-orange-500/20 mb-4">
          <GraduationCap className="w-7 h-7 text-amber-400" />
        </div>
        <h2 className="text-xl font-bold text-white mb-3 text-center">Practice Mode</h2>
        <p className="text-white/80 text-sm leading-relaxed text-center mb-6">
          No clock — take as long as you need on every phase. When you object, the judge explains the underlying rule in more depth instead of a quick ruling, so you actually learn why it was sustained or overruled. Good for working through a case at your own pace.
        </p>
        <div className="flex gap-3">
          <button
            onClick={() => setStep('browse')}
            className="flex-1 px-4 py-3 bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 rounded-lg transition-colors font-semibold"
          >
            Back
          </button>
          <button
            onClick={() => setStep('practice-role')}
            className="flex-1 px-4 py-3 bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-colors font-semibold"
          >
            Continue
          </button>
        </div>
      </Modal>
    );
  }

  if (step === 'practice-role') {
    return (
      <Modal>
        <h2 className="text-xl font-bold text-white mb-1 text-center">Practice As...</h2>
        <p className="text-white/60 text-sm text-center mb-6">Which side do you want to practice?</p>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => onSelect('defense', true)}
            className="p-4 rounded-lg border-2 border-white/10 hover:border-blue-500 bg-white/5 hover:bg-white/10 flex flex-col items-center gap-2 transition-colors"
          >
            <Shield className="w-6 h-6 text-blue-400" />
            <span className="text-white font-semibold text-sm">Defense</span>
          </button>
          <button
            onClick={() => onSelect('prosecution', true)}
            className="p-4 rounded-lg border-2 border-white/10 hover:border-red-500 bg-white/5 hover:bg-white/10 flex flex-col items-center gap-2 transition-colors"
          >
            <Gavel className="w-6 h-6 text-red-400" />
            <span className="text-white font-semibold text-sm">Prosecution</span>
          </button>
        </div>
        <button
          onClick={() => setStep('practice-explain')}
          className="w-full mt-4 px-4 py-2 text-white/60 hover:text-white transition-colors text-sm"
        >
          Back
        </button>
      </Modal>
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
        <p className="text-white/70 text-sm leading-relaxed whitespace-pre-line mb-8">{caseText}</p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
          <button
            onClick={() => setStep('confirm-prosecute')}
            className="p-4 rounded-lg border-2 border-white/10 hover:border-red-500 bg-white/5 hover:bg-white/10 flex flex-col items-center gap-2 transition-colors"
          >
            <Gavel className="w-6 h-6 text-red-400" />
            <span className="text-white font-semibold text-sm">Prosecute</span>
          </button>
          <button
            onClick={() => setStep('confirm-defend')}
            className="p-4 rounded-lg border-2 border-white/10 hover:border-blue-500 bg-white/5 hover:bg-white/10 flex flex-col items-center gap-2 transition-colors"
          >
            <Shield className="w-6 h-6 text-blue-400" />
            <span className="text-white font-semibold text-sm">Defend</span>
          </button>
          <button
            onClick={() => setStep('practice-explain')}
            className="p-4 rounded-lg border-2 border-white/10 hover:border-amber-500 bg-white/5 hover:bg-white/10 flex flex-col items-center gap-2 transition-colors"
          >
            <GraduationCap className="w-6 h-6 text-amber-400" />
            <span className="text-white font-semibold text-sm">Practice</span>
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
