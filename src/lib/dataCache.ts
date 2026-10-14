/**
 * A small in-memory cache for data that rarely changes (the preset case list, a case's
 * details, its witnesses), so moving between screens doesn't re-ask Supabase every time.
 *
 * - Entries expire after `ttlMs`.
 * - Two screens asking at once share one request.
 * - Anything that edits the data calls `invalidate(prefix)`, so editors never see stale rows.
 * - Cleared on sign-in/sign-out, since what a player may read depends on who they are.
 *
 * Evidence is deliberately NOT cached: discovering evidence changes it during play.
 */
const store = new Map<string, { at: number; json: string }>();
const inflight = new Map<string, Promise<string>>();

export const CASE_DATA_TTL_MS = 5 * 60 * 1000;

export async function cached<T>(key: string, ttlMs: number, load: () => Promise<T>, opts: { fresh?: boolean } = {}): Promise<T> {
  if (!opts.fresh) {
    const hit = store.get(key);
    if (hit && Date.now() - hit.at < ttlMs) return JSON.parse(hit.json) as T;
    const pending = inflight.get(key);
    if (pending) return JSON.parse(await pending) as T;
  }
  const run = (async () => {
    const json = JSON.stringify(await load());
    store.set(key, { at: Date.now(), json });
    return json;
  })();
  inflight.set(key, run);
  try {
    // Callers get their own copy, so changing it can never alter what is cached.
    return JSON.parse(await run) as T;
  } finally {
    if (inflight.get(key) === run) inflight.delete(key);
  }
}

/** Forget cached entries whose key starts with `prefix` (everything when omitted). */
export function invalidate(prefix = ''): void {
  for (const key of Array.from(store.keys())) if (key.startsWith(prefix)) store.delete(key);
  for (const key of Array.from(inflight.keys())) if (key.startsWith(prefix)) inflight.delete(key);
}
