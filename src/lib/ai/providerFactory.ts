/**
 * AI Provider Factory
 * Creates and manages AI provider instances
 */

import { getAIConfig, getActiveProviderConfig } from './config';
import { GeminiProvider } from './providers/gemini';
import { OpenAIProvider } from './providers/openai';
import { VoiceProvider } from './providers/voice';
import type { IAIProvider, AIProvider } from './types';

let activeProvider: IAIProvider | null = null;

/**
 * Get or create the active AI provider
 */
export function getAIProvider(): IAIProvider | null {
  if (activeProvider && activeProvider.isAvailable()) {
    return activeProvider;
  }

  const config = getActiveProviderConfig();
  if (!config) {
    return null;
  }

  // Create provider based on type
  switch (config.provider) {
    case 'gemini':
      activeProvider = new GeminiProvider(config);
      break;
    case 'openai':
      activeProvider = new OpenAIProvider(config);
      break;
    case 'voice':
      activeProvider = new VoiceProvider(config);
      break;
    case 'anthropic':
      // TODO: Implement Anthropic provider
      console.warn('Anthropic provider not yet implemented');
      return null;
    case 'custom':
      // TODO: Implement custom provider
      console.warn('Custom provider not yet implemented');
      return null;
    default:
      console.warn(`Unknown provider: ${config.provider}`);
      return null;
  }

  return activeProvider;
}

/**
 * Force refresh the provider (useful when config changes)
 */
export function refreshAIProvider(): void {
  activeProvider = null;
  getAIProvider();
}

/**
 * Get provider by name (for testing or specific use cases)
 */
export function getProviderByName(providerName: AIProvider): IAIProvider | null {
  const config = getAIConfig();
  const providerConfig = config.providers[providerName];
  
  if (!providerConfig || !providerConfig.apiKey) {
    return null;
  }

  switch (providerName) {
    case 'gemini':
      return new GeminiProvider(providerConfig);
    case 'openai':
      return new OpenAIProvider(providerConfig);
    case 'voice':
      return new VoiceProvider(providerConfig);
    default:
      return null;
  }
}





