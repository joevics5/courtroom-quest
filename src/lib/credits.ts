import { supabase } from './supabase';
import type { TrialType } from '../types';

/** Trial credits: what each length costs, what a player has left, and what their plan may start.
 *  The server (start_trial) is the authority; this file only reads its answers and mirrors its rules for display. */

export type Tier = 'guest' | 'free' | 'pro';

export interface CreditStatus {
  /** False while the credit rules are switched off: nothing is charged, locked or shown. */
  enforced: boolean;
  tier: Tier;
  allowance: number;
  allowance_used: number;
  allowance_left: number;
  bonus: number;
  remaining: number;
  resets_at: string | null;
  allowed_minutes: number[];
  jury_allowed: boolean;
  all_cases_allowed: boolean;
  costs: Record<string, number>;
}

export type StartTrialError =
  | 'not_signed_in' | 'session_not_found' | 'bad_mode' | 'duration_not_allowed'
  | 'duration_locked' | 'jury_locked' | 'case_locked' | 'no_credits' | 'already_started' | 'unavailable';

export type StartTrialResult =
  | { ok: true; charged: number; remaining: number; tier: Tier; already_charged: boolean }
  | {
      ok: false;
      error: StartTrialError;
      upgrade_required?: boolean;
      cost?: number;
      remaining?: number;
      resets_at?: string | null;
      tier?: Tier;
      /** For 'already_started': what the game was charged for. */
      minutes?: number;
      mode?: TrialType;
    };

/** Credits a trial of this length costs (the same numbers as the database). */
export const CREDIT_COSTS: Record<number, number> = { 5: 1, 10: 1.5, 20: 3, 30: 5 };

const isTier = (v: unknown): v is Tier => v === 'guest' || v === 'free' || v === 'pro';
const num = (v: unknown, fallback = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : Number.isFinite(Number(v)) ? Number(v) : fallback);

export function parseCreditStatus(raw: unknown): CreditStatus | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (!isTier(r.tier)) return null;
  return {
    enforced: r.enforced !== false,
    tier: r.tier,
    allowance: num(r.allowance),
    allowance_used: num(r.allowance_used),
    allowance_left: num(r.allowance_left),
    bonus: num(r.bonus),
    remaining: num(r.remaining),
    resets_at: typeof r.resets_at === 'string' ? r.resets_at : null,
    allowed_minutes: Array.isArray(r.allowed_minutes) ? r.allowed_minutes.map(Number).filter(Number.isFinite) : [5, 10],
    jury_allowed: r.jury_allowed === true,
    all_cases_allowed: r.all_cases_allowed === true,
    costs: r.costs && typeof r.costs === 'object' ? (r.costs as Record<string, number>) : { '5': 1, '10': 1.5, '20': 3, '30': 5 }
  };
}

export function parseStartTrial(raw: unknown): StartTrialResult {
  if (!raw || typeof raw !== 'object') return { ok: false, error: 'unavailable' };
  const r = raw as Record<string, unknown>;
  if (r.ok === true) {
    return {
      ok: true,
      charged: num(r.charged),
      remaining: num(r.remaining),
      tier: isTier(r.tier) ? r.tier : 'free',
      already_charged: r.already_charged === true
    };
  }
  return {
    ok: false,
    error: typeof r.error === 'string' ? (r.error as StartTrialError) : 'unavailable',
    upgrade_required: r.upgrade_required === true,
    cost: r.cost === undefined ? undefined : num(r.cost),
    remaining: r.remaining === undefined ? undefined : num(r.remaining),
    resets_at: typeof r.resets_at === 'string' ? r.resets_at : null,
    tier: isTier(r.tier) ? r.tier : undefined,
    minutes: r.minutes === undefined ? undefined : num(r.minutes),
    mode: r.mode === 'judge' || r.mode === 'jury' ? r.mode : undefined
  };
}

/** 1 -> "1", 1.5 -> "1.5", 0.5 -> "0.5". */
export function formatCredits(n: number): string {
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100);
}

export function creditCostLabel(minutes: number): string {
  const cost = CREDIT_COSTS[minutes];
  if (cost === undefined) return '';
  return `${formatCredits(cost)} ${cost === 1 ? 'credit' : 'credits'}`;
}

/** Whether this plan can't start the option. Unknown status (offline) or credits switched off locks nothing: the server decides. */
export function isLocked(status: CreditStatus | null, option: { minutes?: number; mode?: TrialType }): boolean {
  if (!status || !status.enforced) return false;
  if (option.minutes !== undefined && !status.allowed_minutes.includes(option.minutes)) return true;
  if (option.mode === 'jury' && !status.jury_allowed) return true;
  return false;
}

/** "1.5 credits left today", "2 of 3 credits left", "74 credits left this month". */
export function creditsLeftLabel(status: CreditStatus | null): string {
  if (!status || !status.enforced) return '';
  const left = formatCredits(status.remaining);
  const word = status.remaining === 1 ? 'credit' : 'credits';
  if (status.tier === 'guest') return `${left} of ${formatCredits(status.allowance + status.bonus)} ${word} left`;
  if (status.tier === 'pro') return `${left} ${word} left this month`;
  return `${left} ${word} left today`;
}

/** When the allowance comes back, in words: "in 3 hours", "in 40 minutes", "tomorrow". */
export function comesBackText(resetsAt: string | null | undefined, now: Date = new Date()): string {
  if (!resetsAt) return '';
  const ms = new Date(resetsAt).getTime() - now.getTime();
  if (!Number.isFinite(ms) || ms <= 0) return 'soon';
  const minutes = Math.ceil(ms / 60000);
  if (minutes < 60) return `in ${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`;
  const hours = Math.round(minutes / 60);
  if (hours < 36) return `in ${hours} ${hours === 1 ? 'hour' : 'hours'}`;
  return `on ${new Date(resetsAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
}

export interface StartTrialAdvice {
  title: string;
  message: string;
  /** Show the Pro upgrade (when the player has an account). */
  canUpgrade: boolean;
  /** A guest has to make a free account first. */
  needsAccount: boolean;
}

/** What to tell the player when a trial could not be started. Null: nothing to show (it worked, or was handled). */
export function adviceFor(result: StartTrialResult, now: Date = new Date()): StartTrialAdvice | null {
  if (result.ok) return null;
  const failure = result as Extract<StartTrialResult, { ok: false }>;
  if (failure.error === 'already_started') return null;
  const guest = failure.tier === 'guest';
  switch (failure.error) {
    case 'duration_locked':
      return { title: 'PRO TRIALS', message: 'The 20 and 30 minute trials are part of Pro, along with jury trials, hard and famous cases and 100 credits a month.', canUpgrade: !guest, needsAccount: guest };
    case 'jury_locked':
      return { title: 'JURY TRIALS ARE PRO', message: 'Pick your jurors and persuade 12 citizens. Jury trials come with Pro, along with longer trials and 100 credits a month.', canUpgrade: !guest, needsAccount: guest };
    case 'case_locked':
      return { title: 'PRO CASES', message: 'Hard and famous cases come with Pro, along with jury trials, longer trials and 100 credits a month.', canUpgrade: !guest, needsAccount: guest };
    case 'no_credits': {
      if (guest) return { title: 'OUT OF CREDITS', message: 'You have used your guest credits. Create a free account to get 2 credits every day.', canUpgrade: false, needsAccount: true };
      const back = comesBackText(failure.resets_at, now);
      const needs = failure.cost !== undefined ? `This trial needs ${formatCredits(failure.cost)}, you have ${formatCredits(failure.remaining ?? 0)}. ` : '';
      return {
        title: 'OUT OF CREDITS',
        message: failure.tier === 'pro'
          ? `${needs}Your credits renew ${back || 'soon'}.`
          : `${needs}Your free credits come back ${back || 'tomorrow'}, or go Pro for 100 credits a month.`,
        canUpgrade: failure.tier !== 'pro',
        needsAccount: false
      };
    }
    case 'not_signed_in':
      return { title: 'SIGN IN', message: 'Please sign in to start a trial.', canUpgrade: false, needsAccount: false };
    default:
      return { title: "COULDN'T START", message: "We couldn't check your credits just now. Please try again in a moment.", canUpgrade: false, needsAccount: false };
  }
}

export async function fetchCreditStatus(): Promise<CreditStatus | null> {
  const { data, error } = await (supabase as any).rpc('my_credit_status');
  if (error) return null;
  return parseCreditStatus(data);
}

export async function startTrialCharge(sessionId: string, minutes: number, mode: TrialType): Promise<StartTrialResult> {
  const { data, error } = await (supabase as any).rpc('start_trial', { p_session_id: sessionId, p_minutes: minutes, p_mode: mode });
  if (error) return { ok: false, error: 'unavailable' };
  return parseStartTrial(data);
}

export type CheckoutResult =
  | { url: string }
  | { error: 'account_required' | 'already_pro' | 'not_ready' | 'failed' };

/** Asks the server for a Paystack checkout page for the Pro plan. */
export async function startProCheckout(): Promise<CheckoutResult> {
  const { data, error } = await supabase.functions.invoke('paystack-checkout', { body: {} });
  if (!error && data && typeof data.url === 'string') return { url: data.url };
  // A non-2xx reply carries the reason in its body.
  let reason: string | undefined = data && typeof data.error === 'string' ? data.error : undefined;
  const response = (error as { context?: Response } | null)?.context;
  if (!reason && response && typeof response.json === 'function') {
    try { reason = (await response.json())?.error; } catch { /* no readable body */ }
  }
  if (reason === 'account_required') return { error: 'account_required' };
  if (reason === 'already_pro') return { error: 'already_pro' };
  if (reason === 'Payments are not set up yet.') return { error: 'not_ready' };
  return { error: 'failed' };
}

/** Pro players: Paystack's page for the card and cancelling. */
export async function openManageSubscription(): Promise<string | null> {
  const { data } = await supabase.functions.invoke('paystack-manage', { body: {} });
  return data && typeof data.url === 'string' ? data.url : null;
}
