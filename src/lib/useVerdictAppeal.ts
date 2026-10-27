import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { db } from './database';
import {
  activeAppeal, appealsEnabled, appealsRemaining, getAppeals, isVerdictAccepted,
  type Appeal, type AppealSubmission
} from './appeals';
import { acceptVerdict, appealsSupported, reopenCase, runAIAppeal, submitAppeal } from './appealFlow';
import type { CaseSession, PlayerRole, Verdict } from '../types';

export type AppealBusy = null | 'accept' | 'run' | 'reopen';

/** Everything the verdict screen needs to offer, run and follow an appeal. */
export function useVerdictAppeal(args: {
  verdict: Verdict;
  playerRole: PlayerRole;
  playerWon: boolean;
  onReopen?: (session: CaseSession) => void;
}) {
  const { verdict, playerRole, playerWon, onReopen } = args;
  const enabled = useMemo(() => appealsEnabled(), []);
  const [session, setSession] = useState<CaseSession | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [busy, setBusy] = useState<AppealBusy>(null);
  const [error, setError] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const running = useRef(false);

  const applicableToPlayer = enabled && !playerWon;

  useEffect(() => {
    if (!applicableToPlayer) return;
    let cancelled = false;
    db.sessions.getSession(verdict.session_id)
      .then(s => { if (cancelled) return; if (s) setSession(s); else setLoadFailed(true); })
      .catch(() => { if (!cancelled) setLoadFailed(true); });
    return () => { cancelled = true; };
  }, [applicableToPlayer, verdict.session_id]);

  const state = session?.session_state ?? null;
  const supported = appealsSupported(state);
  const appeals = getAppeals(state);
  const last: Appeal | undefined = appeals[appeals.length - 1];
  const active = activeAppeal(state);
  const accepted = isVerdictAccepted(state);
  const remaining = appealsRemaining(state);
  const grantedPending = last?.status === 'granted' && !last.reopened;
  const caseId = session?.case_id ?? '';

  /** Until the player decides, the performance review stays hidden: it would tell them exactly what to appeal. */
  const loadingState = applicableToPlayer && !session && !loadFailed;
  const gated = applicableToPlayer && (loadingState || (supported && !accepted && (remaining > 0 || !!active || grantedPending)));
  const showPanel = applicableToPlayer && !!session && supported && (gated || appeals.length > 0);
  const canStartAppeal = gated && !active && !grantedPending && remaining > 0;

  const run = useCallback(async () => {
    if (running.current || !session) return;
    running.current = true;
    setBusy('run');
    setError('');
    try {
      const updated = await runAIAppeal({
        sessionId: session.id, caseId: session.case_id, playerRole, verdict,
        onStep: () => { /* each step is saved; the final state arrives below */ }
      });
      setSession(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.');
      db.sessions.getSession(session.id).then(s => s && setSession(s)).catch(() => {});
    } finally {
      running.current = false;
      setBusy(null);
    }
  }, [session, playerRole, verdict]);

  // An appeal that is waiting on the AI (just submitted, or left half way earlier) carries on by itself.
  const activeId = active?.id;
  const activeStatus = active?.status;
  useEffect(() => {
    if (!activeId || !supported || error || running.current) return;
    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, activeStatus, supported]);

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
    await submitAppeal(session.id, session.case_id, submission);
    const fresh = await db.sessions.getSession(session.id);
    if (fresh) setSession(fresh);
    setFormOpen(false);
  }, [session]);

  const reopen = useCallback(async () => {
    if (!session) return;
    setBusy('reopen');
    setError('');
    try {
      const reopened = await reopenCase(session.id);
      onReopen?.(reopened);
    } catch {
      setError('Could not reopen the case. Please try again.');
      setBusy(null);
    }
  }, [session, onReopen]);

  return {
    enabled, gated, showPanel, canStartAppeal, remaining, last, active, grantedPending, busy, error,
    caseId, nextNumber: appeals.length + 1, formOpen,
    openForm: () => setFormOpen(true), closeForm: () => setFormOpen(false),
    accept, submit, reopen, retry: () => { setError(''); void run(); },
    appealRound: (state?.appealRound as number | undefined) ?? 0
  };
}
