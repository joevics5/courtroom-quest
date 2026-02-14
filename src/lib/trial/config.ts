import type { TrialLength, TrialConfig } from './types';

export const TRIAL_CONFIG: Record<TrialLength, TrialConfig> = {
  SHORT: {
    maxWitnesses: 1,
    maxDirectQuestions: 3,
    maxCrossQuestions: 4,
    openingTokens: 3000,
    closingTokens: 300,
  },
  MEDIUM: {
    maxWitnesses: 2,
    maxDirectQuestions: 5,
    maxCrossQuestions: 6,
    openingTokens: 4000,
    closingTokens: 500,
  },
  LONG: {
    maxWitnesses: 3,
    maxDirectQuestions: 7,
    maxCrossQuestions: 8,
    openingTokens: 5000,
    closingTokens: 800,
  },
};

export function getTrialConfigForDuration(minutes: 15 | 30 | 60): TrialConfig {
  if (minutes === 15) return TRIAL_CONFIG.SHORT;
  if (minutes === 30) return TRIAL_CONFIG.MEDIUM;
  return TRIAL_CONFIG.LONG;
}

export function getTrialLength(minutes: 15 | 30 | 60): TrialLength {
  if (minutes === 15) return 'SHORT';
  if (minutes === 30) return 'MEDIUM';
  return 'LONG';
}
