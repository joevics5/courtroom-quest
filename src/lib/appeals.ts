/**
 * Appeals: a player who lost can ask the court to reopen the case.
 *
 * The appeal only decides whether the case is worth another hearing. If the judge grants it, the case goes back to
 * the start of the pre-trial with the same jurors and the same transcript, and the existing trial runs again.
 * Nothing new can be added: appeals refer only to evidence and witnesses that already exist in the case.
 *
 * Everything lives in the session's session_state under `appeals`, so no existing table changes shape.
 */

export const MAX_APPEALS = 2;
export const RESPONSE_WINDOW_HOURS = 48;
export const MIN_EXPLANATION = 30;
export const MAX_EXPLANATION = 1200;

export type AppealReason = 'missed_evidence' | 'missed_witness' | 'other';

export const APPEAL_REASONS: { id: AppealReason; label: string; hint: string }[] = [
  { id: 'missed_evidence', label: 'Missed Evidence', hint: 'Evidence in the case that you failed to introduce or use well.' },
  { id: 'missed_witness', label: 'Missed Witness Insight', hint: 'Something an existing witness knew that you failed to bring out.' },
  { id: 'other', label: 'Other', hint: 'Another reason the verdict should be reconsidered.' }
];

export type AppealStatus =
  | 'awaiting_response' // waiting for opposing counsel
  | 'awaiting_ruling'   // opposing counsel answered; the judge has not ruled yet
  | 'granted'           // the judge will reopen the case
  | 'denied';           // the original verdict stands

export interface AppealResponse {
  decision: 'accept' | 'oppose';
  explanation: string;
  evidence_ids: string[];
  witness_ids: string[];
  /** 'ai', a user id, or 'timeout' when opposing counsel never answered. */
  by: string;
  created_at: string;
}

export interface AppealRuling {
  granted: boolean;
  reasoning: string;
  created_at: string;
}

export interface Appeal {
  id: string;
  /** 1 or 2: which appeal this is for the case. */
  number: number;
  status: AppealStatus;
  reason: AppealReason;
  explanation: string;
  evidence_ids: string[];
  witness_ids: string[];
  created_at: string;
  /** After this moment a human opponent's silence counts as "no opposition". */
  response_due_at: string;
  response?: AppealResponse;
  ruling?: AppealRuling;
  /** Set by the database once the case has been put back at the start of the pre-trial. */
  reopened?: boolean;
}

export interface AppealSubmission {
  reason: AppealReason | null;
  explanation: string;
  evidence_ids: string[];
  witness_ids: string[];
}

type SessionStateLike = Record<string, any> | null | undefined;

export function getAppeals(state: SessionStateLike): Appeal[] {
  const list = state?.appeals;
  return Array.isArray(list) ? (list as Appeal[]) : [];
}

export function isVerdictAccepted(state: SessionStateLike): boolean {
  return state?.verdictAccepted === true;
}

/** The appeal that is still moving through the process, if any. */
export function activeAppeal(state: SessionStateLike): Appeal | null {
  const last = getAppeals(state).slice(-1)[0];
  return last && (last.status === 'awaiting_response' || last.status === 'awaiting_ruling') ? last : null;
}

export function appealsRemaining(state: SessionStateLike): number {
  return Math.max(0, MAX_APPEALS - getAppeals(state).length);
}

/**
 * Can the player appeal right now? Only the side that lost, only while appeals remain, only when no appeal
 * is already in progress, and not after they accepted the verdict.
 */
export function canAppeal(args: { playerWon: boolean; state: SessionStateLike }): boolean {
  if (args.playerWon) return false;
  if (isVerdictAccepted(args.state)) return false;
  if (activeAppeal(args.state)) return false;
  return appealsRemaining(args.state) > 0;
}

/** Why the form cannot be submitted yet (null when it can). */
export function validateAppeal(input: AppealSubmission): string | null {
  if (!input.reason) return 'Choose a reason for your appeal.';
  const text = input.explanation.trim();
  if (text.length < MIN_EXPLANATION) return `Explain your appeal in at least ${MIN_EXPLANATION} characters.`;
  if (text.length > MAX_EXPLANATION) return `Keep your explanation under ${MAX_EXPLANATION} characters.`;
  if (input.reason === 'missed_evidence' && input.evidence_ids.length === 0) return 'Select the evidence you missed.';
  if (input.reason === 'missed_witness' && input.witness_ids.length === 0) return 'Select the witness whose insight you missed.';
  return null;
}

/** Keeps only ids that exist in the case, so a hand-made request cannot point at things that are not there. */
export function onlyKnownIds(ids: string[], known: string[]): string[] {
  const set = new Set(known);
  return Array.from(new Set(ids)).filter(id => set.has(id));
}

export function newAppeal(args: {
  state: SessionStateLike;
  submission: AppealSubmission;
  knownEvidenceIds: string[];
  knownWitnessIds: string[];
  now?: Date;
}): Appeal {
  const now = args.now ?? new Date();
  const error = validateAppeal(args.submission);
  if (error) throw new Error(error);
  return {
    id: `appeal-${now.getTime()}`,
    number: getAppeals(args.state).length + 1,
    status: 'awaiting_response',
    reason: args.submission.reason as AppealReason,
    explanation: args.submission.explanation.trim(),
    evidence_ids: onlyKnownIds(args.submission.evidence_ids, args.knownEvidenceIds),
    witness_ids: onlyKnownIds(args.submission.witness_ids, args.knownWitnessIds),
    created_at: now.toISOString(),
    response_due_at: new Date(now.getTime() + RESPONSE_WINDOW_HOURS * 3600_000).toISOString()
  };
}

/** Returns the appeals list with one appeal replaced. */
export function withAppealUpdated(state: SessionStateLike, id: string, patch: Partial<Appeal>): Appeal[] {
  return getAppeals(state).map(a => (a.id === id ? { ...a, ...patch } : a));
}

export function responseIsOverdue(appeal: Appeal, now: Date = new Date()): boolean {
  return appeal.status === 'awaiting_response' && now.getTime() >= new Date(appeal.response_due_at).getTime();
}

/** Feature switch while appeals are being built: add ?appeals=on to the address once to turn it on for this browser. */
export function appealsEnabled(): boolean {
  try {
    if (typeof window === 'undefined') return false;
    const q = new URLSearchParams(window.location.search).get('appeals');
    if (q === 'on') window.localStorage.setItem('cq-appeals', 'on');
    if (q === 'off') window.localStorage.removeItem('cq-appeals');
    return window.localStorage.getItem('cq-appeals') === 'on';
  } catch {
    return false;
  }
}
