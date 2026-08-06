/**
 * Supabase Edge Provider
 * Routes AI requests through the ai-generate Supabase edge function instead
 * of calling the model provider (Gemini) directly from the browser. This
 * keeps the API key server-side only — it is never present in the client
 * bundle.
 */

import { BaseAIProvider } from './base';
import { supabase } from '@/integrations/supabase/client';
import type { AIRequest, AIResponse, AIProvider } from '../types';

export class SupabaseEdgeProvider extends BaseAIProvider {
  name: AIProvider = 'gemini';
  modelType = 'text' as const;

  isAvailable(): boolean {
    // Always available: the key lives on the server (Supabase secret),
    // not in client config, so there is nothing to check locally.
    return true;
  }

  async generate(request: AIRequest): Promise<AIResponse> {
    this.validateRequest(request);

    const { data, error } = await supabase.functions.invoke('ai-generate', {
      body: {
        system: request.system,
        user: request.user,
        maxTokens: request.maxTokens ?? 2048,
        temperature: request.temperature ?? 0.7,
        responseFormat: request.responseFormat,
      },
    });

    if (error) {
      // supabase-js gives a generic "non-2xx status code" message here and
      // does NOT automatically parse the JSON body we returned. The actual
      // error detail is on error.context, which is the raw Response object.
      let detail = error.message || 'Unknown edge function error';
      try {
        const context = (error as any).context;
        if (context && typeof context.json === 'function') {
          const body = await context.json();
          if (body?.error) detail = body.error;
        }
      } catch {
        // context wasn't valid JSON or already consumed — fall back to error.message
      }
      this.handleError(new Error(detail), 'generate (edge function)');
    }

    if (!data || data.error) {
      this.handleError(new Error(data?.error || 'Unknown edge function error'), 'generate (edge function)');
    }

    return {
      text: (data.text ?? data.content ?? '').trim(),
      metadata: data.metadata,
    };
  }

  getAvailableModels(): string[] {
    // Fallback chain is handled server-side in the edge function.
    return ['gemini-3.1-flash-lite', 'gemini-2.5-flash'];
  }
}
