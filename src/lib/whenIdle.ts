/** Runs `cb` when the browser is idle (or after `fallbackMs` where it has no idle callback). Used for background prefetching. */
export function whenIdle(cb: () => void, timeoutMs = 4000, fallbackMs = 2000): void {
  const idle = (window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
  if (idle) idle.call(window, cb, { timeout: timeoutMs });
  else setTimeout(cb, fallbackMs);
}
