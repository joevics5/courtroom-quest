import { describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useTrialLifecycle } from './useTrialLifecycle';

const setup = (active: boolean) => {
  const persist = vi.fn();
  const teardown = vi.fn();
  const buildSave = vi.fn(() => ({ phase: 9, left: 140 }));
  const hook = renderHook(({ active }) => useTrialLifecycle({ active, buildSave, persist, teardown }), { initialProps: { active } });
  return { persist, teardown, buildSave, ...hook };
};

describe('useTrialLifecycle', () => {
  it('while the trial screen is open nothing is saved or stopped', () => {
    const { persist, teardown, result } = setup(true);
    expect(persist).not.toHaveBeenCalled();
    expect(teardown).not.toHaveBeenCalled();
    expect(result.current.current).toBe(true);
  });

  it('leaving the screen stops background work, saves a snapshot, and marks the player as gone', () => {
    const { persist, teardown, result, unmount } = setup(true);
    const alive = result.current;
    unmount();
    expect(teardown).toHaveBeenCalledTimes(1);
    expect(persist).toHaveBeenCalledWith({ phase: 9, left: 140 });
    // anything still in flight (an AI turn, the auto-rest countdown) checks this and stops
    expect(alive.current).toBe(false);
  });

  it('still stops background work, but saves nothing, when no trial was running (pre-trial, practice, verdict)', () => {
    const { persist, teardown, unmount } = setup(false);
    unmount();
    expect(teardown).toHaveBeenCalledTimes(1);
    expect(persist).not.toHaveBeenCalled();
  });

  it('saves the latest state, not the state from when the screen opened', () => {
    const persist = vi.fn();
    let left = 300;
    const { rerender, unmount } = renderHook(({ n }) => useTrialLifecycle({ active: true, buildSave: () => ({ left, n }), persist, teardown: () => {} }), { initialProps: { n: 1 } });
    left = 42;
    rerender({ n: 2 });
    unmount();
    expect(persist).toHaveBeenCalledWith({ left: 42, n: 2 });
  });

  it('closing the tab saves too', () => {
    const { persist } = setup(true);
    window.dispatchEvent(new Event('pagehide'));
    expect(persist).toHaveBeenCalledWith({ phase: 9, left: 140 });
  });

  it('after the screen is gone, a closing tab no longer saves again', () => {
    const { persist, unmount } = setup(true);
    unmount();
    persist.mockClear();
    window.dispatchEvent(new Event('pagehide'));
    expect(persist).not.toHaveBeenCalled();
  });
});
