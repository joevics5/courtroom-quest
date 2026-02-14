/**
 * Hardcoded Judge Instructions
 * These are predictable, standard court instructions that appear before each counsel action phase
 */

import type { TrialPhase } from './trialConfig';

export interface JudgeInstructionContext {
  prosecutorName: string;
  defenseName?: string; // Optional, defaults to "Defense" or "Defense Counsel"
  nextPhase: TrialPhase;
  witnessNumber?: number; // For witness phases
}

/**
 * Get the hardcoded judge instruction for a given phase
 */
export function getJudgeInstructionForPhase(context: JudgeInstructionContext): string {
  const { prosecutorName, defenseName = 'Defense', nextPhase, witnessNumber } = context;
  const phaseName = nextPhase.name.toLowerCase();

  // Opening Statements
  if (phaseName.includes('opening statement - prosecution')) {
    return `${prosecutorName}, you may proceed with your opening statement.`;
  }

  if (phaseName.includes('opening statement - defense')) {
    return `${defenseName}, you may proceed with your opening statement.`;
  }

  // Direct Examination - Prosecution
  if (phaseName.includes('prosecution witness') && phaseName.includes('direct examination')) {
    if (witnessNumber === 1) {
      return `Prosecution, you may call your first witness.`;
    } else if (witnessNumber === 2) {
      return `Prosecution, you may call your second witness.`;
    } else if (witnessNumber === 3) {
      return `Prosecution, you may call your third witness.`;
    } else {
      return `Prosecution, you may call your witness.`;
    }
  }

  // Cross-Examination - Defense cross-examining prosecution witness
  if (phaseName.includes('prosecution witness') && phaseName.includes('cross-examination')) {
    return `${defenseName}, you may proceed with cross-examination.`;
  }

  // Direct Examination - Defense
  if (phaseName.includes('defense witness') && phaseName.includes('direct examination')) {
    if (witnessNumber === 1) {
      return `Defense, you may call your first witness.`;
    } else if (witnessNumber === 2) {
      return `Defense, you may call your second witness.`;
    } else if (witnessNumber === 3) {
      return `Defense, you may call your third witness.`;
    } else {
      return `Defense, you may call your witness.`;
    }
  }

  // Cross-Examination - Prosecution cross-examining defense witness
  if (phaseName.includes('defense witness') && phaseName.includes('cross-examination')) {
    return `Prosecution, you may proceed with cross-examination.`;
  }

  // Redirect - Prosecution redirect
  if (phaseName.includes('prosecution witness') && phaseName.includes('redirect')) {
    return `Prosecution, do you wish to redirect?`;
  }

  // Redirect - Defense redirect
  if (phaseName.includes('defense witness') && phaseName.includes('redirect')) {
    return `Defense, do you wish to redirect?`;
  }

  // Closing Statements
  if (phaseName.includes('closing statement - prosecution')) {
    return `Prosecution, you may proceed with your closing argument.`;
  }

  if (phaseName.includes('closing statement - defense')) {
    return `${defenseName}, you may proceed with your closing argument.`;
  }

  // Fallback
  return `Counsel, you may proceed.`;
}

/**
 * Check if a phase requires a judge instruction before it
 */
export function requiresJudgeInstruction(phase: TrialPhase): boolean {
  const phaseName = phase.name.toLowerCase();
  
  // Judge instructions are needed before all counsel action phases
  // But NOT before judge/jury actions (deliberation, verdict)
  if (phaseName.includes('deliberation') || phaseName.includes('verdict delivery')) {
    return false;
  }

  // All trial phases except the judge instruction phase itself need instructions
  if (phase.category === 'trial' && !phaseName.includes('judge instruction')) {
    return true;
  }

  return false;
}

/**
 * Extract witness number from phase name
 */
export function extractWitnessNumber(phaseName: string): number | undefined {
  const match = phaseName.match(/witness (\d+)/i);
  return match ? parseInt(match[1], 10) : undefined;
}

