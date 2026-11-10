import { afterEach, describe, expect, it, vi } from 'vitest';
import { whenIdle } from './whenIdle';

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('whenIdle', () => {
  it('waits for the browser to be idle', () => {
    const queued: (() => void)[] = [];
    vi.stubGlobal('requestIdleCallback', (cb: () => void) => { queued.push(cb); return 1; });
    const cb = vi.fn();
    whenIdle(cb);
    expect(cb).not.toHaveBeenCalled();
    queued[0]();
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('falls back to a short timer where there is no idle callback', () => {
    vi.useFakeTimers();
    vi.stubGlobal('requestIdleCallback', undefined);
    const cb = vi.fn();
    whenIdle(cb);
    vi.advanceTimersByTime(1999);
    expect(cb).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(cb).toHaveBeenCalledTimes(1);
  });
});
