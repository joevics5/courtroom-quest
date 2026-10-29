/**
 * Private challenge links.
 *
 * A private challenge is not listed anywhere. The creator shares a link, and anyone who opens it
 * can accept the challenge: no email addresses involved. The link carries the challenge's id,
 * which is an unguessable uuid, so the link itself is the invitation.
 *
 *   https://courtroomquest.app/?challenge=<uuid>
 *
 * If the person opening it is not signed in yet, the id is remembered while they sign in (or play
 * as a guest) and the accept screen is shown right after.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PENDING_KEY = 'cq_pending_challenge';
/** A remembered link stops being offered after this long (a link left over from days ago). */
const PENDING_TTL_MS = 3 * 24 * 60 * 60 * 1000;

export function isChallengeId(value: unknown): value is string {
  return typeof value === 'string' && UUID.test(value);
}

/** The shareable link for a challenge. */
export function buildChallengeLink(challengeId: string, origin: string): string {
  return `${origin.replace(/\/+$/, '')}/?challenge=${challengeId}`;
}

/** The challenge id in a URL's query string (`?challenge=...`), or null. */
export function readChallengeIdFromSearch(search: string): string | null {
  try {
    const id = new URLSearchParams(search).get('challenge');
    return isChallengeId(id) ? id : null;
  } catch {
    return null;
  }
}

/** The same URL with the `challenge` parameter removed (so a refresh doesn't reopen the screen). */
export function stripChallengeParam(search: string): string {
  const params = new URLSearchParams(search);
  params.delete('challenge');
  const rest = params.toString();
  return rest ? `?${rest}` : '';
}

export function rememberPendingChallenge(id: string, now: number = Date.now()): void {
  try {
    window.localStorage.setItem(PENDING_KEY, JSON.stringify({ id, at: now }));
  } catch {
    /* private mode: the link just won't survive a reload */
  }
}

export function readPendingChallenge(now: number = Date.now()): string | null {
  try {
    const raw = window.localStorage.getItem(PENDING_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { id?: unknown; at?: unknown };
    if (!isChallengeId(parsed.id) || typeof parsed.at !== 'number' || now - parsed.at > PENDING_TTL_MS) {
      window.localStorage.removeItem(PENDING_KEY);
      return null;
    }
    return parsed.id;
  } catch {
    return null;
  }
}

export function clearPendingChallenge(): void {
  try {
    window.localStorage.removeItem(PENDING_KEY);
  } catch {
    /* nothing to clear */
  }
}

/**
 * Called once when the app starts: picks up a challenge link from the address bar (remembering it and
 * cleaning the address) or, failing that, one remembered from before sign-in.
 */
export function captureChallengeLink(): string | null {
  if (typeof window === 'undefined') return null;
  const fromUrl = readChallengeIdFromSearch(window.location.search);
  if (fromUrl) {
    rememberPendingChallenge(fromUrl);
    try {
      const search = stripChallengeParam(window.location.search);
      window.history.replaceState(null, '', `${window.location.pathname}${search}${window.location.hash}`);
    } catch {
      /* the address stays as it is */
    }
    return fromUrl;
  }
  return readPendingChallenge();
}

/** Text to send along with the link. */
export function challengeShareText(caseTitle: string | null | undefined, creatorRole: 'defense' | 'prosecution'): string {
  const you = creatorRole === 'defense' ? 'prosecution' : 'defense';
  const title = caseTitle ? ` "${caseTitle}"` : '';
  return `I challenge you in Courtroom Quest${title}! You'd play the ${you}. Accept here:`;
}
