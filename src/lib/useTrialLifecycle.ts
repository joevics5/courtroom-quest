import { useEffect, useRef } from 'react';

interface Options<T> {
  /** True while a trial is actually running (not in the pre-trial script, practice or verdict). */
  active: boolean;
  /** What to save about the trial right now. Read fresh at the moment the player leaves. */
  buildSave: () => T;
  /** Save it (e.g. to the database). */
  persist: (payload: T) => void;
  /** Stop everything that runs on its own: timers, countdowns, voice. */
  teardown: () => void;
}

/**
 * Makes a trial stop when the player leaves its screen.
 *
 * On leaving (going back, opening another screen, closing the tab) it stops all background work,
 * saves a paused snapshot, and flips `aliveRef` to false so anything still in flight (an AI turn,
 * a countdown) can see the player is gone and do nothing further.
 */
export function useTrialLifecycle<T>({ active, buildSave, persist, teardown }: Options<T>) {
  const aliveRef = useRef(true);
  const latest = useRef({ active, buildSave, persist, teardown });
  latest.current = { active, buildSave, persist, teardown };

  useEffect(() => {
    aliveRef.current = true;

    const saveNow = () => {
      const cur = latest.current;
      if (cur.active) cur.persist(cur.buildSave());
    };

    window.addEventListener('pagehide', saveNow);
    return () => {
      window.removeEventListener('pagehide', saveNow);
      aliveRef.current = false;
      latest.current.teardown();
      saveNow();
    };
  }, []);

  return aliveRef;
}
