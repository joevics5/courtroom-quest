import { TRIAL_CONFIG, getTrialLength } from './config';
import type { TrialState, TrialLength } from './types';
import { callAI } from './aiAdapter';
import { PROMPTS } from './prompts';
import { db } from '../database';

export interface TrialContext {
  judgeName: string;
  prosecutorName: string;
  caseTitle: string;
  caseSummary: string;
  evidenceSummary: string;
  witnessTranscripts: string;
  witnesses: Array<{ name: string; role: string; profile: string }>;
  lastQuestion?: string;
  lastStatement?: string;
  trialSummary?: string;
  objections?: string;
}

export interface TrialStepResult {
  text: string | null;
  speaker: string | null;
  state: TrialState;
  requiresUserInput?: boolean;
  nextAction?: string;
}

export async function buildInvestigationFindings(caseId: string, sessionId: string): Promise<{ evidenceSummary: string; witnessTranscripts: string }> {
  console.log('[buildInvestigationFindings] 🔍 Starting investigation data collection');
  console.log('[buildInvestigationFindings] 📋 Case ID:', caseId, 'Session ID:', sessionId);

  // Get all evidence for the case
  const evidence = await db.evidence.getCaseEvidence(caseId, true); // Include hidden evidence
  console.log('[buildInvestigationFindings] 📄 Evidence found:', evidence.length);

  // Get all witness interactions from investigation
  const interactions = await db.interactions.getSessionInteractions(sessionId);
  console.log('[buildInvestigationFindings] 👥 Witness interactions found:', interactions.length);

  // Get witnesses for name lookup
  const witnesses = await db.witnesses.getCaseWitnesses(caseId);
  const witnessMap = new Map(witnesses.map(w => [w.id, w.name]));
  console.log('[buildInvestigationFindings] 👤 Witnesses found:', witnesses.length);

  // Build comprehensive evidence summary with full content
  const evidenceSummary = evidence.map(e => `
Exhibit ${e.exhibit_label || 'N/A'}: ${e.title}
Type: ${e.evidence_type}
Description: ${e.description || 'No description'}
Content: ${e.content || 'No content available'}
Tags: ${e.tags?.join(', ') || 'None'}
`).join('\n---\n');

  // Build witness transcripts from investigation interviews
  const witnessTranscripts = interactions.map(i => `
Witness: ${witnessMap.get(i.witness_id) || 'Unknown Witness'}
Question: ${i.question}
Response: ${i.response}
Phase: ${i.phase}
Timestamp: ${i.asked_at}
`).join('\n---\n');

  return {
    evidenceSummary: evidenceSummary || 'No evidence available from investigation.',
    witnessTranscripts: witnessTranscripts || 'No witness interviews were conducted during investigation.'
  };
}

export async function runTrialStep({
  state,
  action,
  trialDuration,
  context,
  userInput,
}: {
  state: TrialState;
  action: 'NEXT' | 'USER_INPUT' | 'OBJECT';
  trialDuration: 15 | 30 | 60;
  context: TrialContext;
  userInput?: string;
}): Promise<TrialStepResult> {
  const trialLength = getTrialLength(trialDuration);
  const config = TRIAL_CONFIG[trialLength];

  switch (state.phase) {
    case 'PRE_TRIAL': {
      const text = await callAI({
        system: PROMPTS.judgeOpen(context.judgeName, context.caseTitle),
        user: '',
        maxTokens: 50000,
      });

      return {
        text,
        speaker: 'Judge',
        state: {
          ...state,
          phase: 'OPENING',
          activeSpeaker: 'PROSECUTION',
        },
      };
    }

    case 'OPENING': {
      if (state.activeSpeaker === 'PROSECUTION') {
        const text = await callAI({
          system: PROMPTS.prosecutionOpening(context.caseSummary, context.evidenceSummary, context.witnessTranscripts),
          user: '',
          maxTokens: config.openingTokens,
        });

        return {
          text,
          speaker: context.prosecutorName,
          state: {
            ...state,
            activeSpeaker: 'DEFENSE',
          },
          nextAction: 'Awaiting defense opening statement',
        };
      }

      if (state.activeSpeaker === 'DEFENSE') {
        return {
          text: null,
          speaker: null,
          requiresUserInput: true,
          state: {
            ...state,
            phase: 'WITNESS',
            activeSpeaker: 'JUDGE',
            witnessIndex: 0,
            directCount: 0,
            crossCount: 0,
          },
          nextAction: 'Defense opening statement',
        };
      }
      break;
    }

    case 'WITNESS': {
      if (state.witnessIndex >= config.maxWitnesses) {
        return {
          text: state.witnessIndex > 0 ? 'The defense rests.' : 'The prosecution rests.',
          speaker: state.witnessIndex > 0 ? 'Defense Counsel' : context.prosecutorName,
          state: {
            ...state,
            phase: 'CLOSING',
            activeSpeaker: 'PROSECUTION',
          },
        };
      }

      const currentWitness = context.witnesses[state.witnessIndex];
      const isProsecutionWitness = state.witnessIndex % 2 === 0;

      if (state.activeSpeaker === 'JUDGE') {
        const text = isProsecutionWitness ? `Prosecution may call your next witness.` : `Defense may call your next witness.`;

        return {
          text,
          speaker: context.judgeName,
          state: { ...state, activeSpeaker: isProsecutionWitness ? 'PROSECUTION' : 'DEFENSE' },
        };
      }

      // Calling the witness
      if ((state.activeSpeaker === 'PROSECUTION' && isProsecutionWitness && state.directCount === 0) ||
          (state.activeSpeaker === 'DEFENSE' && !isProsecutionWitness && state.directCount === 0)) {
        if (isProsecutionWitness) {
          const text = await callAI({
            system: PROMPTS.callWitness(currentWitness.name, currentWitness.role),
            user: '',
            maxTokens: 50000,
          });

          return {
            text,
            speaker: context.prosecutorName,
            state: {
              ...state,
              directCount: 1,
            },
          };
        } else {
          // Defense calling witness - user input
          return {
            text: null,
            speaker: null,
            requiresUserInput: true,
            state: {
              ...state,
              directCount: 1,
            },
            nextAction: 'Call the witness',
          };
        }
      }

      // Direct examination
      if ((state.activeSpeaker === 'PROSECUTION' && isProsecutionWitness && state.directCount > 0) ||
          (state.activeSpeaker === 'DEFENSE' && !isProsecutionWitness && state.directCount > 0)) {
        const maxQuestions = config.maxDirectQuestions;
        if (state.directCount > maxQuestions) {
          const crossSpeaker = isProsecutionWitness ? 'DEFENSE' : 'PROSECUTION';
          return {
            text: 'No further questions, Your Honor.',
            speaker: isProsecutionWitness ? context.prosecutorName : 'Defense Counsel',
            state: {
              ...state,
              activeSpeaker: crossSpeaker,
              crossCount: 0,
            },
            nextAction: 'Cross-examination begins',
          };
        }

        if (isProsecutionWitness) {
          const text = await callAI({
            system: PROMPTS.directQuestion(currentWitness.name, context.caseSummary, context.evidenceSummary, context.witnessTranscripts),
            user: '',
            maxTokens: 50000,
          });

          return {
            text,
            speaker: context.prosecutorName,
            state: {
              ...state,
              activeSpeaker: 'WITNESS',
            },
          };
        } else {
          // Defense direct - user input
          return {
            text: null,
            speaker: null,
            requiresUserInput: true,
            state: {
              ...state,
              activeSpeaker: 'WITNESS',
            },
            nextAction: 'Direct examination question',
          };
        }
      }

      if (state.activeSpeaker === 'WITNESS') {
        const text = await callAI({
          system: PROMPTS.witnessAnswer(currentWitness.profile, context.lastQuestion || ''),
          user: context.lastQuestion || '',
          maxTokens: 50000,
        });

        const nextSpeaker = isProsecutionWitness ? 'PROSECUTION' : 'DEFENSE';
        return {
          text,
          speaker: currentWitness.name,
          state: {
            ...state,
            activeSpeaker: nextSpeaker,
            directCount: state.directCount + 1,
          },
        };
      }

      // Cross-examination
      if ((state.activeSpeaker === 'DEFENSE' && isProsecutionWitness) ||
          (state.activeSpeaker === 'PROSECUTION' && !isProsecutionWitness)) {
        if (state.crossCount >= config.maxCrossQuestions) {
          return {
            text: null,
            speaker: null,
            requiresUserInput: false,
            state: {
              ...state,
              witnessIndex: state.witnessIndex + 1,
              directCount: 0,
              crossCount: 0,
              activeSpeaker: 'JUDGE',
            },
            nextAction: 'Witness dismissed',
          };
        }

        if (isProsecutionWitness) {
          // Defense cross - user input
          return {
            text: null,
            speaker: null,
            requiresUserInput: true,
            state: {
              ...state,
              crossCount: state.crossCount + 1,
            },
            nextAction: 'Cross-examination question',
          };
        } else {
          // Prosecution cross - AI
          const text = await callAI({
            system: PROMPTS.crossExaminationQuestion(currentWitness.name),
            user: '',
            maxTokens: 50000,
          });

          return {
            text,
            speaker: context.prosecutorName,
            state: {
              ...state,
              activeSpeaker: 'WITNESS',
            },
          };
        }
      }
      break;
    }

    case 'CLOSING': {
      if (state.activeSpeaker === 'PROSECUTION') {
        const text = await callAI({
          system: PROMPTS.closingProsecution(context.caseSummary, context.evidenceSummary),
          user: '',
          maxTokens: config.closingTokens,
        });

        return {
          text,
          speaker: context.prosecutorName,
          state: { ...state, activeSpeaker: 'DEFENSE' },
          nextAction: 'Defense closing argument',
        };
      }

      if (state.activeSpeaker === 'DEFENSE') {
        return {
          text: null,
          speaker: null,
          requiresUserInput: true,
          state: {
            ...state,
            phase: 'DELIBERATION',
            activeSpeaker: 'JUDGE',
          },
          nextAction: 'Defense closing argument',
        };
      }
      break;
    }

    case 'DELIBERATION': {
      const text = await callAI({
        system: PROMPTS.judgeVerdict(
          context.trialSummary || 'Trial summary unavailable',
          context.objections || 'No objections'
        ),
        user: '',
        maxTokens: 50000, // Up to 50,000 tokens for comprehensive judge verdicts
      });

      return {
        text,
        speaker: context.judgeName,
        state: { ...state, phase: 'VERDICT', activeSpeaker: 'IDLE' },
      };
    }
  }

  return { text: null, speaker: null, state };
}
