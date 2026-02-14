export type TrialLength = 'SHORT' | 'MEDIUM' | 'LONG';

export type Speaker = 'JUDGE' | 'PROSECUTION' | 'DEFENSE' | 'WITNESS' | 'IDLE';

export type Phase =
  | 'PRE_TRIAL'
  | 'OPENING'
  | 'WITNESS'
  | 'CLOSING'
  | 'DELIBERATION'
  | 'VERDICT';

export interface TrialState {
  phase: Phase;
  activeSpeaker: Speaker;
  witnessIndex: number;
  directCount: number;
  crossCount: number;
  objectionsUsed: Record<'PROSECUTION' | 'DEFENSE', number>;
  isPaused: boolean;
  activeObjection: Objection | null;
}

export interface TrialConfig {
  maxWitnesses: number;
  maxDirectQuestions: number;
  maxCrossQuestions: number;
  openingTokens: number;
  closingTokens: number;
}

export interface Objection {
  by: 'PROSECUTION' | 'DEFENSE';
  statement: string;
  timestamp: string;
  ruling?: ObjectionRuling;
}

export interface ObjectionRuling {
  ruling: 'SUSTAINED' | 'OVERRULED';
  reason: string;
  effect: 'CONTINUE' | 'REPHRASE' | 'STRIKE';
}

export type Verdict = 'GUILTY' | 'NOT_GUILTY';

export interface Juror {
  id: number;
  name: string;
  age: number;
  occupation: string;
  background: string;
  vote?: Verdict;
}

export interface JuryVerdict {
  verdict: Verdict;
  guiltyVotes: number;
  notGuiltyVotes: number;
  unanimous: boolean;
  voteHistory: Record<number, Verdict[]>;
}
