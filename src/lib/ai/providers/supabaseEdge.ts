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
      this.handleError(error, 'generate (edge function)');
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
    return ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-2.5-flash-lite'];
  }
}
