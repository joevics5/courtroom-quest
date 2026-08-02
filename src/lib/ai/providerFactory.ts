/**
 * AI Provider Factory
 * Creates and manages the active AI provider instance.
 *
 * Gemini is the only provider in use. It is always routed through the
 * ai-generate Supabase edge function — the Gemini API key lives server-side
 * as a Supabase secret and is never present in client (VITE_) env vars or
 * the browser bundle. See src/lib/ai/README.md and
 * supabase/functions/ai-generate/index.ts.
 */

import { SupabaseEdgeProvider } from './providers/supabaseEdge';
import type { IAIProvider, AIProvider } from './types';

let activeProvider: IAIProvider | null = null;

/**
 * Get or create the active AI provider.
 */
export function getAIProvider(): IAIProvider | null {
  if (!activeProvider) {
    activeProvider = new SupabaseEdgeProvider({});
  }
  return activeProvider;
}

/**
 * Force refresh the provider (useful when config changes).
 */
export function refreshAIProvider(): void {
  activeProvider = null;
  getAIProvider();
}

/**
 * Get provider by name. Only 'gemini' is currently implemented; it always
 * resolves to the Supabase edge provider regardless of name for
 * backwards-compat with existing call sites.
 */
export function getProviderByName(providerName: AIProvider): IAIProvider | null {
  if (providerName === 'gemini') {
    return new SupabaseEdgeProvider({});
  }
  return null;
}
