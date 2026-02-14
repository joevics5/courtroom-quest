/**
 * Base AI Provider
 * Abstract base class for all AI provider implementations
 */

import type { IAIProvider, AIRequest, AIResponse, AIProvider, AIModelType } from '../types';

export abstract class BaseAIProvider implements IAIProvider {
  abstract name: AIProvider;
  abstract modelType: AIModelType;
  
  protected config: any;
  
  constructor(config: any) {
    this.config = config;
  }
  
  abstract isAvailable(): boolean;
  abstract generate(request: AIRequest): Promise<AIResponse>;
  abstract getAvailableModels(): string[];
  
  /**
   * Validate request before processing
   */
  protected validateRequest(request: AIRequest): void {
    if (!request.system && !request.user) {
      throw new Error('AI request must have at least system or user content');
    }
  }
  
  /**
   * Handle errors consistently
   */
  protected handleError(error: any, context: string): never {
    console.error(`[${this.name}] Error in ${context}:`, error);
    throw new Error(`${this.name} provider error: ${error.message || 'Unknown error'}`);
  }
}





