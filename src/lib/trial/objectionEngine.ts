import type { Objection, ObjectionRuling, Phase } from './types';
import { callAI } from './aiAdapter';
import { PROMPTS } from './prompts';

export interface ObjectionState {
  canObject: boolean;
  cooldownExpired: boolean;
  nextObjectionAllowedAt: number;
}

export function canMakeObjection(
  phase: Phase,
  activeSpeaker: string,
  objector: 'PROSECUTION' | 'DEFENSE',
  cooldownState: ObjectionState,
  isPaused: boolean
): boolean {
  const validPhases: Phase[] = ['OPENING', 'WITNESS', 'CLOSING'];

  if (!validPhases.includes(phase)) return false;
  if (isPaused) return false;
  if (!cooldownState.cooldownExpired) return false;

  if (objector === 'DEFENSE' && activeSpeaker === 'DEFENSE') return false;
  if (objector === 'PROSECUTION' && activeSpeaker === 'PROSECUTION') return false;

  return true;
}

export async function resolveObjection({
  objection,
  phase,
  context,
}: {
  objection: Objection;
  phase: string;
  context: string;
}): Promise<ObjectionRuling> {
  try {
    const response = await callAI({
      system: PROMPTS.objectionRuling(
        phase,
        objection.by,
        objection.statement,
        context
      ),
      user: '',
      maxTokens: 50000, // Up to 50,000 tokens for comprehensive objection rulings
    });

    const parsed = JSON.parse(response);

    return {
      ruling: parsed.ruling as 'SUSTAINED' | 'OVERRULED',
      reason: parsed.reason || 'Ruling made.',
      effect: parsed.effect as 'CONTINUE' | 'REPHRASE' | 'STRIKE',
    };
  } catch (error) {
    console.error('Objection resolution failed:', error);

    return {
      ruling: 'OVERRULED',
      reason: 'The court finds no merit in the objection.',
      effect: 'CONTINUE',
    };
  }
}

export function applyObjectionRuling(
  ruling: ObjectionRuling
): {
  speakerEffect: string;
  judgeStatement: string;
  timePenalty: number;
} {
  if (ruling.ruling === 'SUSTAINED') {
    return {
      speakerEffect: 'MUST_REPHRASE',
      judgeStatement: `Objection sustained. ${ruling.reason} Counsel, rephrase.`,
      timePenalty: 10,
    };
  }

  return {
    speakerEffect: 'CONTINUE',
    judgeStatement: `Objection overruled. ${ruling.reason} Proceed.`,
    timePenalty: 0,
  };
}

export function createObjectionCooldown(): number {
  return Date.now() + 60000;
}

export function checkCooldown(nextAllowedTime: number): boolean {
  return Date.now() >= nextAllowedTime;
}

export function formatObjectionLog(
  objections: Objection[]
): string {
  if (objections.length === 0) {
    return 'No objections were raised during trial.';
  }

  return objections
    .map((obj, index) => {
      return `${index + 1}. ${obj.by} objected: "${obj.statement}" - ${obj.ruling?.ruling || 'PENDING'} (${obj.ruling?.reason || ''})`;
    })
    .join('\n');
}
