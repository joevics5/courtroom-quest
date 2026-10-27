/**
 * Runs an appeal against a game vs the AI: save the request, let opposing counsel answer, let the judge rule,
 * and reopen the case when the judge grants it. Each step is saved as it finishes, so leaving the screen part way
 * and coming back carries on from where it stopped.
 */

import { db } from './database';
import { supabase } from './supabase';
import { plainLawyerName, aiDefenseName } from './trialConfig';
import {
  getAppeals, newAppeal, withAppealUpdated, activeAppeal,
  type Appeal, type AppealSubmission
} from './appeals';
import { generateAppealResponse, generateAppealRuling, type AppealCase } from './ai/appealAI';
import type { CaseSession, PlayerRole, Verdict } from '../types';

/** Re-reads the session and applies a change to its state, so nothing saved elsewhere is overwritten. */
async function updateState(sessionId: string, change: (state: Record<string, any>) => Record<string, any>): Promise<CaseSession> {
  const session = await db.sessions.getSession(sessionId);
  if (!session) throw new Error('This case could not be found.');
  const state = (session.session_state ?? {}) as Record<string, any>;
  return db.sessions.updateSession(sessionId, { session_state: { ...state, ...change(state) } });
}

/** Appeals are offered only in games against the AI for now. */
export function appealsSupported(state: Record<string, any> | null | undefined): boolean {
  return !!state && !state.isMultiplayer && !state.sameDevicePlay;
}

export async function submitAppeal(sessionId: string, caseId: string, submission: AppealSubmission): Promise<Appeal> {
  const [evidence, witnesses] = await Promise.all([db.evidence.getCaseEvidence(caseId, true), db.witnesses.getCaseWitnesses(caseId)]);
  let created!: Appeal;
  await updateState(sessionId, state => {
    created = newAppeal({
      state, submission,
      knownEvidenceIds: evidence.map(e => e.id),
      knownWitnessIds: witnesses.map(w => w.id)
    });
    return { appeals: [...getAppeals(state), created] };
  });
  return created;
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
 * Carries the active appeal forward: the opposing counsel answers if it has not, then the judge rules.
 * Returns the session with the appeal's final state. Safe to call again after a failure or a reload.
 */
export async function runAIAppeal(args: {
  sessionId: string; caseId: string; playerRole: PlayerRole; verdict: Verdict;
  onStep?: (appeal: Appeal) => void;
}): Promise<CaseSession> {
  let session = await db.sessions.getSession(args.sessionId);
  if (!session) throw new Error('This case could not be found.');
  let appeal = activeAppeal(session.session_state);
  if (!appeal) return session;

  const [events, appealCase] = await Promise.all([
    db.trialEvents.getSessionEvents(args.sessionId),
    loadAppealCase(session, args.caseId, args.playerRole)
  ]);

  const save = async (patch: Partial<Appeal>) => {
    const id = appeal!.id;
    session = await updateState(args.sessionId, state => ({ appeals: withAppealUpdated(state, id, patch) }));
    appeal = getAppeals(session.session_state).find(a => a.id === id)!;
    args.onStep?.(appeal);
  };

  if (appeal.status === 'awaiting_response') {
    const response = await generateAppealResponse({ case: appealCase, appeal, verdict: args.verdict, events });
    await save({ response, status: 'awaiting_ruling' });
  }

  if (appeal.status === 'awaiting_ruling') {
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
