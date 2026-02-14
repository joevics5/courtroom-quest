/**
 * OpenAI Provider
 * Implementation for OpenAI models (GPT-4, GPT-3.5, etc.)
 */

import { BaseAIProvider } from './base';
import type { AIRequest, AIResponse, AIProvider } from '../types';

export class OpenAIProvider extends BaseAIProvider {
  name: AIProvider = 'openai';
  modelType = 'text' as const;
  private baseUrl: string;

  constructor(config: any) {
    super(config);
    this.baseUrl = config.baseUrl || 'https://api.openai.com/v1';
  }

  isAvailable(): boolean {
    return !!this.config.apiKey;
  }

  async generate(request: AIRequest): Promise<AIResponse> {
    this.validateRequest(request);
    
    if (!this.config.apiKey) {
      throw new Error('OpenAI API key not configured');
    }

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({
          model: this.config.model || 'gpt-4o-mini',
          messages: [
            ...(request.system ? [{ role: 'system', content: request.system }] : []),
            { role: 'user', content: request.user || 'Continue' }
          ],
          max_tokens: request.maxTokens ?? 2048,
          temperature: request.temperature ?? 0.7,
          ...(request.responseFormat === 'json' ? { response_format: { type: 'json_object' } } : {})
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`OpenAI API error: ${error}`);
      }

      const data = await response.json();
      const text = data.choices[0]?.message?.content || '';

      return {
        text: text.trim(),
        metadata: { model: this.config.model, usage: data.usage }
      };
    } catch (error: any) {
      this.handleError(error, 'generate');
    }
  }

  getAvailableModels(): string[] {
    return [this.config.model || 'gpt-4o-mini'];
  }
}





