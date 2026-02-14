/**
 * AI Module Exports
 * Central export point for all AI functionality
 */

// Core types and interfaces
export * from './types';

// Configuration
export * from './config';

// Provider factory
export * from './providerFactory';

// Unified trial AI service (all agents: judge, prosecution, witness, verdict)
export * from './trialAI';

// Provider implementations (for advanced usage)
export { GeminiProvider } from './providers/gemini';
export { OpenAIProvider } from './providers/openai';
export { VoiceProvider } from './providers/voice';





