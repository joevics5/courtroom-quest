import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cached, invalidate } from './dataCache';

describe('dataCache', () => {
  beforeEach(() => { vi.useFakeTimers(); invalidate(); });
  afterEach(() => vi.useRealTimers());

  it('loads once, then serves from memory until it expires', async () => {
    const load = vi.fn(async () => ({ n: 1 }));
    await cached('k', 1000, load);
    await cached('k', 1000, load);
    expect(load).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1001);
    await cached('k', 1000, load);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('two screens asking at once share one request', async () => {
    const load = vi.fn(async () => [1, 2]);
    const [a, b] = await Promise.all([cached('k', 1000, load), cached('k', 1000, load)]);
    expect(load).toHaveBeenCalledTimes(1);
    expect(a).toEqual(b);
  });

  it('fresh skips the cache and refreshes it', async () => {
    let n = 0;
    const load = async () => ++n;
    expect(await cached('k', 1000, load)).toBe(1);
    expect(await cached('k', 1000, load, { fresh: true })).toBe(2);
    expect(await cached('k', 1000, load)).toBe(2);
  });

  it('invalidate forgets matching keys only', async () => {
    const a = vi.fn(async () => 'a');
    const b = vi.fn(async () => 'b');
    await cached('cases:1', 1000, a);
    await cached('witnesses:1', 1000, b);
    invalidate('cases:');
    await cached('cases:1', 1000, a);
    await cached('witnesses:1', 1000, b);
    expect(a).toHaveBeenCalledTimes(2);
    expect(b).toHaveBeenCalledTimes(1);
  });

  it('callers get their own copy, so changing it cannot change the cache', async () => {
    const first = await cached('k', 1000, async () => [{ id: 1 }]);
    first.push({ id: 2 });
    first[0].id = 99;
    expect(await cached('k', 1000, async () => [])).toEqual([{ id: 1 }]);
  });

  it('does not cache a failed load', async () => {
    const load = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce('ok');
    await expect(cached('k', 1000, load)).rejects.toThrow('offline');
    expect(await cached('k', 1000, load)).toBe('ok');
  });
});
