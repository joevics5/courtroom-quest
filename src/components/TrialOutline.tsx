import { Check, Clock, Circle, ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { getPhaseInfo, formatTime, type TrialConfig } from '../lib/trialConfig';
import { requiresJudgeInstruction, getJudgeInstructionForPhase, extractWitnessNumber } from '../lib/judgeInstructions';
import type { TrialEvent } from '../types';

interface TrialOutlineProps {
  currentPhase: number;
  trialConfig: TrialConfig;
  phaseTimeRemaining: Record<number, number>;
  timerActive: boolean;
  totalTimeRemaining: number;
  events?: TrialEvent[]; // Optional: to show actual judge instructions from transcript
  prosecutorName?: string;
  defenseName?: string;
}

export default function TrialOutline({
  currentPhase,
  trialConfig,
  phaseTimeRemaining,
  timerActive,
  totalTimeRemaining,
  events = [],
  prosecutorName = 'Prosecution',
  defenseName = 'Defense'
}: TrialOutlineProps) {
  const [showPreTrial, setShowPreTrial] = useState(false);

  const getPhaseStatus = (phaseNumber: number) => {
    const phase = getPhaseInfo(phaseNumber, trialConfig.duration);
    // Mark all pre-trial phases as ALWAYS completed since they're done before trial starts
    // This should never change regardless of currentPhase or accordion state
    if (phase?.category === 'pre-trial') {
      return 'completed';
    }
    if (phaseNumber < currentPhase) return 'completed';
    if (phaseNumber === currentPhase) return 'current';
    return 'upcoming';
  };

  const getPhaseIcon = (phaseNumber: number) => {
    const status = getPhaseStatus(phaseNumber);
    if (status === 'completed') {
      return <Check className="w-4 h-4 text-green-400" />;
    }
    if (status === 'current') {
      return <Circle className="w-4 h-4 text-blue-400 fill-blue-400" />;
    }
    return <Circle className="w-4 h-4 text-slate-600" />;
  };

  const getCategoryPhases = (category: 'pre-trial' | 'trial' | 'post-trial') => {
    return trialConfig.phases.filter(p => p.category === category);
  };

  const getJudgeInstructionForPhaseNumber = (phaseNumber: number): string | null => {
    const phase = getPhaseInfo(phaseNumber, trialConfig.duration);
    if (!phase || !requiresJudgeInstruction(phase)) return null;

    // Try to get from events first
    const instructionEvent = events.find(e => 
      e.speaker_role === 'judge' && 
      e.metadata?.instruction_for_phase === phaseNumber
    );
    
    if (instructionEvent) {
      return instructionEvent.content;
    }

    // Generate it if not in events yet
    const witnessNumber = extractWitnessNumber(phase.name);
    return getJudgeInstructionForPhase({
      prosecutorName,
      defenseName,
      nextPhase: phase,
      witnessNumber
    });
  };

  const renderPhase = (phase: ReturnType<typeof getPhaseInfo>) => {
    if (!phase) return null;

    // Force pre-trial phases to always be completed
    const isPreTrial = phase.category === 'pre-trial';
    const status = isPreTrial ? 'completed' : getPhaseStatus(phase.number);
    const duration = trialConfig.phaseDurations[phase.number];
    const timeRemaining = phaseTimeRemaining[phase.number];
    
    // Check if this phase needs a judge instruction before it
    const judgeInstruction = !isPreTrial ? getJudgeInstructionForPhaseNumber(phase.number) : null;
    // Instruction status matches the phase status (completed if phase is completed, current if phase is current)
    const instructionStatus = judgeInstruction ? status : null;

    return (
      <>
        {/* Judge Instruction Sub-Phase (x) */}
        {judgeInstruction && (
          <div
            key={`instruction-${phase.number}`}
            className={`flex items-start gap-2 py-1.5 px-3 rounded text-xs ${
              instructionStatus === 'current' ? 'bg-purple-500/10 border border-purple-500/30' : ''
            }`}
          >
            <div className="flex-shrink-0 mt-0.5">
              {instructionStatus === 'completed' ? (
                <Check className="w-3 h-3 text-green-400" />
              ) : instructionStatus === 'current' ? (
                <Circle className="w-3 h-3 text-purple-400 fill-purple-400" />
              ) : (
                <Circle className="w-3 h-3 text-slate-600" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <span className={`font-medium italic ${
                instructionStatus === 'completed' ? 'text-slate-500 line-through' :
                instructionStatus === 'current' ? 'text-purple-300' :
                'text-slate-600'
              }`}>
                x. Judge Instructions
              </span>
            </div>
          </div>
        )}
        
        {/* Main Phase */}
        <div
          key={phase.number}
          className={`flex items-start gap-2 py-2 px-3 rounded ${
            status === 'current' ? 'bg-blue-500/10 border border-blue-500/30' : ''
          }`}
        >
          <div className="flex-shrink-0 mt-0.5">
            {isPreTrial ? (
              <Check className="w-4 h-4 text-green-400" />
            ) : (
              getPhaseIcon(phase.number)
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span className={`text-xs font-medium ${
                status === 'completed' ? 'text-slate-400 line-through' :
                status === 'current' ? 'text-white' :
                'text-slate-500'
              }`}>
                {phase.number}. {phase.name}
              </span>
              {duration !== undefined && duration > 0 && (
                <span className="text-xs text-slate-400 flex-shrink-0">
                  {status === 'current' && timeRemaining !== undefined
                    ? formatTime(timeRemaining)
                    : `${duration}m`}
                </span>
              )}
            </div>
          </div>
        </div>
      </>
    );
  };

  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden h-full flex flex-col">
      <div className="border-b border-slate-700 px-4 py-3 bg-slate-750">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-white">Trial Outline</h3>
          {timerActive && (
            <div className="flex items-center gap-1 text-blue-400">
              <Clock className="w-3 h-3" />
              <span className="text-xs font-mono">{formatTime(totalTimeRemaining)}</span>
            </div>
          )}
        </div>
        <div className="text-xs text-slate-400">
          {trialConfig.duration} minute trial
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div>
          <button
            onClick={() => setShowPreTrial(!showPreTrial)}
            className="w-full flex items-center justify-between text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wide hover:text-slate-300 transition-colors"
          >
            <span className="flex items-center gap-2">
              <Check className="w-3 h-3 text-green-400" />
              Pre-Trial (Completed)
            </span>
            <ChevronDown className={`w-4 h-4 transition-transform ${showPreTrial ? 'rotate-180' : ''}`} />
          </button>
          {showPreTrial && (
            <div className="space-y-1 animate-in slide-in-from-top-2">
              {getCategoryPhases('pre-trial').map(p => renderPhase(getPhaseInfo(p.number, trialConfig.duration)))}
            </div>
          )}
        </div>

        <div>
          <div className="text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wide">
            Trial (Timed)
          </div>
          <div className="space-y-1">
            {getCategoryPhases('trial').map(p => renderPhase(getPhaseInfo(p.number, trialConfig.duration)))}
          </div>
        </div>

        <div>
          <div className="text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wide">
            Post-Trial
          </div>
          <div className="space-y-1">
            {getCategoryPhases('post-trial').map(p => renderPhase(getPhaseInfo(p.number, trialConfig.duration)))}
          </div>
        </div>
      </div>
    </div>
  );
}
