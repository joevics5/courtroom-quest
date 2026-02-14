/**
 * AI Provider Types
 * Defines the interface for all AI providers (text and voice)
 */

export type AIProvider = 'gemini' | 'openai' | 'anthropic' | 'voice' | 'custom';
export type AIModelType = 'text' | 'voice';

export interface AIRequest {
  system: string;
  user: string;
  maxTokens?: number;
  temperature?: number;
  responseFormat?: 'text' | 'json';
}

export interface AIResponse {
  text: string;
  audioUrl?: string; // For voice models
  metadata?: Record<string, any>;
}

export interface AIProviderConfig {
  provider: AIProvider;
  model?: string;
  apiKey?: string;
  baseUrl?: string;
  modelType?: AIModelType;
  [key: string]: any; // Allow provider-specific config
}

/**
 * Base interface for all AI providers
 */
export interface IAIProvider {
  /**
   * Provider name
   */
  name: AIProvider;
  
  /**
   * Model type (text or voice)
   */
  modelType: AIModelType;
  
  /**
   * Check if provider is available/configured
   */
  isAvailable(): boolean;
  
  /**
   * Generate a response
   */
  generate(request: AIRequest): Promise<AIResponse>;
  
  /**
   * Get available models for this provider
   */
  getAvailableModels(): string[];
}





