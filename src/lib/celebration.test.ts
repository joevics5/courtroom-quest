import { beforeEach, describe, expect, it } from 'vitest';
import { FRESH_VERDICT_MS, markCelebrated, resetCelebrated, shouldCelebrate } from './celebration';

const NOW = Date.parse('2026-11-10T12:00:00Z');
const at = (msAgo: number) => new Date(NOW - msAgo).toISOString();

beforeEach(() => resetCelebrated());

describe('shouldCelebrate', () => {
  it('celebrates a verdict that was just delivered', () => {
    expect(shouldCelebrate({ id: 'v1', delivered_at: at(5_000) }, NOW)).toBe(true);
    expect(shouldCelebrate({ id: 'v1', delivered_at: at(FRESH_VERDICT_MS - 1) }, NOW)).toBe(true);
  });

  it('does not celebrate an old verdict opened from history', () => {
    expect(shouldCelebrate({ id: 'v1', delivered_at: at(FRESH_VERDICT_MS + 1) }, NOW)).toBe(false);
    expect(shouldCelebrate({ id: 'v1', delivered_at: at(3 * 24 * 3600 * 1000) }, NOW)).toBe(false);
  });

  it('does not celebrate the same verdict twice in a session', () => {
    const verdict = { id: 'v1', delivered_at: at(1_000) };
    expect(shouldCelebrate(verdict, NOW)).toBe(true);
    markCelebrated('v1');
    expect(shouldCelebrate(verdict, NOW)).toBe(false);
    expect(shouldCelebrate({ id: 'v2', delivered_at: at(1_000) }, NOW)).toBe(true);
  });

  it('ignores a missing or unreadable time, and one far in the future', () => {
    expect(shouldCelebrate({ id: 'v1', delivered_at: 'not a date' }, NOW)).toBe(false);
    expect(shouldCelebrate({ id: 'v1', delivered_at: '' }, NOW)).toBe(false);
    expect(shouldCelebrate({ id: 'v1', delivered_at: at(-3_600_000) }, NOW)).toBe(false);
  });
});
