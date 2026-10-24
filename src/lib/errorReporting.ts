import { supabase } from '@/integrations/supabase/client';

/**
 * Lightweight error monitoring: crashes and unhandled errors are logged to the client_errors table
 * (admins read it in Supabase). Reporting never throws, never blocks the game, and is de-duplicated
 * so one loop cannot flood the log.
 */
const seen = new Set<string>();
const MAX_PER_SESSION = 10;
let sent = 0;

export function describeError(err: unknown): { message: string; stack?: string } {
  if (err instanceof Error) return { message: err.message || err.name, stack: err.stack };
  if (typeof err === 'string') return { message: err };
  try {
    return { message: JSON.stringify(err) ?? String(err) };
  } catch {
    return { message: String(err) };
  }
}

export async function reportError(err: unknown, context = 'unhandled'): Promise<boolean> {
  try {
    const { message, stack } = describeError(err);
    if (!message) return false;
    const key = `${context}:${message}`;
    if (seen.has(key) || sent >= MAX_PER_SESSION) return false;
    seen.add(key);
    sent += 1;
    const { error } = await supabase.rpc('report_client_error' as never, {
      p_message: message,
      p_stack: stack ?? null,
      p_context: context,
      p_url: typeof location !== 'undefined' ? location.pathname : null,
      p_user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
    } as never);
    return !error;
  } catch {
    return false;
  }
}

let installed = false;
/** Call once at startup. */
export function installGlobalErrorReporting() {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  window.addEventListener('error', (e) => {
    // Ignore benign browser noise (e.g. ResizeObserver loop notices, cross-origin "Script error.")
    if (!e.error && /ResizeObserver|Script error/i.test(e.message)) return;
    void reportError(e.error ?? e.message, 'window.error');
  });
  window.addEventListener('unhandledrejection', (e) => void reportError(e.reason, 'unhandledrejection'));
}

/** Test helper. */
export function _resetErrorReportingForTests() {
  seen.clear();
  sent = 0;
  installed = false;
}
