/**
 * Voice AI Provider
 * Interface for voice-based AI models (future implementation)
 */

import { BaseAIProvider } from './base';
import type { AIRequest, AIResponse, AIProvider } from '../types';

export class VoiceProvider extends BaseAIProvider {
  name: AIProvider = 'voice';
  modelType = 'voice' as const;

  constructor(config: any) {
    super(config);
  }

  isAvailable(): boolean {
    // Voice provider availability depends on implementation
    // For now, return false as it's not yet implemented
    return false;
  }

  async generate(request: AIRequest): Promise<AIResponse> {
    this.validateRequest(request);
    
    // TODO: Implement voice model integration
    // This would typically:
    // 1. Send text to voice model API
    // 2. Receive audio response
    // 3. Optionally transcribe back to text
    
    throw new Error('Voice provider not yet implemented. This is a placeholder for future voice model integration.');
  }

  getAvailableModels(): string[] {
    return [this.config.model || 'default'];
  }
}





