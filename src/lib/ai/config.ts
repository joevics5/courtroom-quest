/**
 * AI Configuration Manager
 * Centralized configuration for AI providers and models
 */

import type { AIProvider, AIProviderConfig, AIModelType } from './types';

export interface AIConfig {
  defaultProvider: AIProvider;
  providers: Record<AIProvider, AIProviderConfig>;
  fallbackProvider?: AIProvider;
}

/**
 * Get AI configuration from environment variables
 */
export function getAIConfig(): AIConfig {
  // Get provider from env, default to gemini
  const defaultProvider = (import.meta.env.VITE_AI_PROVIDER || 'gemini') as AIProvider;
  
  const config: AIConfig = {
    defaultProvider,
    providers: {
      gemini: {
        provider: 'gemini',
        modelType: 'text',
        apiKey: import.meta.env.VITE_GEMINI_API_KEY,
        model: import.meta.env.VITE_GEMINI_MODEL || 'gemini-2.5-flash',
        fallbackModels: ['gemini-2.0-flash', 'gemini-2.5-flash-lite']
      },
      openai: {
        provider: 'openai',
        modelType: 'text',
        apiKey: import.meta.env.VITE_OPENAI_API_KEY,
        model: import.meta.env.VITE_OPENAI_MODEL || 'gpt-4o-mini',
        baseUrl: import.meta.env.VITE_OPENAI_BASE_URL || 'https://api.openai.com/v1'
      },
      anthropic: {
        provider: 'anthropic',
        modelType: 'text',
        apiKey: import.meta.env.VITE_ANTHROPIC_API_KEY,
        model: import.meta.env.VITE_ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022',
        baseUrl: import.meta.env.VITE_ANTHROPIC_BASE_URL || 'https://api.anthropic.com/v1'
      },
      voice: {
        provider: 'voice',
        modelType: 'voice',
        apiKey: import.meta.env.VITE_VOICE_API_KEY,
        model: import.meta.env.VITE_VOICE_MODEL || 'default',
        baseUrl: import.meta.env.VITE_VOICE_BASE_URL
      },
      custom: {
        provider: 'custom',
        modelType: 'text',
        apiKey: import.meta.env.VITE_CUSTOM_AI_API_KEY,
        model: import.meta.env.VITE_CUSTOM_AI_MODEL,
        baseUrl: import.meta.env.VITE_CUSTOM_AI_BASE_URL
      }
    },
    fallbackProvider: 'gemini' // Always fallback to gemini if available
  };

  return config;
}

/**
 * Get the active provider configuration
 */
export function getActiveProviderConfig(): AIProviderConfig | null {
  const config = getAIConfig();
  const providerConfig = config.providers[config.defaultProvider];
  
  // Check if provider is configured
  if (!providerConfig.apiKey) {
    // Try fallback
    if (config.fallbackProvider) {
      const fallback = config.providers[config.fallbackProvider];
      if (fallback.apiKey) {
        console.warn(`Primary provider ${config.defaultProvider} not configured, using fallback ${config.fallbackProvider}`);
        return fallback;
      }
    }
    console.warn(`No AI provider configured. Please set API keys in environment variables.`);
    return null;
  }
  
  return providerConfig;
}

/**
 * Check if a provider is available
 */
export function isProviderAvailable(provider: AIProvider): boolean {
  const config = getAIConfig();
  const providerConfig = config.providers[provider];
  return !!providerConfig.apiKey;
}





