import { describe, expect, it } from 'vitest';
import {
  adviceFor, comesBackText, creditCostLabel, creditsLeftLabel, formatCredits, isLocked,
  parseCreditStatus, parseStartTrial, type CreditStatus
} from './credits';

const status = (over: Partial<CreditStatus> = {}): CreditStatus => ({
  enforced: true, tier: 'free', allowance: 2, allowance_used: 0.5, allowance_left: 1.5, bonus: 0, remaining: 1.5, resets_at: null,
  allowed_minutes: [5, 10], jury_allowed: false, all_cases_allowed: false, costs: { '5': 1, '10': 1.5, '20': 3, '30': 5 }, ...over
});
const NOW = new Date('2026-11-25T12:00:00Z');

describe('parsing what the server sends', () => {
  it('reads a credit status, and refuses nonsense', () => {
    const parsed = parseCreditStatus({ tier: 'pro', allowance: 100, allowance_used: 20, allowance_left: 80, bonus: 2.5, remaining: 82.5,
      resets_at: '2026-12-20T00:00:00Z', allowed_minutes: [5, 10, 20, 30], jury_allowed: true, all_cases_allowed: true, costs: { '5': 1 } });
    expect(parsed?.tier).toBe('pro');
    expect(parsed?.remaining).toBe(82.5);
    expect(parsed?.allowed_minutes).toEqual([5, 10, 20, 30]);
    expect(parseCreditStatus(null)).toBeNull();
    expect(parseCreditStatus({ tier: 'vip' })).toBeNull();
  });

  it('reads numbers that arrive as text', () => {
    expect(parseCreditStatus({ tier: 'free', remaining: '1.50', allowance_left: '1.5' })?.remaining).toBe(1.5);
  });

  it('reads a successful and a refused start', () => {
    expect(parseStartTrial({ ok: true, charged: 1.5, remaining: 0.5, tier: 'free', already_charged: false })).toEqual({ ok: true, charged: 1.5, remaining: 0.5, tier: 'free', already_charged: false });
    const refused = parseStartTrial({ ok: false, error: 'already_started', minutes: 5, mode: 'judge', tier: 'free' });
    expect(refused).toMatchObject({ ok: false, error: 'already_started', minutes: 5, mode: 'judge' });
    expect(parseStartTrial(null)).toEqual({ ok: false, error: 'unavailable' });
  });
});

describe('costs and labels', () => {
  it('formats credits without trailing zeros', () => {
    expect([1, 1.5, 3, 0.5, 2.25].map(formatCredits)).toEqual(['1', '1.5', '3', '0.5', '2.25']);
  });

  it('labels what each length costs', () => {
    expect([5, 10, 20, 30].map(creditCostLabel)).toEqual(['1 credit', '1.5 credits', '3 credits', '5 credits']);
    expect(creditCostLabel(15)).toBe('');
  });

  it('says what is left for each plan', () => {
    expect(creditsLeftLabel(status())).toBe('1.5 credits left today');
    expect(creditsLeftLabel(status({ remaining: 1 }))).toBe('1 credit left today');
    expect(creditsLeftLabel(status({ tier: 'guest', allowance: 3, remaining: 2 }))).toBe('2 of 3 credits left');
    expect(creditsLeftLabel(status({ tier: 'pro', remaining: 74 }))).toBe('74 credits left this month');
    expect(creditsLeftLabel(null)).toBe('');
  });

  it('says when credits come back', () => {
    expect(comesBackText('2026-11-25T12:40:00Z', NOW)).toBe('in 40 minutes');
    expect(comesBackText('2026-11-25T15:00:00Z', NOW)).toBe('in 3 hours');
    expect(comesBackText('2026-11-25T12:01:00Z', NOW)).toBe('in 1 minute');
    expect(comesBackText('2026-11-25T11:00:00Z', NOW)).toBe('soon');
    expect(comesBackText(null, NOW)).toBe('');
  });
});

describe('what a plan may start', () => {
  it('locks the long trials and jury for free and guest, nothing for Pro', () => {
    const free = status();
    expect(isLocked(free, { minutes: 20 })).toBe(true);
    expect(isLocked(free, { minutes: 30 })).toBe(true);
    expect(isLocked(free, { minutes: 10 })).toBe(false);
    expect(isLocked(free, { mode: 'jury' })).toBe(true);
    expect(isLocked(free, { mode: 'judge' })).toBe(false);
    const pro = status({ tier: 'pro', allowed_minutes: [5, 10, 20, 30], jury_allowed: true });
    expect(isLocked(pro, { minutes: 30, mode: 'jury' })).toBe(false);
  });

  it('locks nothing when the plan is not known, so the server decides', () => {
    expect(isLocked(null, { minutes: 30, mode: 'jury' })).toBe(false);
  });

  it('locks and shows nothing while the credit rules are switched off', () => {
    const off = status({ enforced: false });
    expect(isLocked(off, { minutes: 30, mode: 'jury' })).toBe(false);
    expect(creditsLeftLabel(off)).toBe('');
    expect(parseCreditStatus({ tier: 'free', enforced: false })?.enforced).toBe(false);
    expect(parseCreditStatus({ tier: 'free' })?.enforced).toBe(true);
  });
});

describe('what to tell the player when a trial cannot start', () => {
  it('offers Pro for a locked length, court or case', () => {
    for (const error of ['duration_locked', 'jury_locked', 'case_locked'] as const) {
      const advice = adviceFor({ ok: false, error, upgrade_required: true, tier: 'free' }, NOW)!;
      expect(advice.canUpgrade).toBe(true);
      expect(advice.needsAccount).toBe(false);
      expect(advice.message).toMatch(/Pro/);
    }
  });

  it('asks a guest to make a free account first', () => {
    const advice = adviceFor({ ok: false, error: 'jury_locked', upgrade_required: true, tier: 'guest' }, NOW)!;
    expect(advice.needsAccount).toBe(true);
    expect(advice.canUpgrade).toBe(false);
    const out = adviceFor({ ok: false, error: 'no_credits', tier: 'guest', cost: 1, remaining: 0 }, NOW)!;
    expect(out.needsAccount).toBe(true);
    expect(out.message).toMatch(/2 credits every day/);
  });

  it('tells a free player when credits come back and offers Pro', () => {
    const advice = adviceFor({ ok: false, error: 'no_credits', tier: 'free', cost: 1.5, remaining: 0.5, resets_at: '2026-11-25T15:00:00Z' }, NOW)!;
    expect(advice.message).toContain('needs 1.5');
    expect(advice.message).toContain('you have 0.5');
    expect(advice.message).toContain('in 3 hours');
    expect(advice.canUpgrade).toBe(true);
  });

  it('does not offer Pro to someone who already has it', () => {
    const advice = adviceFor({ ok: false, error: 'no_credits', tier: 'pro', cost: 5, remaining: 2, resets_at: '2026-12-20T00:00:00Z' }, NOW)!;
    expect(advice.canUpgrade).toBe(false);
    expect(advice.message).toMatch(/renew/);
  });

  it('says nothing for a success or for a game that was already charged, and is calm about the rest', () => {
    expect(adviceFor({ ok: true, charged: 1, remaining: 1, tier: 'free', already_charged: false })).toBeNull();
    expect(adviceFor({ ok: false, error: 'already_started', minutes: 5, mode: 'judge' })).toBeNull();
    expect(adviceFor({ ok: false, error: 'unavailable' })!.title).toBe("COULDN'T START");
  });
});
