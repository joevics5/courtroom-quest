/**
 * Gemini AI Provider
 * Implementation for Google Gemini models
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { BaseAIProvider } from './base';
import type { AIRequest, AIResponse, AIProvider } from '../types';

export class GeminiProvider extends BaseAIProvider {
  name: AIProvider = 'gemini';
  modelType = 'text' as const;
  private client: GoogleGenerativeAI | null = null;
  private fallbackModels: string[] = [];

  constructor(config: any) {
    super(config);
    this.fallbackModels = config.fallbackModels || ['gemini-2.0-flash', 'gemini-2.5-flash-lite'];
    
    if (config.apiKey) {
      this.client = new GoogleGenerativeAI(config.apiKey);
    }
  }

  isAvailable(): boolean {
    return this.client !== null && !!this.config.apiKey;
  }

  async generate(request: AIRequest): Promise<AIResponse> {
    this.validateRequest(request);
    
    if (!this.client) {
      throw new Error('Gemini client not initialized. Check API key.');
    }

    const models = [this.config.model, ...this.fallbackModels].filter(Boolean) as string[];
    
    for (const modelName of models) {
      try {
        console.log(`[Gemini] Attempting to use model: ${modelName}`);
        const model = this.client.getGenerativeModel({ 
          model: modelName,
          generationConfig: {
            temperature: request.temperature ?? 0.7,
            maxOutputTokens: request.maxTokens ?? 2048,
          }
        });

        // Build prompt
        const prompt = request.system 
          ? `${request.system}\n\n${request.user || 'Continue'}`
          : request.user || '';

        const result = await model.generateContent(prompt);
        const text = result.response.text();
        
        console.log(`[Gemini] Successfully got response from ${modelName}`);
        
        // Parse JSON if requested
        if (request.responseFormat === 'json') {
          try {
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              return {
                text: jsonMatch[0],
                metadata: { model: modelName, parsed: true }
              };
            }
          } catch (e) {
            console.warn('[Gemini] Failed to parse JSON response, returning raw text');
          }
        }
        
        return {
          text: text.trim(),
          metadata: { model: modelName }
        };
      } catch (error: any) {
        console.warn(`[Gemini] Model ${modelName} failed: ${error.message}`);
        if (modelName === models[models.length - 1]) {
          // Last model failed
          this.handleError(error, `generate (all models failed)`);
        }
        // Try next model
        continue;
      }
    }
    
    throw new Error('All Gemini models failed');
  }

  getAvailableModels(): string[] {
    return [this.config.model, ...this.fallbackModels].filter(Boolean) as string[];
  }
}





