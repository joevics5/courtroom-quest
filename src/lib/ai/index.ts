/**
 * AI Module Exports
 * Central export point for all AI functionality
 */

// Core types and interfaces
export * from './types';

// Provider factory
export * from './providerFactory';

// Unified trial AI service (all agents: judge, prosecution, witness, verdict)
export * from './trialAI';

// Provider implementations (for advanced usage)
export { SupabaseEdgeProvider } from './providers/supabaseEdge';
export { OpenAIProvider } from './providers/openai';
export { VoiceProvider } from './providers/voice';





