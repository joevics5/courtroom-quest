import type { TrialDuration } from '../types';
import { getTrialConfig, type TrialPhase } from './trialConfig';

export type TurnRole = 'prosecution' | 'defense' | 'witness' | 'judge';
export type PhaseType = 'direct' | 'cross' | 'redirect' | 'opening' | 'closing' | 'call_witness';

export interface TurnState {
  current_turn: TurnRole;
  current_witness_id: string | null;
  current_witness_name: string | null;
  current_phase_type: PhaseType | null;
  current_phase_number: number;
  prosecution_actions_remaining: number;
  phase_time_remaining: number; // in seconds
  witnesses_called: string[]; // witness IDs
  evidence_submitted: string[]; // evidence IDs
  objection_cooldown_until: number | null; // timestamp
}

export interface AllowedAction {
  action: string;
  description: string;
  requires_input?: boolean;
}

/**
 * Get allowed actions for the current turn and phase
 */
export function getAllowedActions(
  turnState: TurnState,
  phase: TrialPhase | undefined,
  trialDuration: TrialDuration,
  availableWitnesses: Array<{ id: string; name: string }>,
  availableEvidence: Array<{ id: string; exhibit_label?: string }>,
  isProsecutionTurn: boolean
): AllowedAction[] {
  const actions: AllowedAction[] = [];

  if (!phase) return actions;

  // Determine phase type from phase name
  const phaseName = phase.name.toLowerCase();
  const isDirect = phaseName.includes('direct examination');
  const isCross = phaseName.includes('cross-examination');
  const isRedirect = phaseName.includes('redirect');
  const isOpening = phaseName.includes('opening');
  const isClosing = phaseName.includes('closing');
  const isWitnessPhase = isDirect || isCross || isRedirect;

  // Call witness phase (before direct examination)
  if (isDirect && !turnState.current_witness_id) {
    const uncalledWitnesses = availableWitnesses.filter(
      w => !turnState.witnesses_called.includes(w.id)
    );
    
    if (uncalledWitnesses.length > 0) {
      actions.push({
        action: 'call_witness',
        description: 'Call a witness to the stand',
        requires_input: true
      });
    }
    actions.push({
      action: 'rest',
      description: 'Rest without calling a witness'
    });
    return actions;
  }

  // During witness examination phases
  if (isWitnessPhase && turnState.current_witness_id) {
    // Only allow questions if time remaining and prosecution has actions remaining (for prosecution turn)
    if (turnState.phase_time_remaining > 0 && (!isProsecutionTurn || turnState.prosecution_actions_remaining > 0)) {
      actions.push({
        action: 'ask_question',
        description: 'Ask a question to the witness',
        requires_input: true
      });
    }

    // Allow evidence submission during examination
    const unsubmittedEvidence = availableEvidence.filter(
      e => !turnState.evidence_submitted.includes(e.id)
    );
    if (unsubmittedEvidence.length > 0) {
      actions.push({
        action: 'submit_evidence',
        description: 'Submit evidence to the court',
        requires_input: true
      });
    }

    // Allow ending phase early
    actions.push({
      action: 'end_phase',
      description: 'End current examination phase'
    });

    // Allow resting (finishing early) cross-examination or redirect
     if (isCross || isRedirect) {
       actions.push({
         action: 'rest',
         description: `Rest from ${isCross ? 'cross-examination' : 'redirect'}`
       });
     }
  }

  // During opening/closing statements
  if (isOpening || isClosing) {
    if (turnState.phase_time_remaining > 0) {
      actions.push({
        action: 'make_statement',
        description: 'Continue your statement',
        requires_input: true
      });
    }
    actions.push({
      action: 'end_phase',
      description: 'Conclude your statement'
    });
  }

  // Objections (reactive, handled separately)
  // This is for when the opposing side is speaking

  return actions;
}

/**
 * Determine whose turn it is based on the phase
 */
export function getTurnForPhase(phase: TrialPhase | undefined): TurnRole {
  if (!phase) return 'judge';

  const phaseName = phase.name.toLowerCase();

  if (phaseName.includes('prosecution')) {
    return 'prosecution';
  }
  if (phaseName.includes('defense')) {
    return 'defense';
  }
  if (phaseName.includes('witness')) {
    // During witness examination, it alternates between prosecution/defense and witness
    // This will be managed by the turn state
    return 'prosecution'; // Default, will be updated based on examination type
  }
  if (phaseName.includes('judge') || phaseName.includes('deliberation') || phaseName.includes('verdict')) {
    return 'judge';
  }

  return 'judge';
}

/**
 * Check if a phase is a witness examination phase
 */
export function isWitnessPhase(phase: TrialPhase | undefined): boolean {
  if (!phase) return false;
  const phaseName = phase.name.toLowerCase();
  return phaseName.includes('direct examination') || 
         phaseName.includes('cross-examination') || 
         phaseName.includes('redirect');
}

/**
 * Get the examination type from phase name
 */
export function getExaminationType(phase: TrialPhase | undefined): PhaseType | null {
  if (!phase) return null;
  const phaseName = phase.name.toLowerCase();
  
  if (phaseName.includes('direct examination')) return 'direct';
  if (phaseName.includes('cross-examination')) return 'cross';
  if (phaseName.includes('redirect')) return 'redirect';
  
  return null;
}

/**
 * Initialize turn state for a new phase
 */
export function initializeTurnState(
  phase: TrialPhase | undefined,
  trialDuration: TrialDuration,
  previousState?: Partial<TurnState>
): TurnState {
  const config = getTrialConfig(trialDuration);
  const phaseDuration = phase ? (config.phaseDurations[phase.number] || 0) * 60 : 0; // Convert to seconds

  // Set prosecution actions based on trial duration and phase type
  let prosecutionActionsRemaining = 10; // Default

  if (phase) {
    const phaseName = phase.name.toLowerCase();

    // Set question limits for direct examination based on trial duration
    if (phaseName.includes('direct examination')) {
      switch (trialDuration) {
        case 15:
          prosecutionActionsRemaining = 3; // 3 direct questions for 15min trial
          break;
        case 30:
          prosecutionActionsRemaining = 5; // 5 direct questions for 30min trial
          break;
        case 60:
          prosecutionActionsRemaining = 7; // 7 direct questions for 60min trial
          break;
        default:
          prosecutionActionsRemaining = 5;
      }
    }
    // For other phases, use default or adjust as needed
  }

  return {
    current_turn: getTurnForPhase(phase),
    current_witness_id: previousState?.current_witness_id || null,
    current_witness_name: previousState?.current_witness_name || null,
    current_phase_type: getExaminationType(phase),
    current_phase_number: phase?.number || 0,
    prosecution_actions_remaining: previousState?.prosecution_actions_remaining ?? prosecutionActionsRemaining,
    phase_time_remaining: phaseDuration,
    witnesses_called: previousState?.witnesses_called || [],
    evidence_submitted: previousState?.evidence_submitted || [],
    objection_cooldown_until: previousState?.objection_cooldown_until || null
  };
}

