/**
 * Runs an appeal: save the request, get opposing counsel's answer, let the judge rule, and reopen the case when the
 * judge grants it. Each step is saved as it finishes, so leaving the screen part way and coming back carries on.
 *
 * Opposing counsel is:
 *  - the AI in a game against the AI (it always accepts),
 *  - the other player in an online game (told through their dashboard, with 48 hours to answer),
 *  - the second player on the same device (answers on the spot).
 */

import { db } from './database';
import { supabase } from './supabase';
import { plainLawyerName, aiDefenseName } from './trialConfig';
import {
  getAppeals, newAppeal, newResponse, withAppealUpdated, activeAppeal, opponentMode, respondentUserId,
  aiAcceptance, timeoutResponse, responseIsOverdue,
  type Appeal, type AppealSubmission, type ResponseSubmission
} from './appeals';
import { generateAppealRuling, type AppealCase } from './ai/appealAI';
import type { CaseSession, PlayerRole, Verdict } from '../types';

/** Re-reads the session and applies a change to its state, so nothing saved elsewhere is overwritten. */
async function updateState(sessionId: string, change: (state: Record<string, any>) => Record<string, any>): Promise<CaseSession> {
  const session = await db.sessions.getSession(sessionId);
  if (!session) throw new Error('This case could not be found.');
  const state = (session.session_state ?? {}) as Record<string, any>;
  return db.sessions.updateSession(sessionId, { session_state: { ...state, ...change(state) } });
}

/** Appeals work in every kind of game. */
export function appealsSupported(state: Record<string, any> | null | undefined): boolean {
  return !!state;
}

export async function submitAppeal(
  sessionId: string, caseId: string, submission: AppealSubmission,
  who: { userId?: string; role: PlayerRole }
): Promise<Appeal> {
  const [evidence, witnesses] = await Promise.all([db.evidence.getCaseEvidence(caseId, true), db.witnesses.getCaseWitnesses(caseId)]);
  let created!: Appeal;
  await updateState(sessionId, state => {
    created = newAppeal({
      state, submission, byUserId: who.userId,
      knownEvidenceIds: evidence.map(e => e.id),
      knownWitnessIds: witnesses.map(w => w.id)
    });
    // An online opponent finds out through their dashboard: the game is marked as waiting for them.
    const respondent = opponentMode(state) === 'human' ? respondentUserId(state, who.role) : null;
    return { appeals: [...getAppeals(state), created], appealAwaiting: respondent };
  });
  return created;
}

/** Opposing counsel's answer (the other player online, or the second player on the same device). */
export async function respondToAppeal(
  sessionId: string, caseId: string, appealId: string, submission: ResponseSubmission, byUserId: string
): Promise<CaseSession> {
  const [evidence, witnesses] = await Promise.all([db.evidence.getCaseEvidence(caseId, true), db.witnesses.getCaseWitnesses(caseId)]);
  return updateState(sessionId, state => {
    const appeal = getAppeals(state).find(a => a.id === appealId);
    if (!appeal) throw new Error('That appeal could not be found.');
    if (appeal.status !== 'awaiting_response') throw new Error('This appeal has already been answered.');
    const response = newResponse({
      submission, by: byUserId,
      knownEvidenceIds: evidence.map(e => e.id),
      knownWitnessIds: witnesses.map(w => w.id)
    });
    return { appeals: withAppealUpdated(state, appealId, { response, status: 'awaiting_ruling' }), appealAwaiting: null };
  });
}

export async function acceptVerdict(sessionId: string): Promise<CaseSession> {
  return updateState(sessionId, () => ({ verdictAccepted: true }));
}

async function loadAppealCase(session: CaseSession, caseId: string, playerRole: PlayerRole): Promise<AppealCase> {
  const [caseRow, evidence, witnesses] = await Promise.all([
    db.cases.getCaseWithDetails(caseId),
    db.evidence.getCaseEvidence(caseId, true),
    db.witnesses.getCaseWitnesses(caseId)
  ]);
  const state = (session.session_state ?? {}) as Record<string, any>;
  return {
    title: caseRow?.title ?? 'The case',
    description: caseRow?.description ?? '',
    evidence,
    witnesses,
    appellantRole: playerRole,
    opponentName: playerRole === 'defense' ? plainLawyerName(state.prosecutorName || 'Prosecution') : aiDefenseName(session.id)
  };
}

/**
 * Carries the active appeal as far as it can go on its own:
 *  - vs the AI: opposing counsel accepts at once.
 *  - online: if the other player has not answered in time, the appeal goes forward unopposed; otherwise it waits.
 *  - same device: it waits for the second player to answer on screen.
 * Once an answer exists, the judge rules. Safe to call again after a failure or a reload.
 */
export async function advanceAppeal(args: {
  /** playerRole here is the APPELLANT's side. */
  sessionId: string; caseId: string; playerRole: PlayerRole; verdict: Verdict; now?: Date;
  onStep?: (appeal: Appeal) => void;
}): Promise<CaseSession> {
  let session = await db.sessions.getSession(args.sessionId);
  if (!session) throw new Error('This case could not be found.');
  let appeal = activeAppeal(session.session_state);
  if (!appeal) return session;

  const mode = opponentMode(session.session_state);
  const save = async (patch: Partial<Appeal>, extraState: Record<string, any> = {}) => {
    const id = appeal!.id;
    session = await updateState(args.sessionId, state => ({ appeals: withAppealUpdated(state, id, patch), ...extraState }));
    appeal = getAppeals(session.session_state).find(a => a.id === id)!;
    args.onStep?.(appeal);
  };

  // Nothing to do yet while the other player (or the second player on this device) still has to answer.
  if (appeal.status === 'awaiting_response' && !(mode === 'ai' || (mode === 'human' && responseIsOverdue(appeal, args.now)))) {
    return session;
  }

  const appealCase = await loadAppealCase(session, args.caseId, args.playerRole);

  if (appeal.status === 'awaiting_response') {
    if (mode === 'ai') {
      await save({ response: aiAcceptance(appealCase.opponentName), status: 'awaiting_ruling' });
    } else {
      await save({ response: timeoutResponse(args.now), status: 'awaiting_ruling' }, { appealAwaiting: null });
    }
  }

  if (appeal.status === 'awaiting_ruling') {
    const events = await db.trialEvents.getSessionEvents(args.sessionId);
    const earlier = getAppeals(session.session_state).filter(a => a.id !== appeal!.id);
    const ruling = await generateAppealRuling({ case: appealCase, appeal, verdict: args.verdict, events, earlier });
    await save({ ruling, status: ruling.granted ? 'granted' : 'denied' });
  }

  return session;
}

/** The judge granted the appeal: send the case back to the start of the pre-trial (the database does the reset). */
export async function reopenCase(sessionId: string): Promise<CaseSession> {
  const { error } = await supabase.rpc('reopen_case_for_appeal' as never, { p_session_id: sessionId } as never);
  if (error) throw error;
  const session = await db.sessions.getSession(sessionId);
  if (!session) throw new Error('This case could not be found.');
  return session;
}
