import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { db } from './database';
import {
  activeAppeal, appealsEnabled, appealsRemaining, getAppeals, isVerdictAccepted, opponentMode, responseIsOverdue,
  type Appeal, type AppealSubmission, type ResponseSubmission
} from './appeals';
import { acceptVerdict, advanceAppeal, appealsSupported, reopenCase, respondToAppeal, submitAppeal } from './appealFlow';
import type { CaseSession, PlayerRole, Verdict } from '../types';

export type AppealBusy = null | 'accept' | 'run' | 'reopen';

/**
 * What the appeal area of the verdict screen is showing:
 *  decide       the player lost and can accept or appeal
 *  working      an appeal is with the AI (opposing counsel / judge)
 *  waiting      an online opponent has not answered yet
 *  handoff      same device: the other player needs to answer on this screen
 *  respond      this player is the one being appealed against and has to answer
 *  granted      the judge granted it; the case can be reopened
 *  ruled        showing the judge's last decision (denied, or history)
 */
export type AppealStage = 'decide' | 'working' | 'waiting' | 'handoff' | 'respond' | 'granted' | 'ruled';

/** Everything the verdict screen needs to offer, run and follow an appeal. */
export function useVerdictAppeal(args: {
  verdict: Verdict;
  /** The side the signed-in player is on. */
  playerRole: PlayerRole;
  playerWon: boolean;
  userId?: string;
  onReopen?: (session: CaseSession) => void;
}) {
  const { verdict, playerRole, playerWon, userId, onReopen } = args;
  const enabled = useMemo(() => appealsEnabled(), []);
  const [session, setSession] = useState<CaseSession | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [busy, setBusy] = useState<AppealBusy>(null);
  const [error, setError] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [responseOpen, setResponseOpen] = useState(false);
  const running = useRef(false);

  // Winners load it too: an appeal may have been filed against them.
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    db.sessions.getSession(verdict.session_id)
      .then(s => { if (cancelled) return; if (s) setSession(s); else setLoadFailed(true); })
      .catch(() => { if (!cancelled) setLoadFailed(true); });
    return () => { cancelled = true; };
  }, [enabled, verdict.session_id]);

  const state = session?.session_state ?? null;
  const mode = opponentMode(state);
  const supported = appealsSupported(state);
  const appeals = getAppeals(state);
  const last: Appeal | undefined = appeals[appeals.length - 1];
  const active = activeAppeal(state);
  const accepted = isVerdictAccepted(state);
  const remaining = appealsRemaining(state);
  const grantedPending = last?.status === 'granted' && !last.reopened;
  const caseId = session?.case_id ?? '';

  // Online, an appeal filed by someone else is addressed to this player.
  const iAmRespondent = mode === 'human' && !!active && !!active.by_user_id && !!userId && active.by_user_id !== userId;
  // The side that filed the appeal (for the AI judge's context).
  const appellantRole: PlayerRole = iAmRespondent ? (playerRole === 'prosecution' ? 'defense' : 'prosecution') : playerRole;

  const appellantView = !playerWon && !iAmRespondent;
  const loadingState = enabled && !session && !loadFailed && appellantView;
  /** Until the player decides, the performance review stays hidden: it would tell them exactly what to appeal. */
  const gated = enabled && appellantView && (loadingState || (supported && !accepted && (remaining > 0 || !!active || grantedPending)));
  const canStartAppeal = gated && !!session && !active && !grantedPending && remaining > 0;

  let stage: AppealStage | null = null;
  if (enabled && session && supported) {
    if (iAmRespondent && active?.status === 'awaiting_response') stage = 'respond';
    else if (active?.status === 'awaiting_response') {
      stage = mode === 'local' ? 'handoff' : mode === 'human' && !responseIsOverdue(active) ? 'waiting' : 'working';
    } else if (active?.status === 'awaiting_ruling') stage = 'working';
    else if (grantedPending) stage = 'granted'; // either player can put the case back on the docket
    else if (canStartAppeal) stage = 'decide';
    else if (last?.ruling) stage = 'ruled';
  }
  const showPanel = stage !== null;

  const run = useCallback(async () => {
    if (running.current || !session) return;
    running.current = true;
    setBusy('run');
    setError('');
    try {
      setSession(await advanceAppeal({ sessionId: session.id, caseId: session.case_id, playerRole: appellantRole, verdict }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.');
      db.sessions.getSession(session.id).then(s => s && setSession(s)).catch(() => {});
    } finally {
      running.current = false;
      setBusy(null);
    }
  }, [session, appellantRole, verdict]);

  // An appeal that can move forward by itself (AI answer, a silent opponent's deadline, the judge) does so.
  const activeId = active?.id;
  const activeStatus = active?.status;
  const canMove = stage === 'working';
  useEffect(() => {
    if (!activeId || !canMove || error || running.current) return;
    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, activeStatus, canMove]);

  const accept = useCallback(async () => {
    if (!session) return;
    setBusy('accept');
    setError('');
    try {
      setSession(await acceptVerdict(session.id));
    } catch {
      setError('Could not save your choice. Please try again.');
    } finally {
      setBusy(null);
    }
  }, [session]);

  const submit = useCallback(async (submission: AppealSubmission) => {
    if (!session) return;
    await submitAppeal(session.id, session.case_id, submission, { userId, role: playerRole });
    const fresh = await db.sessions.getSession(session.id);
    if (fresh) setSession(fresh);
    setFormOpen(false);
  }, [session, userId, playerRole]);

  const respond = useCallback(async (response: ResponseSubmission) => {
    if (!session || !active) return;
    setSession(await respondToAppeal(session.id, session.case_id, active.id, response, userId ?? 'local'));
    setResponseOpen(false);
  }, [session, active, userId]);

  const reopen = useCallback(async () => {
    if (!session) return;
    setBusy('reopen');
    setError('');
    try {
      onReopen?.(await reopenCase(session.id));
    } catch {
      setError('Could not reopen the case. Please try again.');
      setBusy(null);
    }
  }, [session, onReopen]);

  return {
    enabled, gated, showPanel, stage, canStartAppeal, remaining, last, active, busy, error,
    caseId, nextNumber: appeals.length + 1,
    formOpen, openForm: () => setFormOpen(true), closeForm: () => setFormOpen(false),
    responseOpen, openResponse: () => setResponseOpen(true), closeResponse: () => setResponseOpen(false),
    accept, submit, respond, reopen, retry: () => { setError(''); void run(); },
    appealRound: (state?.appealRound as number | undefined) ?? 0
  };
}
