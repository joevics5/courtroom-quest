# AI Provider System

Model-agnostic AI system supporting multiple providers (text and voice).

## Architecture

```
src/lib/ai/
├── types.ts           # Core types and interfaces
├── config.ts          # Configuration management
├── providerFactory.ts # Provider creation and management
├── trialAI.ts         # Unified trial AI service
├── providers/
│   ├── base.ts        # Base provider class
│   ├── gemini.ts      # Gemini implementation
│   ├── openai.ts      # OpenAI implementation
│   └── voice.ts       # Voice model interface (future)
└── index.ts           # Public exports
```

## Configuration

### Environment Variables

```env
# Primary Provider Selection
VITE_AI_PROVIDER=gemini  # Options: gemini, openai, anthropic, voice, custom

# Gemini Configuration
VITE_GEMINI_API_KEY=your_api_key_here
VITE_GEMINI_MODEL=gemini-2.5-flash

# OpenAI Configuration
VITE_OPENAI_API_KEY=your_api_key_here
VITE_OPENAI_MODEL=gpt-4o-mini
VITE_OPENAI_BASE_URL=https://api.openai.com/v1

# Anthropic Configuration (future)
VITE_ANTHROPIC_API_KEY=your_api_key_here
VITE_ANTHROPIC_MODEL=claude-3-5-sonnet-20241022

# Voice Model Configuration (future)
VITE_VOICE_API_KEY=your_api_key_here
VITE_VOICE_MODEL=default
VITE_VOICE_BASE_URL=https://api.voice-provider.com

# Custom Provider Configuration
VITE_CUSTOM_AI_API_KEY=your_api_key_here
VITE_CUSTOM_AI_MODEL=your_model_name
VITE_CUSTOM_AI_BASE_URL=https://api.custom-provider.com
```

### Switching Providers

To switch providers, simply change `VITE_AI_PROVIDER` in your `.env` file:

```env
# Use Gemini (default)
VITE_AI_PROVIDER=gemini
VITE_GEMINI_API_KEY=your_key

# Switch to OpenAI
VITE_AI_PROVIDER=openai
VITE_OPENAI_API_KEY=your_key

# Switch to Voice (when implemented)
VITE_AI_PROVIDER=voice
VITE_VOICE_API_KEY=your_key
```

## Usage

### Basic Usage (Unified Service)

```typescript
import {
  generateJudgeOpeningRequest,
  generateProsecutionAction,
  generateWitnessResponse,
  generateJudgeObjectionRuling
} from '@/lib/ai/trialAI';

// Judge AI
const judgeRequest = await generateJudgeOpeningRequest({
  caseTitle: 'State v. Defendant',
  judgeName: 'Justice Smith',
  prosecutorName: 'DA Johnson',
  phase: 'opening_request'
});

// Prosecution AI
const action = await generateProsecutionAction({
  role: 'prosecution',
  phase: 'direct_examination',
  // ... other context
});

// Witness AI
const response = await generateWitnessResponse({
  witness: witnessData,
  question: 'Where were you on the night of July 4th?',
  previousInteractions: []
});

// Judge Objection Ruling
const ruling = await generateJudgeObjectionRuling({
  caseTitle: 'State v. Defendant',
  judgeName: 'Justice Smith',
  prosecutorName: 'DA Johnson',
  phase: 'objection_ruling',
  objectionContext: {
    objection_by: 'defense',
    objection_reason: 'Leading question',
    questioned_statement: 'Isn\'t it true that...',
    recent_transcript: '...'
  }
});
```

### Advanced Usage (Direct Provider Access)

```typescript
import { getAIProvider, getProviderByName } from '@/lib/ai/providerFactory';
import type { AIRequest } from '@/lib/ai/types';

// Get active provider
const provider = getAIProvider();
if (provider) {
  const response = await provider.generate({
    system: 'You are a helpful assistant.',
    user: 'Hello!',
    temperature: 0.7
  });
}

// Get specific provider
const geminiProvider = getProviderByName('gemini');
```

## Adding New Providers

1. Create provider class in `src/lib/ai/providers/`:

```typescript
import { BaseAIProvider } from './base';
import type { AIRequest, AIResponse, AIProvider } from '../types';

export class MyCustomProvider extends BaseAIProvider {
  name: AIProvider = 'custom';
  modelType = 'text' as const;

  constructor(config: any) {
    super(config);
  }

  isAvailable(): boolean {
    return !!this.config.apiKey;
  }

  async generate(request: AIRequest): Promise<AIResponse> {
    this.validateRequest(request);
    // Implement your provider logic
    return { text: 'response' };
  }

  getAvailableModels(): string[] {
    return [this.config.model];
  }
}
```

2. Register in `providerFactory.ts`:

```typescript
case 'custom':
  activeProvider = new MyCustomProvider(config);
  break;
```

3. Add configuration in `config.ts`:

```typescript
custom: {
  provider: 'custom',
  modelType: 'text',
  apiKey: import.meta.env.VITE_CUSTOM_AI_API_KEY,
  model: import.meta.env.VITE_CUSTOM_AI_MODEL,
  baseUrl: import.meta.env.VITE_CUSTOM_AI_BASE_URL
}
```

## Features

- ✅ Model-agnostic architecture
- ✅ Easy provider switching via environment variables
- ✅ Automatic fallback to configured providers
- ✅ Support for text and voice models (voice placeholder ready)
- ✅ JSON response parsing for structured outputs
- ✅ Consistent error handling
- ✅ Type-safe interfaces
- ✅ Provider-specific configuration support

## Migration from Old System

The old system (`prosecutionAI.ts`, `witnessAI.ts`, `judgeAI.ts`) can be gradually migrated:

1. Old functions still work (they can be updated to use new system internally)
2. New code should use `trialAI.ts` functions
3. Eventually remove old files once migration is complete

## Future Enhancements

- [ ] Anthropic Claude provider
- [ ] Voice model integration
- [ ] Streaming responses
- [ ] Response caching
- [ ] Rate limiting
- [ ] Cost tracking
- [ ] Multi-provider fallback chains





