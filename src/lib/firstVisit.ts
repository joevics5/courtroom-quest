// "Show this once" flags. Kept in localStorage per user, so it also works offline and needs no database change.
// Storage can be blocked (private mode, strict settings); then we fail quiet: show the help, never crash.
const key = (feature: string, userId: string) => `cq:seen:${feature}:${userId}`;

export function hasSeen(feature: string, userId: string): boolean {
  try {
    return window.localStorage.getItem(key(feature, userId)) === '1';
  } catch {
    return false;
  }
}

export function markSeen(feature: string, userId: string): void {
  try {
    window.localStorage.setItem(key(feature, userId), '1');
  } catch {
    /* ignore */
  }
}
